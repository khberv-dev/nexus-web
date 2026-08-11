/** Правовые формы с полным блоком реквизитов (юрлица). */
export const CLIENT_LEGAL_ENTITY_FORMS = ["ООО", "АО", "ПАО"] as const
export const CLIENT_LEGAL_FORMS_ALL = [...CLIENT_LEGAL_ENTITY_FORMS, "ИП"] as const

export type ClientLegalForm = (typeof CLIENT_LEGAL_FORMS_ALL)[number]

function trimStr(v: unknown): string {
    return typeof v === "string" ? v.trim() : ""
}

function onlyDigits(s: string): string {
    return s.replace(/\D/g, "")
}

/**
 * Проверка обязательных реквизитов заказчика. Возвращает текст ошибки или null.
 */
export function validateClientRequisitesForm(form: Record<string, unknown>): string | null {
    const legalForm = trimStr(form.legalForm)
    if (!CLIENT_LEGAL_FORMS_ALL.includes(legalForm as ClientLegalForm)) {
        return "Выберите правовую форму: ООО, АО, ПАО или ИП."
    }

    const inn = onlyDigits(trimStr(form.inn))
    const bik = onlyDigits(trimStr(form.bankBik))

    if (CLIENT_LEGAL_ENTITY_FORMS.includes(legalForm as (typeof CLIENT_LEGAL_ENTITY_FORMS)[number])) {
        if (!trimStr(form.company)) return "Заполните наименование организации."
        if (inn.length !== 10) return "Укажите ИНН организации (10 цифр). Данные можно подставить через DaData."
        if (!trimStr(form.kpp)) return "Заполните КПП."
        if (!trimStr(form.ogrn)) return "Заполните ОГРН."
        if (!trimStr(form.legalAddress)) return "Заполните юридический адрес."
        if (!trimStr(form.bankAccount)) return "Заполните расчетный счет."
        if (!trimStr(form.bankName)) return "Укажите наименование банка."
        if (bik.length !== 9) return "Укажите БИК (9 цифр). Реквизиты банка можно подставить через DaData."
        if (!trimStr(form.corrAccount)) return "Заполните корреспондентский счет."
        return null
    }

    // ИП
    if (!trimStr(form.company)) return "Заполните наименование / ФИО ИП (как в ЕГРИП)."
    if (inn.length !== 12) return "Укажите ИНН (12 цифр). Данные можно подставить через DaData."
    if (!trimStr(form.ogrn)) return "Заполните ОГРНИП."
    if (!trimStr(form.legalAddress)) return "Заполните адрес регистрации."
    if (!trimStr(form.bankAccount)) return "Заполните расчетный счет."
    if (!trimStr(form.bankName)) return "Укажите наименование банка."
    if (bik.length !== 9) return "Укажите БИК (9 цифр). Реквизиты банка можно подставить через DaData."
    if (!trimStr(form.corrAccount)) return "Заполните корреспондентский счет."
    return null
}

/** Можно ли пускать заказчика в кабинет /orders без анкеты реквизитов. */
export function isClientCabinetProfileComplete(formData: unknown): boolean {
    if (formData == null || typeof formData !== "object" || Array.isArray(formData)) return false
    return validateClientRequisitesForm(formData as Record<string, unknown>) === null
}
