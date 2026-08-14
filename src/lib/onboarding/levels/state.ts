import {getLevelBank, toOriginalOptionIndex} from "./banks"
import type {QuizLevelAttempt, QuizLevelCode, QuizLevelStateStored} from "./types"

export function parseQuizLevelState(comment: string | null): QuizLevelStateStored | null {
    if (!comment) return null
    try {
        const parsed = JSON.parse(comment) as Partial<QuizLevelStateStored>
        if (parsed.version !== 5 && parsed.version !== 4) return null
        if (!parsed.currentLevel || typeof parsed.currentLevel !== "string") return null
        if (!parsed.answers || typeof parsed.answers !== "object" || Array.isArray(parsed.answers)) return null
        const bank = getLevelBank(parsed.currentLevel as QuizLevelCode)
        const answers = parsed.answers as Record<string, number>
        return {
            version: 5,
            phase:
                parsed.phase === "awaiting_admin"
                    ? "awaiting_admin"
                    : parsed.phase === "level_finished"
                        ? "level_finished"
                        : "level_in_progress",
            currentLevel: parsed.currentLevel as QuizLevelCode,
            currentQuestionId: Number(parsed.currentQuestionId) || 0,
            questionDeadlineAt:
                typeof parsed.questionDeadlineAt === "string" || parsed.questionDeadlineAt === null
                    ? (parsed.questionDeadlineAt as string | null)
                    : null,
            answers,
            answeredCount: Number(parsed.answeredCount) || Object.keys(answers).length,
            liveCorrect: Number(parsed.liveCorrect) || 0,
            total: Number(parsed.total) || bank.questions.length,
            lastQuestionId: Number(parsed.lastQuestionId) || 0,
            attempts: Array.isArray(parsed.attempts) ? (parsed.attempts as QuizLevelAttempt[]) : [],
            passedLevels: Array.isArray(parsed.passedLevels) ? (parsed.passedLevels as QuizLevelCode[]) : [],
            pendingApprovalLevel:
                parsed.version === 5 && (parsed.pendingApprovalLevel === null || typeof parsed.pendingApprovalLevel === "string")
                    ? ((parsed.pendingApprovalLevel ?? null) as QuizLevelCode | null)
                    : null,
            questionOrder: Array.isArray(parsed.questionOrder) ? (parsed.questionOrder as number[]) : [],
            optionOrder:
                parsed.optionOrder && typeof parsed.optionOrder === "object" && !Array.isArray(parsed.optionOrder)
                    ? (parsed.optionOrder as Record<string, number[]>)
                    : {},
        }
    } catch {
        return null
    }
}

/**
 * answers хранит индекс варианта КАК ОН ПОКАЗАН на экране (после перемешивания), поэтому для
 * проверки правильности нужно транслировать его через optionOrder этой попытки обратно в
 * исходный индекс из банка перед сравнением с q.correct.
 */
export function countCorrectForLevel(
    level: QuizLevelCode,
    answers: Record<string, number>,
    optionOrder?: Record<string, number[]>
): number {
    const bank = getLevelBank(level)
    let n = 0
    for (const q of bank.questions) {
        const shown = answers[String(q.id)]
        const original = toOriginalOptionIndex(optionOrder?.[String(q.id)], shown)
        if (original === q.correct) n++
    }
    return n
}

export function gradeLevel(level: QuizLevelCode, answers: Record<string, number>, optionOrder?: Record<string, number[]>) {
    const bank = getLevelBank(level)
    const correctCount = countCorrectForLevel(level, answers, optionOrder)
    const total = bank.questions.length
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0
    const passed = percent >= bank.passPercent
    return {correctCount, total, percent, passed, passPercent: bank.passPercent}
}

export function validateLevelAnswers(level: QuizLevelCode, answers: unknown): answers is Record<string, number> {
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) return false
    const bank = getLevelBank(level)
    const record = answers as Record<string, number>
    if (Object.keys(record).length !== bank.questions.length) return false
    for (const q of bank.questions) {
        const v = record[String(q.id)]
        if (typeof v !== "number" || !Number.isInteger(v) || v < -1 || v > 3) return false
    }
    return true
}

export function appendAttempt(
    state: QuizLevelStateStored | null,
    level: QuizLevelCode,
    attempt: QuizLevelAttempt,
    passed: boolean,
    answersSnapshot?: Record<string, number>,
    optionOrderSnapshot?: Record<string, number[]>
): QuizLevelStateStored {
    const snapshot =
        answersSnapshot && Object.keys(answersSnapshot).length > 0
            ? {...answersSnapshot}
            : state?.answers && Object.keys(state.answers).length > 0
                ? {...state.answers}
                : undefined
    const optionOrderForSnapshot =
        optionOrderSnapshot && Object.keys(optionOrderSnapshot).length > 0
            ? optionOrderSnapshot
            : state?.optionOrder && Object.keys(state.optionOrder).length > 0
                ? state.optionOrder
                : undefined
    const attemptRecord: QuizLevelAttempt = {
        ...attempt,
        ...(snapshot ? {answers: snapshot} : {}),
        ...(optionOrderForSnapshot ? {optionOrder: optionOrderForSnapshot} : {}),
    }
    const attempts = [...(state?.attempts ?? []), attemptRecord]
    const passedLevels = new Set<QuizLevelCode>(state?.passedLevels ?? [])
    // Do NOT auto-unlock next level; require admin confirmation.
    return {
        version: 5,
        phase: passed ? "awaiting_admin" : "level_finished",
        currentLevel: level,
        currentQuestionId: 0,
        questionDeadlineAt: null,
        answers: {},
        answeredCount: 0,
        liveCorrect: 0,
        total: getLevelBank(level).questions.length,
        lastQuestionId: 0,
        attempts,
        passedLevels: Array.from(passedLevels),
        pendingApprovalLevel: passed ? level : null,
        // Следующая попытка/уровень перемешивается заново при старте (GET /api/onboarding/quiz).
        questionOrder: [],
        optionOrder: {},
    }
}
