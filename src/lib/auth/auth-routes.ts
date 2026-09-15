/**
 * Адреса страницы входа/регистрации. Роль и режим живут в пути, а не в состоянии:
 * `/login[/<role>]` — вход, `/register[/<role>]` — регистрация.
 * Администратор только входит: регистрации для него нет.
 */

export const AUTH_ROLES = ["specialist", "client", "admin"] as const
export type AuthRoleSlug = (typeof AUTH_ROLES)[number]
export type AuthMode = "signin" | "signup"

export const DEFAULT_AUTH_ROLE: AuthRoleSlug = "specialist"

export const AUTH_ROLE_LABEL: Record<AuthRoleSlug, string> = {
    specialist: "Специалист",
    client: "Заказчик",
    admin: "Админ",
}

/** Роль в терминах User.role — для /api/auth/register. */
export const AUTH_ROLE_DB: Record<AuthRoleSlug, "SPECIALIST" | "CLIENT" | "ADMIN"> = {
    specialist: "SPECIALIST",
    client: "CLIENT",
    admin: "ADMIN",
}

/** Куда NextAuth ведёт после входа: там роль пользователя выбирает кабинет. */
export const AUTH_CALLBACK = "/auth/continue"

/** Согласие на обработку ПДн (единая страница; `/legal/personal-data` редиректит сюда). */
export const LEGAL_PERSONAL_DATA_HREF = "/privacy"

export function canSignUp(role: AuthRoleSlug): boolean {
    return role !== "admin"
}

/**
 * Разбирает сегмент `[[...role]]`.
 * `null` — адрес невалиден (лишние сегменты или неизвестная роль): страница отдаёт 404.
 */
export function parseAuthRoleSegment(segments: string[] | undefined): AuthRoleSlug | null {
    if (!segments || segments.length === 0) return DEFAULT_AUTH_ROLE
    if (segments.length > 1) return null
    return (AUTH_ROLES as readonly string[]).includes(segments[0]) ? (segments[0] as AuthRoleSlug) : null
}

/**
 * Адрес формы. Роль по умолчанию не пишется в путь; регистрация администратора
 * превращается во вход. `search` (с `?` или без) сохраняется при переключении вкладок.
 */
export function authHref(mode: AuthMode, role: AuthRoleSlug, search = ""): string {
    const effectiveMode: AuthMode = canSignUp(role) ? mode : "signin"
    const base = effectiveMode === "signup" ? "/register" : "/login"
    const path = role === DEFAULT_AUTH_ROLE ? base : `${base}/${role}`
    const query = search.replace(/^\?/, "")
    return query ? `${path}?${query}` : path
}
