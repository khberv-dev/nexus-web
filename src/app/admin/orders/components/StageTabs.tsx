"use client"

import type {Stage} from "../types"
import {STAGE_LABEL} from "../types"

export function StageTabs({
                              orderedStages,
                              activeStageId,
                              onSelectStage,
                          }: {
    orderedStages: Stage[]
    activeStageId: string
    onSelectStage: (stageId: string) => void
}) {
    return (
        <div
            style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--adm-sidebar-border)",
                background: "var(--adm-outer)",
                overflowX: "auto",
            }}
        >
            <div style={{display: "flex", gap: 6, flexWrap: "nowrap", minWidth: "max-content"}}>
                {orderedStages.map((s) => {
                    const isOn = s.id === activeStageId
                    const hasMod = s.status === "MOD_REVIEW"
                    const actNeedsAdmin = s.act?.status === "SPECIALIST_UPLOADED" || s.act?.status === "CLIENT_SIGNED"
                    return (
                        <button
                            key={`tab-${s.id}`}
                            type="button"
                            className={`sp-btn sp-btn-sm ${isOn ? "sp-btn-primary" : "sp-btn-ghost"}`}
                            onClick={() => onSelectStage(s.id)}
                            style={{display: "inline-flex", alignItems: "center", gap: 6}}
                        >
                            {STAGE_LABEL[s.type]}
                            {hasMod ? <span className="sp-badge sp-badge--danger"
                                            style={{fontSize: "0.6rem"}}>!</span> : null}
                            {!hasMod && actNeedsAdmin ? (
                                <span className="sp-badge sp-badge--warn" style={{fontSize: "0.6rem"}}
                                      title="Акт ждёт действия">
                  акт
                </span>
                            ) : null}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

