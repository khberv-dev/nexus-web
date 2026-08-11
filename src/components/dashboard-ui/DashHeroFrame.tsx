"use client"

import type {ReactNode} from "react"

export function DashHeroFrame({
                                  withAction = false,
                                  children,
                                  action,
                              }: {
    withAction?: boolean
    children: ReactNode
    action?: ReactNode
}) {
    const frameClass = withAction
        ? "dash-hero-wrap dash-hero-wrap--with-action dash-hero-surface"
        : "dash-hero-wrap dash-hero-surface"

    return (
        <div className={frameClass}>
            {children}
            {withAction ? action : null}
        </div>
    )
}
