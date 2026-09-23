"use client"

import type {ReactNode} from "react"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

export function DashSignalListBlock({
                                        className,
                                        iconClass,
                                        title,
                                        count,
                                        children,
                                    }: {
    className: string
    iconClass: string
    title: string
    count: number
    children: ReactNode
}) {
    return (
        <div className={className}>
            <div className={`${className}__hd`}>
                <Icon name={stripBx(iconClass)}/>
                {title}
                <span className={`${className}__count`}>{count}</span>
            </div>
            {children}
        </div>
    )
}
