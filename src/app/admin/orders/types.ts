import type {StatusVariant} from "@/components/app/AppCard"

export type OrderStatus = "DRAFT" | "BRIEFING" | "BRIEF_REVIEW" | "ACTIVE" | "DONE" | "CANCELLED"
export type StageStatus =
    "AWAITING_PAYMENT"
    | "BLOCKED"
    | "PENDING"
    | "UPLOADED"
    | "MOD_REVIEW"
    | "MOD_REVISION"
    | "CLIENT_REVIEW"
    | "CLIENT_REVISION"
    | "APPROVED"
    | "EXTRA_PAYMENT"
export type StageType = "CONCEPT" | "PLANNING" | "VISUALIZATION" | "DOCUMENTATION" | "SPECIFICATION"
export type ActStatus =
    "PENDING"
    | "SPECIALIST_UPLOADED"
    | "ADMIN_APPROVED"
    | "CLIENT_SIGNED"
    | "CONFIRMED"
    | "REJECTED"

export interface User {
    id: string;
    email: string;
    name: string | null
}

export interface SpecialistForAssignment {
    id: string;
    email: string;
    name: string | null
    specialistProfile: {
        onboardingStatus: string;
        rating: number | null;
        formData: Record<string, string> | null
    } | null
    files: { id: string }[]
}

export type FileAudience = "DESIGNER" | "CLIENT" | "SHARED"

export interface StageFile {
    id: string;
    filename: string;
    uploadedAt?: string;
    audience?: FileAudience
}

export interface StageReview {
    id: string;
    reviewerRole: "MODERATOR" | "CLIENT";
    verdict: "APPROVED" | "REJECTED";
    comment: string | null;
    createdAt: string
}

export interface StageAct {
    id: string
    signedAt: string | null
    signedById: string | null
    status: ActStatus
    generatedAt: string
    specialistActS3Key: string | null
    clientActS3Key: string | null
    specialistUploadedAt: string | null
    adminApprovedAt: string | null
    clientSignedAt: string | null
    adminConfirmedAt: string | null
}

export interface StagePaymentBrief {
    id: string
    amount: number
    status: string
}

export interface StageExtraPaymentBrief {
    id: string
    amount: number
    status: string
    reason: string
}

export interface Stage {
    id: string
    type: StageType
    status: StageStatus
    modRound: number
    clientRound: number
    price?: number | null
    files: StageFile[]
    reviews: StageReview[]
    payment?: StagePaymentBrief | null
    extraPayments?: StageExtraPaymentBrief[]
    act?: StageAct | null
    rulesS3Key?: string | null
    rulesSentAt?: string | null
    rulesSentS3Key?: string | null
}

export type ContractStatus =
    "DRAFT"
    | "SENT_TO_SPECIALIST"
    | "SPECIALIST_SIGNED"
    | "SENT_TO_CLIENT"
    | "CLIENT_SIGNED"
    | "CONFIRMED"
    | "CANCELLED"

export interface Contract {
    id: string
    number: string
    orderId: string
    status: ContractStatus
    s3Key: string | null
    specialistSignedS3Key: string | null
    clientSignedS3Key: string | null
    createdAt: string
    sentToSpecialistAt: string | null
    specialistSignedAt: string | null
    sentToClientAt: string | null
    clientSignedAt: string | null
    confirmedAt: string | null
}

export interface Order {
    id: string;
    title: string | null;
    price: number | null;
    status: OrderStatus;
    createdAt: string;
    updatedAt?: string
    briefData: Record<string, string> | null
    briefStep: number;
    briefHelpRequested: boolean
    briefVideoFile?: { id: string; s3Key: string; filename: string; mimeType: string | null; createdAt: string } | null
    client: User;
    specialist: User | null
    stages: Stage[]
    payments: { id: string; amount: number; status: string }[]
    contracts: Contract[]
}

export const ORDER_LABEL: Record<string, string> = {
    DRAFT: "Черновик", BRIEFING: "Бриф", BRIEF_REVIEW: "Проверка брифа",
    ACTIVE: "Активен", DONE: "Завершен", CANCELLED: "Отменен",
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
    DRAFT: "Черновик",
    SENT_TO_SPECIALIST: "Отправлен дизайнеру",
    SPECIALIST_SIGNED: "Подписан дизайнером",
    SENT_TO_CLIENT: "Отправлен заказчику",
    CLIENT_SIGNED: "Подписан заказчиком",
    CONFIRMED: "Подтвержден",
    CANCELLED: "Отменен",
}

export const CONTRACT_STATUS_VARIANT: Record<ContractStatus, StatusVariant> = {
    DRAFT: "pending",
    SENT_TO_SPECIALIST: "current",
    SPECIALIST_SIGNED: "current",
    SENT_TO_CLIENT: "current",
    CLIENT_SIGNED: "current",
    CONFIRMED: "done",
    CANCELLED: "rejected",
}
export const ORDER_VARIANT: Record<OrderStatus, StatusVariant> = {
    DRAFT: "pending", BRIEFING: "pending", BRIEF_REVIEW: "current",
    ACTIVE: "active", DONE: "done", CANCELLED: "rejected",
}
export const STAGE_LABEL: Record<StageType, string> = {
    CONCEPT: "Концепция",
    PLANNING: "Планировка",
    VISUALIZATION: "Визуализация",
    DOCUMENTATION: "Рабочая документация",
    SPECIFICATION: "Спецификация на материалы",
}
export const ACT_STATUS_LABEL: Record<ActStatus, string> = {
    PENDING: "Ожидает загрузки",
    SPECIALIST_UPLOADED: "Загружен специалистом",
    ADMIN_APPROVED: "Проверен, ожидает подписи",
    CLIENT_SIGNED: "Подписан заказчиком",
    CONFIRMED: "Подтвержден",
    REJECTED: "Требует доработки",
}

export const ACT_STATUS_VARIANT: Record<ActStatus, "pending" | "current" | "done" | "rejected"> = {
    PENDING: "pending",
    SPECIALIST_UPLOADED: "current",
    ADMIN_APPROVED: "current",
    CLIENT_SIGNED: "current",
    CONFIRMED: "done",
    REJECTED: "rejected",
}

/** Статус платежа по этапу (удержание / выпуск и т.д.) */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
    PENDING: "Ожидает оплаты",
    HELD: "Удержание (эскроу)",
    RELEASED: "Выплачено специалисту",
    REFUNDED: "Возврат",
    FAILED: "Ошибка платежа",
}

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
    AWAITING_PAYMENT: "Ожидает оплаты",
    BLOCKED: "Ожидает предыдущий этап",
    PENDING: "Ожидает",
    UPLOADED: "Загружен",
    MOD_REVIEW: "На модерации",
    MOD_REVISION: "На доработке", CLIENT_REVIEW: "У заказчика",
    CLIENT_REVISION: "Правки клиента", APPROVED: "Принят", EXTRA_PAYMENT: "Доп. оплата",
}

/** Куда админ может перевести заказ вручную (остальное идет по процессу или кнопкам «принять бриф» и т.д.) */
export function adminManualStatusTargets(current: OrderStatus): OrderStatus[] {
    switch (current) {
        case "DRAFT":
            return ["CANCELLED"]
        case "BRIEFING":
            return ["BRIEF_REVIEW", "CANCELLED"]
        case "BRIEF_REVIEW":
            return ["ACTIVE", "BRIEFING", "CANCELLED"]
        case "ACTIVE":
            return ["DONE", "CANCELLED"]
        case "DONE":
        case "CANCELLED":
            return []
        default:
            return []
    }
}
