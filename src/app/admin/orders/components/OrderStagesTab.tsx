"use client"

import {useEffect, useMemo, useState} from "react"
import {StageActAdminCard} from "@/components/admin/StageActAdminCard"
import {StatusBadge} from "@/components/app/AppCard"
import {buildAdminStageReleaseWaves} from "@/lib/stage-admin-release-waves"
import type {Order, Stage} from "../types"
import {STAGE_LABEL, STAGE_STATUS_LABEL,} from "../types"
import {StageTabs} from "./StageTabs"
import {StageReleaseWavesSection} from "./stage-waves/StageReleaseWavesSection"
import {StageSummaryCards} from "./StageSummaryCards"
import {StageAdminActions} from "./StageAdminActions"
import {StageExtraPaymentActions} from "./StageExtraPaymentActions"
import {StageRulesTemplatesModal} from "./StageRulesTemplatesModal"

function formatStageDt(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function OrderStagesTab({
                                   order,
                                   orderedStages,
                                   acting,
                                   onReviewStage,
                                   onExtraPayment,
                                   onClientRevision,
                                   onBriefSaved,
                                   onOpenPreview,
                                   onApproveAct,
                                   onRejectAct,
                                   onConfirmAct,
                               }: {
    order: Order
    orderedStages: Stage[]
    acting: string | null
    onReviewStage: (stageId: string, action: "modApprove" | "modRevision", stageName: string) => void
    onExtraPayment: (stageId: string, stageName: string) => void
    onClientRevision?: (stageId: string, action: "accept" | "reject", stageName: string) => void
    onBriefSaved?: () => void
    onOpenPreview: (args: { url: string; filename: string; fileId: string | null; stageId: string }) => void
    onApproveAct: (stageId: string, actId: string) => void
    onRejectAct: (stageId: string, actId: string, comment: string) => void
    onConfirmAct: (stageId: string, actId: string) => void
}) {
    const modStagesCount = useMemo(() => order.stages.filter((s) => s.status === "MOD_REVIEW").length, [order.stages])
    const [activeStageId, setActiveStageId] = useState<string | null>(null)
    const [rulesModalStageId, setRulesModalStageId] = useState<string | null>(null)

    const activeStage = orderedStages.find((s) => s.id === activeStageId) ?? orderedStages[0]
    const rulesModalStage = orderedStages.find((s) => s.id === rulesModalStageId) ?? null

    const setStageInUrl = (stageId: string) => {
        if (typeof window === "undefined") return
        const url = new URL(window.location.href)
        url.hash = `stage-${stageId}`
        window.history.replaceState(null, "", url.toString())
    }

    const selectStage = (stageId: string) => {
        setActiveStageId(stageId)
        setStageInUrl(stageId)
    }

    // Restore selected stage from URL (e.g. #stage-<id>) so refresh doesn't reset.
    useEffect(() => {
        if (typeof window === "undefined") return
        const h = window.location.hash
        if (h && h.startsWith("#stage-")) {
            const fromHash = h.slice("#stage-".length)
            if (orderedStages.some((s) => s.id === fromHash)) {
                setActiveStageId(fromHash)
                return
            }
        }
        // Default: first stage
        setActiveStageId(orderedStages[0]?.id ?? null)
    }, [orderedStages])

    if (!activeStage) return null

    return (
        <div className="sp-card">
            <div className="sp-card-hd"
                 style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                <span className="sp-label">Этапы проекта</span>
                {modStagesCount > 0 && (
                    <span className="sp-badge sp-badge--danger" style={{fontSize: "0.65rem"}}>
            {modStagesCount} на проверке
          </span>
                )}
            </div>
            <div className="sp-card-bd" style={{padding: 0}}>
                {/* Stage tabs (instead of long list) */}
                <StageTabs orderedStages={orderedStages} activeStageId={activeStage.id} onSelectStage={selectStage}/>

                {(() => {
                    const stage = activeStage
                    const isMod = stage.status === "MOD_REVIEW"
                    const {waves, pendingDraft} = buildAdminStageReleaseWaves({
                        status: stage.status,
                        files: stage.files,
                        reviews: stage.reviews ?? [],
                    })

                    return (
                        <div key={stage.id} id={`stage-${stage.id}`}
                             className={`sp-stage-detail-panel${isMod ? " sp-stage-detail-panel--mod" : ""}`}>
                            <div className="sp-stage-detail-panel-hd">
                                <div>
                                    <span
                                        style={{fontWeight: 500, fontSize: "0.85rem"}}>{STAGE_LABEL[stage.type]}</span>
                                    <span style={{fontSize: "0.72rem", color: "var(--adm-muted)", marginLeft: 8}}
                                          title="Счётчики раундов доработки">
                    мод. {stage.modRound} · клиент {stage.clientRound}
                  </span>
                                </div>
                                <div style={{display: "flex", alignItems: "center", gap: 6}}>
                                    <StatusBadge
                                        variant={
                                            stage.status === "APPROVED"
                                                ? "done"
                                                : stage.status === "MOD_REVIEW"
                                                    ? "current"
                                                    : stage.status.includes("REVISION")
                                                        ? "rejected"
                                                        : "pending"
                                        }
                                        label={STAGE_STATUS_LABEL[stage.status]}
                                    />
                                    {stage.rulesSentAt ? (
                                        <span
                                            className="sp-badge sp-badge--info"
                                            title={`Размещено у дизайнера: ${formatStageDt(stage.rulesSentAt)}`}
                                            style={{fontSize: "0.65rem", padding: "0.15em 0.5em"}}
                                        >
                      у дизайнера
                    </span>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="sp-btn sp-btn-ghost"
                                        title="Открыть шаблоны правил и отправку дизайнеру"
                                        style={{fontSize: "0.65rem", padding: "0.2em 0.5em"}}
                                        onClick={() => setRulesModalStageId(stage.id)}
                                    >
                                        <i className="bx bx-magic-wand" style={{marginRight: 3}}/>
                                        Шаблоны
                                    </button>
                                </div>
                            </div>

                            <div className="sp-stage-detail-panel-bd">
                                <StageSummaryCards order={order} stage={stage}/>

                                <StageReleaseWavesSection
                                    stageId={stage.id}
                                    waves={waves}
                                    pendingDraft={pendingDraft}
                                    onOpenPreview={onOpenPreview}
                                    onSetAudience={
                                        onBriefSaved
                                            ? async (fileId, audience) => {
                                                await fetch(`/api/admin/files/${fileId}/audience`, {
                                                    method: "PATCH",
                                                    headers: {"Content-Type": "application/json"},
                                                    body: JSON.stringify({audience}),
                                                })
                                                onBriefSaved()
                                            }
                                            : undefined
                                    }
                                />

                                {order.status !== "DRAFT" && stage.act && stage.act.status !== "PENDING" && (
                                    <StageActAdminCard
                                        stage={stage}
                                        act={stage.act}
                                        onApproveAct={onApproveAct}
                                        onRejectAct={onRejectAct}
                                        onConfirmAct={onConfirmAct}
                                    />
                                )}

                                <StageAdminActions
                                    stage={stage}
                                    acting={acting}
                                    onReviewStage={onReviewStage}
                                    onExtraPayment={onExtraPayment}
                                    onClientRevision={onClientRevision}
                                />

                                <StageExtraPaymentActions
                                    stage={stage}
                                    acting={acting}
                                    onExtraPayment={onExtraPayment}
                                />
                            </div>
                        </div>
                    )
                })()}
            </div>

            {rulesModalStage ? (
                <StageRulesTemplatesModal
                    open={Boolean(rulesModalStageId)}
                    onClose={() => setRulesModalStageId(null)}
                    order={order}
                    stage={rulesModalStage}
                    onChanged={onBriefSaved}
                />
            ) : null}
        </div>
    )
}
