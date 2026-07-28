import type { Prisma } from "@prisma/client"

/**
 * Готовит данные анкеты для клиентских форм: скаляры из Json → string,
 * контакты подтягиваются из User, если в JSON их нет (после сохранения API вырезает phone/email).
 */
export function normalizeClientCabinetFormData(
  formDataJson: Prisma.JsonValue | null | undefined,
  user: { name: string | null; phone: string | null; email: string | null },
): Record<string, string> {
  const out: Record<string, string> = {}
  if (formDataJson && typeof formDataJson === "object" && !Array.isArray(formDataJson)) {
    for (const [k, v] of Object.entries(formDataJson as Record<string, unknown>)) {
      if (v === null || v === undefined) continue
      if (typeof v === "object") continue
      out[k] = String(v)
    }
  }
  if (!out.fullName?.trim() && user.name?.trim()) out.fullName = user.name.trim()
  out.phone = user.phone ?? out.phone ?? ""
  out.email = user.email ?? out.email ?? ""
  return out
}
