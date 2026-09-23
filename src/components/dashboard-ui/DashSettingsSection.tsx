import type {CSSProperties, ReactNode} from "react"
import {Icon} from "@/components/ui/icon"
import {stripBx} from "@/lib/icon-map"
import {DashSurfaceCard} from "./DashSurfaceCard"

export function DashSettingsSection({
                                        title,
                                        iconClass,
                                        children,
                                        className = "",
                                        style,
                                    }: {
    title?: ReactNode
    iconClass?: string
    children: ReactNode
    className?: string
    style?: CSSProperties
}) {
    return (
        <DashSurfaceCard className={className} style={style}>
            {title ? (
                <h3 style={{fontSize: "0.82rem", fontWeight: 600, margin: "0 0 12px", color: "var(--dash-text)"}}>
                    {iconClass ?
                        <Icon name={stripBx(iconClass)} style={{marginRight: 6, color: "var(--dash-accent)"}}/> : null}
                    {title}
                </h3>
            ) : null}
            {children}
        </DashSurfaceCard>
    )
}
