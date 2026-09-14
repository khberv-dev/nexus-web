/**
 * Единые URL кабинетов. Разделы кабинета — отдельные адреса (`/work/portfolio`,
 * `/orders/payments`), а не вкладки в `?tab=`. Новые страницы импортируют отсюда,
 * а не дублируют строки.
 */

/** Разделы кабинета специалиста: /work/<section>. */
export const SPECIALIST_CABINET_SECTIONS = ["orders", "portfolio", "landing", "payments", "settings"] as const
export type SpecialistCabinetSection = (typeof SPECIALIST_CABINET_SECTIONS)[number]

export function specialistSectionHref(section: SpecialistCabinetSection): string {
    return `/work/${section}`
}

/** Заказ специалиста и, опционально, его этап: /work/orders/:id[/:stageType]. */
export function specialistOrderHref(orderId: string, stageType?: string): string {
    const path = `/work/orders/${encodeURIComponent(orderId)}`
    return stageType ? `${path}/${encodeURIComponent(stageType)}` : path
}

/** Разделы кабинета заказчика: список проектов живёт на самом /orders. */
export const CLIENT_CABINET_SECTIONS = ["orders", "payments", "settings"] as const
export type ClientCabinetSection = (typeof CLIENT_CABINET_SECTIONS)[number]

export function clientSectionHref(section: ClientCabinetSection): string {
    return section === "orders" ? "/orders" : `/orders/${section}`
}

/** Логотип NEXUS в шапке ведёт в основной раздел кабинета. */
export const CLIENT_CABINET_LOGO_HREF = clientSectionHref("orders")
export const SPECIALIST_CABINET_LOGO_HREF = specialistSectionHref("orders")

/**
 * «Главная» специалиста: стартовый экран со сводкой, куда попадает специалист
 * сразу после входа (см. src/app/(auth)/auth/continue/page.tsx).
 * Отличается от SPECIALIST_CABINET_LOGO_HREF — тот ведёт в раздел проектов кабинета.
 */
export const SPECIALIST_CABINET_HOME_HREF = "/work" as const
