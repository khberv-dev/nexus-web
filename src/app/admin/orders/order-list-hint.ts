import { STAGE_ORDER } from "@/lib/stage-constants"
import type { Order, Stage } from "./types"
import { STAGE_LABEL } from "./types"

function parseTime(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

export type OrderListHint =
  | { kind: "admin"; text: string }
  | { kind: "designer"; text: string }
  | { kind: "client"; text: string }
  | { kind: "neutral"; text: string }

function sortStagesLikePipeline(stages: Order["stages"]): Stage[] {
  return [...stages].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a.type as (typeof STAGE_ORDER)[number]) -
      STAGE_ORDER.indexOf(b.type as (typeof STAGE_ORDER)[number]),
  )
}

/**
 * Подпись под строкой заказа: сначала задачи администратора, иначе последнее заметное действие заказчика/дизайнера.
 */
export function orderListRowHint(order: Order): OrderListHint {
  const stagesSorted = sortStagesLikePipeline(order.stages)
  const needsAssign = !order.specialist && order.status !== "DRAFT" && order.status !== "CANCELLED"
  const contract = order.contracts?.[0] ?? null

  if (order.briefHelpRequested) {
    return { kind: "admin", text: "Вам: ответить по запросу помощи (бриф)" }
  }
  if (order.status === "BRIEF_REVIEW") {
    return { kind: "admin", text: "Вам: проверить бриф" }
  }
  if (needsAssign) {
    return { kind: "admin", text: "Вам: назначить специалиста" }
  }

  const mod = stagesSorted.find((s) => s.status === "MOD_REVIEW")
  if (mod) {
    return { kind: "admin", text: `Вам: модерация · ${STAGE_LABEL[mod.type]}` }
  }

  const actCheck = stagesSorted.find((s) => s.act?.status === "SPECIALIST_UPLOADED")
  if (actCheck) {
    return { kind: "admin", text: `Вам: проверить акт · ${STAGE_LABEL[actCheck.type]}` }
  }

  const actConfirm = stagesSorted.find((s) => s.act?.status === "CLIENT_SIGNED")
  if (actConfirm) {
    return { kind: "admin", text: `Вам: подтвердить акт · ${STAGE_LABEL[actConfirm.type]}` }
  }

  const extra = stagesSorted.find((s) => s.status === "EXTRA_PAYMENT")
  if (extra) {
    return { kind: "admin", text: `Вам: доплата за правки · ${STAGE_LABEL[extra.type]}` }
  }

  if (contract?.status === "SPECIALIST_SIGNED") {
    return { kind: "admin", text: "Вам: отправить договор заказчику" }
  }
  if (contract?.status === "CLIENT_SIGNED") {
    return { kind: "admin", text: "Вам: подтвердить договор" }
  }
  if (order.status !== "DRAFT" && order.status !== "CANCELLED" && contract?.status === "DRAFT" && order.specialist) {
    return { kind: "admin", text: "Вам: создать и отправить договор дизайнеру" }
  }

  type Cand = { t: number; hint: OrderListHint }
  const cands: Cand[] = []

  for (const s of order.stages) {
    const sf = s.files?.[0]
    if (sf?.uploadedAt) {
      cands.push({
        t: parseTime(sf.uploadedAt),
        hint: { kind: "designer", text: `Дизайнер: загрузил файлы · ${STAGE_LABEL[s.type]}` },
      })
    }
    const rv = s.reviews?.[0]
    if (rv?.createdAt && rv.reviewerRole === "CLIENT") {
      if (rv.verdict === "REJECTED") {
        cands.push({
          t: parseTime(rv.createdAt),
          hint: { kind: "client", text: `Заказчик: запросил правки · ${STAGE_LABEL[s.type]}` },
        })
      } else if (rv.verdict === "APPROVED") {
        cands.push({
          t: parseTime(rv.createdAt),
          hint: { kind: "client", text: `Заказчик: принял этап · ${STAGE_LABEL[s.type]}` },
        })
      }
    }
  }

  cands.sort((a, b) => b.t - a.t)
  if (cands.length && cands[0]!.t > 0) {
    return cands[0]!.hint
  }

  const statusHint = (s: Stage): OrderListHint | null => {
    if (s.status === "CLIENT_REVIEW") {
      return { kind: "client", text: `Заказчик согласует · ${STAGE_LABEL[s.type]}` }
    }
    if (s.status === "CLIENT_REVISION") {
      return { kind: "designer", text: `Дизайнер: правки по замечаниям · ${STAGE_LABEL[s.type]}` }
    }
    if (s.status === "MOD_REVISION") {
      return { kind: "designer", text: `Дизайнер: доработка после модерации · ${STAGE_LABEL[s.type]}` }
    }
    if (s.status === "UPLOADED") {
      return { kind: "designer", text: `Сдано на модерацию · ${STAGE_LABEL[s.type]}` }
    }
    return null
  }

  for (const t of [...STAGE_ORDER].reverse()) {
    const s = order.stages.find((x) => x.type === t)
    if (!s) continue
    const h = statusHint(s)
    if (h) return h
  }

  if (order.status === "BRIEFING") {
    return { kind: "neutral", text: "Заказчик заполняет бриф" }
  }
  if (order.status === "DRAFT") {
    return { kind: "neutral", text: "Черновик у заказчика" }
  }
  if (order.status === "DONE") {
    return { kind: "neutral", text: "Заказ завершён" }
  }
  if (order.status === "CANCELLED") {
    return { kind: "neutral", text: "Отменён" }
  }

  const updated = order.updatedAt ? parseTime(order.updatedAt) : 0
  if (updated > 0) {
    const short = new Date(order.updatedAt!).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    return { kind: "neutral", text: `Обновлён ${short}` }
  }

  return { kind: "neutral", text: "" }
}
