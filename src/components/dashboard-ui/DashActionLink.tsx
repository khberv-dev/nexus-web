"use client"

import Link from "next/link"
import type {ReactNode} from "react"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

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
                {iconClass ? <Icon name={stripBx(iconClass)}/> : null}
                {children}
            </a>
        )
    }
    return (
        <Link href={href} className={cls}>
            {iconClass ? <Icon name={stripBx(iconClass)}/> : null}
            {children}
        </Link>
    )
}
