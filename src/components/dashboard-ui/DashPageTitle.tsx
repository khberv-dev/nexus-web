import type {ReactNode} from "react"

export function DashPageTitle({
                                  children,
                                  large = false,
                                  subtitle,
                              }: {
    children: ReactNode
    large?: boolean
    subtitle?: ReactNode
}) {
    return (
        <div>
            <h1 className={`dash-page-title${large ? " dash-page-title--lg" : ""}`}>{children}</h1>
            {subtitle ? <small className="dash-page-sub">{subtitle}</small> : null}
        </div>
    )
}
