/**
 * URL-иерархия админки: ресурс в пути, фильтры списка — в query.
 *
 *   /admin/specialists                 список (?status=&q=&archived=1)
 *   /admin/specialists/:id             карточка специалиста (вкладка «Основной»)
 *   /admin/specialists/:id/:tab        вкладка карточки
 *   /admin/clients/:id                 карточка заказчика
 *   /admin/orders/:id[/:tab]           карточка заказа
 *
 * Query списка переносится при переходе между записями и вкладками, чтобы фильтр не сбрасывался.
 */

export type QueryInput = URLSearchParams | string | null | undefined

export function withQuery(path: string, query?: QueryInput): string {
    const qs = typeof query === "string" ? query.replace(/^\?/, "") : query?.toString() ?? ""
    return qs ? `${path}?${qs}` : path
}

export const ADMIN_SPECIALIST_TABS = ["main", "contract", "onboarding", "rating", "files", "portfolio", "orders"] as const
export type AdminSpecialistTab = (typeof ADMIN_SPECIALIST_TABS)[number]

export const ADMIN_ORDER_TABS = ["overview", "stages", "manage"] as const
export type AdminOrderTab = (typeof ADMIN_ORDER_TABS)[number]

/** Вкладка по умолчанию живёт на самом ресурсе и отдельным сегментом не пишется. */
function resourcePath(base: string, id: string, tab: string | undefined, defaultTab: string): string {
    const path = `${base}/${encodeURIComponent(id)}`
    return tab && tab !== defaultTab ? `${path}/${tab}` : path
}

export function adminSpecialistHref(id: string, tab?: AdminSpecialistTab, query?: QueryInput): string {
    return withQuery(resourcePath("/admin/specialists", id, tab, "main"), query)
}

export function adminClientHref(id: string, query?: QueryInput): string {
    return withQuery(`/admin/clients/${encodeURIComponent(id)}`, query)
}

export function adminOrderHref(id: string, tab?: AdminOrderTab, query?: QueryInput): string {
    return withQuery(resourcePath("/admin/orders", id, tab, "overview"), query)
}

/**
 * Разбор сегмента вкладки из `[[...tab]]`: `undefined` — вкладка по умолчанию,
 * `null` — такого адреса нет (404). Явный сегмент вкладки по умолчанию тоже 404,
 * чтобы у каждой вкладки был ровно один URL.
 */
export function parseTabSegment<T extends string>(
    segments: string[] | undefined,
    tabs: readonly T[],
): T | undefined | null {
    if (!segments || segments.length === 0) return undefined
    if (segments.length > 1) return null
    const [tab] = segments
    const [defaultTab] = tabs
    if (tab === defaultTab || !(tabs as readonly string[]).includes(tab)) return null
    return tab as T
}

type SearchParamsRecord = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value
}

/** Query без служебных ключей старых ссылок — фильтры остаются, выбор записи уходит в путь. */
function remainingQuery(searchParams: SearchParamsRecord, drop: string[]): URLSearchParams {
    const rest = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
        if (drop.includes(key) || value === undefined) continue
        for (const v of Array.isArray(value) ? value : [value]) rest.append(key, v)
    }
    return rest
}

/**
 * Старые ссылки `?highlight=<id>` (письма, уведомления в БД) → адрес ресурса.
 * Возвращает null, если редирект не нужен.
 */
export function legacyAdminSpecialistRedirect(searchParams: SearchParamsRecord): string | null {
    const id = first(searchParams.highlight)
    return id ? adminSpecialistHref(id, undefined, remainingQuery(searchParams, ["highlight"])) : null
}

export function legacyAdminClientRedirect(searchParams: SearchParamsRecord): string | null {
    const id = first(searchParams.highlight)
    return id ? adminClientHref(id, remainingQuery(searchParams, ["highlight"])) : null
}

/** Заказы: `?highlight=`, `?order=` и старый `?tab=`; `?filter=` переименован в `?status=`. */
export function legacyAdminOrderRedirect(searchParams: SearchParamsRecord): string | null {
    const id = first(searchParams.highlight) ?? first(searchParams.order)
    const legacyFilter = first(searchParams.filter)
    if (!id && !legacyFilter) return null

    const rest = remainingQuery(searchParams, ["highlight", "order", "tab", "filter"])
    if (legacyFilter && legacyFilter !== "ALL" && !rest.has("status")) rest.set("status", legacyFilter)
    if (!id) return withQuery("/admin/orders", rest)

    const tab = first(searchParams.tab)
    const validTab = (ADMIN_ORDER_TABS as readonly string[]).includes(tab ?? "") ? tab as AdminOrderTab : undefined
    return adminOrderHref(id, validTab, rest)
}
