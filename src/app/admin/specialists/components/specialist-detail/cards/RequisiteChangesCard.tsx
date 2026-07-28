"use client"

import { useEffect, useState } from "react"
import {
  AdminTableWrapper, AdminTable, AdminTableHeader, AdminTableBody,
  AdminTableRow, AdminTableHead, AdminTableCell,
} from "@/components/admin/AdminTable"

type ReqChange = {
  id: string
  status: string
  oldData: Record<string, string>
  newData: Record<string, string>
  adminComment?: string
  createdAt: string
}

const FIELD_LABELS: Record<string, string> = {
  bankAccount: "Р/с", bankName: "Банк", bankBik: "БИК", corrAccount: "К/с",
  inn: "ИНН", kpp: "КПП", ogrn: "ОГРН", ogrnip: "ОГРНИП",
  legalAddress: "Юр. адрес", companyName: "Организация", ipName: "ИП",
}

export function RequisiteChangesCard({ userId }: { userId: string }) {
  const [items, setItems] = useState<ReqChange[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await fetch("/api/admin/requisite-changes?status=PENDING")
    if (res.ok) {
      const all = await res.json() as (ReqChange & { specialistId: string })[]
      setItems(all.filter(r => r.specialistId === userId))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  const handleAction = async (id: string, action: "approve" | "reject") => {
    const comment = action === "reject" ? prompt("Причина отклонения:") : undefined
    if (action === "reject" && comment === null) return
    await fetch("/api/admin/requisite-changes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id, action, comment }),
    })
    load()
  }

  if (loading || items.length === 0) return null

  return (
    <div className="sp-card" style={{ borderColor: "#ffc107" }}>
      <div className="sp-card-hd" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="sp-badge sp-badge--warn">⏳</span>
        <span className="sp-label">Запрос на смену реквизитов</span>
      </div>
      {items.map(r => {
        const changedKeys = Object.keys(r.newData).filter(k => r.oldData[k] !== r.newData[k])
        return (
          <div key={r.id} className="sp-card-bd">
            <p className="sp-label" style={{ marginBottom: 8 }}>
              {new Date(r.createdAt).toLocaleString("ru-RU")}
            </p>
            <AdminTableWrapper>
              <AdminTable>
                <AdminTableHeader>
                  <AdminTableRow>
                    <AdminTableHead>Поле</AdminTableHead>
                    <AdminTableHead>Было</AdminTableHead>
                    <AdminTableHead>Стало</AdminTableHead>
                  </AdminTableRow>
                </AdminTableHeader>
                <AdminTableBody>
                  {changedKeys.map(k => (
                    <AdminTableRow key={k}>
                      <AdminTableCell style={{ fontWeight: 500 }}>{FIELD_LABELS[k] ?? k}</AdminTableCell>
                      <AdminTableCell style={{ color: "#ef4444" }}>{r.oldData[k] || "—"}</AdminTableCell>
                      <AdminTableCell style={{ color: "#16a34a" }}>{r.newData[k] || "—"}</AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            </AdminTableWrapper>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button className="sp-btn sp-btn-success sp-btn-sm" onClick={() => handleAction(r.id, "approve")}>Одобрить</button>
              <button className="sp-btn sp-btn-danger sp-btn-sm" onClick={() => handleAction(r.id, "reject")}>Отклонить</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
