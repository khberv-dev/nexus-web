"use client"

import { useMemo, useState } from "react"
import { ADMIN_BRIEF_FIELD_GROUPS, getAdminBriefCompletion } from "@/lib/adminBriefFields"
import { formatBriefWizardProgress } from "@/lib/clientBriefDisplay"

function trunc(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

interface Props {
  orderId: string
  briefData: Record<string, string> | null
  briefHelpRequested: boolean
  briefStep: number
  briefVideoFile?: { id: string; s3Key: string; filename: string; mimeType: string | null; createdAt: string } | null
  /** Показывать позицию в мастере (черновик) */
  showWizardStep: boolean
  onOpenFullEditor: () => void
}

export function AdminBriefSummaryPanel({
  orderId,
  briefData,
  briefHelpRequested,
  briefStep,
  briefVideoFile,
  showWizardStep,
  onOpenFullEditor,
}: Props) {
  const [briefFiles, setBriefFiles] = useState<Array<{ id: string; s3Key: string; filename: string; mimeType: string | null; size: number | null; createdAt: string }>>([])
  const [filesLoaded, setFilesLoaded] = useState(false)

  const loadBriefFiles = async () => {
    try {
      const r = await fetch(`/api/orders/${orderId}/brief/files`)
      if (!r.ok) return
      const body = await r.json() as { files?: typeof briefFiles }
      setBriefFiles(Array.isArray(body.files) ? body.files : [])
      setFilesLoaded(true)
    } catch {
      // ignore
    }
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_BRIEF_FIELD_GROUPS.map(g => [g.label, false])),
  )
  const toggle = (label: string) => setOpenGroups(p => ({ ...p, [label]: !p[label] }))

  const { filled, total, rows, extraEntries } = useMemo(() => getAdminBriefCompletion(briefData), [briefData])
  const missing = total - filled

  const rowsByGroup = useMemo(() => {
    const m = new Map<string, typeof rows>()
    for (const r of rows) {
      const list = m.get(r.groupLabel) ?? []
      list.push(r)
      m.set(r.groupLabel, list)
    }
    return m
  }, [rows])

  return (
    <div className="sp-card" style={{ marginBottom: 16 }}>
      <div className="sp-card-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span className="sp-label">Бриф заказчика</span>
        <button type="button" className="sp-btn sp-btn-primary" onClick={onOpenFullEditor} style={{ padding: "0.4em 1em", fontSize: "0.78rem" }}>
          <i className="bx bx-expand-alt" style={{ marginRight: 4 }} />
          Полный бриф
        </button>
      </div>
      <div className="sp-card-bd" style={{ paddingTop: 4 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12, fontSize: "0.8rem" }}>
          <span style={{ fontWeight: 600, color: filled === total ? "#22c55e" : "var(--adm-text, #111)" }}>
            Заполнено: {filled}/{total}
          </span>
          {missing > 0 && (
            <span style={{ color: "#f59e0b", fontWeight: 500 }}>Пустых полей: {missing}</span>
          )}
          {showWizardStep && (
            <span style={{ color: "var(--adm-muted)" }}>
              В мастере: {formatBriefWizardProgress(briefStep)}
            </span>
          )}
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--adm-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
          Блоки брифа по умолчанию свернуты — разверните нужный раздел.
        </p>

        {briefVideoFile?.s3Key && (
          <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.08))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <i className="bx bx-video" style={{ color: "var(--adm-active-color)" }} />
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>Видео к брифу</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)" }}>{briefVideoFile.filename}</div>
                </div>
              </div>
              <a
                href={`/api/files/download?key=${encodeURIComponent(briefVideoFile.s3Key)}`}
                target="_blank"
                rel="noreferrer"
                className="sp-btn sp-btn-ghost"
                style={{ fontSize: "0.72rem", padding: "0.35em 0.7em" }}
              >
                <i className="bx bx-download" style={{ marginRight: 4 }} />
                Скачать
              </a>
            </div>
            <video
              src={`/api/files/download?key=${encodeURIComponent(briefVideoFile.s3Key)}`}
              controls
              style={{ width: "100%", maxHeight: 320, borderRadius: 10, background: "rgba(0,0,0,0.6)" }}
            />
          </div>
        )}

        <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.08))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <i className="bx bx-paperclip" style={{ color: "var(--adm-active-color)" }} />
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>Документы к брифу</div>
                <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)" }}>
                  {filesLoaded ? `Файлов: ${briefFiles.length}` : "Нажмите «Показать»"}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="sp-btn sp-btn-ghost"
              style={{ fontSize: "0.72rem", padding: "0.35em 0.7em" }}
              onClick={() => void loadBriefFiles()}
            >
              <i className="bx bx-refresh" style={{ marginRight: 4 }} />
              Показать
            </button>
          </div>
          {filesLoaded && briefFiles.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              {briefFiles.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: "0.78rem", color: "var(--adm-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.filename}
                  </span>
                  <a
                    href={`/api/files/download?key=${encodeURIComponent(f.s3Key)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="sp-btn sp-btn-ghost"
                    style={{ fontSize: "0.72rem", padding: "0.25em 0.6em", flexShrink: 0 }}
                  >
                    <i className="bx bx-download" style={{ marginRight: 4 }} />
                    Скачать
                  </a>
                </div>
              ))}
            </div>
          ) : filesLoaded ? (
            <div style={{ fontSize: "0.74rem", color: "var(--adm-muted)" }}>Нет прикрепленных файлов.</div>
          ) : null}
        </div>

        {briefHelpRequested && (
          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(234,84,85,0.08)",
              border: "1px solid rgba(234,84,85,0.25)",
              fontSize: "0.78rem",
              color: "#ea5455",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <i className="bx bx-support" style={{ fontSize: "1.1rem" }} />
            <span>
              <strong>Запрошена помощь менеджера.</strong> Ниже видно, что уже введено и что осталось пустым — так проще понять, чем помочь.
            </span>
          </div>
        )}

        {ADMIN_BRIEF_FIELD_GROUPS.map(group => {
          const groupRows = rowsByGroup.get(group.label) ?? []
          const groupFilled = groupRows.filter(r => r.filled).length
          const expanded = openGroups[group.label] === true
          return (
            <div key={group.label} style={{ marginBottom: 10, border: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.08))", borderRadius: 8, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => toggle(group.label)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  background: "var(--adm-hover-bg, rgba(0,0,0,0.03))",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--adm-muted)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <i className={`bx ${group.icon}`} style={{ color: "var(--adm-active-color)" }} />
                  {group.label}
                  <span style={{ fontWeight: 500, opacity: 0.85 }}>
                    ({groupFilled}/{groupRows.length})
                  </span>
                </span>
                <i className={`bx ${expanded ? "bx-chevron-up" : "bx-chevron-down"}`} />
              </button>
              {expanded && (
                <div style={{ padding: "6px 10px 10px" }}>
                  {groupRows.map((r, ri) => (
                    <div
                      key={r.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px 140px 1fr",
                        gap: 8,
                        alignItems: "start",
                        padding: "5px 0",
                        borderBottom: ri === groupRows.length - 1 ? "none" : "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.06))",
                        fontSize: "0.78rem",
                      }}
                    >
                      <span style={{ color: r.filled ? "#22c55e" : "var(--adm-muted)", fontWeight: 700, textAlign: "center" }}>
                        {r.filled ? "✓" : "·"}
                      </span>
                      <span style={{ color: "var(--adm-muted)", fontWeight: 500 }}>{r.label}</span>
                      <span style={{ color: r.filled ? "var(--adm-text)" : "#94a3b8", wordBreak: "break-word" }}>
                        {r.filled ? trunc(r.preview, 120) : "не заполнено"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {extraEntries.length > 0 && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--adm-hover-bg, rgba(0,0,0,0.03))", fontSize: "0.75rem" }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--adm-muted)" }}>Доп. поля (не из мастера)</div>
            {extraEntries.map(({ key, value }) => (
              <div key={key} style={{ marginBottom: 4 }}>
                <span style={{ color: "var(--adm-muted)" }}>{key}: </span>
                {trunc(value, 200)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
