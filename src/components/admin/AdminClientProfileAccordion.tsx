"use client"

import { useMemo, useState } from "react"
import {
  CLIENT_PROFILE_SECTIONS,
  clientProfileSectionStats,
  isClientProfileValueFilled,
  resolveClientProfileValue,
} from "@/lib/clientProfileDisplay"
import { EDO_PROVIDER_OPTIONS, parseEdoProviders } from "@/lib/edo-providers"

const border = "var(--adm-sidebar-border, rgba(0,0,0,0.08))"
const hoverBg = "var(--adm-hover-bg, rgba(0,0,0,0.03))"

interface Props {
  formData: Record<string, string> | null | undefined
  clientEmail: string
  clientPhone: string | null
  clientName: string | null
  /** Регистрация, ID — показываем отдельной секцией */
  systemRows: { label: string; value: string; icon: string }[]
}

export function AdminClientProfileAccordion({
  formData,
  clientEmail,
  clientPhone,
  clientName,
  systemRows,
}: Props) {
  const fallbacks = useMemo(
    () => ({ email: clientEmail, phone: clientPhone, name: clientName }),
    [clientEmail, clientPhone, clientName],
  )

  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    ...Object.fromEntries(CLIENT_PROFILE_SECTIONS.map(s => [s.id, false])),
    edo: false,
    system: false,
  }))

  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }))

  const totals = useMemo(() => {
    let f = 0
    let t = 0
    for (const s of CLIENT_PROFILE_SECTIONS) {
      const st = clientProfileSectionStats(s, formData, fallbacks)
      f += st.filled
      t += st.total
    }
    return { filled: f, total: t }
  }, [formData, fallbacks])

  return (
    <div>
      <div className="cl-section" style={{ marginBottom: 8 }}>
        <span className="cl-label">Анкета заказчика</span>
        <span className="cl-badge" style={{ fontSize: "0.65rem" }}>
          {totals.filled}/{totals.total} полей
        </span>
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--adm-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
        Секции по умолчанию свернуты. Разверните блок, чтобы увидеть компанию, реквизиты и текст о проекте.
      </p>

      {CLIENT_PROFILE_SECTIONS.map(section => {
        const { filled, total } = clientProfileSectionStats(section, formData, fallbacks)
        const expanded = open[section.id] === true
        return (
          <div
            key={section.id}
            style={{
              marginBottom: 10,
              border: `1px solid ${border}`,
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--adm-sidebar)",
            }}
          >
            <button
              type="button"
              onClick={() => toggle(section.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "12px 14px",
                background: hoverBg,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <i className={`bx ${section.icon}`} style={{ fontSize: "1.15rem", color: "var(--adm-active-color)", flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--adm-text)" }}>{section.label}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--adm-muted)", fontWeight: 500, flexShrink: 0 }}>
                  {filled}/{total}
                </span>
              </span>
              <i className={`bx ${expanded ? "bx-chevron-up" : "bx-chevron-down"}`} style={{ color: "var(--adm-muted)", flexShrink: 0 }} />
            </button>
            {expanded && (
              <div style={{ padding: "4px 14px 14px" }}>
                {section.fields.map((field, idx) => {
                  const raw = resolveClientProfileValue(field.key, formData, fallbacks)
                  const ok = isClientProfileValueFilled(raw)
                  const isLong = field.key === "about" || field.key === "legalAddress"
                  const isLast = idx === section.fields.length - 1
                  return (
                    <div
                      key={field.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px minmax(100px, 140px) 1fr",
                        gap: 10,
                        alignItems: "start",
                        padding: "10px 0",
                        borderBottom: isLast ? "none" : `1px solid ${border}`,
                        fontSize: "0.8rem",
                      }}
                    >
                      <span style={{ color: ok ? "#22c55e" : "var(--adm-muted)", fontWeight: 700, textAlign: "center", paddingTop: 2 }}>
                        {ok ? "✓" : "·"}
                      </span>
                      <span style={{ color: "var(--adm-muted)", fontWeight: 500, lineHeight: 1.35 }}>{field.label}</span>
                      {isLong ? (
                        <span
                          style={{
                            color: ok ? "var(--adm-text)" : "var(--adm-muted)",
                            fontStyle: ok ? "normal" : "italic",
                            opacity: ok ? 1 : 0.75,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            lineHeight: 1.45,
                          }}
                        >
                          {ok ? raw : "не заполнено"}
                        </span>
                      ) : (
                        <span
                          style={{
                            color: ok ? "var(--adm-text)" : "var(--adm-muted)",
                            fontStyle: ok ? "normal" : "italic",
                            opacity: ok ? 1 : 0.75,
                            wordBreak: "break-word",
                            lineHeight: 1.35,
                          }}
                        >
                          {ok ? raw : "не заполнено"}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {(() => {
        const edoSet = parseEdoProviders(typeof formData?.edoProviders === "string" ? formData.edoProviders : undefined)
        const edoFilled = EDO_PROVIDER_OPTIONS.filter(o => edoSet.has(o.id)).length
        const expanded = open.edo === true
        return (
          <div
            style={{
              marginBottom: 10,
              border: `1px solid ${border}`,
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--adm-sidebar)",
            }}
          >
            <button
              type="button"
              onClick={() => toggle("edo")}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "12px 14px",
                background: hoverBg,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <i className="bx bx-link-alt" style={{ fontSize: "1.15rem", color: "var(--adm-active-color)", flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--adm-text)" }}>Электронный документооборот</span>
                <span style={{ fontSize: "0.72rem", color: "var(--adm-muted)", fontWeight: 500, flexShrink: 0 }}>
                  {edoFilled}/{EDO_PROVIDER_OPTIONS.length}
                </span>
              </span>
              <i className={`bx ${expanded ? "bx-chevron-up" : "bx-chevron-down"}`} style={{ color: "var(--adm-muted)", flexShrink: 0 }} />
            </button>
            {expanded && (
              <div style={{ padding: "6px 14px 14px" }}>
                {EDO_PROVIDER_OPTIONS.map((o, idx) => {
                  const ok = edoSet.has(o.id)
                  return (
                    <div
                      key={o.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px 1fr",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: idx === EDO_PROVIDER_OPTIONS.length - 1 ? "none" : `1px solid ${border}`,
                        fontSize: "0.8rem",
                      }}
                    >
                      <span style={{ color: ok ? "#22c55e" : "var(--adm-muted)", fontWeight: 700, textAlign: "center" }}>{ok ? "✓" : "·"}</span>
                      <span style={{ color: ok ? "var(--adm-text)" : "var(--adm-muted)" }}>{o.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      <div
        style={{
          marginBottom: 16,
          border: `1px solid ${border}`,
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--adm-sidebar)",
        }}
      >
        <button
          type="button"
          onClick={() => toggle("system")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            background: hoverBg,
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <i className="bx bx-cog" style={{ fontSize: "1.15rem", color: "var(--adm-active-color)" }} />
            <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--adm-text)" }}>Системная информация</span>
          </span>
          <i className={`bx ${open.system === true ? "bx-chevron-up" : "bx-chevron-down"}`} style={{ color: "var(--adm-muted)" }} />
        </button>
        {open.system === true && (
          <div style={{ padding: "8px 14px 14px" }}>
            {systemRows.map((row, idx) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: idx === systemRows.length - 1 ? "none" : `1px solid ${border}`,
                  fontSize: "0.82rem",
                }}
              >
                <i className={`bx ${row.icon}`} style={{ color: "var(--adm-muted)", width: 20, textAlign: "center", flexShrink: 0 }} />
                <span style={{ color: "var(--adm-muted)", minWidth: 100, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontWeight: 500, wordBreak: "break-all" }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
