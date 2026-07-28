import { STEPS } from "@/app/orders/new/briefConfig"

/** Число шагов мастера брифа на /orders/new */
export const BRIEF_WIZARD_STEP_COUNT = STEPS.length

/** Подпись экрана мастера по индексу из Order.briefStep (0-based) */
export function briefWizardStepLabel(stepIndex: number): string {
  const i = Math.min(Math.max(0, stepIndex | 0), STEPS.length - 1)
  return STEPS[i]?.label ?? `Шаг ${stepIndex + 1}`
}

/** Для админки: «3/6 · Бюджет и сроки» */
export function formatBriefWizardProgress(stepIndex: number): string {
  const n = Math.min(Math.max(0, stepIndex | 0) + 1, BRIEF_WIZARD_STEP_COUNT)
  return `${n}/${BRIEF_WIZARD_STEP_COUNT} · ${briefWizardStepLabel(stepIndex)}`
}

/** Ориентир для полосы «заполнено полей» в кабинете (в мастере десятки полей) */
export const BRIEF_FILLED_FIELDS_TARGET = 28

export function countFilledBriefFields(brief: Record<string, unknown> | null | undefined): number {
  if (!brief || typeof brief !== "object") return 0
  let n = 0
  for (const [k, v] of Object.entries(brief)) {
    if (k.startsWith("_")) continue
    if (v == null) continue
    const s = typeof v === "string" ? v : String(v)
    if (s.trim() !== "") n += 1
  }
  return n
}

export function briefListProgressWidthPercent(filled: number): number {
  return Math.min(100, Math.round((filled / BRIEF_FILLED_FIELDS_TARGET) * 100))
}

function trunc(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** Одна строка под заголовком заказа: новый мастер + старые поля анкеты */
export function formatDraftBriefPreviewLine(brief: Record<string, unknown> | null | undefined): string {
  if (!brief || typeof brief !== "object") return ""
  const parts: string[] = []
  const objectType = typeof brief.objectType === "string" ? brief.objectType : ""
  const objAddress = typeof brief.objAddress === "string" ? brief.objAddress : ""
  const companySegment = typeof brief.companySegment === "string" ? brief.companySegment : ""
  const objArea = typeof brief.objArea === "string" ? brief.objArea : typeof brief.objArea === "number" ? String(brief.objArea) : ""
  const styleDir = typeof brief.styleDir === "string" ? brief.styleDir : ""
  const legacyArea = typeof brief.area === "string" ? brief.area : ""
  const legacyStyle = typeof brief.style === "string" ? brief.style : ""
  const legacyRooms = typeof brief.rooms === "string" ? brief.rooms : ""

  if (objectType) parts.push(objectType)
  if (objAddress) parts.push(trunc(objAddress, 48))
  else if (companySegment && !objectType) parts.push(trunc(companySegment, 36))
  if (objArea) parts.push(`${objArea} м²`)

  if (!parts.length && legacyArea) parts.push(legacyArea)
  if (!parts.length && companySegment) parts.push(trunc(companySegment, 36))

  const style = styleDir || legacyStyle
  if (style) parts.push(trunc(style.split(",")[0]!.trim(), 42))
  if (!parts.length && legacyRooms) parts.push(legacyRooms)

  return parts.filter(Boolean).slice(0, 4).join(" · ")
}
