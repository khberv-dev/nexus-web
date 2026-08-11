"use client"

import {useCallback, useEffect, useMemo, useRef, useState} from "react"
import "@/components/Community/Community.css"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {buildClientCabinetNavItems} from "@/components/Client/client-cabinet/constants"
import {CLIENT_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {DashBriefCard} from "@/components/dashboard-ui/DashBriefCard"
import {DashProgressCard} from "@/components/dashboard-ui/DashProgressCard"
import {ClientContractPanel} from "@/components/Client/ClientContractPanel"
import {ClientActSection} from "@/components/Client/ClientActSection"
import {BRIEF_PLACEHOLDERS, ORDER_STATUS, OrderData, OrderStatus} from "./types"
import {getOrderBriefDisplayLabels, getOrderBriefDisplayPlaceholders} from "@/lib/order-brief-display"
import {OrderSpecialist} from "./OrderSpecialist"
import {OrderStagesGrid} from "@/components/app/OrderStagesGrid"
import {OrderBriefCommercialTerms} from "./OrderBriefCommercialTerms"
import {STAGE_ORDER} from "@/lib/stage-constants"
import {normalizeStagesFromOrdersApiPayload} from "@/lib/normalize-order-stages-from-api"
import {ProjectWorkflowInstructions} from "@/components/app/ProjectWorkflowInstructions"

export default function OrderDetailClient({
                                              order: initialOrder,
                                              viewerEmail,
                                          }: {
    order: OrderData
    viewerEmail: string
}) {
    const [order, setOrder] = useState(initialOrder)
    const [submitting, setSubmitting] = useState(false)
    const [submitDone, setSubmitDone] = useState(false)
    const [briefData, setBriefData] = useState<Record<string, string>>(initialOrder.briefData ?? {})
    const [briefSaving, setBriefSaving] = useState(false)
    const [briefSaved, setBriefSaved] = useState(false)
    const [helpRequested, setHelpRequested] = useState(initialOrder.briefHelpRequested)

    const refreshStagesFromServer = useCallback(async () => {
        try {
            const res = await fetch(`/api/orders/${initialOrder.id}`, {cache: "no-store"})
            if (!res.ok) return
            const fresh = (await res.json()) as {
                status?: string
                stages?: unknown
                payments?: unknown
            }
            setOrder((prev) => ({
                ...prev,
                status: (fresh.status as OrderData["status"]) ?? prev.status,
                stages: fresh.stages != null ? normalizeStagesFromOrdersApiPayload(fresh.stages) : prev.stages,
                payments: Array.isArray(fresh.payments) ? (fresh.payments as OrderData["payments"]) : prev.payments,
            }))
        } catch {
            /* сеть / парсинг — не блокируем UI */
        }
    }, [initialOrder.id])

    useEffect(() => {
        void refreshStagesFromServer()
    }, [refreshStagesFromServer])

    useEffect(() => {
        const sync = () => void refreshStagesFromServer()
        const onVisibility = () => {
            if (document.visibilityState === "visible") sync()
        }
        window.addEventListener("focus", sync)
        document.addEventListener("visibilitychange", onVisibility)
        return () => {
            window.removeEventListener("focus", sync)
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [refreshStagesFromServer])

    // Autosave
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const abortRef = useRef<AbortController | null>(null)
    const briefRef = useRef(briefData)
    briefRef.current = briefData

    const doSave = useCallback(async (extra?: Record<string, unknown>) => {
        abortRef.current?.abort()
        const ctrl = new AbortController()
        abortRef.current = ctrl
        setBriefSaving(true)
        try {
            const res = await fetch(`/api/orders/${initialOrder.id}/brief`, {
                method: "PATCH", headers: {"Content-Type": "application/json"},
                body: JSON.stringify({...briefRef.current, ...extra}),
                signal: ctrl.signal,
            })
            if (res.ok) {
                const updated = await res.json()
                // Sync merged briefData from server (picks up admin edits)
                if (updated.briefData) {
                    const merged = updated.briefData as Record<string, string>
                    setBriefData(prev => {
                        const next = {...merged}
                        // Preserve any local edits not yet on server
                        for (const [k, v] of Object.entries(prev)) {
                            if (v && !next[k]) next[k] = v
                        }
                        return next
                    })
                }
            }
            setBriefSaved(true)
            setTimeout(() => setBriefSaved(false), 2500)
        } catch (e) {
            if ((e as Error).name === "AbortError") return
        } finally {
            setBriefSaving(false)
        }
    }, [initialOrder.id])

    useEffect(() => {
        if (order.status !== "DRAFT") return
        if (timerRef.current) clearTimeout(timerRef.current)
        const d = briefRef.current
        const step = (d.budget || d.deadline || d.rooms || d.notes) ? 2 : (d.style || d.materials || d.vision) ? 1 : 0
        timerRef.current = setTimeout(() => doSave({_briefStep: step}), 1500)
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [briefData, order.status, doSave])

    const requestHelp = async () => {
        setHelpRequested(true);
        await doSave({_briefHelpRequested: true})
    }

    const st = ORDER_STATUS[order.status as OrderStatus] ?? {
        label: order.status,
        color: "var(--dash-muted)",
        bg: "var(--dash-border)"
    }
    const isEditable = order.status === "DRAFT"
    const canSubmit = isEditable && Object.keys(briefData).some(k => briefData[k])
    const hasActiveStages = order.status === "ACTIVE" || order.status === "DONE"

    const submitBrief = async () => {
        setSubmitting(true);
        await doSave()
        const res = await fetch(`/api/orders/${order.id}/brief/submit`, {method: "POST"})
        if (res.ok) {
            setOrder(prev => ({...prev, status: "BRIEFING"}));
            setSubmitDone(true)
        }
        setSubmitting(false)
    }

    // Загрузка подписанного договора клиентом
    const handleUploadSignedContract = async (file: File): Promise<{ success: boolean; error?: string }> => {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/orders/${order.id}/contract/client/sign`, {method: "POST", body: formData})
        if (res.ok) {
            const updated = await res.json()
            // Обновляем локальный state
            setOrder(prev => ({
                ...prev,
                contracts: [updated.contract]
            }))
            return {success: true}
        } else {
            const err = await res.json()
            return {success: false, error: err.error || "Ошибка загрузки"}
        }
    }

    // Загрузка подписанного акта клиентом
    const handleUploadSignedAct = async (stageId: string, file: File): Promise<{
        success: boolean;
        error?: string
    }> => {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch(`/api/stages/${stageId}/act/client-sign`, {method: "POST", body: formData})
        if (res.ok) {
            const updated = await res.json()
            // Обновляем локальный state
            setOrder(prev => ({
                ...prev,
                stages: prev.stages.map(s => s.id === stageId && s.act ? {
                    ...s,
                    act: {
                        ...s.act,
                        ...updated.act,
                        clientActS3Key: updated.act.clientActS3Key,
                        clientSignedAt: updated.act.clientSignedAt?.toISOString() ?? null,
                        status: updated.act.status,
                    }
                } : s)
            }))
            return {success: true}
        } else {
            const err = await res.json()
            return {success: false, error: err.error || "Ошибка загрузки"}
        }
    }

    const approved = order.stages.filter(s => s.status === "APPROVED").length
    const total = STAGE_ORDER.length
    const clientReviewCount = order.stages.filter(s => s.status === "CLIENT_REVIEW").length

    const briefFieldLabels = useMemo(() => getOrderBriefDisplayLabels(), [])
    const briefFieldPlaceholders = useMemo(
        () => getOrderBriefDisplayPlaceholders(BRIEF_PLACEHOLDERS),
        [],
    )

    return (
        <div className="dash">
            <DashTopHeader
                email={viewerEmail}
                title="Кабинет заказчика"
                logoHref={CLIENT_CABINET_LOGO_HREF}
                navItems={buildClientCabinetNavItems("orders")}
                orderChat={{orderId: order.id, viewerRole: "CLIENT"}}
                statusChip={{label: st.label, color: st.color, background: st.bg}}
                primaryAction={{href: "/orders", label: "К проектам", iconClassName: "bx bx-grid-alt"}}
            />

            <div className="dash-body" style={{padding: 0}}>
                <main className="dash-main">
                    <div className="dash-main__scroll">

                        {/* Title */}
                        <div style={{marginBottom: 20}}>
                            <h1 style={{
                                fontSize: "1.3rem",
                                fontWeight: 600,
                                color: "var(--dash-text)",
                                margin: "0 0 4px"
                            }}>
                                Проект #{order.id.slice(-6).toUpperCase()}
                            </h1>
                            <small style={{color: "var(--dash-muted)"}}>
                                {new Date(order.createdAt).toLocaleDateString("ru-RU", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric"
                                })}
                            </small>
                        </div>

                        {/* Alerts */}
                        {(order.status === "BRIEFING" || order.status === "BRIEF_REVIEW") && (
                            <div style={{
                                background: "var(--dash-accent-bg)",
                                border: "1px solid var(--dash-accent-border)",
                                borderRadius: 10,
                                padding: "12px 16px",
                                marginBottom: 16,
                                display: "flex",
                                gap: 12,
                                alignItems: "flex-start",
                                fontSize: "0.85rem",
                                lineHeight: 1.45
                            }}>
                                <i className="bx bx-mail-send" style={{
                                    color: "var(--dash-accent)",
                                    fontSize: "1.15rem",
                                    flexShrink: 0,
                                    marginTop: 2
                                }}/>
                                <span style={{color: "var(--dash-text2)", overflowWrap: "anywhere"}}>Заявка отправлена — подбираем специалиста</span>
                            </div>
                        )}
                        {clientReviewCount > 0 && (
                            <div style={{
                                background: "var(--dash-warn-bg)",
                                border: "1px solid var(--dash-warn)",
                                borderRadius: 10,
                                padding: "12px 16px",
                                marginBottom: 16,
                                display: "flex",
                                gap: 12,
                                alignItems: "flex-start",
                                fontSize: "0.85rem",
                                lineHeight: 1.45
                            }}>
                                <i className="bx bx-bell" style={{
                                    color: "var(--dash-warn)",
                                    fontSize: "1.15rem",
                                    flexShrink: 0,
                                    marginTop: 2
                                }}/>
                                <span style={{color: "var(--dash-text2)", overflowWrap: "anywhere"}}>
                  {clientReviewCount} этап{clientReviewCount > 1 ? "а" : ""} ожидают вашего решения
                </span>
                            </div>
                        )}

                        {/* Two columns: brief left, workflow right */}
                        <div className="dash-content">

                            {/* ── LEFT: brief (compact) ── */}
                            <div className="dash-col1">
                                {order.status !== "DRAFT" ? <OrderBriefCommercialTerms order={order}/> : null}

                                {/* Contract */}
                                {order.status !== "DRAFT" && order.contracts && order.contracts.length > 0 && (
                                    <div id="order-contract"
                                         style={{marginTop: 16, marginBottom: 16, scrollMarginTop: 88}}>
                                        <ClientContractPanel
                                            contract={order.contracts[0]}
                                            orderId={order.id}
                                            userRole="CLIENT"
                                            onUploadSigned={handleUploadSignedContract}
                                        />
                                    </div>
                                )}

                                {/* Acts */}
                                {order.stages
                                    .filter((s) => s.act && ["ADMIN_APPROVED", "CLIENT_SIGNED", "CONFIRMED"].includes(s.act.status))
                                    .map((stage) => (
                                        <div key={stage.id} id={`order-act-${stage.id}`}
                                             style={{marginBottom: 16, scrollMarginTop: 88}}>
                                            <ClientActSection stage={stage} onUploadSigned={handleUploadSignedAct}/>
                                        </div>
                                    ))}

                                {/* Payments summary */}
                                {order.payments.length > 0 && (
                                    <div style={{
                                        background: "var(--dash-surface)",
                                        borderRadius: 10,
                                        padding: "14px 16px",
                                        marginBottom: 16,
                                        border: "1px solid var(--dash-border)"
                                    }}>
                                        <div className="dash-list-heading-wrap" style={{marginBottom: 10}}>
                                            <h2 className="dash-list-heading">Платежи</h2>
                                        </div>
                                        {order.payments.map(p => (
                                            <div key={p.id} style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                padding: "6px 0",
                                                borderBottom: "1px solid var(--dash-border)",
                                                fontSize: "0.82rem"
                                            }}>
                                                <span
                                                    style={{color: "var(--dash-text2)"}}>{(p.amount / 100).toLocaleString("ru-RU")} руб.</span>
                                                <span style={{
                                                    color: p.status === "RELEASED" ? "var(--dash-success)" : p.status === "PENDING" ? "var(--dash-warn)" : "var(--dash-muted)",
                                                    fontWeight: 500
                                                }}>
                          {p.status === "PENDING" ? "Ожидает" : p.status === "HELD" ? "Удержана" : p.status === "RELEASED" ? "Оплачена" : p.status}
                        </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <ProjectWorkflowInstructions/>
                                <div id="order-brief" style={{scrollMarginTop: 88}}>
                                    {/* Shared UI component: DashBriefCard */}
                                    <DashBriefCard
                                        title="Бриф проекта"
                                        labels={briefFieldLabels}
                                        values={briefData}
                                        editable={isEditable}
                                        showOnlyFilled={!isEditable}
                                        placeholders={briefFieldPlaceholders}
                                        onChange={(key, value) => setBriefData(prev => ({...prev, [key]: value}))}
                                        headingRight={isEditable ? (
                                            <span style={{
                                                fontSize: "0.72rem",
                                                color: briefSaving ? "var(--dash-muted)" : briefSaved ? "var(--dash-success)" : "transparent"
                                            }}>
                        {briefSaving ? "Сохранение…" : briefSaved ? "✓ Сохранено" : "·"}
                      </span>
                                        ) : null}
                                    />

                                    {/* Submit */}
                                    {isEditable && (
                                        <div style={{marginTop: 16}}>
                                            {submitDone ? (
                                                <div style={{
                                                    background: "var(--dash-success-bg)",
                                                    border: "1px solid var(--dash-success)",
                                                    borderRadius: 10,
                                                    padding: "10px 14px",
                                                    display: "flex",
                                                    gap: 8,
                                                    alignItems: "center"
                                                }}>
                                                    <i className="bx bx-check-circle"
                                                       style={{color: "var(--dash-success)"}}/>
                                                    <span style={{
                                                        fontSize: "0.82rem",
                                                        color: "var(--dash-success)",
                                                        fontWeight: 500
                                                    }}>Заявка отправлена!</span>
                                                </div>
                                            ) : (
                                                <button onClick={submitBrief} disabled={submitting || !canSubmit}
                                                        style={{
                                                            width: "100%",
                                                            padding: "0.65em",
                                                            borderRadius: 8,
                                                            border: "none",
                                                            background: canSubmit ? "var(--dash-accent)" : "var(--dash-border)",
                                                            color: canSubmit ? "#fff" : "var(--dash-muted)",
                                                            fontSize: "0.85rem",
                                                            fontWeight: 600,
                                                            cursor: canSubmit && !submitting ? "pointer" : "default",
                                                            fontFamily: "inherit",
                                                            opacity: submitting ? 0.7 : 1
                                                        }}>
                                                    {submitting ? "Отправляем…" : "Отправить заявку →"}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Help */}
                                    {(order.status === "DRAFT" || order.status === "BRIEFING") && !submitDone && (
                                        <button onClick={requestHelp} disabled={helpRequested}
                                                style={{
                                                    width: "100%",
                                                    marginTop: 8,
                                                    padding: "0.6em",
                                                    borderRadius: 8,
                                                    border: "1px solid var(--dash-accent-border)",
                                                    background: helpRequested ? "var(--dash-accent-bg)" : "transparent",
                                                    color: helpRequested ? "var(--dash-success)" : "var(--dash-accent)",
                                                    fontSize: "0.82rem",
                                                    fontWeight: 500,
                                                    cursor: helpRequested ? "default" : "pointer",
                                                    fontFamily: "inherit"
                                                }}>
                                            <i className={`bx ${helpRequested ? "bx-check" : "bx-support"}`}
                                               style={{marginRight: 6, verticalAlign: "middle"}}/>
                                            {helpRequested ? "Менеджер уведомлен" : "Помощь менеджера"}
                                        </button>
                                    )}
                                </div>

                            </div>

                            {/* ── RIGHT: specialist + workflow ── */}
                            <div className="dash-col2">
                                {/* Specialist */}
                                {order.specialist && <OrderSpecialist specialist={order.specialist}/>}

                                {/* Progress */}
                                {hasActiveStages && (
                                    <DashProgressCard current={approved} total={total}
                                                      className="dash-surface-card--mb"/>
                                )}

                                {/* Pipeline: правки/согласования по этапам */}
                                {hasActiveStages && (
                                    <div style={{marginBottom: 16}}>
                                        <OrderStagesGrid orderId={order.id} stages={order.stages}/>
                                    </div>
                                )}

                                {/* No specialist yet */}
                                {!order.specialist && order.status !== "DRAFT" && (
                                    <div style={{
                                        background: "var(--dash-surface)",
                                        borderRadius: 10,
                                        padding: 20,
                                        textAlign: "center",
                                        border: "1px solid var(--dash-border)",
                                        marginBottom: 16
                                    }}>
                                        <i className="bx bx-user-plus"
                                           style={{fontSize: 32, color: "var(--dash-muted)", opacity: 0.4}}/>
                                        <p style={{
                                            color: "var(--dash-muted)",
                                            fontSize: "0.82rem",
                                            margin: "8px 0 0"
                                        }}>Специалист еще не назначен</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <ClientDashFooter/>
                    </div>
                </main>
            </div>
        </div>
    )
}
