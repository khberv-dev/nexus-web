"use client"

import type {ReactNode} from "react"

export function DashEmptyState({
                                   iconClass,
                                   message,
                                   className,
                                   style,
                                   children,
                               }: {
    iconClass: string
    message: ReactNode
    className?: string
    style?: React.CSSProperties
    children?: ReactNode
}) {
    return (
        <div className={className ?? "dash-empty"} style={style}>
            <i className={`bx ${iconClass}`}/>
            <p style={{margin: 0, fontSize: 13}}>{message}</p>
            {children}
        </div>
    )
}
