"use client"

type DashFilterTab<T extends string> = {
    id: T
    label: string
    count?: number
}

export function DashFilterTabs<T extends string>({
                                                     tabs,
                                                     activeId,
                                                     onChange,
                                                     ariaLabel,
                                                 }: {
    tabs: DashFilterTab<T>[]
    activeId: T
    onChange: (id: T) => void
    ariaLabel: string
}) {
    return (
        <div className="dash-order-tabs" role="tablist" aria-label={ariaLabel}>
            {tabs.map(t => (
                <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeId === t.id}
                    className={`dash-order-tab${activeId === t.id ? " dash-order-tab--active" : ""}`}
                    onClick={() => onChange(t.id)}
                >
                    {t.label}
                    {typeof t.count === "number" && <span className="dash-order-tab__count">{t.count}</span>}
                </button>
            ))}
        </div>
    )
}
