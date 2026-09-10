import type {OnboardingStatus} from "@/components/app/SpecialistCard"
import {STEP_TYPE_RU} from "./components/specialist-detail/constants"

/**
 * Содержимое красной модалки подтверждения для кнопок онбординга.
 *
 * Кнопки закрывают шаг рукой администратора: специалист его не проходил, проверки нет,
 * статус уходит в БД, а специалисту улетает письмо о «пройденном» шаге. Для реального
 * кандидата это подлог, поэтому диалог сделан пугающим — красным и с прямым текстом,
 * а не нейтральным «вы уверены?».
 *
 * Живёт отдельным .ts-модулем (не внутри компонента), чтобы покрываться тестами:
 * jest в этом репозитории берёт только `__tests__/**\/*.test.ts`, .tsx не запускается.
 */

export type SpecialistOnboardingAdminAction =
    | "advance"
    | "reject"
    | "reject_no_education"
    | "reject_no_experience"

/** Совпадает с NEXT_STATUS в src/app/api/admin/specialists/[id]/onboarding/route.ts. */
const ADVANCE_QUESTION: Partial<Record<OnboardingStatus, string>> = {
    PENDING: "Принять анкету и пригласить специалиста на квалификационный тест?",
    TEST_INVITED: "Отметить квалификационный тест пройденным и пригласить на интервью?",
    INTERVIEW_INVITED: "Отметить интервью пройденным и открыть доступ к регламентам?",
    REGULATIONS: "Отметить регламенты изученными и перейти к подписанию договора?",
    CONTRACT: "Зафиксировать подписание договора? Когда закрыты все шаги, специалист становится активным.",
}

/**
 * Шаг, который специалист должен был пройти сам на этом статусе. Зеркалит REQUIRED_STEP
 * в роуте: если шаг не PASSED, роут всё равно пропустит админа вперёд, но пометит шаг
 * как закрытый принудительно — предупреждаем об этом заранее, а не постфактум тостом.
 * INTERVIEW сюда не входит: интервью идёт в Zoom и подтверждается самим админом.
 */
const REQUIRED_STEP: Partial<Record<OnboardingStatus, string>> = {
    TEST_INVITED: "TEST",
    REGULATIONS: "REGULATIONS",
}

const REJECT_QUESTION: Record<Exclude<SpecialistOnboardingAdminAction, "advance">, string> = {
    reject: "Отклонить кандидата? Онбординг будет остановлен.",
    reject_no_education: "Отклонить кандидата по причине «нет профильного образования»?",
    reject_no_experience: "Отклонить кандидата по причине «недостаточно опыта» (нужно от 8 лет)?",
}

/** Заголовок красной шапки — он же главное предупреждение диалога. */
export const ADVANCE_TITLE = "Ручной пропуск шага — не для реальных пользователей"
export const REJECT_TITLE = "Ручное отклонение кандидата — не для реальных пользователей"

const ADVANCE_SUBTITLE =
    "Шаг будет закрыт без прохождения: специалист его не выполнял, проверка не проводилась. " +
    "Используйте только для тестов, демо и переноса с другой площадки."
const REJECT_SUBTITLE =
    "Кандидат получит отказ и больше не сможет продолжить онбординг. " +
    "Используйте только для тестов и демо."

export type OnboardingConfirmInput = {
    action: SpecialistOnboardingAdminAction
    /** null — карточка ещё не загрузилась; тогда спрашиваем обобщённо, но спрашиваем. */
    status: OnboardingStatus | null
    steps?: { type: string; status: string }[]
    /** SpecialistProfile.specialistContractStatus — для предупреждения о неподписанном договоре. */
    contractStatus?: string | null
}

export type OnboardingConfirmContent = {
    /** Красный заголовок в шапке модалки. */
    title: string
    /** Пояснение под заголовком: почему это опасно. */
    subtitle: string
    /** Что конкретно произойдёт с этим специалистом. */
    question: string
    /** Шаги, которые закроются без прохождения (пусто — предупреждать не о чем). */
    forcedSteps: string[]
    /** Подпись кнопки подтверждения. */
    confirmLabel: string
}

/** Шаги, которые роут закроет «волей администратора», а не сдачей специалиста. */
function forcedStepLabels({status, steps, contractStatus}: OnboardingConfirmInput): string[] {
    if (!status) return []
    const labels: string[] = []

    const required = REQUIRED_STEP[status]
    if (required) {
        const step = steps?.find((s) => s.type === required)
        if (!step || step.status !== "PASSED") labels.push(STEP_TYPE_RU[required] ?? required)
    }

    if (status === "CONTRACT" && contractStatus !== "SIGNED_BY_ADMIN") {
        labels.push("Подпись договора")
    }

    return labels
}

export function buildOnboardingActionConfirm(input: OnboardingConfirmInput): OnboardingConfirmContent {
    const {action, status} = input

    if (action !== "advance") {
        return {
            title: REJECT_TITLE,
            subtitle: REJECT_SUBTITLE,
            question: REJECT_QUESTION[action],
            forcedSteps: [],
            confirmLabel: "Да, отклонить",
        }
    }

    return {
        title: ADVANCE_TITLE,
        subtitle: ADVANCE_SUBTITLE,
        question:
            (status && ADVANCE_QUESTION[status]) ??
            "Перевести специалиста на следующий шаг онбординга?",
        forcedSteps: forcedStepLabels(input),
        confirmLabel: "Да, пропустить шаг",
    }
}
