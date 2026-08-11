"use client"

import type {ReactNode} from "react"

export function DashListHeader({
                                   title,
                                   action,
                                   className,
                               }: {
    title: string
    action?: ReactNode
    className?: string
}) {
    return (
        <div className={className ?? "dash-list-heading-wrap"}>
            <h2 className="dash-list-heading">{title}</h2>
            {action}
        </div>
    )
}
