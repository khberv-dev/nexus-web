"use client"

import type { Stage } from "../types"
import { STAGE_LABEL } from "../types"

export function StageAdminActions({
  stage,
  acting,
  onReviewStage,
  onExtraPayment,
  onClientRevision,
}: {
  stage: Stage
  acting: string | null
  onReviewStage: (stageId: string, action: "modApprove" | "modRevision", stageName: string) => void
  onExtraPayment: (stageId: string, stageName: string) => void
  onClientRevision?: (stageId: string, action: "accept" | "reject", stageName: string) => void
}) {
  const isMod = stage.status === "MOD_REVIEW"
  const isClientRevision = stage.status === "CLIENT_REVISION"

  if (isClientRevision) {
    return (
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={() => onClientRevision?.(stage.id, "accept", STAGE_LABEL[stage.type])}
          disabled={acting !== null || !onClientRevision}
          className="sp-btn sp-btn-primary sp-btn-sm"
        >
          Принять правки клиента
        </button>
        <button
          onClick={() => onClientRevision?.(stage.id, "reject", STAGE_LABEL[stage.type])}
          disabled={acting !== null || !onClientRevision}
          className="sp-btn sp-btn-danger sp-btn-sm"
        >
          Отклонить правки (с причиной)
        </button>
      </div>
    )
  }

  if (!isMod) {
    // Explicit hint for admins: why there are no approve/reject buttons.
    // This reduces confusion when the stage is UPLOADED/CLIENT_REVIEW/etc.
    return (
      <div style={{ marginTop: 8, fontSize: "0.78rem", color: "var(--adm-muted)" }}>
        Действия модератора (одобрить / вернуть на доработку) доступны только в статусе «MOD_REVIEW».
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
      <button
        onClick={() => onReviewStage(stage.id, "modApprove", STAGE_LABEL[stage.type])}
        disabled={acting !== null}
        className="sp-btn sp-btn-success sp-btn-sm"
      >
        Одобрить
      </button>
      <button
        onClick={() => onReviewStage(stage.id, "modRevision", STAGE_LABEL[stage.type])}
        disabled={acting !== null}
        className="sp-btn sp-btn-danger sp-btn-sm"
      >
        Отклонить (с причиной)
      </button>
      <button
        onClick={() => onExtraPayment(stage.id, STAGE_LABEL[stage.type])}
        className="sp-btn sp-btn-ghost sp-btn-sm"
      >
        Доп. оплата
      </button>
    </div>
  )
}

