import type { SpecialistOrder } from "../../types"
import { SPEC_ORDER_STATUS_LABEL } from "./constants"

export function SpecialistOrdersTab({
  ordersLoading,
  specOrders,
}: {
  ordersLoading: boolean
  specOrders: SpecialistOrder[]
}) {
  if (ordersLoading) {
    return (
      <div>
        <div className="sp-orders-placeholder"><p>Загрузка…</p></div>
      </div>
    )
  }

  if (specOrders.length === 0) {
    return (
      <div>
        <div className="sp-orders-placeholder">
          <i className="bx bx-folder-open" />
          <p>У специалиста пока нет заказов</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="sp-card">
        <div className="sp-card-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="sp-label">Заказы</span>
          <span className="sp-badge">{specOrders.length}</span>
        </div>
        <div className="sp-card-bd" style={{ padding: "4px 0" }}>
          {specOrders.map((o) => (
            <div key={o.id} className="sp-order-row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={`/admin/orders?highlight=${o.id}`} style={{ fontWeight: 500, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", color: "inherit", textDecoration: "none" }}>
                  {o.title ?? o.briefData?.name ?? `#${o.id.slice(-6)}`}
                </a>
                <a href={`/admin/clients?highlight=${o.client.email}`} style={{ fontSize: "0.72rem", color: "var(--adm-muted)", textDecoration: "none" }}>{o.client.name ?? o.client.email}</a>
                <div style={{ fontSize: "0.68rem", color: "var(--adm-muted)", marginTop: 4 }}>
                  Статус: <span style={{ color: "var(--adm-text)" }}>{SPEC_ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                  {o.id ? <span style={{ marginLeft: 8, opacity: 0.85 }}>ID …{o.id.slice(-8)}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
