"use client"

import {useEffect, useMemo, useState} from "react"
import {toast} from "sonner"
import {DashSettingsSection} from "@/components/dashboard-ui/DashSettingsSection"
import {validateClientRequisitesForm} from "@/lib/client-requisites-validation"
import {EDO_PROVIDER_OPTIONS, parseEdoProviders} from "@/lib/edo-providers"
import {LEGAL_FORMS, POSITION_CHIPS} from "./constants"

const settingsInputStyle: React.CSSProperties = {
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

function SettingsChip({label, active, onClick}: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "0.35em 0.85em",
                borderRadius: 100,
                fontSize: "0.78rem",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                border: active ? "1.5px solid var(--dash-accent)" : "1.5px solid var(--dash-border)",
                background: active ? "var(--dash-accent-bg)" : "transparent",
                color: active ? "var(--dash-accent)" : "var(--dash-text2)",
            }}
        >
            {active && <span style={{marginRight: "0.3em"}}>✓</span>}
            {label}
        </button>
    )
}

export function SettingsTab({name, email, formData}: {
    name: string;
    email: string;
    formData: Record<string, string>
}) {
    const formSeedKey = useMemo(() => JSON.stringify(formData), [formData])
    const [form, setForm] = useState<Record<string, string>>(() => ({...formData}))
    useEffect(() => {
        setForm({...formData})
        // formSeedKey — стабильный снимок formData с сервера
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formSeedKey])
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const initials = (name || email)[0].toUpperCase()

    const isIP = form.legalForm === "ИП"
    const isLegal = ["ООО", "АО", "ПАО"].includes(form.legalForm ?? "")

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        setSaved(false)
        const reqErr = validateClientRequisitesForm(form)
        if (reqErr) {
            setError(reqErr)
            return
        }
        const el = e.currentTarget
        if (!el.checkValidity()) {
            el.reportValidity()
            return
        }
        setSaving(true)
        try {
            const res = await fetch("/api/mock-client/apply", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(form),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as { error?: string }
                throw new Error(body.error ?? "Ошибка сохранения")
            }
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Не удалось сохранить")
        } finally {
            setSaving(false)
        }
    }

    const lookupInn = async (inn: string) => {
        setForm(f => ({...f, inn}))
        const clean = inn.replace(/\D/g, "")
        if ((isIP && clean.length === 12) || (isLegal && clean.length === 10)) {
            try {
                const res = await fetch("/api/dadata/party", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({inn: clean}),
                })
                const data = await res.json()
                if (data.found) {
                    setForm(f => ({
                        ...f,
                        company: data.name ?? f.company ?? "",
                        kpp: data.kpp ?? "",
                        ogrn: data.ogrn ?? "",
                        legalAddress: data.address ?? "",
                    }))
                }
            } catch {
                toast.error("Не удалось загрузить данные по ИНН. Заполните реквизиты вручную.")
            }
        }
    }

    const lookupBik = async (bik: string) => {
        setForm(f => ({...f, bankBik: bik}))
        if (bik.replace(/\D/g, "").length === 9) {
            try {
                const res = await fetch("/api/dadata/bank", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({bik: bik.replace(/\D/g, "")}),
                })
                const data = await res.json()
                if (data.found) {
                    setForm(f => ({...f, bankName: data.bankName ?? "", corrAccount: data.corrAccount ?? ""}))
                }
            } catch {
                toast.error("Не удалось загрузить данные банка по БИК. Заполните вручную.")
            }
        }
    }

    const F = ({label, required, children}: { label: string; required?: boolean; children: React.ReactNode }) => (
        <div style={{marginBottom: "1rem"}}>
            <label
                style={{
                    display: "block",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--dash-muted)",
                    marginBottom: 5,
                }}
            >
                {label}
                {required && <span style={{color: "var(--dash-danger)", marginLeft: 4}}>*</span>}
            </label>
            {children}
        </div>
    )

    return (
        <div>
            <DashSettingsSection
                className="dash-surface-card--pad-lg dash-surface-card--mb"
                style={{display: "flex", alignItems: "center", gap: "1rem"}}
            >
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, hsl(247,60%,58%), hsl(282,60%,48%))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                        color: "#fff",
                        flexShrink: 0,
                    }}
                >
                    {initials}
                </div>
                <div style={{flex: 1}}>
                    <p style={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "var(--dash-text)",
                        margin: "0 0 2px"
                    }}>{name || "—"}</p>
                    <p style={{fontSize: "0.78rem", color: "var(--dash-muted)", margin: 0}}>{email}</p>
                    {(form.phone ?? "").trim() && (
                        <p style={{fontSize: "0.78rem", color: "var(--dash-muted)", margin: "2px 0 0"}}>
                            {form.phone}
                        </p>
                    )}
                </div>
                <span style={{fontSize: "0.72rem", color: saved ? "var(--dash-success)" : "transparent"}}>
          {saved ? "✓ Сохранено" : "·"}
        </span>
            </DashSettingsSection>

            <form onSubmit={handleSave} noValidate>
                <div className="rwd-grid-2" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16}}>
                    <DashSettingsSection title="Контактные данные" iconClass="bx bx-user"
                                         className="dash-surface-card--pad-md">
                        <F label="ФИО">
                            <input
                                type="text"
                                value={form.fullName || name || ""}
                                onChange={e => setForm(p => ({...p, fullName: e.target.value}))}
                                style={settingsInputStyle}
                            />
                        </F>
                        <F label="Email">
                            <input
                                type="email"
                                value={form.email || email}
                                onChange={e => setForm(p => ({...p, email: e.target.value}))}
                                style={settingsInputStyle}
                            />
                        </F>
                        <F label="Телефон">
                            <input type="tel" value={form.phone || ""}
                                   onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                                   style={settingsInputStyle}/>
                        </F>
                        <F label="Сайт">
                            <input
                                type="url"
                                placeholder="https://..."
                                value={form.website || ""}
                                onChange={e => setForm(p => ({...p, website: e.target.value}))}
                                style={settingsInputStyle}
                            />
                        </F>
                        <F label="Город">
                            <input type="text" value={form.city || ""}
                                   onChange={e => setForm(p => ({...p, city: e.target.value}))}
                                   style={settingsInputStyle}/>
                        </F>
                        <F label="ЭДО">
                            <p style={{
                                fontSize: "0.72rem",
                                color: "var(--dash-muted)",
                                margin: "0 0 8px",
                                lineHeight: 1.4
                            }}>
                                Электронный документооборот: Контур.Диадок, Такском, СБИС, 1С-ЭДО — отметьте, чем
                                пользуетесь
                            </p>
                            <div style={{display: "flex", flexWrap: "wrap", gap: "0.4rem"}}>
                                {EDO_PROVIDER_OPTIONS.map(o => {
                                    const set = parseEdoProviders(form.edoProviders)
                                    const on = set.has(o.id)
                                    return (
                                        <SettingsChip
                                            key={o.id}
                                            label={o.label}
                                            active={on}
                                            onClick={() => {
                                                const next = new Set(set)
                                                if (on) next.delete(o.id)
                                                else next.add(o.id)
                                                setForm(f => ({...f, edoProviders: [...next].join(",")}))
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        </F>
                        <F label="Должность">
                            <div style={{display: "flex", flexWrap: "wrap", gap: "0.4rem"}}>
                                {POSITION_CHIPS.map(c => (
                                    <SettingsChip
                                        key={c}
                                        label={c}
                                        active={(form.position ?? "").includes(c)}
                                        onClick={() => {
                                            const cur = (form.position ?? "").split(",").map(s => s.trim()).filter(Boolean)
                                            setForm(f => ({
                                                ...f,
                                                position: (cur.includes(c) ? cur.filter(s => s !== c) : [...cur, c]).join(", "),
                                            }))
                                        }}
                                    />
                                ))}
                            </div>
                        </F>
                    </DashSettingsSection>

                    <DashSettingsSection title="Реквизиты" iconClass="bx bx-building"
                                         className="dash-surface-card--pad-md">
                        <F label="Правовая форма" required>
                            <div style={{display: "flex", gap: "0.4rem", flexWrap: "wrap"}}>
                                {LEGAL_FORMS.map(c => (
                                    <SettingsChip key={c} label={c} active={form.legalForm === c}
                                                  onClick={() => setForm(f => ({...f, legalForm: c}))}/>
                                ))}
                            </div>
                            <p style={{fontSize: "0.68rem", color: "var(--dash-muted)", margin: "6px 0 0"}}>
                                ИНН и БИК при вводе можно подставить через DaData.
                            </p>
                        </F>
                        {(isLegal || isIP) && (
                            <>
                                <F label={isIP ? "Наименование / ФИО ИП" : "Наименование организации"} required>
                                    <input
                                        type="text"
                                        required
                                        value={form.company || ""}
                                        onChange={e => setForm(p => ({...p, company: e.target.value}))}
                                        style={settingsInputStyle}
                                        placeholder={isIP ? "Как в ЕГРИП" : "Как в ЕГРЮЛ"}
                                    />
                                </F>
                                <F label="ИНН" required>
                                    <input
                                        type="text"
                                        required
                                        value={form.inn || ""}
                                        onChange={e => lookupInn(e.target.value)}
                                        style={settingsInputStyle}
                                        maxLength={isIP ? 12 : 10}
                                        inputMode="numeric"
                                    />
                                </F>
                                {isLegal && (
                                    <div className="rwd-grid-2" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem"}}>
                                        <F label="КПП" required>
                                            <input
                                                type="text"
                                                required
                                                value={form.kpp || ""}
                                                onChange={e => setForm(f => ({...f, kpp: e.target.value}))}
                                                style={settingsInputStyle}
                                                maxLength={9}
                                            />
                                        </F>
                                        <F label="ОГРН" required>
                                            <input
                                                type="text"
                                                required
                                                value={form.ogrn || ""}
                                                onChange={e => setForm(f => ({...f, ogrn: e.target.value}))}
                                                style={settingsInputStyle}
                                                maxLength={13}
                                            />
                                        </F>
                                    </div>
                                )}
                                {isIP && (
                                    <F label="ОГРНИП" required>
                                        <input
                                            type="text"
                                            required
                                            value={form.ogrn || ""}
                                            onChange={e => setForm(f => ({...f, ogrn: e.target.value}))}
                                            style={settingsInputStyle}
                                            maxLength={15}
                                        />
                                    </F>
                                )}
                                <F label={isIP ? "Адрес регистрации" : "Юр. адрес"} required>
                                    <input
                                        type="text"
                                        required
                                        value={form.legalAddress || ""}
                                        onChange={e => setForm(f => ({...f, legalAddress: e.target.value}))}
                                        style={settingsInputStyle}
                                    />
                                </F>
                                <F label="Р/с" required>
                                    <input
                                        type="text"
                                        required
                                        value={form.bankAccount || ""}
                                        onChange={e => setForm(f => ({...f, bankAccount: e.target.value}))}
                                        style={settingsInputStyle}
                                        maxLength={20}
                                    />
                                </F>
                                <div className="rwd-grid-2" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.75rem"}}>
                                    <F label="Банк" required>
                                        <input
                                            type="text"
                                            required
                                            value={form.bankName || ""}
                                            onChange={e => setForm(f => ({...f, bankName: e.target.value}))}
                                            style={settingsInputStyle}
                                        />
                                    </F>
                                    <F label="БИК" required>
                                        <input
                                            type="text"
                                            required
                                            value={form.bankBik || ""}
                                            onChange={e => lookupBik(e.target.value)}
                                            style={settingsInputStyle}
                                            maxLength={9}
                                            inputMode="numeric"
                                        />
                                    </F>
                                </div>
                                <F label="Корр. счет" required>
                                    <input
                                        type="text"
                                        required
                                        value={form.corrAccount || ""}
                                        onChange={e => setForm(f => ({...f, corrAccount: e.target.value}))}
                                        style={settingsInputStyle}
                                        maxLength={20}
                                    />
                                </F>
                            </>
                        )}
                    </DashSettingsSection>
                </div>

                {error && (
                    <div
                        style={{
                            background: "var(--dash-danger-bg)",
                            border: "1px solid var(--dash-danger)",
                            borderRadius: 8,
                            padding: "0.6rem 1rem",
                            marginTop: 12,
                            color: "var(--dash-danger)",
                            fontSize: "0.82rem",
                        }}
                    >
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving || saved}
                    style={{
                        marginTop: 16,
                        padding: "0.65em 2em",
                        borderRadius: 8,
                        border: "none",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        background: saved ? "var(--dash-success)" : "var(--dash-accent)",
                        color: "#fff",
                        cursor: saving || saved ? "default" : "pointer",
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    {saved ? "✓ Сохранено" : saving ? "Сохранение…" : "Сохранить изменения"}
                </button>
            </form>
        </div>
    )
}
