"use client"

import {useEffect, useState} from "react"

type LogEntry = {
    id: string; action: string; createdAt: string
    changes: Record<string, { from?: string; to?: string }> | null
    user: { name: string | null; email: string; role: string } | null
}

const ACTION_LABEL: Record<string, { label: string; icon: string; color: string }> = {
    brief_updated: {label: "Бриф обновлен", icon: "bx-edit", color: "#6366f1"},
    brief_edited: {label: "Бриф отредактирован", icon: "bx-edit-alt", color: "#f59e0b"},
    brief_submitted: {label: "Бриф отправлен", icon: "bx-send", color: "#22c55e"},
    order_status_changed: {label: "Статус заказа изменен", icon: "bx-transfer", color: "#6366f1"},
    specialist_assigned: {label: "Назначен специалист", icon: "bx-user-plus", color: "#22c55e"},
    specialist_advanced: {label: "Онбординг продвинут", icon: "bx-chevron-right", color: "#22c55e"},
    specialist_rejected: {label: "Онбординг: отказ", icon: "bx-x", color: "#ef4444"},
    specialist_quiz_progress_reset: {label: "Сброс прогресса теста", icon: "bx-refresh", color: "#f59e0b"},
    specialist_quiz_level_approved: {label: "Уровень теста подтвержден", icon: "bx-check", color: "#22c55e"},
    specialist_quiz_bypassed: {label: "Тест пропущен администратором", icon: "bx-fast-forward", color: "#f59e0b"},
    specialist_profile_edited_by_admin: {label: "Анкета отредактирована", icon: "bx-edit", color: "#f59e0b"},
    regulations_updated: {label: "Регламент обновлен", icon: "bx-book-open", color: "#6366f1"},
    specialist_contract_admin_signed: {label: "Договор подтвержден", icon: "bx-check-shield", color: "#22c55e"},
    framework_contract_admin_signed: {
        label: "Договор оказания услуг подтвержден",
        icon: "bx-check-shield",
        color: "#22c55e"
    },
    payment_released: {label: "Выплата проведена", icon: "bx-money", color: "#22c55e"},
    stage_status_changed: {label: "Этап: изменение статуса", icon: "bx-git-compare", color: "#60a5fa"},
    user_archived: {label: "Пользователь архивирован", icon: "bx-archive", color: "#f59e0b"},
    user_restored: {label: "Пользователь восстановлен", icon: "bx-revision", color: "#22c55e"},
    onboarding_step_test: {label: "Тест пройден", icon: "bx-clipboard", color: "#6366f1"},
    onboarding_step_form: {label: "Анкета заполнена", icon: "bx-file-blank", color: "#6366f1"},
    onboarding_step_interview: {label: "Интервью пройдено", icon: "bx-video", color: "#6366f1"},
    onboarding_step_regulations: {label: "Регламенты изучены", icon: "bx-book-open", color: "#6366f1"},
    onboarding_step_contract: {label: "Договор подписан", icon: "bx-file", color: "#6366f1"},
}

const FIELD_LABEL: Record<string, string> = {
    // Brief
    objectType: "Тип объекта", companySegment: "Сегмент", objAddress: "Адрес", objStage: "Стадия",
    objArea: "Площадь", taskMain: "Цель", styleDir: "Стиль", budgetScope: "Бюджет",
    budgetRange: "Диапазон", deadlineOpen: "Открытие",
    // Order
    status: "Статус", specialistId: "Специалист",
    // Stages (audited into order history)
    stageId: "Этап", stageType: "Тип этапа", stageStatus: "Статус этапа", stageAction: "Действие",
    // Onboarding
    onboardingStatus: "Статус онбординга",
    specialistContractStatus: "Статус договора",
    // Profile fields
    fullName: "ФИО", phone: "Телефон", city: "Город", experience: "Опыт (лет)",
    sqm: "Реализовано м²", interiorStyle: "Стиль", specialty: "Специализация",
    portfolio: "Портфолио", software: "Программы", about: "О себе",
    has3d: "3D моделирование", hasRd: "Чертежи",
    taxStatus: "Налоговый статус", inn: "ИНН", ogrnip: "ОГРНИП",
    bankAccount: "Расчетный счет", bankName: "Банк", bankBik: "БИК",
    edoProviders: "ЭДО",
    // Test
    step: "Этап", score: "Результат",
    // Payment
    orderId: "Заказ",
    // Archive
    archivedAt: "Архивирован",
}

const ONBOARDING_STATUS_LABEL: Record<string, string> = {
    PENDING: "Ожидает", TEST_INVITED: "Приглашен на тест", INTERVIEW_INVITED: "Приглашен на интервью",
    REGULATIONS: "Регламенты", CONTRACT: "Договор", ACTIVE: "Активен", REJECTED: "Отклонен",
}

const CONTRACT_STATUS_LABEL: Record<string, string> = {
    NONE: "Не размещен", AWAITING_SIGNATURE: "Ожидает подписи",
    SIGNED_BY_SPECIALIST: "Подписан специалистом", SIGNED_BY_ADMIN: "Подтвержден",
    DECLINED_BY_SPECIALIST: "Отклонен",
}

function humanizeValue(key: string, val: string | undefined | null): string {
    if (val == null || val === "") return "—"
    if (key === "onboardingStatus") return ONBOARDING_STATUS_LABEL[val] ?? val
    if (key === "specialistContractStatus") return CONTRACT_STATUS_LABEL[val] ?? val
    if (key === "has3d" || key === "hasRd") return val === "true" ? "Да" : "Нет"
    if (key === "taxStatus") return val === "IP" ? "ИП" : val === "SZ" ? "Самозанятый" : val
    if (key === "archivedAt") return val ? "Да" : "Нет"
    // Truncate long IDs
    if (key === "specialistId" || key === "orderId") return val.length > 10 ? `#${val.slice(-6).toUpperCase()}` : val
    return String(val).slice(0, 60)
}

const ROLE_LABEL: Record<string, string> = {ADMIN: "Админ", CLIENT: "Заказчик", SPECIALIST: "Специалист"}

export function AuditTimeline({entity, entityId}: { entity: string; entityId: string }) {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetch(`/api/admin/audit?entity=${entity}&entityId=${entityId}`)
            .then(r => r.ok ? r.json() : [])
            .then(setLogs)
            .catch(() => {
            })
            .finally(() => setLoading(false))
    }, [entity, entityId])

    if (loading) return <div style={{padding: 12, fontSize: "0.75rem", color: "var(--adm-muted)"}}>Загрузка…</div>
    if (logs.length === 0) return <div style={{padding: 12, fontSize: "0.75rem", color: "var(--adm-muted)"}}>Нет
        записей</div>

    return (
        <div style={{position: "relative", paddingLeft: 20}}>
            <div style={{
                position: "absolute",
                left: 6,
                top: 4,
                bottom: 4,
                width: 1,
                background: "var(--adm-sidebar-border, rgba(255,255,255,0.08))"
            }}/>

            {logs.map((log, i) => {
                const meta = ACTION_LABEL[log.action] ?? {
                    label: log.action.replace(/_/g, " "),
                    icon: "bx-dots-horizontal-rounded",
                    color: "var(--adm-muted)"
                }
                const who = log.user ? (log.user.name ?? log.user.email.split("@")[0]) : "Система"
                const role = log.user ? ROLE_LABEL[log.user.role] ?? log.user.role : ""
                const date = new Date(log.createdAt)
                const time = date.toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"})
                const day = date.toLocaleDateString("ru-RU", {day: "numeric", month: "short"})
                const changes = log.changes ? Object.entries(log.changes) : []

                return (
                    <div key={log.id} style={{position: "relative", paddingBottom: i < logs.length - 1 ? 14 : 0}}>
                        <div style={{
                            position: "absolute", left: -17, top: 2, width: 11, height: 11, borderRadius: "50%",
                            background: meta.color, border: "2px solid var(--adm-sidebar, #1e293b)",
                        }}/>

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
                                    fontSize: "0.78rem",
                                    fontWeight: 500
                                }}>
                                    <i className={`bx ${meta.icon}`} style={{color: meta.color, fontSize: "0.85rem"}}/>
                                    {meta.label}
                                </div>
                                <div style={{fontSize: "0.68rem", color: "var(--adm-muted)", marginTop: 1}}>
                                    {who}{role && <span style={{opacity: 0.6}}> · {role}</span>}
                                </div>
                            </div>
                            <div style={{
                                fontSize: "0.65rem",
                                color: "var(--adm-muted)",
                                whiteSpace: "nowrap",
                                textAlign: "right"
                            }}>
                                <div>{day}</div>
                                <div>{time}</div>
                            </div>
                        </div>

                        {changes.length > 0 && (
                            <div style={{marginTop: 4, paddingLeft: 2}}>
                                {changes.slice(0, 6).map(([k, v]) => {
                                    const label = FIELD_LABEL[k] ?? k.replace(/_/g, " ")
                                    const from = humanizeValue(k, v.from as string | undefined)
                                    const to = humanizeValue(k, v.to as string | undefined)
                                    return (
                                        <div key={k}
                                             style={{fontSize: "0.67rem", color: "var(--adm-muted)", lineHeight: 1.5}}>
                                            <span style={{color: "var(--adm-text, #f1f5f9)"}}>{label}</span>{": "}
                                            {v.from != null && <><span style={{
                                                textDecoration: "line-through",
                                                opacity: 0.4
                                            }}>{from}</span> → </>}
                                            <span style={{color: "#22c55e"}}>{to}</span>
                                        </div>
                                    )
                                })}
                                {changes.length > 6 && <div style={{
                                    fontSize: "0.65rem",
                                    color: "var(--adm-muted)",
                                    opacity: 0.5
                                }}>+{changes.length - 6} еще</div>}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
