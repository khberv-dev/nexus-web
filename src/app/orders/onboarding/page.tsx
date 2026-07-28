"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { OnboardingShell } from "@/components/app/OnboardingShell"
import { ClientDashFooter } from "@/components/Client/ClientDashFooter"
import { AppCard } from "@/components/app/AppCard"
import { validateClientRequisitesForm } from "@/lib/client-requisites-validation"

const POSITION_CHIPS = ["Собственник", "Генеральный директор", "Управляющий", "Бренд-менеджер", "Архитектор / дизайнер", "Другое"]
const LEGAL_FORM_CHIPS = ["ООО", "АО", "ПАО", "ИП"]

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.65em 0.875em", borderRadius: 8, fontSize: "0.85rem", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#f4f4f4",
}

const highlightedAutoFillInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "rgba(99,102,241,0.10)",
  border: "1px solid rgba(99,102,241,0.38)",
  boxShadow: "0 0 0 3px rgba(99,102,241,0.06)",
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "0.35em 0.85em", borderRadius: 100, fontSize: "0.78rem", fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      border: active ? "1.5px solid rgba(52,211,153,0.5)" : "1.5px solid rgba(255,255,255,0.12)",
      background: active ? "rgba(52,211,153,0.1)" : "transparent",
      color: active ? "#34d399" : "rgba(255,255,255,0.6)",
    }}>
      {active && <span style={{ marginRight: "0.3em" }}>✓</span>}{label}
    </button>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#f87171", marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

export default function ClientOnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dadataLoading, setDadataLoading] = useState(false)

  useEffect(() => {
    fetch("/api/mock-client/apply")
      .then(r => r.json())
      .then(data => { if (data && typeof data === "object") setForm(data as Record<string, string>) })
      .catch(() => { })
  }, [])

  const toggleChip = (field: string, value: string) => {
    const cur = (form[field] ?? "").split(",").map(s => s.trim()).filter(Boolean)
    setForm(f => ({ ...f, [field]: (cur.includes(value) ? cur.filter(s => s !== value) : [...cur, value]).join(", ") }))
  }
  const activeChips = (field: string) => new Set((form[field] ?? "").split(",").map(s => s.trim()).filter(Boolean))

  const isIP = form.legalForm === "ИП"
  const isLegal = ["ООО", "АО", "ПАО"].includes(form.legalForm ?? "")

  const lookupInn = async (inn: string) => {
    setForm(f => ({ ...f, inn }))
    const clean = inn.replace(/\D/g, "")
    if ((isIP && clean.length === 12) || (isLegal && clean.length === 10)) {
      setDadataLoading(true)
      try {
        const res = await fetch("/api/dadata/party", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inn: clean }),
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
      } catch { /* ignore */ }
      finally { setDadataLoading(false) }
    }
  }

  const lookupBik = async (bik: string) => {
    setForm(f => ({ ...f, bankBik: bik }))
    if (bik.replace(/\D/g, "").length === 9) {
      try {
        const res = await fetch("/api/dadata/bank", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bik: bik.replace(/\D/g, "") }),
        })
        const data = await res.json()
        if (data.found) {
          setForm(f => ({ ...f, bankName: data.bankName ?? "", corrAccount: data.corrAccount ?? "" }))
        }
      } catch { /* ignore */ }
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
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
    setLoading(true)
    try {
      const res = await fetch("/api/mock-client/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? "Ошибка сохранения")
      }
      setSaved(true)
      setTimeout(() => router.push("/orders"), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <OnboardingShell title="Анкета" backHref="/orders" backLabel="Кабинет" withBg>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="mb-10">
          <h1 style={{ color: "#f4f4f4", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 500, margin: 0 }}>
            Анкета заказчика
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", marginTop: "0.5em", fontSize: "0.95rem" }}>
            Расскажите о себе — это поможет подобрать подходящего специалиста
          </p>
        </div>

        <AppCard>
          <form onSubmit={handleSubmit} noValidate>
            <Field label="ФИО" required>
              <input type="text" required placeholder="Иван Иванов" value={form.fullName || ""} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} style={inputStyle} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
              <Field label="Email" required>
                <input type="email" required placeholder="ivan@example.com" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Сайт компании">
                <input type="url" placeholder="https://example.com" value={form.website || ""} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} style={inputStyle} />
              </Field>
            </div>
            <Field label="Правовая форма" required>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {LEGAL_FORM_CHIPS.map(c => (
                  <Chip key={c} label={c} active={form.legalForm === c} onClick={() => setForm(f => ({ ...f, legalForm: c }))} />
                ))}
              </div>
              <p style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)", margin: "8px 0 0" }}>
                ООО, АО, ПАО — полный комплект реквизитов юрлица. ИП — реквизиты ИП. ИНН и БИК при вводе можно подставить через DaData.
              </p>
            </Field>

            {(isLegal || isIP) && (
              <>
                <Field label={isIP ? "Наименование / ФИО ИП" : "Наименование организации"} required>
                  <input
                    type="text"
                    required
                    placeholder={isIP ? "Как в ЕГРИП" : "ООО «Пространство»"}
                    value={form.company || ""}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 1rem" }}>
                  <Field label="ИНН" required>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        required
                        placeholder={isIP ? "123456789012" : "7707083893"}
                        value={form.inn || ""}
                        onChange={e => lookupInn(e.target.value)}
                        style={highlightedAutoFillInputStyle}
                        maxLength={isIP ? 12 : 10}
                        inputMode="numeric"
                      />
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.38)", marginTop: 6 }}>
                        Подтянем данные автоматически после ввода ИНН.
                      </div>
                      {dadataLoading && <span style={{ position: "absolute", right: 12, top: 14, fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>⏳</span>}
                    </div>
                  </Field>

                  {isLegal && (
                    <>
                      <Field label="КПП" required>
                        <input
                          type="text"
                          required
                          placeholder="770701001"
                          value={form.kpp || ""}
                          onChange={e => setForm(f => ({ ...f, kpp: e.target.value }))}
                          style={inputStyle}
                          maxLength={9}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="ОГРН" required>
                        <input
                          type="text"
                          required
                          placeholder="1027700132195"
                          value={form.ogrn || ""}
                          onChange={e => setForm(f => ({ ...f, ogrn: e.target.value }))}
                          style={inputStyle}
                          maxLength={13}
                          inputMode="numeric"
                        />
                      </Field>
                    </>
                  )}

                  {isIP && (
                    <Field label="ОГРНИП" required>
                      <input
                        type="text"
                        required
                        placeholder="304770000000000"
                        value={form.ogrn || ""}
                        onChange={e => setForm(f => ({ ...f, ogrn: e.target.value }))}
                        style={inputStyle}
                        maxLength={15}
                        inputMode="numeric"
                      />
                    </Field>
                  )}
                </div>

                <Field label={isIP ? "Адрес регистрации" : "Юридический адрес"} required>
                  <input type="text" required placeholder="г. Москва, ул. Примерная, д. 1" value={form.legalAddress || ""} onChange={e => setForm(f => ({ ...f, legalAddress: e.target.value }))} style={inputStyle} />
                </Field>

                <Field label="Расчетный счет" required>
                  <input type="text" required placeholder="40702810000000000000" value={form.bankAccount || ""} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} style={inputStyle} maxLength={20} />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 1rem" }}>
                  <Field label="Банк" required>
                    <input type="text" required placeholder="АО «Т-Банк»" value={form.bankName || ""} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} style={inputStyle} />
                  </Field>
                  <Field label="БИК" required>
                    <input type="text" required placeholder="044525974" value={form.bankBik || ""} onChange={e => lookupBik(e.target.value)} style={highlightedAutoFillInputStyle} maxLength={9} inputMode="numeric" />
                    <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.38)", marginTop: 6 }}>
                      Подтянем банк автоматически после ввода БИК.
                    </div>
                  </Field>
                </div>
                <Field label="Корр. счет" required>
                  <input type="text" required placeholder="30101810000000000000" value={form.corrAccount || ""} onChange={e => setForm(f => ({ ...f, corrAccount: e.target.value }))} style={inputStyle} maxLength={20} />
                </Field>
              </>
            )}
            <Field label="Должность">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {POSITION_CHIPS.map(c => <Chip key={c} label={c} active={activeChips("position").has(c)} onClick={() => toggleChip("position", c)} />)}
              </div>
            </Field>
            <Field label="Город">
              <input type="text" placeholder="Москва" value={form.city || ""} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={inputStyle} />
            </Field>

            {error && (
              <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8, padding: "0.6rem 1rem", marginBottom: "1rem", color: "#f87171", fontSize: "0.82rem" }}>{error}</div>
            )}

            <button type="submit" disabled={loading || saved} style={{
              width: "100%", padding: "0.75em", borderRadius: 8, fontSize: "0.88rem", fontWeight: 600, fontFamily: "inherit",
              background: saved ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)",
              border: saved ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.18)",
              color: saved ? "#34d399" : "#f4f4f4",
              cursor: loading || saved ? "default" : "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {saved ? "✓ Сохранено" : loading ? "Сохранение…" : "Сохранить и продолжить →"}
            </button>
          </form>
        </AppCard>
      </div>
      <style>{`
        /* phone field removed: keep style block for future extensions */
      `}</style>
      <ClientDashFooter variant="dark" />
    </OnboardingShell>
  )
}
