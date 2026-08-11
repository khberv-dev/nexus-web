"use client"

import {MAX_FREE_CLIENT_REVISIONS} from "@/lib/stage-constants"
import type {OrderStage} from "../types"

export function StageExtraPaymentSection({
                                             stage,
                                             acting,
                                             onPay,
                                         }: {
    stage: OrderStage
    acting: boolean
    onPay: () => void
}) {
    return (
        <div
            style={{
                marginTop: "1rem",
                padding: "1rem",
                borderRadius: 8,
                background: "var(--dash-danger-bg)",
                border: "1.5px solid var(--dash-danger)",
            }}
        >
            <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 6}}>
                <i className="bx bx-credit-card" style={{fontSize: "1.1rem", color: "var(--dash-danger)"}}/>
                <span style={{fontWeight: 600, fontSize: "0.875rem", color: "var(--dash-danger)"}}>
          Требуется доплата за правки
        </span>
            </div>
            <p style={{fontSize: "0.82rem", color: "var(--dash-muted)", margin: "0 0 8px"}}>
                Использовано {stage.clientRound} из {MAX_FREE_CLIENT_REVISIONS} бесплатных раундов. Для продолжения
                работы необходимо оплатить дополнительные правки.
            </p>
            {(stage.extraPayments ?? [])
                .filter((ep) => ep.status === "PENDING")
                .map((ep) => (
                    <div key={ep.id} style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.15)",
                        marginBottom: 10
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 4
                        }}>
              <span style={{fontSize: "0.82rem", fontWeight: 600, color: "var(--dash-text)"}}>
                {(ep.amount / 100).toLocaleString("ru-RU")} руб.
              </span>
                            <span style={{fontSize: "0.72rem", color: "var(--dash-warn)", fontWeight: 500}}>Ожидает оплаты</span>
                        </div>
                        {ep.reason ? <p style={{
                            fontSize: "0.78rem",
                            color: "var(--dash-muted)",
                            margin: 0
                        }}>{ep.reason}</p> : null}
                    </div>
                ))}
            <button
                onClick={onPay}
                disabled={acting}
                style={{
                    padding: "0.55em 1.25em",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--dash-danger)",
                    color: "#fff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: acting ? "default" : "pointer",
                    fontFamily: "inherit",
                }}
            >
                {acting ? "..." : "Оплатить правки"}
            </button>
        </div>
    )
}

