/** Поля анкеты заказчика (ClientProfile.formData) — для админки */

export type ClientProfileFieldDef = { key: string; label: string }

export type ClientProfileSectionDef = {
    id: string
    label: string
    icon: string
    fields: ClientProfileFieldDef[]
}

export const CLIENT_PROFILE_SECTIONS: ClientProfileSectionDef[] = [
    {
        id: "contact",
        label: "Контакты и представитель",
        icon: "bx-user",
        fields: [
            {key: "fullName", label: "ФИО"},
            {key: "email", label: "Email"},
            {key: "phone", label: "Телефон"},
            {key: "website", label: "Сайт"},
            {key: "city", label: "Город"},
            {key: "position", label: "Должность / роль"},
        ],
    },
    {
        id: "company",
        label: "Компания",
        icon: "bx-buildings",
        fields: [
            {key: "legalForm", label: "Правовая форма"},
            {key: "company", label: "Наименование организации / ИП"},
            {key: "inn", label: "ИНН"},
            {key: "kpp", label: "КПП"},
            {key: "ogrn", label: "ОГРН / ОГРНИП"},
            {key: "legalAddress", label: "Юр. адрес / адрес регистрации"},
        ],
    },
    {
        id: "bank",
        label: "Банковские реквизиты",
        icon: "bx-credit-card",
        fields: [
            {key: "bankAccount", label: "Расчетный счет"},
            {key: "bankName", label: "Банк"},
            {key: "bankBik", label: "БИК"},
            {key: "corrAccount", label: "Корр. счет"},
        ],
    },
    {
        id: "project",
        label: "О проекте",
        icon: "bx-message-detail",
        fields: [
            {key: "about", label: "О задачах и проекте"},
            {key: "objectType", label: "Тип объекта (из анкеты)"},
        ],
    },
]

export function resolveClientProfileValue(
    key: string,
    fd: Record<string, string> | null | undefined,
    fallbacks: { email: string; phone: string | null; name: string | null },
): string {
    const f = fd ?? {}
    if (key === "email") return (f.email || fallbacks.email || "").trim()
    if (key === "phone") return (f.phone || fallbacks.phone || "").trim()
    if (key === "fullName") return (f.fullName || fallbacks.name || "").trim()
    const v = f[key]
    return typeof v === "string" ? v.trim() : ""
}

export function isClientProfileValueFilled(s: string): boolean {
    return s.trim().length > 0
}

export function clientProfileSectionStats(
    section: ClientProfileSectionDef,
    fd: Record<string, string> | null | undefined,
    fallbacks: { email: string; phone: string | null; name: string | null },
): { filled: number; total: number } {
    let filled = 0
    for (const field of section.fields) {
        if (isClientProfileValueFilled(resolveClientProfileValue(field.key, fd, fallbacks))) filled++
    }
    return {filled, total: section.fields.length}
}
