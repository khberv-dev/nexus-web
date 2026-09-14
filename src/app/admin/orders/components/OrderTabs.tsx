"use client"

import Link from "next/link"
import type {AdminOrderTab} from "@/lib/admin-routes"

const TABS: { id: AdminOrderTab; label: string }[] = [
    {id: "overview", label: "Обзор"},
    {id: "stages", label: "Этапы проекта"},
    {id: "manage", label: "Управление"},
]

export function OrderTabs({
                              activeTab,
                              modStagesCount,
                              tabHref,
                          }: {
    activeTab: AdminOrderTab
    modStagesCount: number
    tabHref: (tab: AdminOrderTab) => string
}) {
    return (
        <div className="sp-card" style={{padding: "8px 10px", marginBottom: 12}}>
            <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                {TABS.map((tab) => (
                    <Link
                        key={tab.id}
                        href={tabHref(tab.id)}
                        scroll={false}
                        aria-current={activeTab === tab.id ? "page" : undefined}
                        className={`sp-btn ${activeTab === tab.id ? "sp-btn-primary" : "sp-btn-ghost"}`}
                        style={{textDecoration: "none"}}
                    >
                        {tab.label}
                        {tab.id === "stages" && modStagesCount > 0 ? (
                            <span className="sp-badge sp-badge--danger" style={{fontSize: "0.65rem", marginLeft: 8}}>
                                {modStagesCount}
                            </span>
                        ) : null}
                    </Link>
                ))}
            </div>
        </div>
    )
}
