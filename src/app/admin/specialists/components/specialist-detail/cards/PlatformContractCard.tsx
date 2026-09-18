import {useState} from "react"
import {DocumentUpload} from "@/components/app/DocumentUpload"
import {canAdminUploadSpecialistContract} from "@/lib/contract-upload-lock"
import {uploadWithProgress} from "@/lib/upload-progress"
import {SPEC_CONTRACT_STATUS_LABEL} from "../constants"
import type {RawSpecialist} from "../../../types"
import {confirmDialog} from "@/lib/dialog-store"
import {toast} from "sonner"

const CONTRACT_LOCK_HINT: Record<string, string> = {
    AWAITING_SIGNATURE: "Ожидает подписи специалиста — новую версию можно загрузить после отказа",
    SIGNED_BY_SPECIALIST: "Специалист прислал подписанный PDF — подтвердите подписание",
    SIGNED_BY_ADMIN: "Договор подписан и зафиксирован",
}

export function PlatformContractCard({
                                         specialist,
                                         profile,
                                         onRefresh,
                                     }: {
    specialist: RawSpecialist
    profile?: RawSpecialist["specialistProfile"] | null
    onRefresh?: () => Promise<void>
}) {
    const p = profile
    const uploadOpen = canAdminUploadSpecialistContract(p?.specialistContractStatus, Boolean(p?.specialistContractS3Key))
    const [file, setFile] = useState<File | null>(null)
    const [number, setNumber] = useState("")
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const uploadSource = async () => {
        if (!file) return
        const ok = await confirmDialog({
            title: "Отправить договор специалисту?",
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
            const res = await uploadWithProgress(`/api/admin/specialists/${specialist.id}/framework-contract`, fd, {
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
            await onRefresh?.()
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка загрузки")
        } finally {
            setUploading(false)
        }
    }
    const signedUploadedAt = p?.specialistSignedContractUploadedAt
        ? new Date(p.specialistSignedContractUploadedAt).toLocaleString("ru-RU")
        : null

    const openContract = async (kind: "source" | "signed") => {
        const r = await fetch(`/api/admin/specialists/${specialist.id}/framework-contract`)
        const j = await r.json().catch(() => ({}))
        const url = kind === "source" ? j.downloadUrl : j.signedDownloadUrl
        if (r.ok && url) window.open(url, "_blank", "noopener,noreferrer")
    }

    return (
        <div className="sp-card">
            <div className="sp-card-hd"><span className="sp-label">Договор с платформой</span></div>
            <div className="sp-card-bd">
                <p style={{fontSize: "0.75rem", color: "var(--adm-muted)", margin: "0 0 10px", lineHeight: 1.45}}>
                    Администратор загружает исходный PDF. Специалист скачивает его в онбординге, подписывает и загружает
                    подписанный PDF обратно. После проверки нажмите подтверждение ниже.
                </p>
                <div style={{fontSize: "0.78rem", marginBottom: 10}}>
                    <span style={{color: "var(--adm-muted)"}}>Статус: </span>
                    <strong style={{color: "var(--adm-text)"}}>
                        {SPEC_CONTRACT_STATUS_LABEL[p?.specialistContractStatus ?? "NONE"] ?? (p?.specialistContractStatus ?? "NONE")}
                    </strong>
                    {p?.specialistContractNumber && (
                        <span style={{color: "var(--adm-muted)", marginLeft: 8}}>№ {p.specialistContractNumber}</span>
                    )}
                </div>

                {p?.specialistSignedContractS3Key && (
                    <div
                        style={{
                            marginBottom: 12,
                            padding: "10px 12px",
                            borderRadius: 8,
                            background: "rgba(52,211,153,0.08)",
                            border: "1px solid rgba(52,211,153,0.18)",
                            color: "#34d399",
                            fontSize: "0.78rem",
                        }}
                    >
                        <strong style={{display: "block", marginBottom: 4}}>Подписанный файл получен</strong>
                        <span style={{color: "var(--adm-text)"}}>
              {signedUploadedAt ? `Загружен специалистом: ${signedUploadedAt}` : "Файл загружен специалистом"}
            </span>
                    </div>
                )}

                <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12}}>
                    {p?.specialistContractS3Key && (
                        <button
                            type="button"
                            className="sp-btn sp-btn-ghost"
                            style={{fontSize: "0.78rem"}}
                            onClick={() => void openContract("source")}
                        >
                            <i className="bx bx-download" style={{marginRight: 4}}/>
                            Исходный PDF
                        </button>
                    )}
                    {p?.specialistSignedContractS3Key && (
                        <button
                            type="button"
                            className="sp-btn sp-btn-ghost"
                            style={{fontSize: "0.78rem"}}
                            onClick={() => void openContract("signed")}
                        >
                            <i className="bx bx-file" style={{marginRight: 4}}/>
                            Подписанный PDF
                        </button>
                    )}
                </div>

                {p?.specialistContractStatus === "SIGNED_BY_SPECIALIST" && (
                    <div style={{marginBottom: 12}}>
                        <button
                            type="button"
                            onClick={async () => {
                                if (!(await confirmDialog({
                                    title: "Подтвердить подписание договора?",
                                    description: "Этап «Договор» будет закрыт. Это действие нельзя отменить.",
                                    variant: "warning",
                                }))) return
                                const res = await fetch(`/api/admin/specialists/${specialist.id}/framework-contract/sign`, {method: "POST"})
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok) {
                                    toast.error(typeof data.error === "string" ? data.error : "Ошибка")
                                    return
                                }
                                await onRefresh?.()
                            }}
                            style={{
                                padding: "8px 14px",
                                borderRadius: 6,
                                border: "none",
                                background: "var(--dash-success, #16a34a)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                cursor: "pointer",
                            }}
                        >
                            Подтвердить подписание договора
                        </button>
                        {!p?.specialistSignedContractS3Key && (
                            <p style={{fontSize: "0.72rem", color: "var(--adm-muted)", margin: "8px 0 0"}}>
                                Специалист подтвердил подписание без загрузки файла. Для нового сценария попросите
                                загрузить подписанный PDF.
                            </p>
                        )}
                    </div>
                )}

                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                    <DocumentUpload
                        tone="admin"
                        size="sm"
                        label={uploadOpen && p?.specialistContractS3Key ? "Новая версия договора (PDF)" : "Исходный PDF договора"}
                        file={file}
                        onFileChange={(f) => {
                            setFile(f)
                            setError(null)
                        }}
                        disabled={uploading}
                        progress={uploading ? progress : null}
                        error={error}
                        submitted={uploadOpen ? null : {
                            title: "Договор отправлен специалисту",
                            submittedAt: p?.specialistContractUploadedAt ?? null,
                            hint: CONTRACT_LOCK_HINT[p?.specialistContractStatus ?? ""] ?? "Загрузка новой версии закрыта",
                            onDownload: () => void openContract("source"),
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
                                    onClick={() => void uploadSource()}
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
                                    {uploading ? "Отправка…" : "Отправить договор специалисту"}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
