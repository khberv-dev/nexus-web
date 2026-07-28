"use client"

import type { Stage } from "../types"
import { STAGE_LABEL } from "../types"

export function StageExtraPaymentActions({
  stage,
  acting,
  onExtraPayment,
}: {
  stage: Stage
  acting: string | null
  onExtraPayment: (stageId: string, stageName: string) => void
}) {
  if (stage.status !== "EXTRA_PAYMENT") return null

  return (
    <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
      <button
        onClick={() => onExtraPayment(stage.id, STAGE_LABEL[stage.type])}
        disabled={acting !== null}
        className="sp-btn sp-btn-ghost sp-btn-sm"
      >
        Выставить счет
      </button>
      <button
        onClick={async () => {
          if (!confirm("Разблокировать этап без оплаты? Специалист сможет продолжить работу.")) return
          const res = await fetch(`/api/admin/stages/${stage.id}/unlock`, { method: "POST" })
          if (res.ok) window.location.reload()
          else alert("Ошибка разблокировки")
        }}
        disabled={acting !== null}
        className="sp-btn sp-btn-primary sp-btn-sm"
      >
        Разблокировать вручную
      </button>
    </div>
  )
}

