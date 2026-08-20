import {QUIZ_QUESTIONS} from "./regulations-questions"

/**
 * Сессия теста по регламентам: порядок вопросов и вариантов перемешивается на каждую попытку,
 * на каждый вопрос даётся 30 секунд. Состояние живёт в OnboardingStep(type=REGULATIONS).comment.
 */

export const REGULATIONS_QUESTION_TIME_LIMIT_SEC = 30
export const REGULATIONS_PASS_PERCENT = 80
/** Допуск после дедлайна, чтобы сетевая задержка не обнуляла осознанно выбранный вариант. */
export const REGULATIONS_ANSWER_GRACE_MS = 3_000
export const REGULATIONS_TOTAL = QUIZ_QUESTIONS.length

export type RegulationsQuizState = {
    version: 2
    /** Индексы вопросов банка в порядке показа — перемешиваются заново на каждую попытку. */
    questionOrder: number[]
    /** Индекс вопроса (строкой) → перемешанный порядок вариантов [0..3] на эту попытку. */
    optionOrder: Record<string, number[]>
    /**
     * Индекс вопроса (строкой) → выбранный вариант В ИСХОДНОЙ нумерации банка (-1 — время вышло).
     * Перемешивание не попадает в ответы: их читают админка и грейдер по индексам банка.
     */
    answers: Record<string, number>
    /** Вопрос, на который сейчас отвечают (индекс банка); -1 — все вопросы отвечены. */
    currentQuestionIndex: number
    questionDeadlineAt: string | null
    startedAt: string
}

export type PublicRegulationsQuestion = {
    index: number
    section: string
    text: string
    options: [string, string, string, string]
}

export type RegulationsGrade = {
    score: number
    total: number
    pct: number
    passed: boolean
    sectionScores: Record<string, { correct: number; total: number }>
}

function shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

export function buildRegulationsQuizState(now: Date = new Date()): RegulationsQuizState {
    const questionOrder = shuffle(QUIZ_QUESTIONS.map((_, i) => i))
    const optionOrder: Record<string, number[]> = {}
    for (let i = 0; i < QUIZ_QUESTIONS.length; i++) optionOrder[String(i)] = shuffle([0, 1, 2, 3])

    return {
        version: 2,
        questionOrder,
        optionOrder,
        answers: {},
        currentQuestionIndex: questionOrder[0] ?? -1,
        questionDeadlineAt: new Date(now.getTime() + REGULATIONS_QUESTION_TIME_LIMIT_SEC * 1000).toISOString(),
        startedAt: now.toISOString(),
    }
}

function identityQuestionOrder(): number[] {
    return QUIZ_QUESTIONS.map((_, i) => i)
}

function sanitizeAnswers(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
    const result: Record<string, number> = {}
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const index = Number(key)
        const picked = Number(value)
        if (!Number.isInteger(index) || index < 0 || index >= QUIZ_QUESTIONS.length) continue
        if (!Number.isInteger(picked) || picked < -1 || picked > 3) continue
        result[String(index)] = picked
    }
    return result
}

/**
 * Разбор активной сессии. Завершённая попытка (есть finishedAt) сессией не считается — её
 * читают как результат, а новая попытка стартует через buildRegulationsQuizState().
 */
export function parseRegulationsQuizState(comment: string | null | undefined): RegulationsQuizState | null {
    if (!comment) return null
    let parsed: Record<string, unknown>
    try {
        parsed = JSON.parse(comment) as Record<string, unknown>
    } catch {
        return null
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    if (parsed.finishedAt) return null

    const answers = sanitizeAnswers(parsed.answers)

    // Версия 1 (до перемешивания и таймера): порядок вопросов и вариантов — исходный.
    if (parsed.version !== 2) {
        if (Object.keys(answers).length === 0) return null
        const state: RegulationsQuizState = {
            version: 2,
            questionOrder: identityQuestionOrder(),
            optionOrder: {},
            answers,
            currentQuestionIndex: -1,
            questionDeadlineAt: null,
            startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
        }
        return {...state, currentQuestionIndex: nextRegulationsQuestionIndex(state)}
    }

    const rawOrder = Array.isArray(parsed.questionOrder) ? (parsed.questionOrder as unknown[]) : []
    const questionOrder = rawOrder
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v >= 0 && v < QUIZ_QUESTIONS.length)
    const optionOrder: Record<string, number[]> = {}
    if (parsed.optionOrder && typeof parsed.optionOrder === "object" && !Array.isArray(parsed.optionOrder)) {
        for (const [key, value] of Object.entries(parsed.optionOrder as Record<string, unknown>)) {
            if (!Array.isArray(value) || value.length !== 4) continue
            const order = value.map((v) => Number(v))
            if (order.some((v) => !Number.isInteger(v) || v < 0 || v > 3)) continue
            if (new Set(order).size !== 4) continue
            optionOrder[key] = order
        }
    }

    const state: RegulationsQuizState = {
        version: 2,
        questionOrder: questionOrder.length === QUIZ_QUESTIONS.length ? questionOrder : identityQuestionOrder(),
        optionOrder,
        answers,
        currentQuestionIndex: -1,
        questionDeadlineAt:
            typeof parsed.questionDeadlineAt === "string" ? parsed.questionDeadlineAt : null,
        startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : new Date().toISOString(),
    }

    const storedCurrent = Number(parsed.currentQuestionIndex)
    const expected = nextRegulationsQuestionIndex(state)
    // Сохранённый указатель уважаем, только если вопрос ещё не отвечен, иначе чиним по ответам.
    state.currentQuestionIndex =
        Number.isInteger(storedCurrent) &&
        storedCurrent >= 0 &&
        storedCurrent < QUIZ_QUESTIONS.length &&
        state.answers[String(storedCurrent)] === undefined
            ? storedCurrent
            : expected

    return state
}

/** Следующий неотвеченный вопрос в порядке показа; -1 — отвечены все. */
export function nextRegulationsQuestionIndex(state: RegulationsQuizState): number {
    for (const index of state.questionOrder) {
        if (state.answers[String(index)] === undefined) return index
    }
    return -1
}

/** Позиция вопроса на экране (1-based показывает клиент). */
export function questionPosition(state: RegulationsQuizState, questionIndex: number): number {
    return state.questionOrder.indexOf(questionIndex)
}

/** Вопросы в порядке показа, варианты — в перемешанном порядке, без correct/explain. */
export function getPublicRegulationsQuestions(state: RegulationsQuizState): PublicRegulationsQuestion[] {
    return state.questionOrder.map((index) => {
        const q = QUIZ_QUESTIONS[index]
        const order = state.optionOrder[String(index)]
        const options: [string, string, string, string] =
            order && order.length === 4
                ? [q.options[order[0]], q.options[order[1]], q.options[order[2]], q.options[order[3]]]
                : [...q.options]
        return {index, section: q.section, text: q.text, options}
    })
}

/** То, что видит клиент: вопросы без правильных ответов + прогресс и дедлайн текущего вопроса. */
export function buildRegulationsSessionPayload(state: RegulationsQuizState) {
    const grade = gradeRegulationsQuiz(state.answers)
    return {
        questions: getPublicRegulationsQuestions(state),
        total: REGULATIONS_TOTAL,
        passPercent: REGULATIONS_PASS_PERCENT,
        timeLimitSec: REGULATIONS_QUESTION_TIME_LIMIT_SEC,
        answers: state.answers,
        answeredCount: Object.keys(state.answers).length,
        score: grade.score,
        sectionScores: grade.sectionScores,
        currentQuestionIndex: state.currentQuestionIndex,
        currentPosition: state.currentQuestionIndex >= 0 ? questionPosition(state, state.currentQuestionIndex) : -1,
        questionDeadlineAt: state.questionDeadlineAt,
    }
}

/** Позиция варианта на экране → исходный индекс в банке. */
export function toOriginalOption(order: number[] | undefined, shownIndex: number): number {
    if (shownIndex < 0 || !order || order.length !== 4 || shownIndex > 3) return shownIndex
    return order[shownIndex]
}

/** Исходный индекс варианта в банке → позиция на экране. */
export function toShownOption(order: number[] | undefined, originalIndex: number): number {
    if (originalIndex < 0 || !order || order.length !== 4) return originalIndex
    const pos = order.indexOf(originalIndex)
    return pos === -1 ? originalIndex : pos
}

/** Итог попытки считается на сервере по ответам в исходной нумерации банка. */
export function gradeRegulationsQuiz(answers: Record<string, number>): RegulationsGrade {
    const sectionScores: Record<string, { correct: number; total: number }> = {}
    let score = 0

    QUIZ_QUESTIONS.forEach((q, index) => {
        if (!sectionScores[q.section]) sectionScores[q.section] = {correct: 0, total: 0}
        sectionScores[q.section].total++
        if (answers[String(index)] === q.correct) {
            score++
            sectionScores[q.section].correct++
        }
    })

    const total = QUIZ_QUESTIONS.length
    const pct = total > 0 ? Math.round((score / total) * 100) : 0
    return {score, total, pct, passed: pct >= REGULATIONS_PASS_PERCENT, sectionScores}
}
