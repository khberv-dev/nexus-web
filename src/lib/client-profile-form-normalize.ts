import type {Prisma} from "@prisma/client"

/**
 * Готовит данные анкеты для клиентских форм: скаляры из Json → string,
 * имя и контакты подтягиваются из User (после сохранения API вырезает имя, phone и email).
 */
export function normalizeClientCabinetFormData(
    formDataJson: Prisma.JsonValue | null | undefined,
    user: { firstName: string | null; lastName: string | null; phone: string | null; email: string | null },
): Record<string, string> {
    const out: Record<string, string> = {}
    if (formDataJson && typeof formDataJson === "object" && !Array.isArray(formDataJson)) {
        for (const [k, v] of Object.entries(formDataJson as Record<string, unknown>)) {
            if (v === null || v === undefined) continue
            if (typeof v === "object") continue
            out[k] = String(v)
        }
    }
    // Имя всегда из User: в анкете оно не хранится (старые записи с fullName игнорируем).
    delete out.fullName
    out.firstName = user.firstName ?? ""
    out.lastName = user.lastName ?? ""
    out.phone = user.phone ?? out.phone ?? ""
    out.email = user.email ?? out.email ?? ""
    return out
}
