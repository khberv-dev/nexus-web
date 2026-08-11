"use client"

import Link from "next/link"
import type {ReactNode} from "react"

export function DashActionLink({
                                   href,
                                   children,
                                   iconClass,
                                   className = "",
                                   native = false,
                               }: {
    href: string
    children: ReactNode
    iconClass?: string
    className?: string
    native?: boolean
}) {
    const cls = className ? `dash-action-link ${className}` : "dash-action-link"
    if (native) {
        return (
            <a href={href} className={cls}>
                {iconClass ? <i className={`bx ${iconClass}`}/> : null}
                {children}
            </a>
        )
    }
    return (
        <Link href={href} className={cls}>
            {iconClass ? <i className={`bx ${iconClass}`}/> : null}
            {children}
        </Link>
    )
}
