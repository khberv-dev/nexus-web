"use client"

import {useState} from "react"
import {DocumentUpload} from "@/components/app/DocumentUpload"
import {canAdminUploadClientContract} from "@/lib/contract-upload-lock"
import {uploadWithProgress} from "@/lib/upload-progress"
import {confirmDialog} from "@/lib/dialog-store"

const CONTRACT_LOCK_HINT: Record<string, string> = {
    AWAITING_SIGNATURE: "Ожидает подписи заказчика — новую версию можно загрузить после отказа",
    SIGNED_BY_CLIENT: "Заказчик подписал договор",
    SIGNED_BY_ADMIN: "Подписание зафиксировано менеджером",
}

/** Загрузка договора оказания услуг: после отправки заказчику форма закрыта до его отказа. */
export function ClientContractUpload({
                                         clientId,
                                         status,
                                         fileKey,
                                         uploadedAt,
                                         onUploaded,
                                     }: {
    clientId: string
    status: string | null | undefined
    /** S3-ключ загруженного договора; null — договора ещё нет. */
    fileKey: string | null | undefined
    uploadedAt?: string | null
    onUploaded: () => void | Promise<void>
}) {
    const hasFile = Boolean(fileKey)
    const uploadOpen = canAdminUploadClientContract(status, hasFile)
    const [file, setFile] = useState<File | null>(null)
    const [number, setNumber] = useState("")
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const openSource = async () => {
        if (!fileKey) return
        const r = await fetch("/api/admin/s3-url?key=" + encodeURIComponent(fileKey))
        const j = await r.json().catch(() => ({})) as { url?: string | null }
        if (r.ok && j.url) window.open(j.url, "_blank", "noopener,noreferrer")
    }

    const upload = async () => {
        if (!file) return
        const ok = await confirmDialog({
            title: "Отправить договор заказчику?",
            description: "Это действие нельзя отменить.",
            variant: "warning",
        })
        if (!ok) return
        setUploading(true)
        setProgress(0)
        setError(null)
        try {
            const fd = new FormData()
            fd.set("file", file)
            if (number.trim()) fd.set("number", number.trim())
            const res = await uploadWithProgress(`/api/admin/clients/${clientId}/framework-contract`, fd, {
                onProgress: ({percent}) => setProgress(percent),
            })
            if (!res.ok) {
                let message = "Ошибка загрузки"
                try {
                    const err = JSON.parse(res.text || "{}") as { error?: string }
                    if (typeof err.error === "string") message = err.error
                } catch { /* ответ не JSON — оставляем общий текст */ }
                setError(message)
                return
            }
            setFile(null)
            setNumber("")
            await onUploaded()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка загрузки")
        } finally {
            setUploading(false)
        }
    }

    return (
        <div style={{display: "flex", flexDirection: "column", gap: 8}}>
            <DocumentUpload
                tone="admin"
                size="sm"
                label={uploadOpen && hasFile ? "Новая версия договора (PDF)" : "PDF договора"}
                file={file}
                onFileChange={(f) => {
                    setFile(f)
                    setError(null)
                }}
                disabled={uploading}
                progress={uploading ? progress : null}
                error={error}
                submitted={uploadOpen ? null : {
                    title: "Договор отправлен заказчику",
                    submittedAt: uploadedAt ?? null,
                    hint: CONTRACT_LOCK_HINT[status ?? ""] ?? "Загрузка новой версии закрыта",
                    onDownload: hasFile ? () => void openSource() : undefined,
                }}
            />
            {uploadOpen && (
                <>
                    <input
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        disabled={uploading}
                        placeholder="Номер договора (необязательно)"
                        style={{
                            width: "100%",
                            maxWidth: 320,
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--adm-sidebar-border)",
                            background: "var(--adm-outer)",
                            color: "var(--adm-text)",
                            fontSize: "0.8rem",
                        }}
                    />
                    <div>
                        <button
                            type="button"
                            disabled={!file || uploading}
                            onClick={() => void upload()}
                            style={{
                                padding: "6px 14px",
                                borderRadius: 6,
                                border: "none",
                                background: "var(--adm-active-color)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                cursor: !file || uploading ? "not-allowed" : "pointer",
                                opacity: !file || uploading ? 0.6 : 1,
                            }}
                        >
                            {uploading ? "Отправка…" : "Отправить договор заказчику"}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
