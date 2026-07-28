import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { StatusBadge } from "@/components/app/AppCard"

const ORDER_STATUS_VARIANT = {
  DRAFT: "pending", BRIEFING: "pending", BRIEF_REVIEW: "current",
  ACTIVE: "active", DONE: "done", CANCELLED: "rejected",
} as const

const ORDER_STATUS_LABEL = {
  DRAFT: "Черновик", BRIEFING: "Бриф", BRIEF_REVIEW: "Проверка брифа",
  ACTIVE: "Активен", DONE: "Завершен", CANCELLED: "Отменен",
} as const

export default async function AdminPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "ADMIN") redirect("/login")

  const [
    totalOrders, activeOrders, newBriefs, unassignedOrders,
    totalSpecialists, pendingSpecialists, activeSpecialists,
    totalClients,
    heldPayments, heldSum,
    stagesOnReview, pendingBundles,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "ACTIVE" } }),
    prisma.order.count({ where: { status: "BRIEF_REVIEW" } }),
    prisma.order.count({ where: { status: "ACTIVE", specialistId: null } }),
    prisma.specialistProfile.count(),
    prisma.specialistProfile.count({ where: { onboardingStatus: "PENDING" } }),
    prisma.specialistProfile.count({ where: { onboardingStatus: "ACTIVE" } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.payment.count({ where: { status: "HELD" } }),
    prisma.payment.aggregate({ where: { status: "HELD" }, _sum: { amount: true } }),
    prisma.projectStage.count({ where: { status: "MOD_REVIEW" } }),
    prisma.landingBundle.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.order.findMany({
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, status: true, title: true, createdAt: true, updatedAt: true,
        clientId: true, specialistId: true,
        client: { select: { email: true, name: true } },
        specialist: { select: { email: true, name: true } },
      },
    }),
  ])

  const heldTotal = (heldSum._sum.amount ?? 0) / 100
  const urgentCount = newBriefs + stagesOnReview + unassignedOrders + pendingBundles + pendingSpecialists

  return (
    <AdminLayout>
      {/* Срочные действия */}
      {urgentCount > 0 && (
        <div className="card border-warning mb-4" style={{ borderLeft: "4px solid var(--bs-warning)" }}>
          <div className="card-body py-3">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="bx bx-error-circle text-warning fs-5" />
              <strong>Требует внимания — {urgentCount}</strong>
            </div>
            <div className="d-flex flex-wrap gap-3" style={{ fontSize: "0.85rem" }}>
              {newBriefs > 0 && (
                <a href="/admin/orders" className="text-decoration-none">
                  <span className="badge bg-label-warning me-1">{newBriefs}</span>
                  новых брифов
                </a>
              )}
              {stagesOnReview > 0 && (
                <a href="/admin/orders" className="text-decoration-none">
                  <span className="badge bg-label-danger me-1">{stagesOnReview}</span>
                  этапов на модерации
                </a>
              )}
              {unassignedOrders > 0 && (
                <a href="/admin/orders" className="text-decoration-none">
                  <span className="badge bg-label-primary me-1">{unassignedOrders}</span>
                  без специалиста
                </a>
              )}
              {pendingBundles > 0 && (
                <a href="/admin/landing" className="text-decoration-none">
                  <span className="badge bg-label-info me-1">{pendingBundles}</span>
                  сборок лендинга
                </a>
              )}
              {pendingSpecialists > 0 && (
                <a href="/admin/specialists" className="text-decoration-none">
                  <span className="badge bg-label-warning me-1">{pendingSpecialists}</span>
                  заявок специалистов
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Статистика */}
      <div className="row g-3 mb-4">
        {([
          { label: "Всего заказов", value: totalOrders, sub: `${activeOrders} активных`, icon: "bx-folder", color: "primary" },
          { label: "Новые брифы", value: newBriefs, sub: "ожидают проверки", icon: "bx-file", color: "warning" },
          { label: "На модерации", value: stagesOnReview, sub: "этапов", icon: "bx-check-shield", color: "danger" },
          { label: "Специалисты", value: `${activeSpecialists}/${totalSpecialists}`, sub: `${pendingSpecialists} ожидают модерации`, icon: "bx-user-check", color: "info" },
          { label: "Заказчиков", value: totalClients, sub: "на платформе", icon: "bx-user", color: "info" },
          { label: "На удержании", value: `${heldTotal.toLocaleString("ru-RU")} руб.`, sub: `${heldPayments} платежей`, icon: "bx-money", color: "success" },
        ] as const).map(s => (
          <div key={s.label} className="col-6 col-md-4 col-lg-2">
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="text-muted" style={{ fontSize: "0.78rem" }}>{s.label}</span>
                  <span className={`badge bg-label-${s.color} rounded-pill`}>
                    <i className={`bx ${s.icon}`} />
                  </span>
                </div>
                <h3 className="mb-1 fw-semibold" style={{ fontSize: "1.25rem" }}>{s.value}</h3>
                <small className="text-muted">{s.sub}</small>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Навигация */}
      <div className="row g-3 mb-4">
        {[
          { href: "/admin/specialists", label: "Специалисты", desc: "Онбординг и управление", icon: "bx-user-check" },
          { href: "/admin/clients", label: "Заказчики", desc: "Клиенты платформы", icon: "bx-user" },
          { href: "/admin/orders", label: "Заказы", desc: "Все проекты платформы", icon: "bx-folder" },
          { href: "/admin/payments", label: "Платежи", desc: "Выплаты и счета", icon: "bx-credit-card" },
          { href: "/admin/landing", label: "Лендинг", desc: "Модерация сборок", icon: "bx-globe" },
        ].map(item => (
          <div key={item.href} className="col-6 col-md-3 col-lg">
            <a href={item.href} className="card text-decoration-none h-100" style={{ transition: "box-shadow 0.15s" }}>
              <div className="card-body py-3">
                <i className={`bx ${item.icon} fs-3 mb-2 text-primary d-block`} />
                <h6 className="card-title mb-1">{item.label}</h6>
                <p className="text-muted mb-0" style={{ fontSize: "0.78rem" }}>{item.desc}</p>
              </div>
            </a>
          </div>
        ))}
      </div>

      {/* Последние заказы */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h5 className="card-title mb-0">Последние заказы</h5>
          <a href="/admin/orders" className="btn btn-sm btn-outline-secondary">Все заказы</a>
        </div>
        <div className="table-responsive">
          {recentOrders.length === 0 ? (
            <div className="card-body">
              <p className="text-muted mb-0" style={{ fontSize: "0.875rem" }}>Заказов пока нет</p>
            </div>
          ) : (
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Заказ</th>
                  <th>Клиент</th>
                  <th>Специалист</th>
                  <th>Статус</th>
                  <th>Обновлен</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(row => (
                  <tr key={row.id} style={{ cursor: "pointer" }}>
                    <td className="fw-medium">
                      <a href={`/admin/orders?highlight=${row.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        #{row.id.slice(-6)}
                      </a>
                      {row.title && <span className="text-muted ms-1" style={{ fontSize: "0.78rem" }}>{row.title}</span>}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>
                      <a href={`/admin/clients?highlight=${row.clientId}`} className="text-muted" style={{ textDecoration: "none" }}>
                        {row.client.name ?? row.client.email}
                      </a>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>
                      {row.specialist ? (
                        <a href={`/admin/specialists?highlight=${row.specialistId}`} className="text-muted" style={{ textDecoration: "none" }}>
                          {row.specialist.name ?? row.specialist.email}
                        </a>
                      ) : (
                        <span className="text-danger" style={{ fontSize: "0.78rem" }}>
                          <i className="bx bx-user-plus me-1" />не назначен
                        </span>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        variant={ORDER_STATUS_VARIANT[row.status as keyof typeof ORDER_STATUS_VARIANT] ?? "pending"}
                        label={ORDER_STATUS_LABEL[row.status as keyof typeof ORDER_STATUS_LABEL] ?? row.status}
                      />
                    </td>
                    <td className="text-muted" style={{ fontSize: "0.78rem" }}>
                      {new Date(row.updatedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
