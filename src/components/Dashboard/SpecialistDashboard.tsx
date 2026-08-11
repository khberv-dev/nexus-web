"use client"

import Link from "next/link"
import "./specialist-dashboard.css"

interface UrgentStage {
    orderId: string
    orderTitle: string
    stageType: string
    stageStatus: string
    clientName: string | null
}

interface RecentOrder {
    id: string
    status: string
    createdAt: Date
    briefData: unknown
    client: { name: string | null; email: string | null }
    stages: Array<{ type: string; status: string }>
}

interface SpecialistDashboardProps {
    name: string
    email: string
    activeOrders: number
    completedOrders: number
    totalEarned: number
    pendingPayments: number
    urgentStages: UrgentStage[]
    recentOrders: RecentOrder[]
    formData: Record<string, string> | null
    onboardingStatus: string
}

const STAGE_LABELS: Record<string, string> = {
    CONCEPT: "Концепция",
    PLANNING: "Планировка",
    VISUALIZATION: "Визуализация",
    DOCUMENTATION: "Рабочая документация",
    SPECIFICATION: "Спецификация на материалы",
}

const STAGE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    MOD_REVISION: {label: "На доработке (модератор)", color: "var(--dash-warn)"},
    CLIENT_REVISION: {label: "Правки клиента", color: "var(--dash-warn)"},
}

export default function SpecialistDashboard({
                                                name,
                                                email,
                                                activeOrders,
                                                completedOrders,
                                                totalEarned,
                                                pendingPayments,
                                                urgentStages,
                                                recentOrders,
                                                formData,
                                                onboardingStatus,
                                            }: SpecialistDashboardProps) {
    const initials = name[0]?.toUpperCase() ?? "?"
    const getOrderTitle = (briefData: unknown) => {
        if (briefData && typeof briefData === "object" && !Array.isArray(briefData)) {
            const value = (briefData as Record<string, unknown>).objectType
            if (typeof value === "string") return value
        }
        return "Проект"
    }

    return (
        <div className="spec-dashboard">
            {/* Hero Section */}
            <div className="spec-dashboard__hero">
                <div className="spec-dashboard__greeting">
                    <div className="spec-dashboard__avatar">{initials}</div>
                    <div>
                        <h1 className="spec-dashboard__title">Добро пожаловать, {name.split(" ")[0]}!</h1>
                        <p className="spec-dashboard__subtitle">Статус: {onboardingStatus === "ACTIVE" ? "✓ Активный" : "Онбординг"}</p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="spec-dashboard__stats-grid">
                <div className="spec-dashboard__stat-card">
                    <div className="spec-dashboard__stat-icon" style={{backgroundColor: "rgba(41, 205, 130, 0.1)"}}>
                        <i className="bx bx-folder" style={{color: "var(--dash-success)"}}/>
                    </div>
                    <div className="spec-dashboard__stat-content">
                        <div className="spec-dashboard__stat-value">{activeOrders}</div>
                        <div className="spec-dashboard__stat-label">Активных проектов</div>
                    </div>
                </div>

                <div className="spec-dashboard__stat-card">
                    <div className="spec-dashboard__stat-icon" style={{backgroundColor: "rgba(115, 103, 240, 0.1)"}}>
                        <i className="bx bx-check-circle" style={{color: "var(--dash-accent)"}}/>
                    </div>
                    <div className="spec-dashboard__stat-content">
                        <div className="spec-dashboard__stat-value">{completedOrders}</div>
                        <div className="spec-dashboard__stat-label">Завершено</div>
                    </div>
                </div>

                <div className="spec-dashboard__stat-card">
                    <div className="spec-dashboard__stat-icon" style={{backgroundColor: "rgba(0, 207, 232, 0.1)"}}>
                        <i className="bx bx-wallet" style={{color: "var(--dash-info)"}}/>
                    </div>
                    <div className="spec-dashboard__stat-content">
                        <div className="spec-dashboard__stat-value">{Math.round(totalEarned / 1000)}k ₽</div>
                        <div className="spec-dashboard__stat-label">Заработано</div>
                    </div>
                </div>

                <div className="spec-dashboard__stat-card">
                    <div className="spec-dashboard__stat-icon" style={{backgroundColor: "rgba(255, 159, 67, 0.1)"}}>
                        <i className="bx bx-time-five" style={{color: "var(--dash-warn)"}}/>
                    </div>
                    <div className="spec-dashboard__stat-content">
                        <div className="spec-dashboard__stat-value">{Math.round(pendingPayments / 1000)}k ₽</div>
                        <div className="spec-dashboard__stat-label">Ожидает выплаты</div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="spec-dashboard__main">
                {/* Urgent Section */}
                {urgentStages.length > 0 && (
                    <div className="spec-dashboard__section">
                        <div className="spec-dashboard__section-header">
                            <h2 className="spec-dashboard__section-title">
                                <i className="bx bx-bell"/> Требует внимания
                            </h2>
                            <span className="spec-dashboard__badge">{urgentStages.length}</span>
                        </div>
                        <div className="spec-dashboard__urgent-list">
                            {urgentStages.slice(0, 5).map((item, idx) => (
                                <Link
                                    key={idx}
                                    href={`/work/${item.orderId}`}
                                    className="spec-dashboard__urgent-item"
                                >
                                    <div className="spec-dashboard__urgent-icon">
                                        <i className="bx bx-exclamation-circle"/>
                                    </div>
                                    <div className="spec-dashboard__urgent-content">
                                        <div className="spec-dashboard__urgent-title">{item.orderTitle}</div>
                                        <div className="spec-dashboard__urgent-meta">
                                            <span>{STAGE_LABELS[item.stageType] ?? item.stageType}</span>
                                            <span className="spec-dashboard__urgent-status"
                                                  style={{color: STAGE_STATUS_LABELS[item.stageStatus]?.color}}>
                        {STAGE_STATUS_LABELS[item.stageStatus]?.label ?? item.stageStatus}
                      </span>
                                        </div>
                                    </div>
                                    <i className="bx bx-chevron-right"/>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Orders */}
                <div className="spec-dashboard__section">
                    <div className="spec-dashboard__section-header">
                        <h2 className="spec-dashboard__section-title">
                            <i className="bx bx-folder-open"/> Последние проекты
                        </h2>
                        <Link href="/work/community?tab=orders" className="spec-dashboard__link">
                            Все проекты →
                        </Link>
                    </div>
                    {recentOrders.length === 0 ? (
                        <div className="spec-dashboard__empty">
                            <i className="bx bx-inbox"/>
                            <p>Нет активных проектов</p>
                        </div>
                    ) : (
                        <div className="spec-dashboard__orders-table">
                            <table>
                                <thead>
                                <tr>
                                    <th>Проект</th>
                                    <th>Клиент</th>
                                    <th>Статус</th>
                                    <th>Прогресс</th>
                                </tr>
                                </thead>
                                <tbody>
                                {recentOrders.map((order) => {
                                    const approved = order.stages.filter((s) => s.status === "APPROVED").length
                                    const total = order.stages.length
                                    const pct = total ? Math.round((approved / total) * 100) : 0

                                    return (
                                        <tr key={order.id}>
                                            <td>
                                                <Link href={`/work/${order.id}`} className="spec-dashboard__order-link">
                                                    {getOrderTitle(order.briefData)}
                                                </Link>
                                            </td>
                                            <td>{order.client.name ?? order.client.email}</td>
                                            <td>
                          <span
                              className={`spec-dashboard__status spec-dashboard__status--${order.status.toLowerCase()}`}>
                            {order.status === "ACTIVE" ? "В работе" : order.status === "DONE" ? "Завершен" : "Черновик"}
                          </span>
                                            </td>
                                            <td>
                                                <div className="spec-dashboard__progress">
                                                    <div className="spec-dashboard__progress-bar">
                                                        <div className="spec-dashboard__progress-fill"
                                                             style={{width: `${pct}%`}}/>
                                                    </div>
                                                    <span className="spec-dashboard__progress-text">{pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Quick Links */}
                <div className="spec-dashboard__section">
                    <div className="spec-dashboard__section-header">
                        <h2 className="spec-dashboard__section-title">
                            <i className="bx bx-link"/> Быстрый доступ
                        </h2>
                    </div>
                    <div className="spec-dashboard__quick-links">
                        <Link href="/work/community?tab=payments" className="spec-dashboard__quick-link">
                            <i className="bx bx-credit-card"/>
                            <span>Выплаты</span>
                        </Link>
                        <Link href="/work/community?tab=portfolio" className="spec-dashboard__quick-link">
                            <i className="bx bx-image-alt"/>
                            <span>Портфолио</span>
                        </Link>
                        <Link href="/work/community?tab=settings" className="spec-dashboard__quick-link">
                            <i className="bx bx-cog"/>
                            <span>Профиль</span>
                        </Link>
                        <Link href="/work/academy" className="spec-dashboard__quick-link">
                            <i className="bx bx-book"/>
                            <span>Академия</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
