"use client"

import {useCallback, useRef, useState} from "react"
import "@/components/Community/Community.css"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {buildClientCabinetNavItems} from "@/components/Client/client-cabinet/constants"
import {CLIENT_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import Link from "next/link"
import {StageCard} from "../../StageCard"
import {OrderHistoryTimeline} from "@/components/dashboard-ui/OrderHistoryTimeline"
import {openOrderChat} from "@/components/dashboard-ui/OrderChatPanel"
import type {OrderData, OrderStage, StageType} from "../../types"
import {STAGE_LABEL, STAGE_STATUS} from "../../types"
import {stagePurpose, stageStatusGuidance} from "../stageGuidance"
import {OrderSpecialist} from "../../OrderSpecialist"
import {normalizeStagesFromOrdersApiPayload} from "@/lib/normalize-order-stages-from-api"
import {STAGE_ORDER} from "@/lib/stage-constants"
import {ProjectWorkflowInstructions} from "@/components/app/ProjectWorkflowInstructions"
import {stageStatusLabelForViewer} from "@/lib/stage-status-ui"

function stageStatusLabelForUI(type: StageType, status: OrderStage["status"]): string {
    return stageStatusLabelForViewer({viewerRole: "CLIENT", stageType: type, status})
}

export default function OrderWorkStageClient({
                                                 initialOrder,
                                                 viewerEmail,
                                                 stageType,
                                             }: {
    initialOrder: OrderData
    viewerEmail: string
    stageType: StageType
}) {
    const [order, setOrder] = useState(initialOrder)
    const abortRef = useRef<AbortController | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)

    const focusChatForRevision = useCallback(() => {
        openOrderChat(initialOrder.id, {focus: true, channel: "ADMIN_CLIENT"})
    }, [initialOrder.id])

    const stage = order.stages.find((s) => s.type === stageType) ?? null
    const nextStageType: StageType | null = (() => {
        if (!stage) return null
        const idx = (STAGE_ORDER as readonly string[]).indexOf(stage.type)
        if (idx < 0 || idx >= (STAGE_ORDER as readonly string[]).length - 1) return null
        const next = (STAGE_ORDER as readonly StageType[])[idx + 1] ?? null
        return next
    })()
    const nextStage = nextStageType ? order.stages.find((s) => s.type === nextStageType) ?? null : null

    const handleStageAction = useCallback(
        async (stageId: string, action: "clientApprove" | "clientRevision", comment?: string) => {
            abortRef.current?.abort()
            const ctrl = new AbortController()
            abortRef.current = ctrl
            setActionError(null)

            const res = await fetch(`/api/stages/${stageId}/client-review`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action, comment}),
                signal: ctrl.signal,
            })

            const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string }

            if (!res.ok) {
                // Важный кейс: статус этапа мог измениться в БД (например, уже не CLIENT_REVIEW),
                // а у клиента осталась старая отрисовка. Показываем ошибку и синхронизируем заказ.
                setActionError(body.error ?? `Ошибка ${res.status}`)
            }

            // Refetch full order to pick up side effects (next stage activation etc.)
            // и чтобы убрать кнопки, если этап уже вышел из CLIENT_REVIEW.
            const orderRes = await fetch(`/api/orders/${initialOrder.id}`, {cache: "no-store"})
            if (orderRes.ok) {
                const fresh = (await orderRes.json()) as Partial<OrderData>
                setOrder((prev) => ({
                    ...prev,
                    status: (fresh.status as OrderData["status"]) ?? prev.status,
                    stages: fresh.stages != null ? normalizeStagesFromOrdersApiPayload(fresh.stages) : prev.stages,
                }))
                return
            }

            // Fallback: если /api/orders/:id недоступен, хотя бы обновим статус текущего этапа из ответа.
            if (body.status) {
                setOrder((prev) => ({
                    ...prev,
                    stages: prev.stages.map((s) =>
                        s.id === stageId ? {...s, status: body.status! as OrderStage["status"]} : s
                    ),
                }))
            }
        },
        [initialOrder.id]
    )

    const approved = order.stages.filter((s) => s.status === "APPROVED").length
    const total = order.stages.length || 5

    const stageTitle = stage ? STAGE_LABEL[stage.type] : "Этап"
    const stageStatusLabel = stage ? stageStatusLabelForUI(stage.type, stage.status) : ""

    const stageAbout =
        stage ? (
            <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                <div>
                    <div style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: "var(--dash-text2)",
                        marginBottom: 6,
                        letterSpacing: "0.02em"
                    }}>
                        Зачем этот этап
                    </div>
                    <div style={{
                        fontSize: "0.82rem",
                        lineHeight: 1.55,
                        color: "var(--dash-text)"
                    }}>{stagePurpose(stage.type)}</div>
                </div>
                <div>
                    <div style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: "var(--dash-text2)",
                        marginBottom: 6,
                        letterSpacing: "0.02em"
                    }}>
                        В этом статусе
                    </div>
                    <div style={{fontSize: "0.82rem", lineHeight: 1.55, color: "var(--dash-text)"}}>
                        {stageStatusGuidance(stage.type, stage.status)}
                    </div>
                </div>
            </div>
        ) : (
            "Этап не найден."
        )

    return (
        <div className="dash">
            <DashTopHeader
                email={viewerEmail}
                title="Кабинет заказчика"
                logoHref={CLIENT_CABINET_LOGO_HREF}
                navItems={buildClientCabinetNavItems("orders")}
                orderChat={{orderId: order.id, viewerRole: "CLIENT"}}
                statusChip={{
                    label: `Прогресс ${approved}/${total}`,
                    color: "var(--dash-muted)",
                    background: "var(--dash-border)",
                }}
                primaryAction={{href: `/orders/${order.id}`, label: "К брифу", iconClassName: "bx bx-left-arrow-alt"}}
            />

            <div className="dash-body" style={{padding: 0}}>
                <main className="dash-main">
                    <div className="dash-main__scroll">
                        <div className="dash-content">
                            {/* LEFT column uses existing dash-col1 styles */}
                            <div className="dash-col1">
                                {order.specialist ? <OrderSpecialist specialist={order.specialist}/> : null}
                                <ProjectWorkflowInstructions/>
                                <div className="dash-list-heading-wrap dash-brief-head">
                                    <h2 className="dash-list-heading">Этап</h2>
                                </div>

                                <div className="dash-surface-card dash-brief-card" style={{overflow: "hidden"}}>
                                    <div className="dash-brief-row"
                                         style={{borderBottom: "1px solid var(--dash-border)"}}>
                                        <div className="dash-brief-label">Проект</div>
                                        <span className="dash-brief-value">#{order.id.slice(-6).toUpperCase()}</span>
                                    </div>

                                    <div className="dash-brief-row"
                                         style={{borderBottom: "1px solid var(--dash-border)"}}>
                                        <div className="dash-brief-label">Название</div>
                                        <span className="dash-brief-value">{stageTitle}</span>
                                    </div>

                                    {stage ? (
                                        <div className="dash-brief-row"
                                             style={{borderBottom: "1px solid var(--dash-border)"}}>
                                            <div className="dash-brief-label">Статус</div>
                                            <span className="dash-brief-value"
                                                  style={{color: STAGE_STATUS[stage.status].color}}>
                        {stageStatusLabel}
                      </span>
                                        </div>
                                    ) : null}

                                    <div className="dash-brief-row" style={{borderBottom: "none"}}>
                                        <div className="dash-brief-label">О этапе</div>
                                        <div className="dash-brief-value" style={{whiteSpace: "normal"}}>
                                            {stageAbout}
                                        </div>
                                    </div>
                                </div>

                                {stage?.rulesS3Key ? (
                                    <div className="dash-surface-card"
                                         style={{marginTop: 12, padding: 0, overflow: "hidden"}}>
                                        <details>
                                            <summary
                                                style={{
                                                    listStyle: "none",
                                                    padding: "10px 12px",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    gap: 10,
                                                    userSelect: "none",
                                                    background: "var(--dash-surface2)",
                                                    borderBottom: "1px solid var(--dash-border)",
                                                }}
                                            >
                        <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "var(--dash-text)"
                        }}>
                          <i className="bx bx-book-open" style={{color: "var(--dash-accent)", fontSize: "1.05rem"}}/>
                          Инструкции по этапу
                        </span>
                                                <i className="bx bx-chevron-down" style={{color: "var(--dash-muted)"}}/>
                                            </summary>
                                            <div style={{padding: "10px 12px"}}>
                                                <a
                                                    href={`/api/stages/${stage.id}/rules`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 6,
                                                        textDecoration: "none",
                                                        color: "var(--dash-accent)",
                                                        fontSize: "0.82rem",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    <i className="bx bx-file"/>
                                                    Скачать PDF с правилами
                                                </a>
                                                <div style={{
                                                    marginTop: 6,
                                                    fontSize: "0.74rem",
                                                    color: "var(--dash-muted)",
                                                    lineHeight: 1.45
                                                }}>
                                                    Рекомендуем посмотреть перед согласованием — там описаны формат и
                                                    состав материалов по этапу.
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                ) : null}

                            </div>

                            {/* RIGHT column: основной блок + плавающая история этапа */}
                            <div className="dash-col2 order-work-stage-col2">
                                <div className="order-work-stage-main">
                                    <div className="dash-list-heading-wrap" style={{
                                        marginBottom: 12,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 12,
                                        flexWrap: "wrap"
                                    }}>
                                        <h2 className="dash-list-heading">Ход работ</h2>
                                        <div style={{display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap"}}>
                                            <Link href={`/orders/${order.id}`}
                                                  className="dash-header__btn dash-header__btn--primary">
                                                <i className="bx bx-left-arrow-alt" aria-hidden/>
                                                К брифу
                                            </Link>
                                        </div>
                                    </div>

                                    {stage ? (
                                        <div id={`stage-${stage.id}`} style={{scrollMarginTop: 88}}>
                                            <div className="order-work-stage-card-single">
                                                {actionError ? (
                                                    <div className="alert alert-danger py-2 mb-3" role="alert">
                                                        {actionError}
                                                    </div>
                                                ) : null}
                                                {stage.status === "APPROVED" ? (
                                                    <div
                                                        style={{
                                                            marginBottom: 12,
                                                            padding: "12px 14px",
                                                            borderRadius: 10,
                                                            border: "1px solid var(--dash-success)",
                                                            background: "var(--dash-success-bg)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            gap: 12,
                                                            flexWrap: "wrap",
                                                        }}
                                                    >
                                                        <div style={{display: "flex", alignItems: "center", gap: 10}}>
                                                            <i className="bx bx-check-circle" style={{
                                                                color: "var(--dash-success)",
                                                                fontSize: "1.15rem"
                                                            }} aria-hidden/>
                                                            <div style={{minWidth: 0}}>
                                                                <div style={{
                                                                    fontWeight: 700,
                                                                    fontSize: "0.86rem",
                                                                    color: "var(--dash-success)"
                                                                }}>Этап принят
                                                                </div>
                                                                <div style={{
                                                                    fontSize: "0.76rem",
                                                                    color: "var(--dash-muted)"
                                                                }}>
                                                                    {nextStage ? `Далее — «${STAGE_LABEL[nextStage.type]}».` : "Все этапы завершены — можно вернуться к проекту."}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {nextStage ? (
                                                            <Link
                                                                href={`/orders/${order.id}/work/${nextStage.type}`}
                                                                className="dash-header__btn dash-header__btn--primary"
                                                            >
                                                                Следующий этап →
                                                            </Link>
                                                        ) : (
                                                            <Link href={`/orders/${order.id}`}
                                                                  className="dash-header__btn dash-header__btn--primary">
                                                                К проекту →
                                                            </Link>
                                                        )}
                                                    </div>
                                                ) : null}
                                                <StageCard
                                                    embedded
                                                    stage={stage as OrderStage}
                                                    onAction={handleStageAction}
                                                    onOpenRevisionChat={focusChatForRevision}
                                                />
                                            </div>
                                        </div>
                                    ) : null}

                                </div>

                                {stage ? (
                                    <aside className="order-work-history-aside" aria-label="История этапа">
                                        <OrderHistoryTimeline orderId={order.id} stageId={stage.id}/>
                                    </aside>
                                ) : null}

                                {!stage ? (
                                    <div
                                        style={{
                                            background: "var(--dash-surface)",
                                            border: "1px solid var(--dash-border)",
                                            borderRadius: 12,
                                            padding: 16,
                                            color: "var(--dash-muted)",
                                            fontSize: "0.9rem",
                                        }}
                                    >
                                        Этап не найден.
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <ClientDashFooter/>
                    </div>
                </main>
            </div>
        </div>
    )
}

