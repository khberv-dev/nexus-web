import {parseQuizLevelState} from "@/lib/onboarding/levels/state"
import {QUIZ_LEVEL_ORDER} from "@/lib/onboarding/levels/banks"
import type {QuizLevelCode} from "@/lib/onboarding/levels/types"
import {LEVEL_TITLE} from "@/lib/onboarding/levels/titles"

/**
 * Квалификационный уровень дизайнера = самый высокий подтверждённый уровень теста.
 * Хранится в OnboardingStep(type=TEST).comment вместе с состоянием квиза, поэтому
 * достаётся разбором JSON, а не отдельным полем в БД.
 */

export type SpecialistLevel = {
    code: QuizLevelCode
    /** Подпись для лендинга — банки называются JUNIOR/SENIOR/MASTER/ELITE. */
    title: string
    /** 1 (JUNIOR) … 4 (ELITE) — для сортировки «сильные первыми». */
    rank: number
}

/** Уровень, начиная с которого дизайнер считается «сильным» для главной страницы. */
export const LANDING_PREFERRED_LEVEL_RANK = 3 // MASTER и выше

export function levelByCode(code: QuizLevelCode): SpecialistLevel {
    return {code, title: LEVEL_TITLE[code], rank: QUIZ_LEVEL_ORDER.indexOf(code) + 1}
}

/** Самый высокий подтверждённый уровень; null — тест не пройден ни на одном уровне. */
export function levelFromTestStep(comment: string | null | undefined): SpecialistLevel | null {
    const state = parseQuizLevelState(comment ?? null)
    if (!state) return null

    const passed = new Set<QuizLevelCode>(state.passedLevels ?? [])
    for (let i = QUIZ_LEVEL_ORDER.length - 1; i >= 0; i--) {
        const code = QUIZ_LEVEL_ORDER[i]
        if (passed.has(code)) return levelByCode(code)
    }
    return null
}

/** Ниже этого числа слайдов планка по уровню снимается — лучше показать сильнейших из имеющихся, чем пустую главную. */
export const LANDING_MIN_SLIDES = 3

export type LandingCandidate = {
    level: SpecialistLevel | null
    rating: number
    featured: boolean
    /** Слайд собран админом (LandingBundle), а не автоматически из портфолио. */
    curated?: boolean
}

/**
 * Порядок на главной: закреплённые админом → выше уровень → выше рейтинг →
 * кураторская сборка выше автособранного слайда.
 * Если сильных (MASTER и ELITE) меньше LANDING_MIN_SLIDES, показываем всех подходящих
 * в том же порядке — пустая главная хуже, чем главная с юниорами.
 */
export function selectLandingCandidates<T extends LandingCandidate>(
    candidates: readonly T[],
    minSlides: number = LANDING_MIN_SLIDES,
): T[] {
    const ranked = [...candidates].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        const byLevel = (b.level?.rank ?? 0) - (a.level?.rank ?? 0)
        if (byLevel !== 0) return byLevel
        if (a.rating !== b.rating) return b.rating - a.rating
        return Number(b.curated ?? false) - Number(a.curated ?? false)
    })

    const strong = ranked.filter(c => (c.level?.rank ?? 0) >= LANDING_PREFERRED_LEVEL_RANK)
    return strong.length >= minSlides ? strong : ranked
}
