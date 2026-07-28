"use client"

import { useState } from "react"
import { ADMIN_BRIEF_FIELD_GROUPS } from "@/lib/adminBriefFields"
import styles from "./BriefEditor.module.css"

export interface BriefEditorOrder {
  id: string; briefData: Record<string, string> | null; briefHelpRequested: boolean
}

const BRIEF_GROUPS = ADMIN_BRIEF_FIELD_GROUPS

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "5px 8px", borderRadius: 6, fontSize: "0.82rem", fontFamily: "inherit",
  border: "1px solid var(--adm-sidebar-border, rgba(255,255,255,0.1))",
  background: "var(--adm-outer, rgba(0,0,0,0.15))", color: "inherit", outline: "none",
}

function BriefField({ f, value, onChange }: {
  f: import("@/lib/adminBriefFields").AdminBriefField
  value: string
  onChange: (v: string) => void
}) {
  const type = f.type ?? "text"

  if (type === "textarea") {
    return <textarea value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, resize: "vertical", minHeight: 50 }} />
  }

  if (type === "select" && f.options) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={styles.nativeSelect}
        style={{ ...inputStyle, appearance: "auto" }}
      >
        <option value="">— выберите —</option>
        {f.options.map(o => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (type === "chips" && f.options) {
    const active = new Set(value.split(",").map(s => s.trim()).filter(Boolean))
    const toggle = (opt: string) => {
      const next = new Set(active)
      next.has(opt) ? next.delete(opt) : next.add(opt)
      onChange([...next].join(", "))
    }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
        {f.options.map(opt => {
          const on = active.has(opt)
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)} style={{
              padding: "2px 8px", borderRadius: 100, fontSize: "0.72rem", fontFamily: "inherit", cursor: "pointer",
              border: on ? "1px solid var(--adm-active-color, #6366f1)" : "1px solid var(--adm-sidebar-border, rgba(255,255,255,0.15))",
              background: on ? "rgba(99,102,241,0.18)" : "transparent",
              color: on ? "var(--adm-active-color, #6366f1)" : "var(--adm-muted)",
            }}>
              {on && "✓ "}{opt}
            </button>
          )
        })}
      </div>
    )
  }

  return <input type={type === "number" ? "number" : type === "date" ? "date" : "text"} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
}

export function BriefEditor({ order, onClose, onSaved }: { order: BriefEditorOrder; onClose: () => void; onSaved: () => void }) {
  const [bd, setBd] = useState<Record<string, string>>(order.briefData ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const set = (k: string, v: string) => setBd(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/admin/orders/${order.id}/brief`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bd),
    })
    setSaving(false); setSaved(true); onSaved()
    setTimeout(() => setSaved(false), 2000)
  }

  const filled = Object.values(bd).filter(Boolean).length
  const total = BRIEF_GROUPS.reduce((s, g) => s + g.fields.length, 0)

  return (
    <div style={{ padding: "20px 24px", maxHeight: "80vh", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h5 style={{ margin: "0 0 2px", fontWeight: 600, fontSize: "1rem" }}>Бриф #{order.id.slice(-6).toUpperCase()}</h5>
          <span style={{ fontSize: "0.72rem", color: "var(--adm-muted)" }}>{filled} из {total} полей заполнено</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--adm-muted)", padding: 0 }}><i className="bx bx-x" /></button>
      </div>

      {order.briefHelpRequested && (
        <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: "rgba(234,84,85,0.06)", border: "1px solid rgba(234,84,85,0.2)", display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem" }}>
          <i className="bx bx-support" style={{ color: "#ea5455" }} />
          <span style={{ color: "#ea5455", fontWeight: 600 }}>Заказчик запросил помощь менеджера</span>
        </div>
      )}

      {BRIEF_GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <i className={`bx ${group.icon}`} style={{ fontSize: "0.85rem", color: "var(--adm-active-color, #6366f1)" }} />
            <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--adm-muted)" }}>{group.label}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
            {group.fields.map(f => (
              <div key={f.key} style={{ gridColumn: f.type === "chips" || f.type === "textarea" ? "1 / -1" : undefined }}>
                <label style={{ display: "block", fontSize: "0.65rem", color: "var(--adm-muted)", marginBottom: 2, fontWeight: 500 }}>{f.label}</label>
                <BriefField f={f} value={bd[f.key] ?? ""} onChange={v => set(f.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: "0.55em 1.5em", borderRadius: 8, border: "none", fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit",
          background: saved ? "#22c55e" : "var(--adm-active-color, #6366f1)", color: "#fff",
          cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1,
        }}>{saved ? "\u2713 Сохранено" : saving ? "Сохранение\u2026" : "Сохранить бриф"}</button>
        <button onClick={onClose} style={{
          padding: "0.55em 1.5em", borderRadius: 8, fontSize: "0.82rem", fontFamily: "inherit",
          border: "1px solid var(--adm-sidebar-border)", background: "none", color: "var(--adm-muted)", cursor: "pointer",
        }}>Закрыть</button>
      </div>
    </div>
  )
}
