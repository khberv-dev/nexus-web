"use client"

import type {ReactNode} from "react"

export function DashSectionCard({
                                    title,
                                    className = "",
                                    style,
                                    children,
                                }: {
    title: string
    className?: string
    style?: React.CSSProperties
    children: ReactNode
}) {
    const cls = className ? `dash-cards-container ${className}` : "dash-cards-container"

    return (
        <div className={cls} style={style}>
            <div className="dash-cards-heading-wrap">
                <h3 className="dash-section-heading">{title}</h3>
            </div>
            {children}
        </div>
    )
}
