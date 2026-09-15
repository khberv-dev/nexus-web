import type {DashHeaderNavItem} from "@/components/dashboard-ui/DashTopHeader"
import {SPECIALIST_CABINET_HOME_HREF, specialistSectionHref} from "@/lib/cabinet-shell"

export const SPECIALIST_ROUTE_TABS = [
    // «Главная» — первым пунктом: это стартовый экран после входа.
    {id: "home", icon: "bx-home", label: "Главная", href: SPECIALIST_CABINET_HOME_HREF},
    {id: "orders", icon: "bx-folder", label: "Проекты", href: specialistSectionHref("orders")},
    {id: "portfolio", icon: "bx-image-alt", label: "Портфолио", href: specialistSectionHref("portfolio")},
    {id: "landing", icon: "bx-globe", label: "Лендинг", href: specialistSectionHref("landing")},
    {id: "payments", icon: "bx-credit-card", label: "Выплаты", href: specialistSectionHref("payments")},
    {id: "settings", icon: "bx-cog", label: "Настройки", href: specialistSectionHref("settings")},
] as const

/** Верхняя навигация и выдвижное меню кабинета специалиста — разделы из `SPECIALIST_ROUTE_TABS`. */
export function buildSpecialistCabinetNavItems(
    activeTab: string,
    badgeCountByTab: Partial<Record<string, number>> = {},
): DashHeaderNavItem[] {
    return SPECIALIST_ROUTE_TABS.map(t => ({
        id: t.id,
        href: t.href,
        label: t.label,
        iconClassName: `bx ${t.icon}`,
        active: t.id === activeTab,
        badgeCount: badgeCountByTab[t.id],
    }))
}
