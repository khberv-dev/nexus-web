import {SPEC_CONTRACT_STATUS_LABEL} from "../constants"
import type {RawSpecialist} from "../../../types"

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
                                if (!confirm("Подтвердить подписание договора? Этап «Договор» будет закрыт.")) return
                                const res = await fetch(`/api/admin/specialists/${specialist.id}/framework-contract/sign`, {method: "POST"})
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok) {
                                    alert(typeof data.error === "string" ? data.error : "Ошибка")
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

                <form
                    onSubmit={async (e) => {
                        e.preventDefault()
                        const el = e.currentTarget
                        const fd = new FormData(el)
                        const res = await fetch(`/api/admin/specialists/${specialist.id}/framework-contract`, {
                            method: "POST",
                            body: fd
                        })
                        if (res.ok) {
                            el.reset()
                            await onRefresh?.()
                        } else {
                            const err = await res.json().catch(() => ({}))
                            alert(typeof err.error === "string" ? err.error : "Ошибка загрузки")
                        }
                    }}
                    style={{display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start"}}
                >
                    <input type="file" name="file" accept=".pdf,application/pdf" required
                           style={{fontSize: "0.78rem", maxWidth: "100%"}}/>
                    <input
                        name="number"
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
                    <button
                        type="submit"
                        style={{
                            padding: "6px 14px",
                            borderRadius: 6,
                            border: "none",
                            background: "var(--adm-active-color)",
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: "0.78rem",
                            cursor: "pointer",
                        }}
                    >
                        Загрузить / заменить исходный PDF
                    </button>
                </form>
            </div>
        </div>
    )
}
