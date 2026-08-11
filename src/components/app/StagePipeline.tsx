import {StatusBadge} from "./AppCard"
import {MAX_FREE_CLIENT_REVISIONS} from "@/lib/stage-constants"

export type StageStatus =
    | "AWAITING_PAYMENT" | "BLOCKED" | "PENDING" | "UPLOADED" | "MOD_REVIEW" | "MOD_REVISION"
    | "CLIENT_REVIEW" | "CLIENT_REVISION" | "APPROVED" | "EXTRA_PAYMENT"

export interface Stage {
    type: "CONCEPT" | "PLANNING" | "VISUALIZATION" | "DOCUMENTATION" | "SPECIFICATION"
    label: string
    status: StageStatus
    modRound: number
    clientRound: number
    comment?: string
}

const STAGE_BADGE: Record<StageStatus, {
    variant: "done" | "active" | "pending" | "rejected" | "current";
    label: string
}> = {
    AWAITING_PAYMENT: {variant: "pending", label: "Ожидает оплаты"},
    BLOCKED: {variant: "pending", label: "Ждёт предыдущий этап"},
    PENDING: {variant: "pending", label: "Ожидает"},
    UPLOADED: {variant: "current", label: "Загружено"},
    MOD_REVIEW: {variant: "current", label: "На модерации"},
    MOD_REVISION: {variant: "rejected", label: "Доработка"},
    CLIENT_REVIEW: {variant: "current", label: "У заказчика"},
    CLIENT_REVISION: {variant: "rejected", label: "Правки"},
    APPROVED: {variant: "done", label: "Одобрено"},
    EXTRA_PAYMENT: {variant: "rejected", label: "Доп. оплата"},
}

export function StagePipeline({stages, compact = false}: { stages: Stage[]; compact?: boolean }) {
    if (compact) {
        return (
            <div className="d-flex align-items-center gap-2 flex-wrap">
                {stages.map((stage, i) => {
                    const cls =
                        stage.status === "APPROVED" ? "bg-label-success" :
                            stage.status === "BLOCKED" ? "bg-label-secondary" :
                                ["MOD_REVIEW", "CLIENT_REVIEW", "UPLOADED"].includes(stage.status) ? "bg-label-info" :
                                    ["MOD_REVISION", "CLIENT_REVISION", "EXTRA_PAYMENT"].includes(stage.status) ? "bg-label-danger" :
                                        "bg-label-secondary"
                    return (
                        <span key={stage.type} className={`badge ${cls}`}>{stage.label}</span>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="d-flex flex-column gap-3">
            {stages.map((stage, i) => {
                const badge = STAGE_BADGE[stage.status]
                const isDone = stage.status === "APPROVED"
                const isActive = stage.status !== "PENDING" && stage.status !== "BLOCKED"

                return (
                    <div
                        key={stage.type}
                        className={`p-3 rounded border ${isDone ? "border-success bg-label-success" : isActive ? "border-primary" : "border-secondary"}`}
                        style={{opacity: !isActive && i > 0 ? 0.5 : 1}}
                    >
                        <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center gap-2">
                                <div
                                    className={`avatar avatar-sm rounded-circle d-flex align-items-center justify-content-center ${isDone ? "bg-label-success" : "bg-label-secondary"}`}
                                    style={{width: 30, height: 30, fontSize: "0.78rem", fontWeight: 600}}
                                >
                                    {isDone ? <i className="bx bx-check"/> : i + 1}
                                </div>
                                <span className="fw-medium">{stage.label}</span>
                            </div>
                            <StatusBadge variant={badge.variant} label={badge.label}/>
                        </div>

                        {(stage.modRound > 0 || stage.clientRound > 0) && (
                            <div className="d-flex gap-3 mt-2 ps-4">
                                {stage.modRound > 0 && (
                                    <small className="text-muted">
                                        <i className="bx bx-shield me-1"/>Модерация: {stage.modRound} кр.
                                    </small>
                                )}
                                {stage.clientRound > 0 && (
                                    <small className="text-muted">
                                        <i className="bx bx-chat me-1"/>Правки: {stage.clientRound}/{MAX_FREE_CLIENT_REVISIONS}
                                    </small>
                                )}
                            </div>
                        )}

                        {stage.comment && (
                            <div className="alert alert-danger mt-2 mb-0 py-2 px-3" style={{fontSize: "0.82rem"}}>
                                <strong>Комментарий: </strong>{stage.comment}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
