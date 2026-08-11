import type {PaymentStatus, StageType} from "@prisma/client"

export type OrderWithRelations = {
    id: string; status: string; briefData: unknown; createdAt: Date; updatedAt: Date
    client: { name: string | null; email: string | null }
    stages: {
        id: string;
        type: StageType;
        status: string;
        modRound: number;
        clientRound: number;
        act?: { id: string; signedAt: Date | null } | null
    }[]
}

export type PaymentWithRelations = {
    id: string; amount: number; status: PaymentStatus; createdAt: Date
    order: { id: string; briefData: unknown }
}

export type OnboardingStep = { type: string; status: string; comment?: string | null }

export type UrgentItem = { order: OrderWithRelations; stage: OrderWithRelations["stages"][number] }
export type ActItem = { order: OrderWithRelations; stage: OrderWithRelations["stages"][number] }

export const STAGE_LABELS: Record<StageType, string> = {
    CONCEPT: "Концепция",
    PLANNING: "Планировка",
    VISUALIZATION: "Визуализация",
    DOCUMENTATION: "Рабочая документация",
    SPECIFICATION: "Спецификация на материалы",
}

export const ORDER_STATUS_MAP: Record<string, {
    variant: "active" | "pending" | "done" | "rejected" | "current";
    label: string
}> = {
    DRAFT: {variant: "pending", label: "Черновик"}, BRIEFING: {variant: "pending", label: "Бриф"},
    BRIEF_REVIEW: {variant: "current", label: "На проверке"}, ACTIVE: {variant: "active", label: "В работе"},
    DONE: {variant: "done", label: "Завершен"}, CANCELLED: {variant: "rejected", label: "Отменен"},
}

export const ORDER_HUE: Record<string, number> = {
    DRAFT: 60,
    BRIEFING: 35,
    BRIEF_REVIEW: 200,
    ACTIVE: 247,
    DONE: 140,
    CANCELLED: 0
}

export const PAYMENT_BADGE: Record<PaymentStatus, {
    variant: "done" | "pending" | "current" | "rejected";
    label: string
}> = {
    HELD: {variant: "current", label: "Удержана"}, RELEASED: {variant: "done", label: "Выплачена"},
    PENDING: {variant: "pending", label: "Ожидает"}, REFUNDED: {variant: "rejected", label: "Возврат"},
    FAILED: {variant: "rejected", label: "Ошибка"},
}

export const PAYMENT_HUE: Record<PaymentStatus, number> = {
    HELD: 200,
    RELEASED: 140,
    PENDING: 60,
    REFUNDED: 0,
    FAILED: 0
}

export const ONBOARDING_STEPS = [
    {key: "FORM", label: "Анкета", icon: "bx-file-blank"},
    {key: "TEST", label: "Квалификационный тест", icon: "bx-clipboard"},
    {key: "INTERVIEW", label: "Интервью", icon: "bx-video"},
    {key: "REGULATIONS", label: "Регламенты", icon: "bx-book-open"},
    {key: "CONTRACT", label: "Договор", icon: "bx-file"},
]

export const DISCOVER_HUES = [{h1: 247, h2: 282}, {h1: 200, h2: 230}, {h1: 120, h2: 160}, {h1: 0, h2: 35}, {
    h1: 280,
    h2: 310
}]

export type SpecContract = {
    id: string
    number: string
    orderId?: string | null
    status: string
    s3Key: string | null
    createdAt: Date
    signedAt: Date | null
    kind?: "PROJECT" | "ONBOARDING"
}
export type SpecAct = { id: string; stageType: string; orderId: string; generatedAt: string; signedAt: string | null }
