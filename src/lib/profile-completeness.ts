import {specialistSectionHref} from "@/lib/cabinet-shell"

/**
 * Заполненность профиля специалиста для карточки на главной (/work).
 * Профиль заполнен, когда выполнены все шаги — тогда карточку не показываем.
 */

export type LandingBundleStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED"

export type ProfileCompletenessInput = {
    hasAvatar: boolean
    portfolioProjectCount: number
    landingStatuses: LandingBundleStatus[]
}

export type ProfileCompletenessStepId = "avatar" | "portfolio" | "landing"

export type ProfileCompletenessStep = {
    id: ProfileCompletenessStepId
    label: string
    description: string
    href: string
    done: boolean
    /** Специалист свою часть сделал, ждём модератора — действие не нужно. */
    pending?: boolean
}

export type ProfileCompleteness = {
    steps: ProfileCompletenessStep[]
    doneCount: number
    percent: number
    complete: boolean
}

export function getProfileCompleteness({
                                           hasAvatar,
                                           portfolioProjectCount,
                                           landingStatuses,
                                       }: ProfileCompletenessInput): ProfileCompleteness {
    // Лендинг считается только одобренный: на публичную страницу попадают лишь APPROVED-сборки.
    const landingDone = landingStatuses.includes("APPROVED")
    const landingPending = !landingDone && landingStatuses.includes("PENDING_REVIEW")

    const steps: ProfileCompletenessStep[] = [
        {
            id: "avatar",
            label: "Фото профиля",
            description: "Загрузите аватар — клиентам проще доверять специалисту с фото",
            href: specialistSectionHref("settings"),
            done: hasAvatar,
        },
        {
            id: "portfolio",
            label: "Проект в портфолио",
            description: "Добавьте хотя бы один проект с вашими работами",
            href: specialistSectionHref("portfolio"),
            done: portfolioProjectCount > 0,
        },
        {
            id: "landing",
            label: "Лендинг",
            description: landingPending
                ? "Сборка на модерации — дождитесь проверки"
                : "Соберите лендинг и отправьте его на модерацию",
            href: specialistSectionHref("landing"),
            done: landingDone,
            pending: landingPending,
        },
    ]

    const doneCount = steps.filter((step) => step.done).length
    return {
        steps,
        doneCount,
        percent: Math.round((doneCount / steps.length) * 100),
        complete: doneCount === steps.length,
    }
}
