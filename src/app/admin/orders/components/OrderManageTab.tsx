"use client"

import type { Order, OrderStatus, SpecialistForAssignment } from "../types"
import { ORDER_LABEL } from "../types"

export function OrderManageTab({
  order,
  specialists,
  assignMap,
  assigning,
  needsAssign,
  statusTargets,
  onAssignMapChange,
  onAssign,
  onChangeStatus,
}: {
  order: Order
  specialists: SpecialistForAssignment[]
  assignMap: Record<string, string>
  assigning: string | null
  needsAssign: boolean
  statusTargets: OrderStatus[]
  onAssignMapChange: (orderId: string, specId: string) => void
  onAssign: (orderId: string) => void
  onChangeStatus: (orderId: string, status: OrderStatus) => void
}) {
  return (
    <>
      {needsAssign && order.status !== "DRAFT" && (
        <div className="sp-card" style={{ marginTop: 12 }}>
          <div className="sp-card-hd">
            <span className="sp-label">Назначить специалиста</span>
          </div>
          <div className="sp-card-bd">
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className="sp-select"
                value={assignMap[order.id] ?? ""}
                onChange={(e) => onAssignMapChange(order.id, e.target.value)}
              >
                <option value="">Выберите…</option>
                {specialists.map((s) => {
                  const fd = s.specialistProfile?.formData
                  const label = fd?.fullName ?? s.name ?? s.email
                  return (
                    <option key={s.id} value={s.id}>
                      {label}
                      {s.specialistProfile?.rating ? ` (★${s.specialistProfile.rating.toFixed(1)})` : ""}
                    </option>
                  )
                })}
              </select>
              <button
                onClick={() => onAssign(order.id)}
                disabled={!assignMap[order.id] || assigning === order.id}
                className="sp-btn sp-btn-primary"
              >
                {assigning === order.id ? "…" : "Назначить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusTargets.length > 0 && (
        <div className="sp-card" style={{ marginTop: 12 }}>
          <div className="sp-card-hd">
            <span className="sp-label">
              {order.status === "DRAFT" ? "Черновик" : order.status === "ACTIVE" ? "Завершение или отмена" : "Управление статусом"}
            </span>
          </div>
          <div className="sp-card-bd">
            {order.status === "DRAFT" && (
              <p style={{ fontSize: "0.8rem", color: "var(--adm-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
                После отправки брифа клиентом заказ сам перейдет в «Бриф». Здесь можно только отменить незавершенный черновик.
              </p>
            )}
            {order.status === "ACTIVE" && (
              <p style={{ fontSize: "0.8rem", color: "var(--adm-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
                Отметьте проект завершенным или отмените заказ. Вернуть в черновик из этой панели нельзя — только через отдельные действия в процессе.
              </p>
            )}
            {order.status === "BRIEFING" && (
              <p style={{ fontSize: "0.8rem", color: "var(--adm-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
                Отправьте бриф на проверку или отмените заказ. Принятие брифа и перевод в работу — блоком «Бриф на проверке», когда статус станет «Проверка брифа».
              </p>
            )}
            {order.status === "BRIEF_REVIEW" && (
              <p style={{ fontSize: "0.8rem", color: "var(--adm-muted)", margin: "0 0 12px", lineHeight: 1.45 }}>
                «Активен» — в работу. «Бриф» — вернуть на доработку заказчику. Либо отмена.
              </p>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {statusTargets.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChangeStatus(order.id, s)}
                  className={`sp-btn ${s === "CANCELLED" ? "sp-btn-ghost" : "sp-btn-primary"}`}
                  style={s === "CANCELLED" ? { borderColor: "rgba(239,68,68,0.45)", color: "#ef4444" } : undefined}
                >
                  {ORDER_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

