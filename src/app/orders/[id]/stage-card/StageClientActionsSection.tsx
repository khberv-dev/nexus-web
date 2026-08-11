"use client"

import {MAX_FREE_CLIENT_REVISIONS} from "@/lib/stage-constants"
import type {OrderStage} from "../types"

export function StageClientActionsSection({
                                              stage,
                                              acting,
                                              showRevision,
                                              setShowRevision,
                                              comment,
                                              setComment,
                                              onApprove,
                                              onRevision,
                                              onOpenRevisionChat,
                                              revisionViaChatOnly,
                                          }: {
    stage: OrderStage
    acting: boolean
    showRevision: boolean
    setShowRevision: (v: boolean) => void
    comment: string
    setComment: (v: string) => void
    onApprove: () => void
    onRevision: () => void
    onOpenRevisionChat?: () => void
    revisionViaChatOnly?: boolean
}) {
    const isClientReview = stage.status === "CLIENT_REVIEW"
    if (!isClientReview) return null

    return (
        <div style={{marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--dash-border)"}}>
            {!showRevision ? (
                <div style={{display: "flex", gap: "0.75rem"}}>
                    <button
                        onClick={onApprove}
                        disabled={acting}
                        style={{
                            padding: "0.6em 1.5em",
                            borderRadius: 8,
                            border: "none",
                            background: "var(--dash-success)",
                            color: "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            cursor: acting ? "default" : "pointer",
                            fontFamily: "inherit",
                            opacity: acting ? 0.7 : 1,
                        }}
                    >
                        {acting ? "…" : "✓ Принять этап"}
                    </button>
                    <button
                        onClick={() => {
                            if (stage.clientRound >= MAX_FREE_CLIENT_REVISIONS - 1) {
                                if (!confirm("Это последний бесплатный раунд правок. После него потребуется доплата. Продолжить?")) return
                            }
                            onOpenRevisionChat?.()
                            setShowRevision(true)
                        }}
                        disabled={acting}
                        style={{
                            padding: "0.6em 1.25em",
                            borderRadius: 8,
                            border: "1.5px solid var(--dash-warn)",
                            background: "transparent",
                            color: "var(--dash-warn)",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            cursor: acting ? "default" : "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        На доработку
                    </button>
                </div>
            ) : revisionViaChatOnly ? (
                <div>
                    <p style={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--dash-text)",
                        marginBottom: "0.5rem"
                    }}>
                        Что нужно доработать?
                    </p>
                    <p style={{
                        fontSize: "0.72rem",
                        color: "var(--dash-muted)",
                        margin: "0 0 0.75rem",
                        lineHeight: 1.45
                    }}>
                        Опишите замечания в чате — дизайнер получит уведомление. Когда закончите, отправьте этап на
                        доработку.
                    </p>
                    <button
                        type="button"
                        onClick={() => onOpenRevisionChat?.()}
                        style={{
                            padding: "0.55em 1.1em",
                            borderRadius: 8,
                            border: "1px solid var(--dash-accent)",
                            background: "var(--dash-accent-bg)",
                            color: "var(--dash-accent)",
                            fontSize: "0.82rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                        }}
                    >
                        <i className="bx bx-message-dots" aria-hidden/>
                        Открыть чат
                    </button>
                    <div style={{display: "flex", gap: "0.5rem", marginTop: "0.85rem", flexWrap: "wrap"}}>
                        <button
                            onClick={onRevision}
                            disabled={acting}
                            style={{
                                padding: "0.55em 1.25em",
                                borderRadius: 8,
                                border: "none",
                                background: "var(--dash-warn)",
                                color: "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                cursor: acting ? "default" : "pointer",
                                fontFamily: "inherit",
                                opacity: acting ? 0.7 : 1,
                            }}
                        >
                            {acting ? "…" : "Отправить на доработку"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowRevision(false)
                                setComment("")
                            }}
                            style={{
                                padding: "0.55em 1em",
                                borderRadius: 8,
                                border: "1.5px solid var(--dash-border)",
                                background: "transparent",
                                color: "var(--dash-muted)",
                                fontSize: "0.875rem",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <p style={{
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "var(--dash-text)",
                        marginBottom: "0.5rem"
                    }}>
                        Что нужно доработать?
                    </p>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Опишите замечания…"
                        rows={3}
                        style={{
                            width: "100%",
                            padding: "0.65em 0.875em",
                            border: "1.5px solid var(--dash-border)",
                            borderRadius: 8,
                            fontSize: "0.875rem",
                            fontFamily: "inherit",
                            resize: "vertical",
                            outline: "none",
                            boxSizing: "border-box",
                            marginBottom: "0.75rem",
                            background: "var(--dash-surface2)",
                            color: "var(--dash-text)",
                        }}
                    />
                    <div style={{display: "flex", gap: "0.5rem"}}>
                        <button
                            onClick={onRevision}
                            disabled={acting}
                            style={{
                                padding: "0.55em 1.25em",
                                borderRadius: 8,
                                border: "none",
                                background: "var(--dash-warn)",
                                color: "#fff",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                cursor: acting ? "default" : "pointer",
                                fontFamily: "inherit",
                                opacity: acting ? 0.7 : 1,
                            }}
                        >
                            {acting ? "…" : "Отправить замечания"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowRevision(false)
                                setComment("")
                            }}
                            style={{
                                padding: "0.55em 1em",
                                borderRadius: 8,
                                border: "1.5px solid var(--dash-border)",
                                background: "transparent",
                                color: "var(--dash-muted)",
                                fontSize: "0.875rem",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}
            {stage.clientRound >= MAX_FREE_CLIENT_REVISIONS - 1 && (
                <p style={{fontSize: "0.75rem", color: "var(--dash-danger)", marginTop: "0.5rem", marginBottom: 0}}>
                    ⚠ Последний бесплатный раунд правок.
                </p>
            )}
        </div>
    )
}

