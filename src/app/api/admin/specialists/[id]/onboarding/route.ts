import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {OnboardingStatus, SpecialistContractStatus} from "@prisma/client"
import {audit} from "@/lib/audit"
import {notifySpecialistStep} from "@/lib/onboarding/notify-step"

const NEXT_STATUS: Record<string, OnboardingStatus> = {
    PENDING: "TEST_INVITED",
    TEST_INVITED: "INTERVIEW_INVITED",
    INTERVIEW_INVITED: "REGULATIONS",
    REGULATIONS: "CONTRACT",
}

const ALL_STEP_TYPES = ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"] as const

export async function PATCH(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const {action, comment} = await req.json() as {
        action?: "advance" | "reject" | "reject_no_education" | "reject_no_experience"
        comment?: string
    }

    const profile = await prisma.specialistProfile.findUnique({where: {userId: id}})
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const isRejectAction = action === "reject" || action === "reject_no_education" || action === "reject_no_experience"
    if (!action) {
        return NextResponse.json({error: "Некорректное действие"}, {status: 400})
    }

    if (
        !isRejectAction &&
        profile.onboardingStatus === "CONTRACT" &&
        profile.specialistContractStatus !== SpecialistContractStatus.SIGNED_BY_ADMIN
    ) {
        return NextResponse.json(
            {
                error:
                    "Сначала в карточке специалиста подтвердите подписание договора (кнопка после того, как дизайнер подписал в онбординге).",
            },
            {status: 409},
        )
    }

    const nextFromMap = NEXT_STATUS[profile.onboardingStatus]
    if (!isRejectAction && !nextFromMap && profile.onboardingStatus !== "CONTRACT") {
        return NextResponse.json({error: "Невозможно продвинуть из текущего статуса"}, {status: 409})
    }

    // Sequential guard: the step being completed must actually exist as PASSED or IN_PROGRESS
    // before admin can advance past it. PENDING → TEST_INVITED не требует FORM в БД: приглашение на тест
    // — действие админа после ручной проверки анкеты; FORM тогда помечается ниже как PASSED.
    if (!isRejectAction) {
        const REQUIRED_STEP: Record<string, string> = {
            TEST_INVITED: "TEST",
            // INTERVIEW_INVITED: интервью проводится через Zoom и подтверждается самим администратором
            REGULATIONS: "REGULATIONS",
        }
        const requiredStep = REQUIRED_STEP[profile.onboardingStatus]
        if (requiredStep) {
            const step = await prisma.onboardingStep.findFirst({
                where: {profileId: profile.id, type: requiredStep as never},
            })
            // REGULATIONS must be PASSED by the specialist (quiz completed); other steps allow IN_PROGRESS
            const allowInProgress = requiredStep !== "REGULATIONS"
            const ok = step && (step.status === "PASSED" || (allowInProgress && step.status === "IN_PROGRESS"))
            if (!ok) {
                return NextResponse.json(
                    {
                        error: requiredStep === "REGULATIONS"
                            ? "Нельзя подтвердить: специалист ещё не завершил тест регламентов"
                            : `Нельзя продвинуть: шаг «${requiredStep}» ещё не пройден специалистом`
                    },
                    {status: 409},
                )
            }
        }
    }

    // PENDING → TEST_INVITED: анкета принята админом; в данных онбординга фиксируем FORM как пройденный.
    if (!isRejectAction && profile.onboardingStatus === "PENDING" && nextFromMap === "TEST_INVITED") {
        const formStep = await prisma.onboardingStep.findFirst({
            where: {profileId: profile.id, type: "FORM"},
        })
        const adminNote = comment?.trim() || "Анкета принята администратором (приглашение на тест)"
        if (!formStep) {
            await prisma.onboardingStep.create({
                data: {profileId: profile.id, type: "FORM", status: "PASSED", comment: adminNote},
            })
        } else if (formStep.status !== "PASSED") {
            await prisma.onboardingStep.update({
                where: {id: formStep.id},
                data: {
                    status: "PASSED",
                    comment: comment !== undefined && comment !== "" ? comment : formStep.comment ?? adminNote,
                },
            })
        }
    }

    // For CONTRACT stage, we don't advance here — ACTIVE is set only after all steps are verified below.
    const newStatus: OnboardingStatus =
        isRejectAction ? "REJECTED" : (nextFromMap ?? profile.onboardingStatus)

    const updated = await prisma.specialistProfile.update({
        where: {userId: id},
        data: {onboardingStatus: newStatus},
        include: {user: true},
    })

    // Log a step record if advancing to a meaningful stage
    const STEP_MAP: Record<string, string> = {
        TEST_INVITED: "TEST",
        INTERVIEW_INVITED: "INTERVIEW",
        REGULATIONS: "REGULATIONS",
        CONTRACT: "CONTRACT",
    }
    const stepType = STEP_MAP[profile.onboardingStatus]
    if (stepType && !isRejectAction) {
        const existing = await prisma.onboardingStep.findFirst({
            where: {profileId: profile.id, type: stepType as never},
        })
        if (existing) {
            await prisma.onboardingStep.update({
                where: {id: existing.id},
                data: {
                    status: "PASSED",
                    // Тело запроса от админки обычно без comment — не затираем JSON с ответами квиза.
                    comment: comment !== undefined ? comment : existing.comment,
                },
            })
        } else {
            await prisma.onboardingStep.create({
                data: {profileId: profile.id, type: stepType as never, status: "PASSED", comment: comment ?? null},
            })
        }
    }

    // Auto-activate: ACTIVE only when ALL 5 steps are PASSED
    if (!isRejectAction) {
        const allSteps = await prisma.onboardingStep.findMany({where: {profileId: profile.id}})
        const passedTypes = new Set(allSteps.filter(s => s.status === "PASSED").map(s => s.type))
        // Backward-compat: if REGULATIONS quiz is passed, treat REGULATIONS_READ as passed.
        const has = (t: (typeof ALL_STEP_TYPES)[number]) => {
            if (t === "REGULATIONS_READ") return passedTypes.has("REGULATIONS_READ" as never) || passedTypes.has("REGULATIONS" as never)
            return passedTypes.has(t as never)
        }
        const allPassed = ALL_STEP_TYPES.every(has)
        if (allPassed && updated.onboardingStatus !== "ACTIVE") {
            await prisma.specialistProfile.update({
                where: {userId: id},
                data: {onboardingStatus: "ACTIVE"},
            })
            updated.onboardingStatus = "ACTIVE" as never
        }
    }

    // Шаг закрыт как раз тем действием, что мы обрабатываем: письмо идёт на КАЖДОЕ действие админа,
    // даже если он не оставил комментарий — дефолтный текст берём по исходному статусу.
    let emailComment = comment ?? undefined
    if (action === "advance" && profile.onboardingStatus === "PENDING") {
        emailComment = "Благодарим за анкету. Приглашаем пройти квалификационный тест NEXUS."
    }
    if (action === "advance" && profile.onboardingStatus === "TEST_INVITED") {
        emailComment = emailComment ?? "Квалификационный тест пройден. Приглашаем на интервью с командой NEXUS."
    }
    if (action === "advance" && profile.onboardingStatus === "INTERVIEW_INVITED") {
        emailComment = emailComment ?? "Интервью пройдено. Ознакомьтесь с регламентами платформы."
    }
    if (action === "advance" && profile.onboardingStatus === "REGULATIONS") {
        emailComment = emailComment ?? "Регламенты изучены. Переходим к подписанию договора."
    }
    if (action === "reject_no_education") {
        emailComment = "К сожалению, мы не можем предложить сотрудничество: требуется профильное образование в области дизайна интерьеров."
    }
    if (action === "reject_no_experience") {
        emailComment = "К сожалению, минимальный практический опыт в разработке дизайн-проектов должен составлять 8 лет."
    }
    // Автоактивация выше могла перевести профиль в ACTIVE — письмо должно сообщать реальный статус,
    // иначе последний шаг уходит дизайнеру как «CONTRACT».
    const finalStatus = updated.onboardingStatus as string
    const STATUS_URL: Record<string, string> = {
        TEST_INVITED: "/onboarding/test",
        INTERVIEW_INVITED: "/onboarding/interview",
        REGULATIONS: "/onboarding/regulations",
        CONTRACT: "/onboarding/contract",
        ACTIVE: "/work",
    }
    const STATUS_TITLE: Record<string, string> = {
        TEST_INVITED: "Приглашение на квалификационный тест",
        INTERVIEW_INVITED: "Приглашение на интервью",
        REGULATIONS: "Изучение регламентов",
        CONTRACT: "Подписание договора",
        ACTIVE: "Добро пожаловать на платформу!",
        REJECTED: "Заявка отклонена",
    }
    await notifySpecialistStep({
        userId: updated.userId,
        email: updated.user.email,
        status: finalStatus,
        title: STATUS_TITLE[finalStatus] ?? "Обновление статуса онбординга",
        message: emailComment ?? "Статус вашего онбординга изменён администратором.",
        url: STATUS_URL[finalStatus] ?? "/onboarding",
        extra: isRejectAction ? {reason: action} : undefined,
    })

    const dbUser = await prisma.user.findUnique({where: {email: user.email}, select: {id: true}})
    await audit(dbUser?.id ?? null, isRejectAction ? "specialist_rejected" : "specialist_advanced", "User", id, {
        onboardingStatus: {
            from: profile.onboardingStatus,
            to: newStatus
        }, action: {to: action}
    })

    return NextResponse.json({ok: true, status: newStatus})
}
