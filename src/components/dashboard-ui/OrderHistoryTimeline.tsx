"use client"

import {useCallback, useEffect, useState} from "react"
import {usePathname} from "next/navigation"

type Anchor =
    | { kind: "hash"; hash: string }
    | { kind: "path"; path: string; hash?: string }

type LogEntry = {
    id: string
    action: string
    createdAt: string
    changes: Record<string, { from?: unknown; to?: unknown }> | null
    user: { name: string | null; email: string; role: string } | null
    anchor: Anchor | null
}

type HistoryViewerRole = "CLIENT" | "SPECIALIST" | "ADMIN"

const ACTION_LABEL: Record<string, { label: string; icon: string; color: string }> = {
    brief_updated: {label: "Бриф обновлён", icon: "bx-edit", color: "var(--dash-accent)"},
    brief_submitted: {label: "Заявка отправлена", icon: "bx-send", color: "var(--dash-success)"},
    order_status_changed: {label: "Статус заказа", icon: "bx-transfer", color: "var(--dash-accent)"},
    specialist_assigned: {label: "Назначен специалист", icon: "bx-user-plus", color: "var(--dash-success)"},
    framework_contract_admin_signed: {
        label: "Рамочный договор подтверждён",
        icon: "bx-check-shield",
        color: "var(--dash-success)"
    },
    contract_generated: {label: "Договор сформирован", icon: "bx-file", color: "var(--dash-accent)"},
    contract_specialist_signed: {label: "Договор подписан специалистом", icon: "bx-pen", color: "var(--dash-accent)"},
    contract_sent_to_client: {label: "Договор отправлен вам", icon: "bx-mail-send", color: "var(--dash-accent)"},
    contract_client_signed: {label: "Договор подписан вами", icon: "bx-check", color: "var(--dash-success)"},
    contract_confirmed: {label: "Договор активирован", icon: "bx-check-double", color: "var(--dash-success)"},
    act_admin_approved: {label: "Акт проверен", icon: "bx-check-circle", color: "var(--dash-success)"},
    act_admin_rejected: {label: "Акт возвращён", icon: "bx-x-circle", color: "var(--dash-warn)"},
    act_client_signed: {label: "Акт подписан вами", icon: "bx-edit", color: "var(--dash-accent)"},
    act_confirmed: {label: "Акт подтверждён", icon: "bx-badge-check", color: "var(--dash-success)"},
    stage_file_uploaded: {label: "Загружен файл", icon: "bx-upload", color: "var(--dash-accent)"},
    stage_file_annotations_saved: {
        label: "Пометки на изображении отправлены",
        icon: "bx-image",
        color: "var(--dash-accent)"
    },
    stage_mod_passed: {label: "Модерация пройдена", icon: "bx-check", color: "var(--dash-success)"},
    stage_mod_revision: {label: "Возврат от модератора", icon: "bx-undo", color: "var(--dash-warn)"},
    stage_client_approved: {label: "Этап принят вами", icon: "bx-check-double", color: "var(--dash-success)"},
    stage_client_revision: {label: "Запрошены правки", icon: "bx-message-alt-detail", color: "var(--dash-warn)"},
}

/** Тексты «вам» / «вами» — от лица заказчика; для специалиста и админа — от третьего лица. */
const ACTION_LABEL_NON_CLIENT: Partial<Record<string, string>> = {
    contract_sent_to_client: "Договор отправлен заказчику",
    contract_client_signed: "Договор подписан заказчиком",
    act_client_signed: "Акт подписан заказчиком",
    stage_client_approved: "Этап принят заказчиком",
    /** На клиентском экране — от лица заказчика; у специалиста явно кто оставил пометки. */
    stage_file_annotations_saved: "Пометки заказчика на изображении",
}

function metaForAction(action: string, viewerRole: HistoryViewerRole): { label: string; icon: string; color: string } {
    const base =
        ACTION_LABEL[action] ?? {
            label: action.replace(/_/g, " "),
            icon: "bx-dots-horizontal-rounded",
            color: "var(--dash-muted)",
        }
    if (viewerRole === "CLIENT") return base
    const alt = ACTION_LABEL_NON_CLIENT[action]
    return alt ? {...base, label: alt} : base
}

const FIELD_LABEL: Record<string, string> = {
    objectType: "Тип объекта",
    companySegment: "Сегмент",
    objAddress: "Адрес",
    objStage: "Стадия",
    objArea: "Площадь",
    taskMain: "Цель",
    styleDir: "Стиль",
    budgetScope: "Бюджет",
    budgetRange: "Диапазон",
    deadlineOpen: "Открытие",
    status: "Статус",
    specialistId: "Специалист",
    orderId: "Заказ",
    number: "Номер",
    comment: "Комментарий",
    filename: "Файл",
    audience: "Доступ",
    reviewer: "Кто",
    verdict: "Решение",
    comments: "Комментарии к областям",
}

const ROLE_LABEL: Record<string, string> = {ADMIN: "Админ", CLIENT: "Заказчик", SPECIALIST: "Специалист"}

const ORDER_STATUS_LABEL: Record<string, string> = {
    DRAFT: "Черновик",
    BRIEFING: "Бриф",
    BRIEF_REVIEW: "Проверка брифа",
    ACTIVE: "В работе",
    COMPLETED: "Завершён",
    CANCELLED: "Отменён",
}

const ACT_STATUS_LABEL: Record<string, string> = {
    SPECIALIST_UPLOADED: "Загружен специалистом",
    ADMIN_APPROVED: "Проверен",
    REJECTED: "Отклонён",
    CLIENT_SIGNED: "Подписан заказчиком",
    CONFIRMED: "Подтверждён",
}

const CONTRACT_STATUS_LABEL: Record<string, string> = {
    DRAFT: "Черновик",
    SENT_TO_SPECIALIST: "У специалиста",
    SPECIALIST_SIGNED: "Подписан специалистом",
    SENT_TO_CLIENT: "У заказчика",
    CLIENT_SIGNED: "Подписан заказчиком",
    CONFIRMED: "Активен",
    CANCELLED: "Отменён",
}

const REVIEW_VERDICT_LABEL: Record<string, string> = {
    APPROVED: "Допущено / принято",
    REJECTED: "На доработку",
}

const FILE_AUDIENCE_LABEL: Record<string, string> = {
    DESIGNER: "Только дизайнер",
    CLIENT: "Только заказчик",
    SHARED: "Общие",
}

function humanizeValue(key: string, val: unknown): string {
    if (val == null || val === "") return "—"
    const s = String(val)
    if (key === "audience") return FILE_AUDIENCE_LABEL[s] ?? s
    if (key === "verdict") return REVIEW_VERDICT_LABEL[s] ?? s
    if (key === "status") {
        return ORDER_STATUS_LABEL[s] ?? ACT_STATUS_LABEL[s] ?? CONTRACT_STATUS_LABEL[s] ?? s
    }
    if (key === "specialistId" || key === "orderId") return s.length > 10 ? `#${s.slice(-6).toUpperCase()}` : s
    return s.slice(0, 72)
}

function resolveHref(anchor: Anchor): string {
    if (anchor.kind === "hash") return anchor.hash
    return anchor.hash ? `${anchor.path}${anchor.hash}` : anchor.path
}

export function OrderHistoryTimeline({
                                         orderId,
                                         stageId,
                                         viewerRole = "CLIENT",
                                     }: {
    orderId: string
    /** Если задан — только события по этому этапу (акты и т.п.). */
    stageId?: string
    /** От чьего лица формулировки («принят вами» только для заказчика). */
    viewerRole?: HistoryViewerRole
}) {
    const pathname = usePathname()
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const scrollToHash = useCallback(
        (href: string) => {
            const hashIdx = href.indexOf("#")
            if (hashIdx < 0) return
            const hash = href.slice(hashIdx + 1)
            if (!hash) return
            requestAnimationFrame(() => {
                document.getElementById(hash)?.scrollIntoView({behavior: "smooth", block: "start"})
            })
        },
        [],
    )

    const historySearchParams = useCallback(
        (limit: number, cursor?: string | null) => {
            const p = new URLSearchParams()
            p.set("limit", String(limit))
            if (stageId) p.set("stageId", stageId)
            if (cursor) p.set("cursor", cursor)
            return p.toString()
        },
        [stageId],
    )

    const loadInitial = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const r = await fetch(`/api/orders/${orderId}/history?${historySearchParams(12)}`)
            const data = r.ok ? await r.json() : null
            if (!r.ok || !data) {
                setLogs([])
                setNextCursor(null)
                setError("Не удалось загрузить историю")
                return
            }
            setLogs(data.items ?? [])
            setNextCursor(data.nextCursor ?? null)
        } catch {
            setLogs([])
            setNextCursor(null)
            setError("Не удалось загрузить историю")
        } finally {
            setLoading(false)
        }
    }, [orderId, historySearchParams])

    useEffect(() => {
        void loadInitial()
    }, [loadInitial])

    const loadOlder = async () => {
        if (!nextCursor || loadingMore) return
        setLoadingMore(true)
        setError(null)
        try {
            const r = await fetch(
                `/api/orders/${orderId}/history?${historySearchParams(12, nextCursor)}`,
            )
            const data = r.ok ? await r.json() : null
            if (!r.ok || !data) {
                setError("Не удалось подгрузить записи")
                return
            }
            setLogs(prev => [...prev, ...(data.items ?? [])])
            setNextCursor(data.nextCursor ?? null)
        } catch {
            setError("Не удалось подгрузить записи")
        } finally {
            setLoadingMore(false)
        }
    }

    const followAnchor = (log: LogEntry) => {
        if (!log.anchor) return
        const href = resolveHref(log.anchor)

        const onOrderBriefPage = pathname === `/orders/${orderId}`

        if (log.anchor.kind === "hash") {
            scrollToHash(log.anchor.hash)
            return
        }

        if (onOrderBriefPage) {
            scrollToHash(href)
            return
        }

        window.location.assign(href)
    }

    return (
        <div
            style={{
                background: "var(--dash-surface)",
                border: "1px solid var(--dash-border)",
                borderRadius: 12,
                padding: "14px 16px",
            }}
        >
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10
            }}>
                <div style={{fontWeight: 600, fontSize: "0.95rem", color: "var(--dash-text)"}}>
                    {stageId ? "История этапа" : "История"}
                </div>
                <button
                    type="button"
                    onClick={() => void loadInitial()}
                    disabled={loading}
                    style={{
                        border: "1px solid var(--dash-border)",
                        background: "transparent",
                        borderRadius: 8,
                        padding: "4px 10px",
                        fontSize: "0.72rem",
                        color: "var(--dash-muted)",
                        cursor: loading ? "default" : "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    Обновить
                </button>
            </div>

            {error && (
                <div style={{fontSize: "0.78rem", color: "var(--dash-danger)", marginBottom: 10}}>{error}</div>
            )}

            {loading ? (
                <div style={{fontSize: "0.78rem", color: "var(--dash-muted)", padding: "6px 0"}}>Загрузка…</div>
            ) : logs.length === 0 ? (
                <div style={{fontSize: "0.78rem", color: "var(--dash-muted)", padding: "6px 0"}}>
                    {stageId
                        ? "Пока нет событий по этому этапу."
                        : "Пока нет записей"}
                </div>
            ) : (
                <div style={{position: "relative", paddingLeft: 18}}>
                    <div
                        style={{
                            position: "absolute",
                            left: 5,
                            top: 4,
                            bottom: 4,
                            width: 1,
                            background: "var(--dash-border)",
                        }}
                    />

                    {logs.map((log, i) => {
                        const meta = metaForAction(log.action, viewerRole)
                        const who = log.user ? log.user.name ?? log.user.email.split("@")[0] : "Система"
                        const role = log.user ? ROLE_LABEL[log.user.role] ?? log.user.role : ""
                        const date = new Date(log.createdAt)
                        const time = date.toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"})
                        const day = date.toLocaleDateString("ru-RU", {day: "numeric", month: "short"})
                        const changes = log.changes ? Object.entries(log.changes) : []

                        function jumpLabelFor(a: Anchor | null): string {
                            if (!a) return "К блоку →"
                            if (a.kind === "hash") {
                                if (a.hash.startsWith("#stage-")) return "К карточке этапа →"
                                return "К блоку →"
                            }
                            const h = a.hash ?? ""
                            if (pathname !== `/orders/${orderId}`) {
                                if (h.startsWith("#order-act-")) return "К акту →"
                                if (h === "#order-contract") return "К договору →"
                                if (h === "#order-brief") return "К брифу →"
                                return "Открыть →"
                            }
                            return "К блоку →"
                        }

                        const jumpLabel = jumpLabelFor(log.anchor)

                        const jump = log.anchor ? (
                            <button
                                type="button"
                                onClick={() => followAnchor(log)}
                                style={{
                                    border: "none",
                                    background: "none",
                                    padding: 0,
                                    margin: 0,
                                    fontSize: "0.68rem",
                                    color: "var(--dash-accent)",
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    fontFamily: "inherit",
                                }}
                            >
                                {jumpLabel}
                            </button>
                        ) : null

                        return (
                            <div key={log.id}
                                 style={{position: "relative", paddingBottom: i < logs.length - 1 ? 14 : 0}}>
                                <div
                                    style={{
                                        position: "absolute",
                                        left: -15,
                                        top: 2,
                                        width: 11,
                                        height: 11,
                                        borderRadius: "50%",
                                        background: meta.color,
                                        border: "2px solid var(--dash-surface)",
                                    }}
                                />

                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: 8
                                }}>
                                    <div style={{minWidth: 0}}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 5,
                                            fontSize: "0.8rem",
                                            fontWeight: 600
                                        }}>
                                            <i className={`bx ${meta.icon}`}
                                               style={{color: meta.color, fontSize: "0.9rem"}}/>
                                            {meta.label}
                                        </div>
                                        <div style={{fontSize: "0.68rem", color: "var(--dash-muted)", marginTop: 2}}>
                                            {who}
                                            {role && <span style={{opacity: 0.65}}> · {role}</span>}
                                        </div>
                                    </div>
                                    <div style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "flex-end",
                                        gap: 4
                                    }}>
                                        <div style={{
                                            fontSize: "0.65rem",
                                            color: "var(--dash-muted)",
                                            whiteSpace: "nowrap",
                                            textAlign: "right"
                                        }}>
                                            <div>{day}</div>
                                            <div>{time}</div>
                                        </div>
                                        {jump}
                                    </div>
                                </div>

                                {changes.length > 0 && (
                                    <div style={{marginTop: 6}}>
                                        {changes.slice(0, 4).map(([k, v]) => {
                                            const label = FIELD_LABEL[k] ?? k.replace(/_/g, " ")
                                            const from = humanizeValue(k, v.from)
                                            const to = humanizeValue(k, v.to)
                                            return (
                                                <div key={k} style={{
                                                    fontSize: "0.68rem",
                                                    color: "var(--dash-muted)",
                                                    lineHeight: 1.45
                                                }}>
                                                    <span style={{color: "var(--dash-text2)"}}>{label}</span>
                                                    {": "}
                                                    {v.from != null && v.from !== "" && (
                                                        <>
                                                            <span style={{
                                                                textDecoration: "line-through",
                                                                opacity: 0.45
                                                            }}>{from}</span>
                                                            {" → "}
                                                        </>
                                                    )}
                                                    <span style={{color: "var(--dash-success)"}}>{to}</span>
                                                </div>
                                            )
                                        })}
                                        {changes.length > 4 && (
                                            <div style={{
                                                fontSize: "0.65rem",
                                                color: "var(--dash-muted)",
                                                opacity: 0.65
                                            }}>
                                                +{changes.length - 4} полей
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {nextCursor ? (
                <button
                    type="button"
                    onClick={() => void loadOlder()}
                    disabled={loadingMore || loading}
                    style={{
                        marginTop: 12,
                        width: "100%",
                        padding: "0.45em",
                        borderRadius: 8,
                        border: "1px solid var(--dash-border)",
                        background: "var(--dash-surface2)",
                        color: "var(--dash-text2)",
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        cursor: loadingMore ? "default" : "pointer",
                        fontFamily: "inherit",
                    }}
                >
                    {loadingMore ? "Загрузка…" : "Раньше"}
                </button>
            ) : null}
        </div>
    )
}
