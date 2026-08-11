"use client"

import Link from "next/link"
import {useCallback, useMemo, useState} from "react"
import {StatusBadge} from "@/components/app/AppCard"
import {INV_BADGE} from "@/components/Client/client-cabinet/constants"
import {MAX_FREE_CLIENT_REVISIONS} from "@/lib/stage-constants"
import {isStagePaymentsDisabledPublic} from "@/lib/payments/flags"
import type {OrderData} from "./types"
import {STAGE_LABEL} from "./types"

/** Блок под брифом: правила правок, счета по проекту, оплата доп. правок, ссылка в раздел «Оплата». */
export function OrderBriefCommercialTerms({order}: { order: OrderData }) {
    const skipPayments = isStagePaymentsDisabledPublic()
    const [payingStageId, setPayingStageId] = useState<string | null>(null)

    const openInvoices = useMemo(
        () => order.invoices.filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED"),
        [order.invoices],
    )

    const pendingExtraLines = useMemo(
        () =>
            order.stages.flatMap((s) =>
                s.status === "EXTRA_PAYMENT"
                    ? (s.extraPayments ?? [])
                        .filter((ep) => ep.status === "PENDING")
                        .map((ep) => ({stageId: s.id, stageType: s.type, ep}))
                    : [],
            ),
        [order.stages],
    )

    const payExtra = useCallback(async (stageId: string) => {
        setPayingStageId(stageId)
        try {
            const res = await fetch("/api/payments/init", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({stageId}),
            })
            if (res.ok) {
                const data = await res.json()
                if (data.paymentUrl) window.location.href = data.paymentUrl
                else if (data.skipped) window.location.reload()
            } else {
                const err = await res.json().catch(() => ({}))
                alert(typeof err.error === "string" ? err.error : "Не удалось начать оплату")
            }
        } catch {
            alert("Не удалось связаться с платёжным сервисом")
        } finally {
            setPayingStageId(null)
        }
    }, [])

    return (
        <div
            id="order-commercial-terms"
            style={{
                marginTop: 16,
                background: "var(--dash-surface)",
                borderRadius: 10,
                padding: "14px 16px",
                border: "1px solid var(--dash-border)",
            }}
        >
            <div className="dash-list-heading-wrap" style={{marginBottom: 10}}>
                <h2 className="dash-list-heading" style={{fontSize: "1rem"}}>
                    Правки по этапам и оплата
                </h2>
            </div>

            <div style={{fontSize: "0.82rem", lineHeight: 1.55, color: "var(--dash-text2)", marginBottom: 14}}>
                <p style={{margin: "0 0 8px"}}>
                    По каждому этапу можно запросить до{" "}
                    <strong style={{color: "var(--dash-text)"}}>{MAX_FREE_CLIENT_REVISIONS}</strong> раундов правок{" "}
                    <strong style={{color: "var(--dash-text)"}}>без доплаты</strong> (каждый раунд — после согласования
                    вы отправляете замечания,
                    дизайнер дорабатывает материалы).
                </p>
                {!skipPayments ? (
                    <p style={{margin: 0}}>
                        Если лимит исчерпан, этап переходит в режим дополнительной оплаты: менеджер формирует начисление
                        и при необходимости выставляет
                        счёт. После успешной оплаты этап снова возвращается в работу. Оплатить дополнительные правки
                        можно на этой странице (если есть
                        начисление) или на карточке этапа; все счета и история платежей — в разделе{" "}
                        <strong style={{color: "var(--dash-text)"}}>«Оплата»</strong>.
                    </p>
                ) : (
                    <p style={{margin: 0}}>
                        Оплата этапов в системе сейчас отключена — после исчерпания лимита процесс согласуется с
                        менеджером отдельно.
                    </p>
                )}
            </div>

            <div style={{display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14}}>
                <Link
                    href="/orders?tab=payments"
                    className="dash-header__btn dash-header__btn--primary"
                    style={{
                        fontSize: "0.82rem",
                        padding: "0.5em 1em",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6
                    }}
                >
                    <i className="bx bx-credit-card" aria-hidden/>
                    Перейти в оплату и счета
                </Link>
            </div>

            {openInvoices.length > 0 && (
                <div style={{marginBottom: pendingExtraLines.length > 0 ? 14 : 0}}>
                    <p style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--dash-muted)",
                        margin: "0 0 8px"
                    }}>
                        Счета по этому проекту
                    </p>
                    <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                        {openInvoices.map((inv) => {
                            const b = INV_BADGE[inv.status] ?? {variant: "pending" as const, label: inv.status}
                            return (
                                <div
                                    key={inv.id}
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 10,
                                        justifyContent: "space-between",
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: "1px solid var(--dash-border)",
                                        background: "var(--dash-surface2)",
                                    }}
                                >
                                    <div style={{minWidth: 0}}>
                                        <div style={{fontSize: "0.84rem", fontWeight: 600, color: "var(--dash-text)"}}>
                                            Счёт № {inv.number}
                                        </div>
                                        <div style={{
                                            fontSize: "0.76rem",
                                            color: "var(--dash-muted)",
                                            marginTop: 2
                                        }}>{inv.purpose}</div>
                                        <div style={{fontSize: "0.78rem", color: "var(--dash-text)", marginTop: 4}}>
                                            {(inv.amount / 100).toLocaleString("ru-RU")} руб. ·{" "}
                                            {new Date(inv.createdAt).toLocaleDateString("ru-RU")}
                                        </div>
                                    </div>
                                    <div style={{display: "flex", alignItems: "center", gap: 10, flexShrink: 0}}>
                                        <StatusBadge variant={b.variant} label={b.label}/>
                                        {inv.s3Key ? (
                                            <a
                                                href={`/api/files/download?key=${encodeURIComponent(inv.s3Key)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{
                                                    fontSize: "0.78rem",
                                                    fontWeight: 600,
                                                    color: "var(--dash-accent)",
                                                    textDecoration: "none",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: 4,
                                                }}
                                            >
                                                <i className="bx bx-download"/>
                                                Скачать счёт
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {!skipPayments && pendingExtraLines.length > 0 && (
                <div>
                    <p style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--dash-danger)",
                        margin: "0 0 8px"
                    }}>
                        Требуется оплата доп. правок
                    </p>
                    <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                        {pendingExtraLines.map(({stageId, stageType, ep}) => (
                            <div
                                key={ep.id}
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: 12,
                                    justifyContent: "space-between",
                                    padding: "10px 12px",
                                    borderRadius: 8,
                                    border: "1px solid var(--dash-danger)",
                                    background: "var(--dash-danger-bg)",
                                }}
                            >
                                <div style={{minWidth: 0}}>
                                    <div style={{fontSize: "0.84rem", fontWeight: 600, color: "var(--dash-text)"}}>
                                        {STAGE_LABEL[stageType]}
                                    </div>
                                    {ep.reason ? (
                                        <div style={{
                                            fontSize: "0.76rem",
                                            color: "var(--dash-muted)",
                                            marginTop: 4
                                        }}>{ep.reason}</div>
                                    ) : null}
                                    <div style={{
                                        fontSize: "0.82rem",
                                        fontWeight: 600,
                                        color: "var(--dash-danger)",
                                        marginTop: 6
                                    }}>
                                        {(ep.amount / 100).toLocaleString("ru-RU")} руб.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    disabled={payingStageId !== null}
                                    onClick={() => void payExtra(stageId)}
                                    style={{
                                        padding: "0.55em 1.15em",
                                        borderRadius: 8,
                                        border: "none",
                                        background: "var(--dash-danger)",
                                        color: "#fff",
                                        fontSize: "0.82rem",
                                        fontWeight: 600,
                                        cursor: payingStageId ? "wait" : "pointer",
                                        fontFamily: "inherit",
                                        opacity: payingStageId === stageId ? 0.85 : 1,
                                    }}
                                >
                                    {payingStageId === stageId ? "Переход…" : "Оплатить онлайн"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
