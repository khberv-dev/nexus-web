"use client"

import type {ReactNode} from "react"

/** Тело кабинета под шапкой. Разделы переключаются вкладками в DashTopHeader — боковой панели нет. */
export function DashMainLayout({children}: { children: ReactNode }) {
    return (
        <div className="dash-body">
            <main className="dash-main">
                <div className="dash-main__scroll">{children}</div>
            </main>
        </div>
    )
}
