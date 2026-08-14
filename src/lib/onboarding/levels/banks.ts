import level1 from "./level-1.json"
import level2 from "./level-2.json"
import level3 from "./level-3.json"
import level4 from "./level-4.json"
import type {QuizLevelBank, QuizLevelCode, QuizLevelMeta, QuizLevelQuestion, QuizLevelQuestionPublic,} from "./types"

function asQuestion(q: {
    id: number
    section: string
    text: string
    options: string[]
    correct: number
    explain: string
    source?: string
}): QuizLevelQuestion {
    return {
        ...q,
        options: [q.options[0], q.options[1], q.options[2], q.options[3]],
    }
}

function asBank(raw: {
    level: string
    title: string
    passPercent: number
    questions: Array<{
        id: number
        section: string
        text: string
        options: string[]
        correct: number
        explain: string
        source?: string
    }>
}): QuizLevelBank {
    return {
        level: raw.level as QuizLevelCode,
        title: raw.title,
        passPercent: raw.passPercent,
        questions: raw.questions.map(asQuestion),
    }
}

export const QUIZ_LEVEL_BANKS: Record<QuizLevelCode, QuizLevelBank> = {
    L1: asBank(level1),
    L2: asBank(level2),
    L3: asBank(level3),
    L4: asBank(level4),
}

export const QUIZ_LEVEL_ORDER: readonly QuizLevelCode[] = ["L1", "L2", "L3", "L4"]

export const QUIZ_LEVEL_META: readonly QuizLevelMeta[] = QUIZ_LEVEL_ORDER.map((code) => {
    const bank = QUIZ_LEVEL_BANKS[code]
    return {
        code,
        title: bank.title,
        passPercent: bank.passPercent,
        questionsCount: bank.questions.length,
        isElite: code === "L4",
    }
})

export function getLevelBank(level: QuizLevelCode): QuizLevelBank {
    return QUIZ_LEVEL_BANKS[level]
}

export function getPublicLevelQuestions(level: QuizLevelCode): QuizLevelQuestionPublic[] {
    return getLevelBank(level).questions.map((q) => {
        const {correct, ...rest} = q
        void correct
        return rest
    })
}

export function getLevelQuestion(level: QuizLevelCode, questionId: number): QuizLevelQuestion | undefined {
    return getLevelBank(level).questions.find((q) => q.id === questionId)
}

function shuffleArray<T>(arr: readonly T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/** Новый порядок показа вопросов (id из банка) — генерируется заново при старте каждой попытки. */
export function buildShuffledQuestionOrder(level: QuizLevelCode): number[] {
    return shuffleArray(getLevelBank(level).questions.map((q) => q.id))
}

/** Новый порядок вариантов ответа для каждого вопроса уровня — questionId (строкой) → [0..3] перемешанные. */
export function buildShuffledOptionOrder(level: QuizLevelCode): Record<string, number[]> {
    const result: Record<string, number[]> = {}
    for (const q of getLevelBank(level).questions) {
        result[String(q.id)] = shuffleArray([0, 1, 2, 3])
    }
    return result
}

/** Публичные вопросы уровня в заданном порядке показа, с вариантами в заданном перемешанном порядке. */
export function getPublicLevelQuestionsOrdered(
    level: QuizLevelCode,
    questionOrder: readonly number[],
    optionOrder: Record<string, number[]>,
): QuizLevelQuestionPublic[] {
    const bank = getLevelBank(level)
    const byId = new Map(bank.questions.map((q) => [q.id, q]))
    const order = questionOrder.length > 0 ? questionOrder : bank.questions.map((q) => q.id)
    return order.map((id) => {
        const q = byId.get(id)
        if (!q) throw new Error(`Unknown question id ${id} for level ${level}`)
        const optOrder = optionOrder[String(id)]
        const options: readonly [string, string, string, string] =
            optOrder && optOrder.length === 4
                ? [q.options[optOrder[0]], q.options[optOrder[1]], q.options[optOrder[2]], q.options[optOrder[3]]]
                : q.options
        const {correct, ...rest} = q
        void correct
        return {...rest, options}
    })
}

/** Позиция на экране (перемешанная) → исходный индекс варианта в банке. */
export function toOriginalOptionIndex(optionOrder: number[] | undefined, shownIndex: number): number {
    if (shownIndex < 0 || !optionOrder || shownIndex >= optionOrder.length) return shownIndex
    return optionOrder[shownIndex]
}

/** Исходный индекс варианта в банке → позиция на экране (перемешанная). */
export function toShownOptionIndex(optionOrder: number[] | undefined, originalIndex: number): number {
    if (originalIndex < 0 || !optionOrder) return originalIndex
    const pos = optionOrder.indexOf(originalIndex)
    return pos === -1 ? originalIndex : pos
}
