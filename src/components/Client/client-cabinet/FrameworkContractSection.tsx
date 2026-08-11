"use client"

import {useRef, useState} from "react"
import {StatusBadge} from "@/components/app/AppCard"
import {FRAMEWORK_CONTRACT_BADGE} from "./constants"
import {DocSection} from "./DocSection"
import {FrameworkContractClientGuide} from "./FrameworkContractClientGuide"

export function FrameworkContractSection({
                                             initial,
                                         }: {
    initial: { status: string; number: string | null; hasFile: boolean; hasSignedFile?: boolean }
}) {
    const [state, setState] = useState(initial)
    const [busy, setBusy] = useState(false)
    const [uploadingFile, setUploadingFile] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)
    const badge = FRAMEWORK_CONTRACT_BADGE[state.status] ?? {variant: "pending" as const, label: state.status}

    const refresh = async () => {
        const r = await fetch("/api/client/framework-contract")
        if (!r.ok) return
        const j = (await r.json()) as {
            status: string;
            number: string | null;
            hasFile: boolean;
            hasSignedFile?: boolean
        }
        setState({status: j.status, number: j.number, hasFile: j.hasFile, hasSignedFile: j.hasSignedFile})
    }

    const download = async () => {
        const r = await fetch("/api/client/framework-contract")
        if (!r.ok) return
        const j = (await r.json()) as { downloadUrl?: string | null }
        if (j.downloadUrl) window.open(j.downloadUrl, "_blank", "noopener,noreferrer")
    }

    const uploadSignedContract = async (file: File) => {
        setUploadingFile(true)
        try {
            const res = await fetch("/api/client/framework-contract", {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({filename: file.name}),
            })
            if (!res.ok) return
            const {uploadUrl} = await res.json()
            await fetch(uploadUrl, {
                method: "PUT",
                headers: {"Content-Type": file.type || "application/pdf"},
                body: file
            })
            await refresh()
        } finally {
            setUploadingFile(false)
        }
    }

    const respond = async (action: "sign" | "decline") => {
        if (!confirm(action === "sign" ? "Подтвердить подписание договора?" : "Отказаться от договора? Менеджер свяжется с вами.")) return
        setBusy(true)
        try {
            const r = await fetch("/api/client/framework-contract", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: action === "sign" ? "sign" : "decline"}),
            })
            if (r.ok) {
                await refresh();
                window.location.reload()
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <DocSection title="Договор оказания услуг" icon="bx-file-blank">
            <FrameworkContractClientGuide contractStatus={state.status}/>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display: "none"}}
                   onChange={e => {
                       const f = e.target.files?.[0];
                       if (f) uploadSignedContract(f);
                       e.target.value = ""
                   }}/>

            <div style={{display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 10}}>
                <StatusBadge variant={badge.variant} label={badge.label}/>
                {state.number && <span style={{fontSize: "0.8rem", color: "var(--dash-muted)"}}>№ {state.number}</span>}
            </div>

            {state.status === "NONE" && !state.hasFile && (
                <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0, lineHeight: 1.45}}>
                    Администратор разместит договор в вашей карточке. После подписания вы сможете отправлять брифы на
                    рассмотрение.
                </p>
            )}

            {state.status === "AWAITING_SIGNATURE" && state.hasFile && (
                <p style={{fontSize: "0.82rem", color: "var(--dash-text2)", margin: "0 0 12px", lineHeight: 1.5}}>
                    Договор размещён: скачайте PDF, при необходимости загрузите скан с подписью и нажмите «Подписан»
                    (или «Отказать», если не согласны — с вами свяжется менеджер).
                </p>
            )}

            {state.hasFile && (
                <div style={{display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center"}}>
                    <button type="button" onClick={() => void download()} style={{
                        padding: "0.45em 1em", borderRadius: 8, border: "1px solid var(--dash-accent)",
                        background: "var(--dash-accent-bg)", color: "var(--dash-accent)", fontSize: "0.78rem",
                        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>
                        <i className="bx bx-download" style={{marginRight: 4}}/>Скачать PDF
                    </button>

                    {state.status === "AWAITING_SIGNATURE" && (
                        <>
                            <button type="button" disabled={uploadingFile} onClick={() => fileRef.current?.click()}
                                    style={{
                                        padding: "0.45em 1em",
                                        borderRadius: 8,
                                        border: "1px solid var(--dash-accent)",
                                        background: "transparent",
                                        color: "var(--dash-accent)",
                                        fontSize: "0.78rem",
                                        fontWeight: 600,
                                        cursor: uploadingFile ? "default" : "pointer",
                                        fontFamily: "inherit",
                                        opacity: uploadingFile ? 0.7 : 1,
                                    }}>
                                <i className="bx bx-upload" style={{marginRight: 4}}/>
                                {uploadingFile ? "Загрузка…" : "Загрузить подписанный скан"}
                            </button>
                            <button type="button" disabled={busy} onClick={() => void respond("sign")} style={{
                                padding: "0.45em 1em", borderRadius: 8, border: "none",
                                background: "var(--dash-success, #2d6a2d)", color: "#fff", fontSize: "0.78rem",
                                fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
                            }}>Подписан
                            </button>
                            <button type="button" disabled={busy} onClick={() => void respond("decline")} style={{
                                padding: "0.45em 1em", borderRadius: 8, border: "1px solid var(--dash-danger)",
                                background: "transparent", color: "var(--dash-danger)", fontSize: "0.78rem",
                                fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
                            }}>Отказать
                            </button>
                        </>
                    )}
                </div>
            )}

            {state.hasSignedFile && (
                <p style={{fontSize: "0.75rem", color: "var(--dash-success)", margin: "8px 0 0"}}>
                    ✓ Подписанный скан загружен
                </p>
            )}

            {state.status === "SIGNED_BY_ADMIN" && (
                <p style={{fontSize: "0.78rem", color: "var(--dash-muted)", margin: "8px 0 0", lineHeight: 1.45}}>
                    Подписание договора зафиксировано менеджером. Вы можете отправлять брифы.
                </p>
            )}
            {state.status === "DECLINED_BY_CLIENT" && (
                <p style={{fontSize: "0.78rem", color: "var(--dash-warn)", margin: "8px 0 0"}}>
                    Свяжитесь с менеджером или дождитесь новой версии договора.
                </p>
            )}
        </DocSection>
    )
}
