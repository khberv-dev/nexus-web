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
