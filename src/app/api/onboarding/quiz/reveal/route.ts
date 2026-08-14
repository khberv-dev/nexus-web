import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"
import {getLevelBank, getLevelQuestion, toOriginalOptionIndex, toShownOptionIndex} from "@/lib/onboarding/levels/banks"
import {countCorrectForLevel, parseQuizLevelState} from "@/lib/onboarding/levels/state"
import type {QuizLevelCode} from "@/lib/onboarding/levels/types"

const QUESTION_TIME_LIMIT_SEC = 30
/** Допуск после дедлайна: ответ с выбранным вариантом не обнуляется из‑за сетевой задержки / рассинхрона таймера. */
const ANSWER_GRACE_MS = 3_000

export async function POST(req: NextRequest) {
    const rl = rateLimit(`quiz-reveal:${req.headers.get("x-forwarded-for") ?? "unknown"}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({error: "Too many requests"}, {status: 429})

    const session = await getSessionUser()
    if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {level, questionId, selectedIndex, timedOut} = (await req.json()) as {
        level?: QuizLevelCode
        questionId?: number
        selectedIndex?: number
        timedOut?: boolean
    }
    if (!level || !["L1", "L2", "L3", "L4"].includes(level)) {
        return NextResponse.json({error: "Не указан уровень теста"}, {status: 400})
    }
    if (typeof questionId !== "number" || !Number.isInteger(questionId)) {
        return NextResponse.json({error: "Некорректные данные"}, {status: 400})
    }
    const isTimedOut = Boolean(timedOut)
    if (
        !isTimedOut &&
        (typeof selectedIndex !== "number" || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3)
    ) {
        return NextResponse.json({error: "Некорректные данные"}, {status: 400})
    }

    const user = await prisma.user.findUnique({
        where: {id: session.id},
        include: {
            specialistProfile: {
                include: {steps: true},
            },
        },
    })
    const profile = user?.specialistProfile
    if (!profile) return NextResponse.json({error: "Профиль не найден"}, {status: 404})

    const formPassed = profile.steps.some((s) => s.type === "FORM" && s.status === "PASSED")
    if (!formPassed) return NextResponse.json({error: "Сначала заполните анкету"}, {status: 403})

    if (!["TEST_INVITED", "INTERVIEW_INVITED"].includes(profile.onboardingStatus)) {
        return NextResponse.json({error: "Нет доступа к тесту"}, {status: 403})
    }

    const q = getLevelQuestion(level, questionId)
    if (!q) return NextResponse.json({error: "Вопрос не найден"}, {status: 404})

    const selectedValue = isTimedOut ? -1 : (selectedIndex as number)

    const existing = await prisma.onboardingStep.findFirst({
        where: {profileId: profile.id, type: "TEST"},
    })

    const state = parseQuizLevelState(existing?.comment ?? null)
    if (state?.pendingApprovalLevel) {
        return NextResponse.json({error: "Ожидает подтверждения администратора"}, {status: 409})
    }
    if (existing?.status === "PASSED") {
        const passedSet = new Set<QuizLevelCode>(state?.passedLevels ?? [])
        const allPassed = ["L1", "L2", "L3", "L4"].every((lvl) => passedSet.has(lvl as QuizLevelCode))
        if (allPassed) {
            return NextResponse.json({error: "Тест завершён. Пересдача недоступна."}, {status: 409})
        }
    }
    if (!state || state.currentLevel !== level) {
        return NextResponse.json({error: "Сессия уровня не инициализирована, обновите страницу"}, {status: 409})
    }
    if (state.answers[String(questionId)] !== undefined) {
        return NextResponse.json({error: "Ответ на этот вопрос уже сохранен"}, {status: 409})
    }
    if (state.currentQuestionId !== questionId) {
        return NextResponse.json(
            {
                error: "Нарушен порядок вопросов",
                code: "QUESTION_ORDER",
                expectedQuestionId: state.currentQuestionId,
            },
            {status: 409}
        )
    }
    const now = Date.now()
    const deadlineMs = state.questionDeadlineAt ? new Date(state.questionDeadlineAt).getTime() : NaN
    const deadlineExpired = Number.isFinite(deadlineMs) && now > deadlineMs
    const withinAnswerGrace =
        deadlineExpired && Number.isFinite(deadlineMs) && now <= deadlineMs + ANSWER_GRACE_MS
    // Явный timedOut=true — всегда просрочка; иначе при выборе варианта даём grace, чтобы не сбрасывать верный ответ.
    const effectiveTimedOut =
        isTimedOut || (deadlineExpired && !(withinAnswerGrace && !isTimedOut && selectedValue >= 0))
    let base: Record<string, number> = {}
    if (state && state.currentLevel === level && existing?.status !== "FAILED") {
        base = {...state.answers}
    }

    // answers хранит индекс варианта КАК ПОКАЗАН на экране (после перемешивания) — так же, как
    // его потом резолвит клиент при финальной отправке в /api/onboarding/step. Для проверки
    // правильности транслируем через optionOrder этой попытки в исходный индекс из банка.
    const optionOrderForQuestion = state.optionOrder[String(questionId)]
    const effectiveSelectedValue = effectiveTimedOut ? -1 : selectedValue
    const answers = {...base, [String(questionId)]: effectiveSelectedValue}
    const liveCorrect = countCorrectForLevel(level, answers, state.optionOrder)
    const total = getLevelBank(level).questions.length
    const answeredCount = Object.keys(answers).length
    const posInOrder = state.questionOrder.indexOf(questionId)
    const nextQuestionId =
        answeredCount < total && posInOrder >= 0 && posInOrder + 1 < state.questionOrder.length
            ? state.questionOrder[posInOrder + 1]
            : 0
    const nextDeadline = nextQuestionId > 0 ? new Date(now + QUESTION_TIME_LIMIT_SEC * 1000).toISOString() : null
    const comment = JSON.stringify({
        version: 5,
        phase: "level_in_progress",
        currentLevel: level,
        currentQuestionId: nextQuestionId,
        questionDeadlineAt: nextDeadline,
        answers,
        answeredCount,
        liveCorrect,
        total,
        lastQuestionId: questionId,
        attempts: state?.attempts ?? [],
        passedLevels: state?.passedLevels ?? [],
        pendingApprovalLevel: null,
        questionOrder: state.questionOrder,
        optionOrder: state.optionOrder,
    })

    if (existing) {
        await prisma.onboardingStep.update({
            where: {id: existing.id},
            data: {status: "IN_PROGRESS", comment},
        })
    } else {
        await prisma.onboardingStep.create({
            data: {profileId: profile.id, type: "TEST", status: "IN_PROGRESS", comment},
        })
    }

    const originalSelected = toOriginalOptionIndex(optionOrderForQuestion, effectiveSelectedValue)

    return NextResponse.json({
        isCorrect: originalSelected === q.correct,
        correctIndex: toShownOptionIndex(optionOrderForQuestion, q.correct),
        explain: q.explain,
        savedIndex: effectiveSelectedValue,
        timedOut: effectiveTimedOut,
        progress: {
            answeredCount,
            total,
            liveCorrect,
            currentQuestionId: nextQuestionId,
            questionDeadlineAt: nextDeadline,
        },
    })
}

