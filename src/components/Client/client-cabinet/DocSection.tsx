"use client"

import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"

export function DocSection({
                               title,
                               icon,
                               children,
                           }: {
    title: string
    icon: string
    children: React.ReactNode
}) {
    return (
        <div className="dash-doc-section dash-glass-panel">
            <h3 className="dash-doc-section__title">
                <Icon name={stripBx(icon)}/>
                {title}
            </h3>
            {children}
        </div>
    )
}
