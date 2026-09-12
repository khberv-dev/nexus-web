"use client"

import {useId, useState} from "react"
import type {OrderStage, StageAct} from "../types"
import {ACT_STATUS_LABEL} from "../types"
import {actWaitingMessage} from "./actWaitingMessage"
import {UploadingCards, type UploadItem} from "@/components/app/UploadingCard"
import {uploadWithProgress} from "@/lib/upload-progress"

export function StageActSection({
                                    stage,
                                    effectiveAct,
                                    clientActSubmitted,
                                    clientCanUploadSignedAct,
                                    actUploading,
                                    actUploadError,
                                    setActUploading,
                                    setActUploadError,
                                    onActUploaded,
                                }: {
    stage: OrderStage
    effectiveAct: StageAct
    clientActSubmitted: boolean
    clientCanUploadSignedAct: boolean
    actUploading: boolean
    actUploadError: string | null
    setActUploading: (v: boolean) => void
    setActUploadError: (v: string | null) => void
    onActUploaded: (act: StageAct) => void
}) {
    const inputId = useId()
    const [uploadItem, setUploadItem] = useState<UploadItem | null>(null)

    return (
        <div
            style={{
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: 8,
                background: clientActSubmitted
                    ? "var(--dash-success-bg)"
                    : clientCanUploadSignedAct
                        ? "var(--dash-accent-bg)"
                        : "var(--dash-surface2)",
                border: `1.5px solid ${
                    clientActSubmitted ? "var(--dash-success)" : clientCanUploadSignedAct ? "var(--dash-accent)" : "var(--dash-border)"
                }`,
            }}
        >
            <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                <i
                    className={`bx ${clientActSubmitted ? "bx-check-circle" : clientCanUploadSignedAct ? "bx-edit" : "bx-time-five"}`}
                    style={{
                        fontSize: "1.1rem",
                        color: clientActSubmitted ? "var(--dash-success)" : clientCanUploadSignedAct ? "var(--dash-accent)" : "var(--dash-muted)",
                    }}
                />
                <span
                    style={{
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        color: clientActSubmitted ? "var(--dash-success)" : clientCanUploadSignedAct ? "var(--dash-accent)" : "var(--dash-text)",
                    }}
                >
          {clientActSubmitted
              ? effectiveAct.status === "CONFIRMED"
                  ? "Акт подтверждён"
                  : "Акт отправлен"
              : clientCanUploadSignedAct
                  ? "Акт выполненных работ"
                  : effectiveAct.status === "SPECIALIST_UPLOADED"
                      ? "Акт на проверке у администратора"
                      : "Ожидание акта от дизайнера"}
        </span>
            </div>

            {clientActSubmitted ? (
                <>
                    {(effectiveAct.clientSignedAt || effectiveAct.signedAt) && (
                        <p style={{fontSize: "0.82rem", color: "var(--dash-muted)", margin: "0 0 6px"}}>
                            Подписан{" "}
                            {new Date(effectiveAct.clientSignedAt || effectiveAct.signedAt!).toLocaleDateString("ru-RU")}
                        </p>
                    )}
                    {effectiveAct.status === "CLIENT_SIGNED" && (
                        <p style={{fontSize: "0.78rem", color: "var(--dash-muted)", margin: 0}}>
                            Ожидайте подтверждения администратором — после этого будет зафиксирован перевод оплаты
                            специалисту.
                        </p>
                    )}
                    {effectiveAct.status === "CONFIRMED" && (
                        <p style={{fontSize: "0.78rem", color: "var(--dash-muted)", margin: 0}}>Акт подтверждён
                            администратором.</p>
                    )}
                </>
            ) : clientCanUploadSignedAct ? (
                <>
                    <p style={{fontSize: "0.82rem", color: "var(--dash-muted)", margin: "0 0 10px"}}>
                        Скачайте акт, подпишите и загрузите PDF — это нужно для перевода оплаты специалисту после
                        проверки администратором.
                    </p>
                    {effectiveAct.specialistActS3Key ? (
                        <div style={{
                            marginBottom: 10,
                            fontSize: "0.82rem",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap"
                        }}>
                            <i className="bx bx-file-pdf" style={{color: "#e74c3c"}}/>
                            <a
                                href={`/api/stages/${stage.id}/act/download`}
                                target="_blank"
                                rel="noreferrer"
                                style={{color: "var(--dash-accent)", textDecoration: "none", fontWeight: 500}}
                            >
                                <i className="bx bx-download" style={{marginRight: 4}}/>
                                Скачать акт от дизайнера
                            </a>
                        </div>
                    ) : null}

                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        id={inputId}
                        disabled={actUploading}
                        style={{display: "none"}}
                        onChange={async (e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ""
                            if (!file) return

                            if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
                                setActUploadError("Загрузите файл в формате PDF")
                                return
                            }
                            if (file.size > 50 * 1024 * 1024) {
                                setActUploadError("Размер файла не должен превышать 50МБ")
                                return
                            }

                            setActUploadError(null)
                            setActUploading(true)
                            setUploadItem({
                                id: "act", name: file.name, size: file.size,
                                mimeType: file.type, progress: 0, status: "uploading",
                            })
                            const patchCard = (patch: Partial<UploadItem>) =>
                                setUploadItem((prev) => (prev ? {...prev, ...patch} : prev))

                            const fd = new FormData()
                            fd.append("file", file)
                            let res
                            try {
                                res = await uploadWithProgress(`/api/stages/${stage.id}/act/client-sign`, fd, {
                                    onProgress: ({percent}) => patchCard({progress: percent}),
                                })
                            } catch {
                                setActUploading(false)
                                setActUploadError("Ошибка сети при загрузке файла")
                                patchCard({status: "error", error: "Ошибка сети"})
                                return
                            }

                            setActUploading(false)
                            const parsed = (() => {
                                try {
                                    return JSON.parse(res.text || "null") as { act?: StageAct; error?: string } | null
                                } catch {
                                    return null
                                }
                            })()
                            if (!res.ok) {
                                const message = typeof parsed?.error === "string"
                                    ? parsed.error
                                    : "Не удалось загрузить файл"
                                setActUploadError(message)
                                patchCard({status: "error", error: message})
                                return
                            }
                            patchCard({progress: 100, status: "done"})
                            setUploadItem(null)
                            if (parsed?.act) onActUploaded(parsed.act)
                        }}
                    />
                    <label
                        htmlFor={inputId}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "0.55em 1.25em",
                            borderRadius: 8,
                            border: "1px solid var(--dash-border)",
                            background: actUploading ? "var(--dash-border)" : "var(--dash-accent)",
                            color: actUploading ? "var(--dash-muted)" : "#fff",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            cursor: actUploading ? "not-allowed" : "pointer",
                            fontFamily: "inherit",
                        }}
                    >
                        <i className="bx bx-upload"/>
                        {actUploading ? "Загрузка…" : "Загрузить подписанный акт (PDF)"}
                    </label>
                    {uploadItem ? (
                        <div style={{marginTop: 10}}>
                            <UploadingCards items={[uploadItem]}/>
                        </div>
                    ) : null}
                    {actUploadError ? (
                        <p style={{
                            fontSize: "0.78rem",
                            color: "var(--dash-danger)",
                            margin: "8px 0 0"
                        }}>{actUploadError}</p>
                    ) : null}
                </>
            ) : (
                <>
                    <p style={{fontSize: "0.82rem", color: "var(--dash-muted)", margin: "0 0 6px"}}>
                        {actWaitingMessage(effectiveAct)}
                    </p>
                    <p style={{fontSize: "0.72rem", color: "var(--dash-muted)", margin: 0}}>
                        Текущий статус: {ACT_STATUS_LABEL[effectiveAct.status] ?? effectiveAct.status}
                    </p>
                </>
            )}
        </div>
    )
}

