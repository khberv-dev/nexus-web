import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {notifySpecialistStep} from "@/lib/onboarding/notify-step"
import {getLevelBank, QUIZ_LEVEL_ORDER} from "@/lib/onboarding/levels/banks"
import {parseQuizLevelState} from "@/lib/onboarding/levels/state"
import type {QuizLevelCode, QuizLevelStateStored} from "@/lib/onboarding/levels/types"
import {levelByCode} from "@/lib/landing/specialist-level"

/**
 * Админ выставляет квалификационный уровень дизайнеру без сдачи теста.
 *
 * Уровни кумулятивные: назначение L3 означает пройденные L1–L3 — так же это читают
 * лендинг (highest passed) и сам квиз (активный уровень = первый непройденный).
 * Понижение уровня тоже допустимо: уровни выше назначенного снимаются.
 */
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: userId} = await params
    const body = await req.json().catch(() => ({})) as { level?: unknown; reason?: unknown }
    const level = typeof body.level === "string" ? body.level.toUpperCase() : ""
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : ""

    if (!QUIZ_LEVEL_ORDER.includes(level as QuizLevelCode)) {
        return NextResponse.json(
            {error: `Некорректный уровень. Допустимые: ${QUIZ_LEVEL_ORDER.join(", ")}`},
            {status: 400},
        )
    }
    const target = level as QuizLevelCode

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId},
        include: {steps: true, user: {select: {email: true, archivedAt: true}}},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})
    if (profile.user.archivedAt) return NextResponse.json({error: "Специалист в архиве"}, {status: 409})
    if (profile.onboardingStatus === "PENDING") {
        return NextResponse.json({error: "Сначала примите анкету — уровень назначается после этого"}, {status: 409})
    }
    if (profile.onboardingStatus === "REJECTED") {
        return NextResponse.json({error: "Кандидат отклонён — уровень назначить нельзя"}, {status: 409})
    }

    const dbAdmin = await prisma.user.findUnique({where: {email: admin.email}, select: {id: true}})

    const testStep = profile.steps.find((s) => s.type === "TEST")
    const prevState = parseQuizLevelState(testStep?.comment ?? null)
    const previousLevel = (() => {
        const passed = new Set<QuizLevelCode>(prevState?.passedLevels ?? [])
        for (let i = QUIZ_LEVEL_ORDER.length - 1; i >= 0; i--) {
            if (passed.has(QUIZ_LEVEL_ORDER[i])) return QUIZ_LEVEL_ORDER[i]
        }
        return null
    })()

    const targetIndex = QUIZ_LEVEL_ORDER.indexOf(target)
    const passedLevels = QUIZ_LEVEL_ORDER.slice(0, targetIndex + 1) as QuizLevelCode[]
    const allPassed = passedLevels.length === QUIZ_LEVEL_ORDER.length

    const nextState: QuizLevelStateStored = {
        version: 5,
        phase: "level_finished",
        currentLevel: target,
        currentQuestionId: 0,
        questionDeadlineAt: null,
        answers: {},
        answeredCount: 0,
        liveCorrect: 0,
        total: getLevelBank(target).questions.length,
        lastQuestionId: 0,
        // Реальные попытки дизайнера сохраняем — админ должен видеть историю.
        attempts: prevState?.attempts ?? [],
        passedLevels,
        pendingApprovalLevel: null,
        adminBypass: {
            at: new Date().toISOString(),
            adminId: dbAdmin?.id ?? null,
            reason: reason || `Уровень ${target} назначен администратором`,
        },
        questionOrder: [],
        optionOrder: {},
    }

    // Тест считаем закрытым только когда назначен верхний уровень: иначе дизайнеру
    // остаётся возможность досдать следующие уровни самостоятельно.
    const stepStatus = allPassed ? "PASSED" : "IN_PROGRESS"
    const unlockInterview = allPassed && profile.onboardingStatus === "TEST_INVITED"

    await prisma.$transaction(async (tx) => {
        if (testStep) {
            await tx.onboardingStep.update({
                where: {id: testStep.id},
                data: {status: stepStatus, comment: JSON.stringify(nextState)},
            })
        } else {
            await tx.onboardingStep.create({
                data: {profileId: profile.id, type: "TEST", status: stepStatus, comment: JSON.stringify(nextState)},
            })
        }
        if (unlockInterview) {
            await tx.specialistProfile.update({
                where: {userId},
                data: {onboardingStatus: "INTERVIEW_INVITED"},
            })
        }
    })

    await audit(dbAdmin?.id ?? null, "specialist_level_set", "User", userId, {
        specialistId: {to: userId},
        level: {from: previousLevel ?? undefined, to: target},
        ...(reason ? {reason: {to: reason}} : {}),
        ...(unlockInterview ? {onboardingStatus: {from: profile.onboardingStatus, to: "INTERVIEW_INVITED"}} : {}),
    })

    const title = levelByCode(target).title
    const message = reason
        ? `Администратор присвоил вам уровень «${title}» (${target}): ${reason}`
        : `Администратор присвоил вам уровень «${title}» (${target}).`

    await notifySpecialistStep({
        userId,
        email: profile.user.email,
        status: "LEVEL_GRANTED",
        title: `Присвоен уровень «${title}»`,
        message,
        url: unlockInterview ? "/onboarding/interview" : "/onboarding/test",
        extra: {level: target, levelTitle: title},
    })

    return NextResponse.json({
        ok: true,
        level: target,
        levelTitle: title,
        passedLevels,
        previousLevel,
        testStepStatus: stepStatus,
        onboardingStatus: unlockInterview ? "INTERVIEW_INVITED" : profile.onboardingStatus,
    })
}
