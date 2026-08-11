"use client"

import {useEffect, useState} from "react"
import {toast} from "sonner"
import {EDO_PROVIDER_OPTIONS, parseEdoProviders} from "@/lib/edo-providers"
import {PortfolioLinksField, splitPortfolioLinks} from "@/components/ui/PortfolioLinksField"

const FIELDS = [
    {name: "fullName", label: "ФИО", placeholder: "Иван Иванов"},
    {name: "phone", label: "Телефон", placeholder: "+7 (999) 123-45-67"},
    {name: "city", label: "Город", placeholder: "Москва"},
    {name: "experience", label: "Опыт (лет)", placeholder: "3"},
    {name: "sqm", label: "Реализовано м2", placeholder: "1200"},
    {name: "interiorStyle", label: "Интерьерный стиль", placeholder: "Минимализм, Лофт"},
    {name: "specialty", label: "Специализация", placeholder: "Минимализм · Сканди"},
    {name: "portfolio", label: "Портфолио (ссылка)", placeholder: "https://behance.net/..."},
    {name: "software", label: "Программы", placeholder: "AutoCAD, 3ds Max"},
    {name: "aiServices", label: "Нейросети", placeholder: "ChatGPT, Midjourney"},
]

const TOGGLE_FIELDS = [
    {name: "has3d", label: "3D моделирование"},
    {name: "hasRd", label: "Чертежи"},
]

const TAX_STATUSES = [
    {value: "IP", label: "ИП"},
    {value: "SZ", label: "Самозанятый"},
    {value: "OOO", label: "ООО"},
]

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.55em 0.875em",
    border: "1px solid var(--dash-border)",
    borderRadius: 8,
    fontSize: "0.85rem",
    color: "var(--dash-text)",
    background: "var(--dash-surface2)",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
}

export default function ProfileForm({
                                        initialData,
                                        hideTaxAndRequisites = false,
                                        submitUrl = "/api/specialist/profile",
                                        submitMethod = "POST",
                                        submitLabel = "Сохранить",
                                        savedLabel = "✓ Сохранено",
                                        onSuccess,
                                    }: {
    initialData: Record<string, string>
    hideTaxAndRequisites?: boolean
    submitUrl?: string
    submitMethod?: "POST" | "PATCH"
    submitLabel?: string
    savedLabel?: string
    onSuccess?: (form: Record<string, string>) => void | Promise<void>
}) {
    const normalizeFormData = (data: Record<string, string>): Record<string, string> => ({
        ...data,
        specialty: data.specialty ?? data.specialization ?? "",
    })
    const [form, setForm] = useState(normalizeFormData(initialData))
    const [loading, setLoading] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setForm(normalizeFormData(initialData))
    }, [initialData])

    const lookupInn = async (inn: string) => {
        setForm((p) => ({...p, inn}))
        const cleanInn = inn.replace(/\D/g, "")
        const isIpInn = form.taxStatus === "IP" && cleanInn.length === 12
        const isOooInn = form.taxStatus === "OOO" && cleanInn.length === 10
        if (isIpInn || isOooInn) {
            try {
                const res = await fetch("/api/dadata/party", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({inn: cleanInn})
                })
                const data = await res.json()
                if (data.found) {
                    setForm((p) => ({
                        ...p,
                        ...(form.taxStatus === "IP"
                            ? {ogrnip: data.ogrn ?? p.ogrnip ?? "", ipName: data.fullName ?? ""}
                            : {
                                companyName: data.name ?? p.companyName ?? "",
                                kpp: data.kpp ?? "",
                                ogrn: data.ogrn ?? "",
                                legalAddress: data.address ?? "",
                            }),
                    }))
                }
            } catch {
                toast.error("Не удалось загрузить данные по ИНН. Заполните реквизиты вручную.")
            }
        }
    }

    const lookupBik = async (bik: string) => {
        setForm((p) => ({...p, bankBik: bik}))
        if (bik.replace(/\D/g, "").length === 9) {
            try {
                const res = await fetch("/api/dadata/bank", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({bik: bik.replace(/\D/g, "")})
                })
                const data = await res.json()
                if (data.found) setForm((p) => ({...p, bankName: data.bankName ?? ""}))
            } catch {
                toast.error("Не удалось загрузить данные банка по БИК. Заполните вручную.")
            }
        }
    }

    const [reqPending, setReqPending] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSaved(false)
        setReqPending(null)
        try {
            const finalForm = {
                ...form,
                specialty: form.specialty ?? "",
                specialization: form.specialty ?? "",
                portfolio: splitPortfolioLinks(form.portfolio || "").join("\n"),
            }
            const payload =
                submitMethod === "PATCH" && submitUrl.includes("/api/admin/specialists/")
                    ? {formData: finalForm}
                    : finalForm

            const res = await fetch(submitUrl, {
                method: submitMethod,
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? "Ошибка")
            if (data.requisitesPending) {
                setReqPending(data.message)
            }
            setSaved(true)
            await onSuccess?.(finalForm)
            setTimeout(() => setSaved(false), 2000)
        } catch (e) {
            setError(e instanceof Error ? e.message : "Ошибка")
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {reqPending && (
                <div style={{
                    padding: "10px 14px",
                    marginBottom: 12,
                    borderRadius: 8,
                    background: "rgba(255,193,7,0.12)",
                    border: "1px solid rgba(255,193,7,0.3)",
                    fontSize: "0.82rem",
                    color: "#856404"
                }}>
                    <i className="bx bx-time" style={{marginRight: 6}}/>{reqPending}
                </div>
            )}
            <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem"}}>
                {FIELDS.map((f) => (
                    <div key={f.name} style={f.name === "portfolio" ? {gridColumn: "1 / -1"} : undefined}>
                        <label style={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "var(--dash-muted)",
                            marginBottom: 6
                        }}>{f.label}</label>
                        {f.name === "portfolio" ? (
                            <PortfolioLinksField
                                value={form.portfolio || ""}
                                onChange={(v) => setForm((p) => ({...p, portfolio: v}))}
                                inputStyle={inputStyle}
                                placeholder={f.placeholder}
                                addButtonStyle={{
                                    alignSelf: "flex-start",
                                    padding: "0.4em 0.9em",
                                    borderRadius: 8,
                                    border: "1px dashed var(--dash-border)",
                                    background: "transparent",
                                    color: "var(--dash-muted)",
                                    fontSize: "0.82rem",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                }}
                                removeButtonStyle={{
                                    flexShrink: 0,
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    border: "1px solid var(--dash-border)",
                                    background: "transparent",
                                    color: "var(--dash-muted)",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    lineHeight: 1,
                                }}
                                hintStyle={{fontSize: "0.75rem", color: "var(--dash-muted)"}}
                            />
                        ) : (
                            <input type="text" placeholder={f.placeholder} value={form[f.name] || ""}
                                   onChange={(e) => setForm((p) => ({...p, [f.name]: e.target.value}))}
                                   style={inputStyle}/>
                        )}
                    </div>
                ))}
            </div>

            <div style={{display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap"}}>
                {TOGGLE_FIELDS.map((f) => (
                    <div key={f.name}>
                        <label style={{
                            display: "block",
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "var(--dash-muted)",
                            marginBottom: 6
                        }}>{f.label}</label>
                        <button
                            type="button"
                            onClick={() => setForm((p) => ({...p, [f.name]: p[f.name] === "true" ? "false" : "true"}))}
                            style={{
                                padding: "0.4em 1em",
                                borderRadius: 6,
                                fontSize: "0.82rem",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                border: form[f.name] === "true" ? "1.5px solid var(--dash-success)" : "1.5px solid var(--dash-border)",
                                background: form[f.name] === "true" ? "var(--dash-success-bg)" : "transparent",
                                color: form[f.name] === "true" ? "var(--dash-success)" : "var(--dash-muted)",
                            }}
                        >
                            {form[f.name] === "true" ? "✓ Да" : "Нет"}
                        </button>
                    </div>
                ))}
            </div>

            <div style={{marginBottom: "1rem"}}>
                <label style={{
                    display: "block",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--dash-muted)",
                    marginBottom: 6
                }}>О себе</label>
                <textarea rows={3} placeholder="Расскажите о специализации..." value={form.about || ""}
                          onChange={(e) => setForm((p) => ({...p, about: e.target.value}))}
                          style={{...inputStyle, resize: "vertical", minHeight: 80}}/>
            </div>

            {hideTaxAndRequisites ? (
                <p style={{
                    fontSize: "0.78rem",
                    color: "var(--dash-muted)",
                    margin: "0 0 1rem",
                    lineHeight: 1.45,
                    padding: "0.65rem 0.85rem",
                    background: "var(--dash-surface2)",
                    borderRadius: 8,
                    border: "1px solid var(--dash-border)"
                }}>
                    <i className="bx bx-file-blank"
                       style={{marginRight: 6, color: "var(--dash-accent)", verticalAlign: "middle"}}/>
                    Налоговый статус и банковские реквизиты подтверждаются на шаге договора.
                </p>
            ) : (
                <div style={{marginBottom: "1rem"}}>
                    <label style={{
                        display: "block",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--dash-muted)",
                        marginBottom: 8
                    }}>
                        <i className="bx bx-building" style={{marginRight: 4}}/>Налоговый статус и реквизиты
                    </label>
                    <div style={{display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap"}}>
                        {TAX_STATUSES.map((s) => (
                            <button
                                key={s.value}
                                type="button"
                                onClick={() => setForm((p) => ({...p, taxStatus: s.value}))}
                                style={{
                                    padding: "0.4em 1em",
                                    borderRadius: 6,
                                    fontSize: "0.82rem",
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    border: form.taxStatus === s.value ? "1.5px solid var(--dash-success)" : "1.5px solid var(--dash-border)",
                                    background: form.taxStatus === s.value ? "var(--dash-success-bg)" : "transparent",
                                    color: form.taxStatus === s.value ? "var(--dash-success)" : "var(--dash-muted)",
                                }}
                            >
                                {form.taxStatus === s.value ? "✓ " : ""}{s.label}
                            </button>
                        ))}
                    </div>
                    {(form.taxStatus === "IP" || form.taxStatus === "SZ" || form.taxStatus === "OOO") && (
                        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem"}}>
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    color: "var(--dash-muted)",
                                    marginBottom: 4
                                }}>
                                    ИНН {form.taxStatus === "OOO" ? "(10)" : "(12)"}
                                </label>
                                <input
                                    type="text"
                                    placeholder={form.taxStatus === "OOO" ? "7707083893" : "123456789012"}
                                    value={form.inn || ""}
                                    onChange={(e) => lookupInn(e.target.value)}
                                    style={inputStyle}
                                    maxLength={form.taxStatus === "OOO" ? 10 : 12}
                                />
                                {form.taxStatus === "IP" && form.ipName && <div style={{
                                    fontSize: "0.72rem",
                                    color: "var(--dash-success)",
                                    marginTop: 2
                                }}>{form.ipName}</div>}
                                {form.taxStatus === "OOO" && form.companyName && <div style={{
                                    fontSize: "0.72rem",
                                    color: "var(--dash-success)",
                                    marginTop: 2
                                }}>{form.companyName}</div>}
                            </div>
                            {form.taxStatus === "IP" && (
                                <div>
                                    <label style={{
                                        display: "block",
                                        fontSize: "0.65rem",
                                        fontWeight: 600,
                                        color: "var(--dash-muted)",
                                        marginBottom: 4
                                    }}>ОГРНИП</label>
                                    <input type="text" placeholder="304770000000000" value={form.ogrnip || ""}
                                           onChange={(e) => setForm((p) => ({...p, ogrnip: e.target.value}))}
                                           style={inputStyle} maxLength={15}/>
                                </div>
                            )}
                            {form.taxStatus === "OOO" && (
                                <>
                                    <div>
                                        <label style={{
                                            display: "block",
                                            fontSize: "0.65rem",
                                            fontWeight: 600,
                                            color: "var(--dash-muted)",
                                            marginBottom: 4
                                        }}>Наименование ООО</label>
                                        <input type="text" placeholder="ООО «Пространство»"
                                               value={form.companyName || ""}
                                               onChange={(e) => setForm((p) => ({...p, companyName: e.target.value}))}
                                               style={inputStyle}/>
                                    </div>
                                    <div>
                                        <label style={{
                                            display: "block",
                                            fontSize: "0.65rem",
                                            fontWeight: 600,
                                            color: "var(--dash-muted)",
                                            marginBottom: 4
                                        }}>КПП</label>
                                        <input type="text" placeholder="770701001" value={form.kpp || ""}
                                               onChange={(e) => setForm((p) => ({...p, kpp: e.target.value}))}
                                               style={inputStyle} maxLength={9}/>
                                    </div>
                                    <div>
                                        <label style={{
                                            display: "block",
                                            fontSize: "0.65rem",
                                            fontWeight: 600,
                                            color: "var(--dash-muted)",
                                            marginBottom: 4
                                        }}>ОГРН</label>
                                        <input type="text" placeholder="1027700132195" value={form.ogrn || ""}
                                               onChange={(e) => setForm((p) => ({...p, ogrn: e.target.value}))}
                                               style={inputStyle} maxLength={13}/>
                                    </div>
                                    <div style={{gridColumn: "1 / -1"}}>
                                        <label style={{
                                            display: "block",
                                            fontSize: "0.65rem",
                                            fontWeight: 600,
                                            color: "var(--dash-muted)",
                                            marginBottom: 4
                                        }}>Юридический адрес</label>
                                        <input type="text" placeholder="г. Москва, ул. Примерная, д. 1"
                                               value={form.legalAddress || ""}
                                               onChange={(e) => setForm((p) => ({...p, legalAddress: e.target.value}))}
                                               style={inputStyle}/>
                                    </div>
                                </>
                            )}
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    color: "var(--dash-muted)",
                                    marginBottom: 4
                                }}>{form.taxStatus === "SZ" ? "Счет карты / р/с" : "Р/с"}</label>
                                <input type="text" placeholder="40802810000000000000" value={form.bankAccount || ""}
                                       onChange={(e) => setForm((p) => ({...p, bankAccount: e.target.value}))}
                                       style={inputStyle} maxLength={20}/>
                            </div>
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    color: "var(--dash-muted)",
                                    marginBottom: 4
                                }}>Банк</label>
                                <input type="text" placeholder="АО Т-Банк" value={form.bankName || ""}
                                       onChange={(e) => setForm((p) => ({...p, bankName: e.target.value}))}
                                       style={inputStyle}/>
                            </div>
                            <div>
                                <label style={{
                                    display: "block",
                                    fontSize: "0.65rem",
                                    fontWeight: 600,
                                    color: "var(--dash-muted)",
                                    marginBottom: 4
                                }}>БИК</label>
                                <input type="text" placeholder="044525974" value={form.bankBik || ""}
                                       onChange={(e) => lookupBik(e.target.value)} style={inputStyle} maxLength={9}/>
                            </div>
                            {form.taxStatus === "OOO" && (
                                <div>
                                    <label style={{
                                        display: "block",
                                        fontSize: "0.65rem",
                                        fontWeight: 600,
                                        color: "var(--dash-muted)",
                                        marginBottom: 4
                                    }}>Корр. счет</label>
                                    <input type="text" placeholder="30101810000000000000" value={form.corrAccount || ""}
                                           onChange={(e) => setForm((p) => ({...p, corrAccount: e.target.value}))}
                                           style={inputStyle} maxLength={20}/>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div style={{marginBottom: "1rem"}}>
                <label style={{
                    display: "block",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--dash-muted)",
                    marginBottom: 8
                }}>
                    <i className="bx bx-transfer-alt" style={{marginRight: 4}}/>ЭДО
                </label>
                <div style={{display: "flex", flexWrap: "wrap", gap: "0.4rem"}}>
                    {EDO_PROVIDER_OPTIONS.map((o) => {
                        const set = parseEdoProviders(form.edoProviders)
                        const on = set.has(o.id)
                        return (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => {
                                    const next = new Set(set)
                                    if (on) next.delete(o.id)
                                    else next.add(o.id)
                                    setForm((p) => ({...p, edoProviders: [...next].join(",")}))
                                }}
                                style={{
                                    padding: "0.35em 0.85em",
                                    borderRadius: 100,
                                    fontSize: "0.78rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    border: on ? "1.5px solid var(--dash-accent)" : "1.5px solid var(--dash-border)",
                                    background: on ? "var(--dash-accent-bg)" : "transparent",
                                    color: on ? "var(--dash-accent)" : "var(--dash-muted)",
                                }}
                            >
                                {on && <span style={{marginRight: "0.3em"}}>✓</span>}
                                {o.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {error && <div style={{
                background: "var(--dash-danger-bg)",
                border: "1px solid var(--dash-danger)",
                borderRadius: 8,
                padding: "0.6rem 1rem",
                marginBottom: "1rem",
                color: "var(--dash-danger)",
                fontSize: "0.82rem"
            }}>{error}</div>}

            <button
                type="submit"
                disabled={loading || saved}
                style={{
                    padding: "0.6em 1.5em",
                    borderRadius: 8,
                    border: "none",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    fontFamily: "inherit",
                    background: saved ? "var(--dash-success)" : "var(--dash-accent)",
                    color: "#fff",
                    cursor: loading || saved ? "default" : "pointer",
                    opacity: loading ? 0.7 : 1,
                }}
            >
                {saved ? savedLabel : loading ? "Сохранение..." : submitLabel}
            </button>
        </form>
    )
}
