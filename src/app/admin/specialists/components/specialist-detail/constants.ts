import type {OnboardingStatus} from "@/components/app/SpecialistCard"

/** Поля анкеты из ProfileForm — остальные показываем в «Прочее». */
export const SPECIALIST_FORMDATA_KNOWN = new Set([
    "fullName", "phone", "city", "experience", "sqm", "interiorStyle", "specialty", "specialization", "methods", "portfolio", "software",
    "aiServices", "has3d", "hasRd", "about", "taxStatus", "inn", "ogrnip", "ogrn", "kpp", "ipName", "companyName", "legalAddress",
    "corrAccount", "bankAccount", "bankName", "bankBik", "edoProviders",
    "edoOperator",
])

export const SPEC_CONTRACT_STATUS_LABEL: Record<string, string> = {
    NONE: "Не размещен",
    AWAITING_SIGNATURE: "Ожидает подписи специалиста",
    SIGNED_BY_SPECIALIST: "Специалист подписал — подтвердите",
    SIGNED_BY_ADMIN: "Подписан (зафиксирован)",
    DECLINED_BY_SPECIALIST: "Отказ специалиста",
}

export const STEP_TYPE_RU: Record<string, string> = {
    FORM: "Анкета",
    TEST: "Квалификационный тест",
    INTERVIEW: "Интервью",
    REGULATIONS_READ: "Регламент (ознакомление)",
    REGULATIONS: "Тест по регламенту",
    CONTRACT: "Договор",
}

export const STEP_STATUS_RU: Record<string, string> = {
    PENDING: "Ожидает",
    IN_PROGRESS: "В процессе",
    PASSED: "Пройдено",
    FAILED: "Не пройдено",
}

export const SPEC_ORDER_STATUS_LABEL: Record<string, string> = {
    DRAFT: "Черновик",
    BRIEFING: "Бриф",
    BRIEF_REVIEW: "Проверка",
    ACTIVE: "В работе",
    DONE: "Завершен",
    CANCELLED: "Отменен",
}

export const ADVANCE_LABEL: Partial<Record<OnboardingStatus, string>> = {
    PENDING: "Пригласить на тест",
    TEST_INVITED: "Тест пройден",
    INTERVIEW_INVITED: "Интервью пройдено",
    REGULATIONS: "Регламенты изучены",
    CONTRACT: "Договор подписан",
}

export const FILE_CATEGORY_LABEL: Record<string, string> = {
    AVATAR: "Аватар",
    PORTRAIT: "Портрет",
    LANDING_WORK: "Работа для лендинга",
    PORTFOLIO: "Портфолио",
    DOCUMENT: "Документ",
    INTRO_VIDEO: "Видео-приветствие",
}

export const ONBOARDING_STEPS_UI = [
    {key: "FORM", label: "Анкета", icon: "bx-file-blank"},
    {key: "TEST", label: "Квалификационный тест", icon: "bx-clipboard"},
    {key: "INTERVIEW", label: "Интервью", icon: "bx-video"},
    {key: "REGULATIONS_READ", label: "Регламент", icon: "bx-book-open"},
    {key: "REGULATIONS", label: "Тест по регламенту", icon: "bx-check-shield"},
    {key: "CONTRACT", label: "Договор", icon: "bx-file"},
] as const

export const ONBOARDING_TABLE_STEP_TYPES = ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"] as const
