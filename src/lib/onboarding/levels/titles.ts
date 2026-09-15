import type {QuizLevelCode} from "./types"

/**
 * Названия квалификационных уровней — всегда по-английски, как у банков вопросов
 * (level-*.json). Единый источник для бейджей, админки, уведомлений и писем.
 */
export const LEVEL_TITLE: Record<QuizLevelCode, string> = {
    L1: "JUNIOR",
    L2: "SENIOR",
    L3: "MASTER",
    L4: "ELITE",
}
