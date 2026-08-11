"use client"

import type {ReactNode} from "react"

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
                <i className={`bx ${iconClass}`}/>
                {title}
                <span className={`${className}__count`}>{count}</span>
            </div>
            {children}
        </div>
    )
}
