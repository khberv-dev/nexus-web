/**
 * Требования к сборке для главной страницы. Чистый модуль без prisma:
 * одни и те же правила применяет и форма специалиста, и роут отправки на модерацию.
 */

export const MAX_LANDING_PORTFOLIO = 20
/** Меньше трёх работ — карточке на главной нечего показать в галерее. */
export const MIN_LANDING_PORTFOLIO = 3

export type LandingBundleReadiness = {
    /** Фото профиля (аватар) — на главной им показывается карточка специалиста. */
    avatar: boolean
    work: boolean
    /** Видео-визитка необязательна — в требования не входит, показывается как бонус. */
    video: boolean
    portfolio: number
    specialty: boolean
    about: boolean
}

export type LandingRequirement = {
    key: keyof LandingBundleReadiness
    label: string
    done: boolean
    /** Необязательные пункты не блокируют отправку. */
    optional?: boolean
}

export function landingRequirements(readiness: LandingBundleReadiness): LandingRequirement[] {
    return [
        {key: "avatar", label: "Фото профиля", done: readiness.avatar},
        {key: "work", label: "Фото интерьера", done: readiness.work},
        {key: "video", label: "Видео-визитка", done: readiness.video, optional: true},
        {
            key: "portfolio",
            label: `Портфолио: ${readiness.portfolio}/${MIN_LANDING_PORTFOLIO}`,
            done: readiness.portfolio >= MIN_LANDING_PORTFOLIO,
        },
        {key: "specialty", label: "Специализация", done: readiness.specialty},
        {key: "about", label: "О себе", done: readiness.about},
    ]
}

/** Незаполненные обязательные пункты — пусто, значит сборку можно отправлять. */
export function missingLandingRequirements(readiness: LandingBundleReadiness): string[] {
    return landingRequirements(readiness)
        .filter((item) => !item.optional && !item.done)
        .map((item) => (item.key === "portfolio" ? `Портфолио: минимум ${MIN_LANDING_PORTFOLIO} работы` : item.label))
}

export function canSubmitLandingBundle(readiness: LandingBundleReadiness): boolean {
    return missingLandingRequirements(readiness).length === 0
}
