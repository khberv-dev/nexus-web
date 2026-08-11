"use client"

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
                <i className={`bx ${icon}`}/>
                {title}
            </h3>
            {children}
        </div>
    )
}
