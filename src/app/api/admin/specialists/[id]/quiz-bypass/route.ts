import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {notifySpecialistStep} from "@/lib/onboarding/notify-step"
import {getLevelBank} from "@/lib/onboarding/levels/banks"
import {parseQuizLevelState} from "@/lib/onboarding/levels/state"
import type {QuizLevelCode, QuizLevelStateStored} from "@/lib/onboarding/levels/types"

const ALL_LEVELS: QuizLevelCode[] = ["L1", "L2", "L3", "L4"]

/**
 * Пропуск квалификационного теста администратором: шаг TEST закрывается как пройденный,
 * даже если специалист его не сдавал (или завалил), и открывается этап интервью.
 */
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: userId} = await params
    const body = await req.json().catch(() => ({})) as { reason?: unknown }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : ""

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId},
        include: {steps: true, user: {select: {email: true, archivedAt: true}}},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})
    if (profile.user.archivedAt) {
        return NextResponse.json({error: "Специалист в архиве"}, {status: 409})
    }
    if (profile.onboardingStatus !== "TEST_INVITED") {
        return NextResponse.json(
            {error: "Пропустить тест можно только на этапе квалификационного теста"},
            {status: 409},
        )
    }

    const dbAdmin = await prisma.user.findUnique({where: {email: admin.email}, select: {id: true}})

    const testStep = profile.steps.find((s) => s.type === "TEST")
    const prevState = parseQuizLevelState(testStep?.comment ?? null)
    const lastLevel = ALL_LEVELS[ALL_LEVELS.length - 1]

    const nextState: QuizLevelStateStored = {
        version: 5,
        phase: "level_finished",
        currentLevel: lastLevel,
        currentQuestionId: 0,
        questionDeadlineAt: null,
        answers: {},
        answeredCount: 0,
        liveCorrect: 0,
        total: getLevelBank(lastLevel).questions.length,
        lastQuestionId: 0,
        // Попытки специалиста сохраняем — они остаются видны админу в карточке.
        attempts: prevState?.attempts ?? [],
        passedLevels: [...ALL_LEVELS],
        pendingApprovalLevel: null,
        adminBypass: {
            at: new Date().toISOString(),
            adminId: dbAdmin?.id ?? null,
            reason: reason || null,
        },
        questionOrder: [],
        optionOrder: {},
    }

    await prisma.$transaction(async (tx) => {
        if (testStep) {
            await tx.onboardingStep.update({
                where: {id: testStep.id},
                data: {status: "PASSED", comment: JSON.stringify(nextState)},
            })
        } else {
            await tx.onboardingStep.create({
                data: {profileId: profile.id, type: "TEST", status: "PASSED", comment: JSON.stringify(nextState)},
            })
        }
        await tx.specialistProfile.update({
            where: {userId},
            data: {onboardingStatus: "INTERVIEW_INVITED"},
        })
    })

    await audit(dbAdmin?.id ?? null, "specialist_quiz_bypassed", "User", userId, {
        specialistId: {to: userId},
        onboardingStatus: {from: profile.onboardingStatus, to: "INTERVIEW_INVITED"},
        ...(reason ? {reason: {to: reason}} : {}),
    })

    const message = reason
        ? `Администратор пропустил квалификационный тест: ${reason}. Этап интервью открыт.`
        : "Администратор пропустил квалификационный тест. Этап интервью открыт."

    await notifySpecialistStep({
        userId,
        email: profile.user.email,
        status: "TEST_BYPASSED",
        title: "Тест пропущен администратором",
        message,
        url: "/onboarding/interview",
    })

    return NextResponse.json({ok: true, status: "INTERVIEW_INVITED", bypassed: true})
}
