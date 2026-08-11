"use client"

import {AdminBriefSummaryPanel} from "@/components/admin/AdminBriefSummaryPanel"
import {ContractPanel} from "@/components/admin/ContractPanel"
import type {Order} from "../types"

export function OrderOverviewTab({
                                     order,
                                     acting,
                                     onOpenBriefEditor,
                                     onBriefApprove,
                                     onBriefReject,
                                     onBriefSaved,
                                     onGenerateContract,
                                     onSendContractToClient,
                                     onConfirmContract,
                                 }: {
    order: Order
    acting: string | null
    onOpenBriefEditor: () => void
    onBriefApprove: (orderId: string) => void
    onBriefReject: (orderId: string) => void
    onBriefSaved?: () => void
    onGenerateContract: (orderId: string) => void
    onSendContractToClient: (orderId: string) => void
    onConfirmContract: (orderId: string) => void
}) {
    const bd = order.briefData

    return (
        <>
            <AdminBriefSummaryPanel
                orderId={order.id}
                briefData={bd}
                briefHelpRequested={order.briefHelpRequested}
                briefStep={order.briefStep}
                briefVideoFile={order.briefVideoFile ?? null}
                showWizardStep={order.status === "DRAFT"}
                onOpenFullEditor={onOpenBriefEditor}
            />

            {order.status !== "DRAFT" && (
                <ContractPanel
                    contract={order.contracts?.[0] ?? null}
                    orderId={order.id}
                    canGenerate={true}
                    canSendToClient={true}
                    canConfirm={true}
                    onGenerate={() => onGenerateContract(order.id)}
                    onSendToClient={() => onSendContractToClient(order.id)}
                    onConfirm={() => onConfirmContract(order.id)}
                />
            )}

            {order.payments.length > 0 && (
                <div className="sp-card" style={{padding: "10px 12px", marginBottom: 16}}>
                    <div style={{
                        fontSize: "0.65rem",
                        color: "var(--adm-muted)",
                        textTransform: "uppercase",
                        marginBottom: 6
                    }}>
                        Платежи
                    </div>
                    <div style={{display: "flex", gap: 16, fontSize: "0.82rem"}}>
                        {[
                            {s: "HELD", l: "Удержано", c: "var(--adm-active-color)"},
                            {s: "RELEASED", l: "Выплачено", c: "#22c55e"},
                            {s: "PENDING", l: "Ожидает", c: "#f59e0b"},
                        ].map((p) => {
                            const sum = order.payments.filter((x) => x.status === p.s).reduce((a, x) => a + x.amount, 0)
                            return sum > 0 ? (
                                <div key={p.s}>
                                    <span style={{color: "var(--adm-muted)"}}>{p.l}: </span>
                                    <span style={{
                                        fontWeight: 600,
                                        color: p.c
                                    }}>{(sum / 100).toLocaleString("ru-RU")} руб.</span>
                                </div>
                            ) : null
                        })}
                    </div>
                </div>
            )}

            {order.status === "BRIEF_REVIEW" && (
                <div className="sp-brief-actions">
                    <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 8}}>
                        <i className="bx bx-file" style={{color: "var(--adm-active-color)", fontSize: "1.1rem"}}/>
                        <span style={{fontWeight: 500, fontSize: "0.85rem"}}>Бриф на проверке</span>
                    </div>
                    <div style={{display: "flex", gap: 8}}>
                        <button onClick={() => onBriefApprove(order.id)} disabled={acting !== null}
                                className="sp-btn sp-btn-success">
                            {acting === "brief-approve" ? "…" : "Одобрить бриф"}
                        </button>
                        <button onClick={() => onBriefReject(order.id)} disabled={acting !== null}
                                className="sp-btn sp-btn-danger">
                            Вернуть бриф
                        </button>
                    </div>
                </div>
            )}

            {/* keep prop for consistency; used by parent refresh */}
            {onBriefSaved ? null : null}
        </>
    )
}

