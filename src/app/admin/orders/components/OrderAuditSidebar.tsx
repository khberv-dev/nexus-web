"use client"

import { AuditTimeline } from "@/components/admin/AuditTimeline"

export function OrderAuditSidebar({ orderId }: { orderId: string }) {
  return (
    <div style={{ width: 240, flexShrink: 0 }}>
      <div className="sp-card" style={{ position: "sticky", top: 0 }}>
        <div className="sp-card-hd">
          <span className="sp-label">История</span>
        </div>
        <div
          className="sp-card-bd"
          style={{
            padding: "8px 12px",
            maxHeight: "60vh",
            overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.15) transparent",
          }}
        >
          <AuditTimeline entity="Order" entityId={orderId} />
        </div>
      </div>
    </div>
  )
}

