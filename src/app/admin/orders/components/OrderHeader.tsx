"use client"

import {StatusBadge} from "@/components/app/AppCard"
import {formatBriefWizardProgress} from "@/lib/clientBriefDisplay"
import type {Order} from "../types"
import {ORDER_LABEL, ORDER_VARIANT} from "../types"

export function OrderHeader({
                                order,
                                title,
                                acting,
                                onResolveHelp,
                                onOpenChat,
                                unreadChatCount,
                                chatOpen,
                            }: {
    order: Order
    title: string
    acting: string | null
    onResolveHelp: (orderId: string) => void
    onOpenChat: () => void
    unreadChatCount: number
    chatOpen: boolean
}) {
    return (
        <div style={{marginBottom: 20}}>
            <div style={{display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4}}>
                <h5 style={{fontWeight: 600, margin: 0}}>{title}</h5>
                <StatusBadge variant={ORDER_VARIANT[order.status]} label={ORDER_LABEL[order.status]}/>
                <span style={{flex: 1}}/>
                <button
                    type="button"
                    className="sp-btn sp-btn-primary"
                    onClick={onOpenChat}
                    style={{display: "inline-flex", alignItems: "center", gap: 8}}
                >
                    <i className="bx bx-message-dots" aria-hidden/>
                    Чат
                    {!chatOpen && unreadChatCount > 0 && (
                        <span
                            title={`Непрочитанные: ${unreadChatCount}`}
                            style={{
                                minWidth: 18,
                                height: 18,
                                padding: "0 6px",
                                borderRadius: 999,
                                background: "#ef4444",
                                color: "#fff",
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                lineHeight: "18px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {unreadChatCount > 99 ? "99+" : unreadChatCount}
                        </span>
                    )}
                </button>
            </div>
            <small style={{color: "var(--adm-muted)"}}>
                <i className="bx bx-user" style={{marginRight: 3}}/>
                {order.client.name ?? order.client.email}
                {" → "}
                <i className="bx bx-brush" style={{marginRight: 3}}/>
                {order.specialist ? (
                    order.specialist.name ?? order.specialist.email
                ) : (
                    <span style={{color: "#ef4444"}}>не назначен</span>
                )}
                {" · "}
                {new Date(order.createdAt).toLocaleDateString("ru-RU")}
            </small>

            {order.status === "DRAFT" && (
                <div
                    style={{
                        marginTop: 10,
                        fontSize: "0.82rem",
                        color: "var(--adm-text, #334)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                    }}
                >
          <span style={{display: "inline-flex", alignItems: "center", gap: 6}}>
            <i className="bx bx-list-ul" style={{color: "var(--adm-active-color)"}}/>
            <strong>Заполнение брифа:</strong> {formatBriefWizardProgress(order.briefStep)}
          </span>
                    {order.briefHelpRequested && (
                        <span className="sp-badge sp-badge--danger" style={{fontSize: "0.65rem"}}>
              <i className="bx bx-support" style={{marginRight: 3}}/>
              нужна помощь
            </span>
                    )}
                    {order.briefHelpRequested && (
                        <button
                            type="button"
                            className="sp-btn sp-btn-ghost"
                            style={{
                                fontSize: "0.65rem",
                                padding: "0.2em 0.6em",
                                borderColor: "rgba(34,197,94,0.4)",
                                color: "#22c55e",
                            }}
                            onClick={() => onResolveHelp(order.id)}
                            disabled={acting !== null}
                        >
                            <i className="bx bx-check" style={{marginRight: 3}}/>
                            Закрыть запрос
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
