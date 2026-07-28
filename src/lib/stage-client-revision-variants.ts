import type { OrderStage } from "@/app/orders/[id]/types"

export type ClientRevisionVariant = {
  /** 0-based индекс сдачи (0 — первая сдача на согласование) */
  variantIndex: number
  /** Номер для подписи «Вариант k» */
  displayRound: number
  files: OrderStage["files"]
  /** Комментарий заказчика при отправке этой версии на доработку */
  revisionFeedback: string | null
}

function time(iso: string): number {
  return new Date(iso).getTime()
}

/** Время загрузки файла: клиентский UI после refetch может получить только uploadedAt (см. GET /api/orders/:id). */
function fileUploadedMs(f: OrderStage["files"][number]): number | null {
  const iso = (f.createdAt?.trim() || f.uploadedAt?.trim() || "").trim()
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : null
}

/**
 * Делит файлы этапа на «варианты сдачи» по моментам отказа заказчика (запрос правок).
 * Границы — по времени загрузки файла относительно времени записи StageReview (CLIENT + REJECTED).
 */
export function buildClientRevisionVariants(stage: Pick<OrderStage, "files" | "reviews">): ClientRevisionVariant[] {
  const rejections = stage.reviews
    .filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "REJECTED")
    .sort((a, b) => time(a.createdAt) - time(b.createdAt))

  const sortedAsc = [...stage.files].sort((a, b) => {
    const ta = fileUploadedMs(a)
    const tb = fileUploadedMs(b)
    if (ta !== null && tb !== null && ta !== tb) return ta - tb
    if (ta === null && tb !== null) return 1
    if (ta !== null && tb === null) return -1
    return a.id.localeCompare(b.id)
  })

  const variants: ClientRevisionVariant[] = []
  const n = rejections.length

  for (let i = 0; i <= n; i++) {
    const prevCut = i === 0 ? null : rejections[i - 1]!.createdAt
    const nextCut = i < n ? rejections[i]!.createdAt : null

    const bucket = sortedAsc.filter((f) => {
      const ft = fileUploadedMs(f)
      // Без валидной метки времени нельзя надёжно отнести файл к раунду — показываем только в последнем варианте (иначе дубли во всех корзинах).
      if (ft === null) return i === n
      if (prevCut !== null && ft <= time(prevCut)) return false
      if (nextCut !== null && ft > time(nextCut)) return false
      return true
    })

    bucket.sort((a, b) => time(b.createdAt) - time(a.createdAt))

    variants.push({
      variantIndex: i,
      displayRound: i + 1,
      files: bucket,
      revisionFeedback: i < n ? rejections[i]!.comment ?? null : null,
    })
  }

  return variants
}
