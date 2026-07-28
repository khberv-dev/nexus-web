import { STAGE_STATUS } from "@/app/orders/[id]/types"
import { ORDER_STATUS_MAP, STAGE_LABELS_SHORT } from "./constants"
import type { ClientOrder } from "./types"

export type OrderListFilter = "all" | "active" | "draft" | "done"

export function orderMatchesFilter(order: ClientOrder, f: OrderListFilter): boolean {
  if (f === "all") return true
  if (f === "draft") return order.status === "DRAFT"
  if (f === "done") return order.status === "DONE"
  if (f === "active") {
    return order.status === "ACTIVE" || order.status === "BRIEFING" || order.status === "BRIEF_REVIEW"
  }
  return true
}

export function formatOrderObjectType(brief: Record<string, unknown> | null): string {
  const raw = brief?.objectType
  if (raw == null || raw === "") return "—"
  return String(raw).split(",").map(s => s.trim()).filter(Boolean).join(", ") || "—"
}

export function formatOrderSum(order: ClientOrder): string {
  if (order.price != null && order.price > 0) {
    return `${(order.price / 100).toLocaleString("ru-RU")} руб.`
  }
  const brief = order.briefData as Record<string, string> | null
  const b = brief?.budget?.trim()
  return b || "—"
}

export function orderStageSummary(order: ClientOrder): string {
  const st = order.status
  if (st === "DRAFT" || st === "BRIEFING" || st === "BRIEF_REVIEW") {
    return (ORDER_STATUS_MAP[st] ?? { label: st }).label
  }
  if (st !== "ACTIVE") {
    return (ORDER_STATUS_MAP[st] ?? { label: st }).label
  }
  const stages = order.stages
  const current = stages.find(s => s.status !== "APPROVED")
  if (!current) return "Все этапы приняты"
  const typeLabel = STAGE_LABELS_SHORT[current.type] ?? current.type
  const statusKey = current.status as keyof typeof STAGE_STATUS
  const statusLabel = STAGE_STATUS[statusKey]?.label ?? current.status
  return `${typeLabel} · ${statusLabel}`
}

export const FILTER_EMPTY_HINT: Record<OrderListFilter, string> = {
  all: "Проектов пока нет",
  active: "Нет активных заказов",
  draft: "Черновиков нет",
  done: "Завершенных заказов пока нет",
}

export const FILTER_SECTION_TITLE: Record<OrderListFilter, string> = {
  all: "Все заказы",
  active: "Активные заказы",
  draft: "Черновики",
  done: "Завершенные",
}
