import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"
import type {NexusQuizQuestionWire} from "@/lib/onboarding/quiz-wire"
import {getPublicLevelQuestions, QUIZ_LEVEL_META, QUIZ_LEVEL_ORDER} from "@/lib/onboarding/levels/banks"
import {parseQuizLevelState} from "@/lib/onboarding/levels/state"
import type {QuizLevelCode} from "@/lib/onboarding/levels/types"

export async function GET(req: NextRequest) {
    const rl = rateLimit(`quiz:${req.headers.get("x-forwarded-for") ?? "unknown"}`, 30, 60_000)
    if (!rl.ok) return NextResponse.json({error: "Too many requests"}, {status: 429})

    const session = await getSessionUser()
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const user = await prisma.user.findUnique({
        where: {id: session.id},
        include: {
            specialistProfile: {
                include: {steps: true},
            },
        },
    })
    if (!user?.specialistProfile) return NextResponse.json({error: "Profile not found"}, {status: 404})

    const profile = user.specialistProfile
    const formPassed = profile.steps.some((s) => s.type === "FORM" && s.status === "PASSED")
    if (!formPassed) {
        return NextResponse.json({error: "Сначала заполните и отправьте анкету", code: "FORM_REQUIRED"}, {status: 403})
    }

    if (!["TEST_INVITED", "INTERVIEW_INVITED"].includes(profile.onboardingStatus)) {
        return NextResponse.json(
            {
                error: "Тест станет доступен после приглашения администратора",
                code: "NOT_INVITED",
            },
            {status: 403}
        )
    }

    function utf8ToBase64(s: string): string {
        return Buffer.from(s, "utf8").toString("base64")
    }

    const requested = (req.nextUrl.searchParams.get("level") ?? "L1").toUpperCase() as QuizLevelCode
    const testStep = profile.steps.find((s) => s.type === "TEST")
    let state = parseQuizLevelState(testStep?.comment ?? null)
    if (state?.pendingApprovalLevel) {
        return NextResponse.json(
            {
                error: "Уровень теста завершён и ожидает подтверждения администратора",
                code: "AWAITING_ADMIN",
                level: state.pendingApprovalLevel,
            },
            {status: 403}
        )
    }
    // Fully completed & confirmed — do not allow retake.
    if (testStep?.status === "PASSED") {
        const passedSet = new Set<QuizLevelCode>(state?.passedLevels ?? [])
        const allPassed = ["L1", "L2", "L3", "L4"].every((lvl) => passedSet.has(lvl as QuizLevelCode))
        if (allPassed) {
            return NextResponse.json(
                {
                    error: "Квалификационный тест уже завершён. Пересдача недоступна.",
                    code: "TEST_COMPLETED",
                },
                {status: 403}
            )
        }
    }
    const passedSet = new Set<QuizLevelCode>(state?.passedLevels ?? [])
    const activeLevel =
        QUIZ_LEVEL_ORDER.find((code) => !passedSet.has(code)) ?? QUIZ_LEVEL_ORDER[QUIZ_LEVEL_ORDER.length - 1]
    const attemptsByLevel = (state?.attempts ?? []).reduce<Record<string, number>>((acc, item) => {
        acc[item.level] = (acc[item.level] ?? 0) + 1
        return acc
    }, {})

    const availableLevels = [activeLevel]
    const resolvedLevel = availableLevels.includes(requested) ? requested : activeLevel

    const plain = getPublicLevelQuestions(resolvedLevel)
    const questions: NexusQuizQuestionWire[] = plain.map((q) => ({
        id: q.id,
        s64: utf8ToBase64(q.section),
        t64: utf8ToBase64(q.text),
        o64: q.options.map((o) => utf8ToBase64(o)),
    }))

    const QUESTION_TIME_LIMIT_SEC = 30
    const now = Date.now()
    const bank = getPublicLevelQuestions(resolvedLevel)
    const totalQuestions = bank.length
    const findNextQuestionId = (answers: Record<string, number>) => {
        const answeredSet = new Set(Object.keys(answers))
        for (let i = 1; i <= totalQuestions; i++) {
            if (!answeredSet.has(String(i))) return i
        }
        return 0
    }
    const hasActiveState = state && state.currentLevel === resolvedLevel && testStep?.status === "IN_PROGRESS"
    if (!hasActiveState) {
        const currentQuestionId = 1
        const questionDeadlineAt = new Date(now + QUESTION_TIME_LIMIT_SEC * 1000).toISOString()
        const nextState = {
            version: 5 as const,
            phase: "level_in_progress" as const,
            currentLevel: resolvedLevel,
            currentQuestionId,
            questionDeadlineAt,
            answers: {},
            answeredCount: 0,
            liveCorrect: 0,
            total: totalQuestions,
            lastQuestionId: 0,
            attempts: state?.attempts ?? [],
            passedLevels: state?.passedLevels ?? [],
            pendingApprovalLevel: null,
        }
        if (testStep) {
            await prisma.onboardingStep.update({
                where: {id: testStep.id},
                data: {status: "IN_PROGRESS", comment: JSON.stringify(nextState)},
            })
        } else {
            await prisma.onboardingStep.create({
                data: {profileId: profile.id, type: "TEST", status: "IN_PROGRESS", comment: JSON.stringify(nextState)},
            })
        }
        state = nextState
    } else if (state) {
        const expectedQuestionId = findNextQuestionId(state.answers)
        const needsSync =
            (state.currentQuestionId === 0 && expectedQuestionId > 0) ||
            (expectedQuestionId > 0 && state.currentQuestionId !== expectedQuestionId)
        if (needsSync) {
            const nextState = {
                ...state,
                currentQuestionId: expectedQuestionId,
                questionDeadlineAt: new Date(now + QUESTION_TIME_LIMIT_SEC * 1000).toISOString(),
                answeredCount: Object.keys(state.answers).length,
                liveCorrect: state.liveCorrect,
            }
            await prisma.onboardingStep.update({
                where: {id: testStep!.id},
                data: {status: "IN_PROGRESS", comment: JSON.stringify(nextState)},
            })
            state = nextState
        }
    }
    let resume: {
        answers: Record<string, number>
        answeredCount: number
        liveCorrect: number
        total: number
        lastQuestionId: number
        currentQuestionId: number
        questionDeadlineAt: string | null
    } | null = null

    if (testStep?.status === "IN_PROGRESS" && state && state.currentLevel === resolvedLevel) {
        resume = {
            answers: state.answers,
            answeredCount: state.answeredCount,
            liveCorrect: state.liveCorrect,
            total: state.total,
            lastQuestionId: state.lastQuestionId,
            currentQuestionId: state.currentQuestionId,
            questionDeadlineAt: state.questionDeadlineAt,
        }
    }
    const activeMeta = QUIZ_LEVEL_META.find((m) => m.code === resolvedLevel)

    return NextResponse.json({
        level: resolvedLevel,
        levelTitle: activeMeta?.title ?? resolvedLevel,
        levels: QUIZ_LEVEL_META,
        availableLevels,
        attemptsByLevel,
        passPercent: activeMeta?.passPercent ?? 80,
        total: questions.length,
        questions,
        resume,
    })
}

