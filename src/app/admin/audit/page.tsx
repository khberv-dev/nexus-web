"use client"

import { useState, useEffect, useCallback } from "react"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { useRegisterAdminRefresh } from "@/components/admin/AdminRefreshContext"
import {
  AdminTableWrapper, AdminTable, AdminTableHeader, AdminTableBody,
  AdminTableRow, AdminTableHead, AdminTableCell,
} from "@/components/admin/AdminTable"
import { StatusBadge, type StatusVariant } from "@/components/app/AppCard"

interface AuditLogEntry {
  id: string
  entity: string
  entityId: string
  action: string
  changes: Record<string, unknown> | null
  createdAt: string
  user: { name: string | null; email: string; role: string }
}

function actionVariant(action: string): StatusVariant {
  if (action.includes("create") || action.includes("approve") || action.includes("advanced")) return "done"
  if (action.includes("delete") || action.includes("reject")) return "rejected"
  if (action.includes("update") || action.includes("patch") || action.includes("change")) return "active"
  return "pending"
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("ru-RU", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

const ENTITY_TYPES = ["ORDER", "SPECIALIST", "CLIENT", "PAYMENT", "STAGE", "USER"]

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [search, setSearch] = useState("")
  const [pageSize, setPageSize] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.append("entity", filter)
      if (search) params.append("search", search)
      params.append("limit", pageSize.toString())
      const res = await fetch(`/api/admin/audit/all?${params}`)
      if (res.ok) setLogs(await res.json())
    } catch (err) {
      console.error("Failed to load audit logs:", err)
    } finally {
      setLoading(false)
    }
  }, [filter, search, pageSize])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useRegisterAdminRefresh(load)

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 4px", color: "var(--adm-text)" }}>Журнал действий</h2>
          <p className="sp-label">Все действия администраторов и системы</p>
        </div>

        {/* Controls */}
        <div className="sp-card" style={{ marginBottom: 16 }}>
          <div className="sp-card-bd" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label className="sp-label" style={{ display: "block", marginBottom: 4 }}>Тип сущности</label>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="sp-input" style={{ minWidth: 160 }}>
                <option value="">Все</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="sp-label" style={{ display: "block", marginBottom: 4 }}>Поиск</label>
              <input type="text" placeholder="Email, ID…" value={search} onChange={e => setSearch(e.target.value)} className="sp-input" style={{ minWidth: 220 }} />
            </div>
            <div>
              <label className="sp-label" style={{ display: "block", marginBottom: 4 }}>Строк</label>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="sp-input">
                {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={load} disabled={loading} className="sp-btn sp-btn-primary">
              {loading ? "Загрузка…" : "Обновить"}
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="sp-card">
            <div className="sp-card-bd" style={{ textAlign: "center", padding: 40 }}>
              <i className="bx bx-loader-alt" style={{ fontSize: 32, color: "var(--adm-muted)", animation: "spin 1s linear infinite" }} />
              <p style={{ marginTop: 12, color: "var(--adm-muted)" }}>Загрузка…</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="sp-card">
            <div className="sp-card-bd" style={{ textAlign: "center", padding: 40 }}>
              <i className="bx bx-inbox" style={{ fontSize: 48, color: "var(--adm-muted)", opacity: 0.3 }} />
              <p style={{ marginTop: 8, color: "var(--adm-muted)" }}>Нет записей</p>
            </div>
          </div>
        ) : (
          <AdminTableWrapper>
            <AdminTable>
              <AdminTableHeader>
                <AdminTableRow>
                  <AdminTableHead>Время</AdminTableHead>
                  <AdminTableHead>Пользователь</AdminTableHead>
                  <AdminTableHead>Тип</AdminTableHead>
                  <AdminTableHead>Действие</AdminTableHead>
                  <AdminTableHead>Сущность</AdminTableHead>
                  <AdminTableHead>Детали</AdminTableHead>
                </AdminTableRow>
              </AdminTableHeader>
              <AdminTableBody>
                {logs.map(log => (
                  <AdminTableRow key={log.id}>
                    <AdminTableCell muted mono>{formatDate(log.createdAt)}</AdminTableCell>
                    <AdminTableCell>
                      <div style={{ fontWeight: 500 }}>{log.user.name || "Система"}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)", fontFamily: "monospace" }}>{log.user.email}</div>
                    </AdminTableCell>
                    <AdminTableCell style={{ fontWeight: 600 }}>{log.entity}</AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge variant={actionVariant(log.action)} label={log.action} />
                    </AdminTableCell>
                    <AdminTableCell>
                      <code className="sp-tag" style={{ fontSize: "0.68rem", cursor: "pointer" }} title={log.entityId} onClick={() => navigator.clipboard?.writeText(log.entityId)}>
                        {log.entityId}
                      </code>
                    </AdminTableCell>
                    <AdminTableCell style={{ maxWidth: 420 }}>
                      {log.changes ? (
                        <div style={{ fontSize: "0.78rem", lineHeight: 1.6 }}>
                          {Object.entries(log.changes).map(([key, val]) => {
                            const v = val as { from?: unknown; to?: unknown } | unknown
                            if (v && typeof v === "object" && ("from" in v || "to" in v)) {
                              const { from, to } = v as { from?: unknown; to?: unknown }
                              return (
                                <div key={key} style={{ marginBottom: 2 }}>
                                  <span style={{ color: "var(--adm-muted)" }}>{key}: </span>
                                  {from != null && <span style={{ color: "#ef4444", textDecoration: "line-through", marginRight: 4 }}>{String(from)}</span>}
                                  {to != null && <span style={{ color: "#16a34a" }}>{String(to)}</span>}
                                </div>
                              )
                            }
                            return (
                              <div key={key} style={{ marginBottom: 2 }}>
                                <span style={{ color: "var(--adm-muted)" }}>{key}: </span>
                                <span>{String(v)}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <span style={{ color: "var(--adm-muted)" }}>—</span>
                      )}
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTable>
          </AdminTableWrapper>
        )}

        <p className="sp-label" style={{ textAlign: "center", marginTop: 12 }}>
          Всего записей: {logs.length}
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </AdminLayout>
  )
}
