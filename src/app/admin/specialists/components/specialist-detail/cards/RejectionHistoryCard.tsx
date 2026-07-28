"use client"

import { useEffect, useMemo, useState } from "react"

type AuditUser = { name: string | null; email: string; role: string } | null
type AuditFieldDiff = { from?: string; to?: string }
type AuditChanges = Record<string, AuditFieldDiff> | null
type AuditEntry = {
  id: string
  action: string
  createdAt: string
  changes: AuditChanges
  user: AuditUser
}

const REJECTION_REASON_BY_ACTION: Record<string, string> = {
  reject: "Отклонено администратором",
  reject_no_education: "Отклонено: нет профильного образования",
  reject_no_experience: "Отклонено: недостаточно опыта",
}

function resolveReason(entry: AuditEntry): string {
  const actionFromChanges = entry.changes?.action?.to
  if (actionFromChanges && REJECTION_REASON_BY_ACTION[actionFromChanges]) {
    return REJECTION_REASON_BY_ACTION[actionFromChanges]
  }
  const comment = entry.changes?.comment?.to
  if (comment?.trim()) return comment
  return "Отклонено"
}

export function RejectionHistoryCard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AuditEntry[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/audit?entity=User&entityId=${userId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: AuditEntry[]) => {
        if (cancelled) return
        setItems(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const rejections = useMemo(
    () => items.filter((it) => it.action === "specialist_rejected"),
    [items],
  )

  return (
    <div className="sp-card">
      <div className="sp-card-hd"><span className="sp-label">История отклонений</span></div>
      <div className="sp-card-bd">
        {loading && <div style={{ fontSize: "0.78rem", color: "var(--adm-muted)" }}>Загрузка…</div>}
        {!loading && rejections.length === 0 && (
          <div style={{ fontSize: "0.8rem", color: "var(--adm-muted)" }}>
            Отклонений пока не было.
          </div>
        )}
        {!loading && rejections.length > 0 && (
          <div style={{ display: "grid", gap: 8 }}>
            {rejections.map((entry) => {
              const reason = resolveReason(entry)
              const who = entry.user?.name?.trim() || entry.user?.email || "Система"
              const date = new Date(entry.createdAt)
              return (
                <div
                  key={entry.id}
                  style={{
                    border: "1px solid var(--adm-sidebar-border, rgba(255,255,255,0.1))",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "var(--adm-outer, rgba(255,255,255,0.03))",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", color: "var(--adm-text, #fff)", fontWeight: 600 }}>{reason}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)", marginTop: 2 }}>
                    {date.toLocaleDateString("ru-RU")} {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {who}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

