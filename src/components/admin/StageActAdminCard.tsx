"use client"

import {useState} from "react"
import {StatusBadge} from "@/components/app/AppCard"
import type {ActStatus, Stage, StageAct} from "@/app/admin/orders/types"
import {ACT_STATUS_LABEL, ACT_STATUS_VARIANT} from "@/app/admin/orders/types"

function formatDate(dateString: string | null): string {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function ActFileLink({stageId, s3Key, label}: { stageId: string; s3Key: string | null; label: string }) {
    if (!s3Key) return null
    return (
        <a
            href={`/api/stages/${stageId}/act/download`}
            target="_blank"
            rel="noreferrer"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#34d399",
                fontSize: "0.85rem",
                textDecoration: "none",
            }}
        >
            <i className="bx bx-download"/>
            {label}
        </a>
    )
}

/** Карточка акта для одного этапа (админ-модерация). */
export function StageActAdminCard({
                                      stage,
                                      act,
                                      onApproveAct,
                                      onRejectAct,
                                      onConfirmAct,
                                  }: {
    stage: Stage
    act: StageAct
    onApproveAct: (stageId: string, actId: string) => void | Promise<void>
    onRejectAct: (stageId: string, actId: string, comment: string) => void | Promise<void>
    onConfirmAct: (stageId: string, actId: string) => void | Promise<void>
}) {
    const [rejecting, setRejecting] = useState(false)
    const [rejectComment, setRejectComment] = useState("")
    const [acting, setActing] = useState(false)

    const statusLabel = ACT_STATUS_LABEL[act.status as ActStatus] || act.status
    const variant = ACT_STATUS_VARIANT[act.status as ActStatus] || "pending"

    const handleApprove = async () => {
        if (!confirm("Одобрить акт и отправить заказчику для подписания?")) return
        setActing(true)
        try {
            await onApproveAct(stage.id, act.id)
        } finally {
            setActing(false)
        }
    }

    const submitReject = async () => {
        if (!rejectComment.trim()) {
            alert("Пожалуйста, укажите причину отклонения")
            return
        }
        setActing(true)
        setRejecting(false)
        try {
            await onRejectAct(stage.id, act.id, rejectComment)
        } finally {
            setActing(false)
        }
    }

    const handleConfirm = async () => {
        if (!confirm("Подтвердить акт? Это активирует следующий этап (если есть).")) return
        setActing(true)
        try {
            await onConfirmAct(stage.id, act.id)
        } finally {
            setActing(false)
        }
    }

    return (
        <>
            <div
                style={{
                    border: "1px solid var(--adm-border)",
                    borderRadius: 8,
                    padding: "12px",
                    marginTop: 10,
                    background:
                        act.status === "REJECTED"
                            ? "rgba(234,84,85,0.06)"
                            : act.status === "CONFIRMED"
                                ? "rgba(46,184,92,0.06)"
                                : "rgba(255,255,255,0.02)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                        gap: "8px",
                    }}
                >
                    <div style={{display: "flex", alignItems: "center", gap: 8}}>
                        <i className="bx bx-file-blank" style={{fontSize: "1.1rem", color: "var(--adm-muted)"}}/>
                        <span style={{fontWeight: 600, fontSize: "0.88rem"}}>Акт этапа</span>
                    </div>
                    <StatusBadge variant={variant} label={statusLabel}/>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 8,
                        fontSize: "0.75rem",
                    }}
                >
                    <div>
                        <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Статус</div>
                        <div style={{fontWeight: 500}}>{statusLabel}</div>
                    </div>
                    {act.specialistUploadedAt ? (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Загружен</div>
                            <div>{formatDate(act.specialistUploadedAt)}</div>
                        </div>
                    ) : null}
                    {act.adminApprovedAt ? (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Проверен</div>
                            <div>{formatDate(act.adminApprovedAt)}</div>
                        </div>
                    ) : null}
                    {act.clientSignedAt ? (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Подписан клиентом</div>
                            <div>{formatDate(act.clientSignedAt)}</div>
                        </div>
                    ) : null}
                    {act.adminConfirmedAt ? (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Подтверждён</div>
                            <div>{formatDate(act.adminConfirmedAt)}</div>
                        </div>
                    ) : null}
                </div>

                <div style={{display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8, fontSize: "0.8rem"}}>
                    <ActFileLink stageId={stage.id} s3Key={act.specialistActS3Key} label="Акт от дизайнера"/>
                    <ActFileLink stageId={stage.id} s3Key={act.clientActS3Key} label="Акт от заказчика"/>
                </div>

                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                    {act.status === "SPECIALIST_UPLOADED" && (
                        <p style={{fontSize: "0.72rem", color: "var(--adm-muted)", margin: 0, lineHeight: 1.35}}>
                            «Одобрить» открывает заказчику скачивание акта и загрузку подписанного PDF. «Подтвердить»
                            (финально) — только после того, как заказчик загрузит подпись.
                        </p>
                    )}
                    {act.status === "CLIENT_SIGNED" && (
                        <p style={{fontSize: "0.72rem", color: "var(--adm-muted)", margin: 0, lineHeight: 1.35}}>
                            Заказчик загрузил подписанный акт — проверьте и подтвердите.
                        </p>
                    )}
                    <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
                        {act.status === "SPECIALIST_UPLOADED" && (
                            <>
                                <button onClick={() => void handleApprove()} disabled={acting}
                                        className="sp-btn sp-btn-success sp-btn-sm">
                                    {acting ? "…" : "Одобрить"}
                                </button>
                                <button
                                    onClick={() => {
                                        setRejecting(true)
                                        setRejectComment("")
                                    }}
                                    disabled={acting}
                                    className="sp-btn sp-btn-danger sp-btn-sm"
                                >
                                    На доработку
                                </button>
                            </>
                        )}
                        {act.status === "CLIENT_SIGNED" && (
                            <button onClick={() => void handleConfirm()} disabled={acting}
                                    className="sp-btn sp-btn-success sp-btn-sm">
                                {acting ? "…" : "Подтвердить"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {rejecting && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                    }}
                    onClick={() => setRejecting(false)}
                >
                    <div
                        style={{
                            background: "#1a1a1a",
                            borderRadius: 12,
                            padding: 24,
                            width: 420,
                            maxWidth: "90vw",
                            color: "#fff",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16
                        }}>
                            <h3 style={{margin: 0, fontSize: "1.1rem"}}>Акт на доработку</h3>
                            <button
                                type="button"
                                onClick={() => setRejecting(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#999",
                                    cursor: "pointer",
                                    fontSize: "1.2rem",
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <p style={{color: "#999", fontSize: "0.85rem", marginBottom: 16}}>Укажите причину возврата акта
                            на доработку</p>
                        <textarea
                            className="sp-textarea"
                            rows={4}
                            placeholder="Причина возврата…"
                            value={rejectComment}
                            onChange={(e) => setRejectComment(e.target.value)}
                            autoFocus
                            style={{marginBottom: 16}}
                        />
                        <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                            <button type="button" onClick={() => setRejecting(false)} disabled={acting}
                                    className="sp-btn sp-btn-ghost">
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={() => void submitReject()}
                                disabled={!rejectComment.trim() || acting}
                                className="sp-btn sp-btn-danger"
                            >
                                Отправить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
