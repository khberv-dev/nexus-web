/**
 * Имя пользователя хранится раздельно: `User.firstName` + `User.lastName`.
 * Чистый модуль без prisma — им пользуются и роуты, и клиентские компоненты.
 */

export type UserNameParts = {
    firstName?: string | null
    lastName?: string | null
}

export const MAX_NAME_PART_LENGTH = 80

function clean(value: unknown): string {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

/** «Имя Фамилия»; пустая строка, если обе части пусты. */
export function formatUserName(user: UserNameParts | null | undefined): string {
    if (!user) return ""
    return [clean(user.firstName), clean(user.lastName)].filter(Boolean).join(" ")
}

/** Имя для интерфейса: «Имя Фамилия», иначе почта, иначе запасная подпись. */
export function userDisplayName(
    user: (UserNameParts & { email?: string | null }) | null | undefined,
    fallback = "",
): string {
    return formatUserName(user) || clean(user?.email) || fallback
}

/** Первая буква имени (или почты) для аватара-заглушки. */
export function userInitial(user: (UserNameParts & { email?: string | null }) | null | undefined): string {
    return (userDisplayName(user, "?")[0] ?? "?").toUpperCase()
}

/**
 * Разбивает строку «Имя Фамилия» на части: первое слово — имя, остаток — фамилия.
 * Нужен только там, где имя приходит одной строкой извне (OIDC-профиль, демо-данные).
 */
export function splitFullName(full: string | null | undefined): { firstName: string | null; lastName: string | null } {
    const text = clean(full)
    if (!text) return {firstName: null, lastName: null}
    const [first, ...rest] = text.split(" ")
    return {firstName: first, lastName: rest.join(" ") || null}
}

export type ParsedNameParts = { firstName: string | null; lastName: string | null }

/** Ключи имени, которые не хранятся в анкетах (formData): источник истины — поля User. */
const NAME_FORM_KEYS = ["fullName", "firstName", "lastName"] as const

/** Копия анкеты без полей имени — перед сохранением formData в профиль. */
export function omitNameFields<T extends Record<string, unknown>>(formData: T): Omit<T, (typeof NAME_FORM_KEYS)[number]> {
    const rest = {...formData}
    for (const key of NAME_FORM_KEYS) delete rest[key]
    return rest
}

/**
 * Проверяет пришедшие от клиента имя и фамилию.
 * `required` — обе части обязательны (регистрация); иначе пустые значения превращаются в null.
 * Возвращает текст ошибки для пользователя или разобранные части.
 */
export function parseNameParts(
    input: { firstName?: unknown; lastName?: unknown },
    {required = false}: { required?: boolean } = {},
): { error: string } | ParsedNameParts {
    for (const key of ["firstName", "lastName"] as const) {
        const value = input[key]
        if (value !== undefined && value !== null && typeof value !== "string") {
            return {error: key === "firstName" ? "Имя имеет неверный формат" : "Фамилия имеет неверный формат"}
        }
    }
    const firstName = clean(input.firstName)
    const lastName = clean(input.lastName)
    if (required && !firstName) return {error: "Введите имя"}
    if (required && !lastName) return {error: "Введите фамилию"}
    if (firstName.length > MAX_NAME_PART_LENGTH || lastName.length > MAX_NAME_PART_LENGTH) {
        return {error: `Имя и фамилия — не длиннее ${MAX_NAME_PART_LENGTH} символов`}
    }
    return {firstName: firstName || null, lastName: lastName || null}
}
