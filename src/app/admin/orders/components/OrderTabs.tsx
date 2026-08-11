"use client"

export type OrderDetailTab = "overview" | "stages" | "manage"

export function OrderTabs({
                              activeTab,
                              modStagesCount,
                              onTabChange,
                          }: {
    activeTab: OrderDetailTab
    modStagesCount: number
    onTabChange: (tab: OrderDetailTab) => void
}) {
    return (
        <div className="sp-card" style={{padding: "8px 10px", marginBottom: 12}}>
            <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                <button
                    type="button"
                    className={`sp-btn ${activeTab === "overview" ? "sp-btn-primary" : "sp-btn-ghost"}`}
                    onClick={() => onTabChange("overview")}
                >
                    Обзор
                </button>
                <button
                    type="button"
                    className={`sp-btn ${activeTab === "stages" ? "sp-btn-primary" : "sp-btn-ghost"}`}
                    onClick={() => onTabChange("stages")}
                >
                    Этапы проекта
                    {modStagesCount > 0 ? (
                        <span className="sp-badge sp-badge--danger" style={{fontSize: "0.65rem", marginLeft: 8}}>
              {modStagesCount}
            </span>
                    ) : null}
                </button>
                <button
                    type="button"
                    className={`sp-btn ${activeTab === "manage" ? "sp-btn-primary" : "sp-btn-ghost"}`}
                    onClick={() => onTabChange("manage")}
                >
                    Управление
                </button>
            </div>
        </div>
    )
}

