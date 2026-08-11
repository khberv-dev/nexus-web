import {QUIZ_LEVEL_ORDER} from "./banks"
import type {QuizLevelCode} from "./types"

export const QUIZ_POLICY = {
    allowAllLevelsNow: true,
    futureCooldownHours: 24,
    futureMaxAttemptsPerWindow: 1,
    futureWindowDays: 90,
    eliteUnlock: {
        byMonthsWorked: 0,
        byDesignedM2: 0,
        canUseProAcceleration: true,
    },
}

export function getCurrentlyAvailableLevels(): QuizLevelCode[] {
    if (QUIZ_POLICY.allowAllLevelsNow) return [...QUIZ_LEVEL_ORDER]
    return ["L1"]
}
