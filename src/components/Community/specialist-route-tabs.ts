import type { DashHeaderNavItem } from "@/components/dashboard-ui/DashTopHeader"
import { SPECIALIST_CABINET_LOGO_HREF } from "@/lib/cabinet-shell"

export const SPECIALIST_ROUTE_TABS = [
  { id: "orders", icon: "bx-folder", label: "Проекты", href: SPECIALIST_CABINET_LOGO_HREF },
  { id: "portfolio", icon: "bx-image-alt", label: "Портфолио", href: `${SPECIALIST_CABINET_LOGO_HREF}?tab=portfolio` },
  { id: "landing", icon: "bx-globe", label: "Лендинг", href: `${SPECIALIST_CABINET_LOGO_HREF}?tab=landing` },
  { id: "payments", icon: "bx-credit-card", label: "Выплаты", href: `${SPECIALIST_CABINET_LOGO_HREF}?tab=payments` },
  { id: "settings", icon: "bx-cog", label: "Настройки", href: `${SPECIALIST_CABINET_LOGO_HREF}?tab=settings` },
] as const

/** Верхняя навигация и выдвижное меню — те же разделы, что в `SPECIALIST_ROUTE_TABS`. */
export function buildSpecialistCabinetNavItems(activeTab: string): DashHeaderNavItem[] {
  return SPECIALIST_ROUTE_TABS.map(t => ({
    href: t.href,
    label: t.label,
    iconClassName: `bx ${t.icon}`,
    active: t.id === activeTab,
  }))
}
