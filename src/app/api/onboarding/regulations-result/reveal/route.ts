import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"
import {QUIZ_QUESTIONS} from "@/lib/onboarding/regulations-questions"
import {
    gradeRegulationsQuiz,
    nextRegulationsQuestionIndex,
    parseRegulationsQuizState,
    questionPosition,
    REGULATIONS_ANSWER_GRACE_MS,
    REGULATIONS_QUESTION_TIME_LIMIT_SEC,
    toOriginalOption,
    toShownOption,
} from "@/lib/onboarding/regulations-quiz"

/** POST — ответ на вопрос теста регламентов (или истёкшее время) с переходом к следующему вопросу. */
export async function POST(req: NextRequest) {
    const rl = rateLimit(`regulations-reveal:${req.headers.get("x-forwarded-for") ?? "unknown"}`, 60, 60_000)
    if (!rl.ok) return NextResponse.json({error: "Too many requests"}, {status: 429})

    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {questionIndex, selectedIndex, timedOut} = await req.json() as {
        questionIndex?: number
        selectedIndex?: number
        timedOut?: boolean
    }

    const isTimedOut = Boolean(timedOut)
    if (typeof questionIndex !== "number" || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= QUIZ_QUESTIONS.length) {
        return NextResponse.json({error: "Некорректные данные"}, {status: 400})
    }
    if (
        !isTimedOut &&
        (typeof selectedIndex !== "number" || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3)
    ) {
        return NextResponse.json({error: "Некорректные данные"}, {status: 400})
    }

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const existing = profile.steps.find((s) => s.type === "REGULATIONS")
    if (existing?.status === "PASSED") {
        return NextResponse.json({error: "Тест по регламентам уже пройден"}, {status: 409})
    }

    const state = parseRegulationsQuizState(existing?.comment ?? null)
    if (!state) {
        return NextResponse.json(
            {error: "Сессия теста не найдена, начните тест заново", code: "NO_SESSION"},
            {status: 409},
        )
    }

    const q = QUIZ_QUESTIONS[questionIndex]
    const optionOrder = state.optionOrder[String(questionIndex)]

    // Повторный ответ на тот же вопрос не перезаписываем — возвращаем сохранённый результат.
    const already = state.answers[String(questionIndex)]
    if (already !== undefined) {
        return NextResponse.json({
            isCorrect: already === q.correct,
            correctIndex: toShownOption(optionOrder, q.correct),
            explain: q.explain,
            savedIndex: toShownOption(optionOrder, already),
            timedOut: already === -1,
            progress: {
                answeredCount: Object.keys(state.answers).length,
                total: QUIZ_QUESTIONS.length,
                score: gradeRegulationsQuiz(state.answers).score,
                currentQuestionIndex: state.currentQuestionIndex,
                currentPosition: state.currentQuestionIndex >= 0 ? questionPosition(state, state.currentQuestionIndex) : -1,
                questionDeadlineAt: state.questionDeadlineAt,
            },
        })
    }

    if (state.currentQuestionIndex !== questionIndex) {
        return NextResponse.json(
            {
                error: "Нарушен порядок вопросов",
                code: "QUESTION_ORDER",
                expectedQuestionIndex: state.currentQuestionIndex,
            },
            {status: 409},
        )
    }

    const now = Date.now()
    const deadlineMs = state.questionDeadlineAt ? new Date(state.questionDeadlineAt).getTime() : NaN
    const deadlineExpired = Number.isFinite(deadlineMs) && now > deadlineMs
    const withinGrace = deadlineExpired && now <= deadlineMs + REGULATIONS_ANSWER_GRACE_MS
    // Явный timedOut — всегда просрочка; выбранный вариант в пределах grace засчитываем.
    const effectiveTimedOut = isTimedOut || (deadlineExpired && !withinGrace)

    const shownIndex = effectiveTimedOut ? -1 : (selectedIndex as number)
    const originalIndex = effectiveTimedOut ? -1 : toOriginalOption(optionOrder, shownIndex)

    const answers = {...state.answers, [String(questionIndex)]: originalIndex}
    const nextState = {
        ...state,
        answers,
        currentQuestionIndex: nextRegulationsQuestionIndex({...state, answers}),
        questionDeadlineAt: null as string | null,
    }
    if (nextState.currentQuestionIndex >= 0) {
        nextState.questionDeadlineAt = new Date(now + REGULATIONS_QUESTION_TIME_LIMIT_SEC * 1000).toISOString()
    }

    const comment = JSON.stringify(nextState)
    if (existing) {
        await prisma.onboardingStep.update({
            where: {id: existing.id},
            data: {status: "IN_PROGRESS", comment},
        })
    } else {
        await prisma.onboardingStep.create({
            data: {profileId: profile.id, type: "REGULATIONS", status: "IN_PROGRESS", comment},
        })
    }

    return NextResponse.json({
        isCorrect: originalIndex === q.correct,
        correctIndex: toShownOption(optionOrder, q.correct),
        explain: q.explain,
        savedIndex: shownIndex,
        timedOut: effectiveTimedOut,
        progress: {
            answeredCount: Object.keys(answers).length,
            total: QUIZ_QUESTIONS.length,
            score: gradeRegulationsQuiz(answers).score,
            currentQuestionIndex: nextState.currentQuestionIndex,
            currentPosition: nextState.currentQuestionIndex >= 0
                ? questionPosition(nextState, nextState.currentQuestionIndex)
                : -1,
            questionDeadlineAt: nextState.questionDeadlineAt,
        },
    })
}
