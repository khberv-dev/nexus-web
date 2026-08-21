"use client"

import Link from "next/link"

type SidebarTab = {
    id: string
    icon: string
    label: string
    href?: string
}

export function DashSidebarNav({
                                   tabs,
                                   activeTab,
                                   onChange,
                                   badgeCountByTab = {},
                                   showLogout = true,
                               }: {
    tabs: readonly SidebarTab[]
    activeTab: string
    onChange?: (tabId: string) => void
    badgeCountByTab?: Record<string, number>
    /** Кнопка выхода внизу сайдбара; отключается там, где выход не нужен. */
    showLogout?: boolean
}) {
    return (
        <div className="dash-sidebar">
            {tabs.map(tab => {
                const badgeCount = badgeCountByTab[tab.id] ?? 0
                const inner = (
                    <>
                        <i className={`bx ${tab.icon}`}/>
                        <span className="dash-sidebar__label">{tab.label}</span>
                        {badgeCount > 0 && <span className="dash-sidebar__badge">{badgeCount}</span>}
                    </>
                )
                return onChange ? (
                    <button
                        key={tab.id}
                        type="button"
                        data-tour={`sidebar-${tab.id}`}
                        className={`dash-sidebar__icon${activeTab === tab.id ? " active" : ""}`}
                        title={tab.label}
                        onClick={() => onChange(tab.id)}
                    >
                        {inner}
                    </button>
                ) : (
                    <Link
                        key={tab.id}
                        href={tab.href ?? "#"}
                        data-tour={`sidebar-${tab.id}`}
                        className={`dash-sidebar__icon${activeTab === tab.id ? " active" : ""}`}
                        title={tab.label}
                    >
                        {inner}
                    </Link>
                )
            })}

            {showLogout && (
                <Link
                    href="/api/auth/signout?callbackUrl=/login"
                    className="dash-sidebar__icon dash-sidebar__icon--logout"
                    title="Выйти из кабинета"
                    data-tour="sidebar-logout"
                >
                    <i className="bx bx-power-off"/>
                    <span className="dash-sidebar__label">Выйти</span>
                </Link>
            )}
        </div>
    )
}
