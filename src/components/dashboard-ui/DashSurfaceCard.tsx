import type {CSSProperties, ReactNode} from "react"

type Padding = "md" | "lg" | "none"

export function DashSurfaceCard({
                                    children,
                                    padding = "none",
                                    className = "",
                                    style,
                                }: {
    children: ReactNode
    padding?: Padding
    className?: string
    style?: CSSProperties
}) {
    const padClass =
        padding === "md" ? "dash-surface-card--pad-md" : padding === "lg" ? "dash-surface-card--pad-lg" : ""

    return (
        <div className={`dash-surface-card ${padClass} ${className}`.trim()} style={style}>
            {children}
        </div>
    )
}
