export type OrderStatus = "DRAFT" | "BRIEFING" | "BRIEF_REVIEW" | "ACTIVE" | "DONE" | "CANCELLED"
export type StageType = "CONCEPT" | "PLANNING" | "VISUALIZATION" | "DOCUMENTATION" | "SPECIFICATION"
export type StageStatus =
  | "AWAITING_PAYMENT" | "BLOCKED" | "PENDING" | "UPLOADED" | "MOD_REVIEW" | "MOD_REVISION"
  | "CLIENT_REVIEW" | "CLIENT_REVISION" | "APPROVED" | "EXTRA_PAYMENT"
export type ActStatus = "PENDING" | "SPECIALIST_UPLOADED" | "ADMIN_APPROVED" | "CLIENT_SIGNED" | "CONFIRMED" | "REJECTED"

/** В SSR используем createdAt (из uploadedAt в БД); сырой GET /api/orders/:id может отдавать только uploadedAt. */
export interface StageFile {
  id: string
  filename: string
  createdAt: string
  uploadedAt?: string
  audience?: "DESIGNER" | "CLIENT" | "SHARED"
}
export interface StageReview { reviewerRole: string; verdict: string; comment: string | null; createdAt: string }

export interface ExtraPaymentInfo { id: string; amount: number; reason: string; status: string }

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

export interface OrderStage {
  id: string
  type: StageType
  status: StageStatus
  modRound: number
  clientRound: number
  rulesS3Key?: string | null
  price?: number | null
  files: StageFile[]
  reviews: StageReview[]
  /** ISO timestamp of last rejection (moderator or client). Used to show only latest files. */
  lastRejectedAt?: string | null
  act?: StageAct | null
  extraPayments?: ExtraPaymentInfo[]
}

export type ContractStatus = "DRAFT" | "SENT_TO_SPECIALIST" | "SPECIALIST_SIGNED" | "SENT_TO_CLIENT" | "CLIENT_SIGNED" | "CONFIRMED" | "CANCELLED"

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

/** Счета по заказу (для блока в брифе и сводки). */
export interface OrderInvoiceBrief {
  id: string
  number: string
  amount: number
  status: string
  purpose: string
  s3Key: string | null
  createdAt: string
}

export interface OrderData {
  id: string
  status: OrderStatus
  createdAt: string
  briefData: Record<string, string> | null
  briefHelpRequested: boolean
  specialist: { name: string | null; email: string; avatarUrl: string | null } | null
  stages: OrderStage[]
  payments: { id: string; amount: number; status: string }[]
  contracts: Contract[]
  invoices: OrderInvoiceBrief[]
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "Черновик",
  SENT_TO_SPECIALIST: "На подписании у дизайнера",
  SPECIALIST_SIGNED: "Ожидает вашей подписи",
  SENT_TO_CLIENT: "Ожидает вашей подписи",
  CLIENT_SIGNED: "Ожидает подтверждения",
  CONFIRMED: "Активен",
  CANCELLED: "Отменен",
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "Черновик", color: "var(--dash-warn)", bg: "var(--dash-warn-bg)" },
  BRIEFING: { label: "Заявка отправлена", color: "var(--dash-accent)", bg: "var(--dash-accent-bg)" },
  BRIEF_REVIEW: { label: "Проверка брифа", color: "hsl(270,60%,65%)", bg: "hsla(270,60%,65%,0.12)" },
  ACTIVE: { label: "В работе", color: "var(--dash-success)", bg: "var(--dash-success-bg)" },
  DONE: { label: "Завершен", color: "var(--dash-muted)", bg: "var(--dash-border)" },
  CANCELLED: { label: "Отменен", color: "var(--dash-danger)", bg: "var(--dash-danger-bg)" },
}

export const STAGE_LABEL: Record<StageType, string> = {
  CONCEPT: "Концепция",
  PLANNING: "Планировочное решение",
  VISUALIZATION: "Визуализация",
  DOCUMENTATION: "Рабочая документация",
  SPECIFICATION: "Спецификация на материалы",
}

export const STAGE_STATUS: Record<StageStatus, { label: string; color: string }> = {
  AWAITING_PAYMENT: { label: "Ожидает оплаты", color: "var(--dash-danger)" },
  BLOCKED: { label: "Ожидает предыдущий этап", color: "var(--dash-muted)" },
  PENDING: { label: "Ожидает", color: "var(--dash-muted)" },
  UPLOADED: { label: "Загружен", color: "var(--dash-accent)" },
  MOD_REVIEW: { label: "На проверке", color: "hsl(270,60%,65%)" },
  MOD_REVISION: { label: "Дорабатывается", color: "var(--dash-warn)" },
  CLIENT_REVIEW: { label: "Ожидает вашего решения", color: "var(--dash-warn)" },
  CLIENT_REVISION: { label: "На доработке", color: "var(--dash-warn)" },
  APPROVED: { label: "Принят", color: "var(--dash-success)" },
  EXTRA_PAYMENT: { label: "Доп. оплата", color: "var(--dash-danger)" },
}

export const BRIEF_LABELS: Record<string, string> = {
  objectType: "Тип объекта", area: "Площадь", address: "Адрес", style: "Стиль",
  materials: "Материалы и цвета", vision: "Образ и атмосфера",
  budget: "Бюджет", deadline: "Срок", rooms: "Помещения", notes: "Особые требования",
}

export const BRIEF_PLACEHOLDERS: Record<string, string> = {
  objectType: "Офис, ресторан, магазин…",
  area: "Например: 150 м²",
  address: "Город, улица, дом",
  style: "Минимализм, лофт, скандинавский…",
  materials: "Дерево, камень, металл; предпочтительные цвета",
  vision: "Опишите атмосферу: уютно, строго, современно…",
  budget: "Общий бюджет на реализацию",
  deadline: "Желаемая дата завершения",
  rooms: "Перечислите помещения: зал, кухня, санузел…",
  notes: "Нормативы, ограничения, особые пожелания",
}

export { STAGE_ORDER } from "@/lib/stage-constants"

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
