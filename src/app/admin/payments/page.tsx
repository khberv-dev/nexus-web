"use client"

import {useCallback, useEffect, useState} from "react"
import {StatusBadge, StatusVariant} from "@/components/app/AppCard"
import {AdminLayout} from "@/components/admin/AdminLayout"
import {useRegisterAdminRefresh} from "@/components/admin/AdminRefreshContext"

type PaymentStatus = "PENDING" | "HELD" | "RELEASED" | "REFUNDED" | "FAILED"

interface Payment {
    id: string
    amount: number
    status: PaymentStatus
    createdAt: string
    order: {
        id: string; title: string | null; status: string
        client: { email: string; name: string | null }
        specialist: { email: string; name: string | null } | null
    }
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
    PENDING: "Ожидание", HELD: "Удержан", RELEASED: "Выплачен", REFUNDED: "Возврат", FAILED: "Ошибка",
}
const STATUS_VARIANT: Record<PaymentStatus, StatusVariant> = {
    PENDING: "pending", HELD: "current", RELEASED: "done", REFUNDED: "rejected", FAILED: "rejected",
}

const fmt = (n: number) => n.toLocaleString("ru-RU")

export default function PaymentsAdminPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<PaymentStatus | "ALL">("ALL")
    const [releasing, setReleasing] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch("/api/admin/payments")
        if (res.ok) setPayments(await res.json())
        setLoading(false)
    }, [])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        load()
    }, [load])

    useRegisterAdminRefresh(load)

    const release = async (id: string) => {
        setReleasing(id)
        await fetch(`/api/admin/payments/${id}/release`, {method: "POST"})
        await load()
        setReleasing(null)
    }

    const filtered = filter === "ALL" ? payments : payments.filter(p => p.status === filter)

    const total = {
        held: payments.filter(p => p.status === "HELD").reduce((s, p) => s + p.amount, 0),
        released: payments.filter(p => p.status === "RELEASED").reduce((s, p) => s + p.amount, 0),
        pending: payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0),
    }

    return (
        <AdminLayout>

            {/* Статистика */}
            <div className="row g-3 mb-4">
                {[
                    {label: "На удержании", value: total.held, icon: "bx-time", color: "warning"},
                    {label: "Выплачено", value: total.released, icon: "bx-check-circle", color: "success"},
                    {label: "Ожидает", value: total.pending, icon: "bx-hourglass", color: "info"},
                ].map(s => (
                    <div key={s.label} className="col-md-4">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <small className="text-muted">{s.label}</small>
                                    <span className={`badge bg-label-${s.color} rounded-pill`}>
                    <i className={`bx ${s.icon}`}/>
                  </span>
                                </div>
                                <h4 className="mb-0 fw-semibold">{fmt(s.value)} <small
                                    className="text-muted fs-6">руб.</small></h4>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Таблица */}
            <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                    <h5 className="card-title mb-0">
                        Все платежи
                        <span className="badge bg-label-primary ms-2">{filtered.length}</span>
                    </h5>
                    <div className="d-flex gap-1">
                        {([
                            {value: "ALL", label: "Все"},
                            {value: "HELD", label: "Удержан"},
                            {value: "RELEASED", label: "Выплачен"},
                            {value: "PENDING", label: "Ожидание"},
                            {value: "REFUNDED", label: "Возврат"},
                        ] as { value: PaymentStatus | "ALL"; label: string }[]).map(f => (
                            <button
                                key={f.value}
                                className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => setFilter(f.value)}
                                style={{fontSize: "0.72rem", padding: "2px 10px"}}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="table-responsive">
                    {loading && <div className="p-4 text-muted">Загрузка…</div>}
                    {!loading && filtered.length === 0 && (
                        <div className="p-4 text-center text-muted">Платежей нет</div>
                    )}
                    {!loading && filtered.length > 0 && (
                        <table className="table table-hover mb-0">
                            <thead>
                            <tr>
                                <th>Сумма</th>
                                <th>Заказ</th>
                                <th>Клиент</th>
                                <th>Специалист</th>
                                <th>Статус</th>
                                <th>Дата</th>
                                <th></th>
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.map(p => (
                                <tr key={p.id}>
                                    <td className="fw-semibold">{fmt(p.amount)} руб.</td>
                                    <td className="text-muted" style={{fontSize: "0.875rem"}}>
                                        {p.order.title ?? `#${p.order.id.slice(-6)}`}
                                    </td>
                                    <td className="text-muted"
                                        style={{fontSize: "0.875rem"}}>{p.order.client.email}</td>
                                    <td className="text-muted" style={{fontSize: "0.875rem"}}>
                                        {p.order.specialist?.email ?? <span className="text-danger">—</span>}
                                    </td>
                                    <td><StatusBadge variant={STATUS_VARIANT[p.status]} label={STATUS_LABEL[p.status]}/>
                                    </td>
                                    <td className="text-muted" style={{fontSize: "0.8rem"}}>
                                        {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                                    </td>
                                    <td>
                                        {p.status === "HELD" && (
                                            <button
                                                onClick={() => release(p.id)}
                                                disabled={releasing !== null}
                                                className="btn btn-sm btn-success"
                                            >
                                                {releasing === p.id ? "…" : "Выплатить"}
                                            </button>
                                        )}
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
