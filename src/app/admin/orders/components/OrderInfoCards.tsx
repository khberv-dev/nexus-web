"use client"

import type { Order } from "../types"

export function OrderInfoCards({ order }: { order: Order }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
      <div className="sp-card" style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: "0.65rem", color: "var(--adm-muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Заказчик
        </div>
        <a
          href={`/admin/clients?highlight=${order.client.id}`}
          style={{ fontSize: "0.82rem", fontWeight: 500, color: "inherit", textDecoration: "none" }}
        >
          {order.client.name ?? order.client.email}
        </a>
        <div style={{ fontSize: "0.7rem", color: "var(--adm-muted)" }}>{order.client.email}</div>
      </div>

      <div className="sp-card" style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: "0.65rem", color: "var(--adm-muted)", textTransform: "uppercase", marginBottom: 4 }}>
          Специалист
        </div>
        {order.specialist ? (
          <>
            <a
              href={`/admin/specialists?highlight=${order.specialist.id}`}
              style={{ fontSize: "0.82rem", fontWeight: 500, color: "inherit", textDecoration: "none" }}
            >
              {order.specialist.name ?? order.specialist.email}
            </a>
            <div style={{ fontSize: "0.7rem", color: "var(--adm-muted)" }}>{order.specialist.email}</div>
          </>
        ) : (
          <span style={{ fontSize: "0.82rem", color: "#ef4444" }}>Не назначен</span>
        )}
      </div>
    </div>
  )
}

