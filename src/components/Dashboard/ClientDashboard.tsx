"use client"

import Link from "next/link"
import "./client-dashboard.css"

interface ClientOrder {
  id: string
  status: string
  briefData: Record<string, string> | null
  stages: Array<{ type: string; status: string }>
  specialist: { name: string; email: string } | null
}

interface ClientPayment {
  id: string
  amount: number
  status: string
  orderId: string
  createdAt: Date
}

interface ClientDashboardProps {
  name: string
  email: string
  activeOrders: number
  completedOrders: number
  totalSpent: number
  pendingPayments: number
  recentOrders: ClientOrder[]
  recentPayments: ClientPayment[]
  city?: string
  company?: string
}

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "var(--dash-warn)" },
  BRIEFING: { label: "Заполнение брифа", color: "var(--dash-info)" },
  ACTIVE: { label: "В работе", color: "var(--dash-success)" },
  DONE: { label: "Завершен", color: "var(--dash-muted)" },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Ожидает оплаты", color: "var(--dash-warn)" },
  PAID: { label: "Оплачено", color: "var(--dash-success)" },
  RELEASED: { label: "Выплачено", color: "var(--dash-muted)" },
}

export default function ClientDashboard({
  name,
  email,
  activeOrders,
  completedOrders,
  totalSpent,
  pendingPayments,
  recentOrders,
  recentPayments,
  city,
  company,
}: ClientDashboardProps) {
  const initials = name[0]?.toUpperCase() ?? "?"

  return (
    <div className="client-dashboard">
      {/* Hero Section */}
      <div className="client-dashboard__hero">
        <div className="client-dashboard__greeting">
          <div className="client-dashboard__avatar">{initials}</div>
          <div>
            <h1 className="client-dashboard__title">Добро пожаловать, {name.split(" ")[0]}!</h1>
            <p className="client-dashboard__subtitle">Ваш личный кабинет на платформе NEXUS</p>
            {company && <p className="client-dashboard__company">{company}</p>}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="client-dashboard__stats-grid">
        <div className="client-dashboard__stat-card">
          <div className="client-dashboard__stat-icon" style={{ backgroundColor: "rgba(41, 205, 130, 0.1)" }}>
            <i className="bx bx-folder" style={{ color: "var(--dash-success)" }} />
          </div>
          <div className="client-dashboard__stat-content">
            <div className="client-dashboard__stat-value">{activeOrders}</div>
            <div className="client-dashboard__stat-label">Активных проектов</div>
          </div>
        </div>

        <div className="client-dashboard__stat-card">
          <div className="client-dashboard__stat-icon" style={{ backgroundColor: "rgba(115, 103, 240, 0.1)" }}>
            <i className="bx bx-check-circle" style={{ color: "var(--dash-accent)" }} />
          </div>
          <div className="client-dashboard__stat-content">
            <div className="client-dashboard__stat-value">{completedOrders}</div>
            <div className="client-dashboard__stat-label">Завершено</div>
          </div>
        </div>

        <div className="client-dashboard__stat-card">
          <div className="client-dashboard__stat-icon" style={{ backgroundColor: "rgba(0, 207, 232, 0.1)" }}>
            <i className="bx bx-wallet" style={{ color: "var(--dash-info)" }} />
          </div>
          <div className="client-dashboard__stat-content">
            <div className="client-dashboard__stat-value">{Math.round(totalSpent / 1000)}k ₽</div>
            <div className="client-dashboard__stat-label">Потрачено</div>
          </div>
        </div>

        <div className="client-dashboard__stat-card">
          <div className="client-dashboard__stat-icon" style={{ backgroundColor: "rgba(255, 159, 67, 0.1)" }}>
            <i className="bx bx-time-five" style={{ color: "var(--dash-warn)" }} />
          </div>
          <div className="client-dashboard__stat-content">
            <div className="client-dashboard__stat-value">{Math.round(pendingPayments / 1000)}k ₽</div>
            <div className="client-dashboard__stat-label">К оплате</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="client-dashboard__main">
        {/* Quick Actions */}
        <div className="client-dashboard__section">
          <div className="client-dashboard__section-header">
            <h2 className="client-dashboard__section-title">
              <i className="bx bx-lightning-charge" /> Быстрые действия
            </h2>
          </div>
          <div className="client-dashboard__quick-actions">
            <Link href="/orders/new" className="client-dashboard__action-btn client-dashboard__action-btn--primary">
              <i className="bx bx-plus" />
              <span>Создать проект</span>
            </Link>
            <Link href="/orders?tab=payments" className="client-dashboard__action-btn">
              <i className="bx bx-credit-card" />
              <span>Счета и оплаты</span>
            </Link>
            <Link href="/orders?tab=orders" className="client-dashboard__action-btn">
              <i className="bx bx-folder-open" />
              <span>Мои проекты</span>
            </Link>
            <Link href="/orders?tab=settings" className="client-dashboard__action-btn">
              <i className="bx bx-cog" />
              <span>Профиль</span>
            </Link>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="client-dashboard__section">
          <div className="client-dashboard__section-header">
            <h2 className="client-dashboard__section-title">
              <i className="bx bx-folder-open" /> Последние проекты
            </h2>
            <Link href="/orders" className="client-dashboard__link">
              Все проекты →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="client-dashboard__empty">
              <i className="bx bx-inbox" />
              <p>У вас пока нет проектов</p>
              <Link href="/orders/new" className="client-dashboard__empty-link">
                Создать первый проект
              </Link>
            </div>
          ) : (
            <div className="client-dashboard__orders-list">
              {recentOrders.map((order) => {
                const statusInfo = ORDER_STATUS_MAP[order.status] || { label: order.status, color: "var(--dash-muted)" }
                const approved = order.stages.filter((s) => s.status === "APPROVED").length
                const total = order.stages.length || 1
                const pct = Math.round((approved / total) * 100)

                return (
                  <Link key={order.id} href={`/orders/${order.id}`} className="client-dashboard__order-card">
                    <div className="client-dashboard__order-header">
                      <div className="client-dashboard__order-title">
                        {order.briefData?.["objectType"] ?? "Проект"}
                      </div>
                      <span className="client-dashboard__order-status" style={{ color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    {order.specialist && (
                      <div className="client-dashboard__order-specialist">
                        <i className="bx bx-user-circle" />
                        <span>{order.specialist.name}</span>
                      </div>
                    )}
                    <div className="client-dashboard__order-progress">
                      <div className="client-dashboard__progress-bar">
                        <div className="client-dashboard__progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="client-dashboard__progress-text">{pct}%</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <div className="client-dashboard__section">
            <div className="client-dashboard__section-header">
              <h2 className="client-dashboard__section-title">
                <i className="bx bx-credit-card" /> Последние платежи
              </h2>
              <Link href="/orders?tab=payments" className="client-dashboard__link">
                История платежей →
              </Link>
            </div>
            <div className="client-dashboard__payments-table">
              <table>
                <thead>
                  <tr>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.slice(0, 5).map((payment) => {
                    const statusInfo = PAYMENT_STATUS_MAP[payment.status] || { label: payment.status, color: "var(--dash-muted)" }
                    const date = new Date(payment.createdAt)

                    return (
                      <tr key={payment.id}>
                        <td className="client-dashboard__payment-amount">
                          {Math.round(payment.amount / 1000)}k ₽
                        </td>
                        <td>
                          <span className="client-dashboard__payment-status" style={{ color: statusInfo.color }}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="client-dashboard__payment-date">
                          {date.toLocaleDateString("ru-RU")}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
