import { OrderStage, STAGE_ORDER, STAGE_LABEL, STAGE_STATUS } from "./types"

export function StagePipelineView({ stages }: { stages: OrderStage[] }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      {STAGE_ORDER.map((type, i) => {
        const stage = stages.find(s => s.type === type)
        if (!stage) return null
        const st = STAGE_STATUS[stage.status]
        const isDone = stage.status === "APPROVED"
        const isActive = stage.status !== "PENDING" && stage.status !== "APPROVED"
        return (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              padding: "0.4em 0.9em", borderRadius: 100, fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap",
              border: `1.5px solid ${isDone ? "var(--dash-success)" : isActive ? "var(--dash-warn)" : "var(--dash-border)"}`,
              background: isDone ? "var(--dash-success-bg)" : isActive ? "var(--dash-warn-bg)" : "transparent",
              color: isDone ? "var(--dash-success)" : isActive ? "var(--dash-warn)" : "var(--dash-muted)",
            }}>
              <span style={{ marginRight: "0.35em" }}>{i + 1}.</span>
              {STAGE_LABEL[type]}
              <span style={{ marginLeft: "0.4em", fontSize: "0.72rem", opacity: 0.75 }}>— {st.label}</span>
            </div>
            {i < STAGE_ORDER.length - 1 && <span style={{ color: "var(--dash-muted)", fontSize: "0.75rem" }}>→</span>}
          </div>
        )
      })}
    </div>
  )
}
