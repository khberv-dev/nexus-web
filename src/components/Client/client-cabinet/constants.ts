import type { PaymentStatus, StageType } from "@prisma/client"

/** Короткие названия этапов проекта (сводка для заказчика) */
export const STAGE_LABELS_SHORT: Record<StageType, string> = {
  CONCEPT: "Концепция",
  PLANNING: "Планировка",
  VISUALIZATION: "Визуализация",
  DOCUMENTATION: "Рабочая документация",
  SPECIFICATION: "Спецификация",
}

export const ORDER_HUE: Record<string, number> = {
  DRAFT: 60,
  BRIEFING: 35,
  BRIEF_REVIEW: 200,
  ACTIVE: 247,
  DONE: 140,
  CANCELLED: 0,
}

export const ORDER_STATUS_MAP: Record<
  string,
  { variant: "active" | "pending" | "done" | "rejected" | "current"; label: string }
> = {
  DRAFT: { variant: "pending", label: "Черновик" },
  BRIEFING: { variant: "pending", label: "Бриф" },
  BRIEF_REVIEW: { variant: "current", label: "На проверке" },
  ACTIVE: { variant: "active", label: "В работе" },
  DONE: { variant: "done", label: "Завершен" },
  CANCELLED: { variant: "rejected", label: "Отменен" },
}

export const PAYMENT_BADGE: Record<
  PaymentStatus,
  { variant: "done" | "pending" | "current" | "rejected"; label: string }
> = {
  HELD: { variant: "current", label: "Удержана" },
  RELEASED: { variant: "done", label: "Выплачена" },
  PENDING: { variant: "pending", label: "Ожидает" },
  REFUNDED: { variant: "rejected", label: "Возврат" },
  FAILED: { variant: "rejected", label: "Ошибка" },
}

/** Подписи этапа в таблице актов (вкладка Оплата) */
export const ACT_STAGE_LABEL: Record<string, string> = {
  CONCEPT: "Концепция",
  PLANNING: "Планировка",
  VISUALIZATION: "Визуализация",
  DOCUMENTATION: "Рабочая документация",
  SPECIFICATION: "Спецификация на материалы",
}

export const INV_BADGE: Record<string, { variant: "done" | "pending" | "current" | "rejected"; label: string }> = {
  CREATED: { variant: "pending", label: "Создан" },
  SENT: { variant: "current", label: "Отправлен" },
  PAID: { variant: "done", label: "Оплачен" },
  CANCELLED: { variant: "rejected", label: "Отменен" },
}

export const CON_BADGE: Record<string, { variant: "done" | "pending" | "current" | "rejected"; label: string }> = {
  DRAFT: { variant: "pending", label: "Подготовка в ЭДО" },
  SIGNED_CLIENT: { variant: "current", label: "Подписано вами" },
  SIGNED_BOTH: { variant: "done", label: "Подписано" },
  CANCELLED: { variant: "rejected", label: "Отменен" },
}

export const FRAMEWORK_CONTRACT_BADGE: Record<
  string,
  { variant: "pending" | "done" | "rejected" | "current"; label: string }
> = {
  NONE: { variant: "pending", label: "Не размещен" },
  AWAITING_SIGNATURE: { variant: "current", label: "Ожидает подписи" },
  SIGNED_BY_CLIENT: { variant: "done", label: "Подписан" },
  SIGNED_BY_ADMIN: { variant: "done", label: "Подписан (менеджер)" },
  DECLINED_BY_CLIENT: { variant: "rejected", label: "Отклонен" },
}

export const SIDEBAR_TABS = [
  { id: "orders", icon: "bx-folder", label: "Проекты" },
  { id: "payments", icon: "bx-credit-card", label: "Оплата" },
  { id: "settings", icon: "bx-cog", label: "Настройки" },
] as const

export type ClientCabinetNavItem = {
  href: string
  label: string
  iconClassName: string
  active: boolean
}

/** Ссылки верхней навигации кабинета заказчика (те же разделы, что в боковой панели). */
export function buildClientCabinetNavItems(activeTab: string): ClientCabinetNavItem[] {
  return SIDEBAR_TABS.map(t => ({
    href: t.id === "orders" ? "/orders" : `/orders?tab=${t.id}`,
    label: t.label,
    iconClassName: `bx ${t.icon}`,
    active: activeTab === t.id,
  }))
}

export const POSITION_CHIPS = [
  "Собственник",
  "Генеральный директор",
  "Управляющий",
  "Бренд-менеджер",
  "Архитектор / дизайнер",
  "Другое",
]

export const LEGAL_FORMS = ["ООО", "АО", "ПАО", "ИП"]
