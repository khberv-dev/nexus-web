export const STAGE_ORDER = ["CONCEPT", "PLANNING", "VISUALIZATION", "DOCUMENTATION", "SPECIFICATION"] as const

export type StageTypeKey = (typeof STAGE_ORDER)[number]

export function stageOrderIndex(type: string): number {
  const i = (STAGE_ORDER as readonly string[]).indexOf(type)
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

export function sortStages<T extends { type: string }>(stages: T[]): T[] {
  return [...stages].sort((a, b) => stageOrderIndex(a.type) - stageOrderIndex(b.type))
}

/** Все предыдущие этапы в пайплайне приняты — можно открывать этот этап заказчиком. */
export function isStageUnlockedForClient<T extends { type: string; status: string }>(
  stages: T[],
  stageType: string,
): boolean {
  const idx = stageOrderIndex(stageType)
  if (idx === Number.POSITIVE_INFINITY) return false
  const byType = new Map(stages.map((s) => [s.type, s]))
  return STAGE_ORDER.slice(0, idx).every((pt) => byType.get(pt)?.status === "APPROVED")
}

/**
 * Этап по умолчанию для кабинета заказчика: первый по порядку «разблокированный» и ещё не APPROVED.
 * Если все приняты — последний этап в цепочке.
 */
export function getDefaultClientWorkStageType<T extends { type: string; status: string }>(
  stages: T[],
): StageTypeKey {
  const byType = new Map(stages.map((s) => [s.type, s]))
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const t = STAGE_ORDER[i]
    const predsOk = STAGE_ORDER.slice(0, i).every((pt) => byType.get(pt)?.status === "APPROVED")
    if (!predsOk) continue
    const s = byType.get(t)
    if (s && s.status !== "APPROVED") return t
  }
  return STAGE_ORDER[STAGE_ORDER.length - 1]
}

