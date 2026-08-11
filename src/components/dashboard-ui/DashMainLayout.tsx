"use client"

import type {ReactNode} from "react"

export function DashMainLayout({
                                   sidebar,
                                   children,
                               }: {
    sidebar: ReactNode
    children: ReactNode
}) {
    return (
        <div className="dash-body">
            {sidebar}
            <main className="dash-main">
                <div className="dash-main__scroll">{children}</div>
            </main>
        </div>
    )
}
