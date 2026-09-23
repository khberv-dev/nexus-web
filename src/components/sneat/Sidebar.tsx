"use client"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

const navItems = [
    {href: "/work", icon: "bx bx-briefcase", label: "Мои заказы"},
    {href: "/work/payments", icon: "bx bx-credit-card", label: "Платежи"},
    {href: "/work/settings", icon: "bx bx-user", label: "Профиль"},
]

export default function Sidebar() {
    const pathname = usePathname()

    return (
        <aside id="layout-menu" className="layout-menu menu-vertical menu bg-menu-theme">
            <div className="app-brand demo">
                <Link href="/work" className="app-brand-link">
                    <span className="app-brand-text demo menu-text fw-bold ms-2">NEXUS</span>
                </Link>
            </div>

            <div className="menu-divider mt-0"/>
            <div className="menu-inner-shadow"/>

            <ul className="menu-inner py-1">
                {navItems.map(({href, icon, label}) => (
                    <li key={href} className={`menu-item${pathname === href ? " active" : ""}`}>
                        <Link href={href} className="menu-link">
                            <Icon name={stripBx(icon)} className="menu-icon tf-icons"/>
                            <div className="text-truncate">{label}</div>
                        </Link>
                    </li>
                ))}
            </ul>
        </aside>
    )
}
