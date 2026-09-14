"use client"

import {useCallback} from "react"
import {useSearchParams} from "next/navigation"
import {adminOrderHref, type AdminOrderTab} from "@/lib/admin-routes"
import {OrderDetail} from "./OrderDetail"
import {useOrdersShell} from "./OrdersShell"

/** Карточка заказа по адресу /admin/orders/:id[/:tab]; данные и действия — из списка в layout. */
export function OrderDetailRoute({id, activeTab}: { id: string; activeTab: AdminOrderTab }) {
    const {orders, loading, detailProps} = useOrdersShell()
    const searchParams = useSearchParams()
    const order = orders.find((o) => o.id === id) ?? null
    const tabHref = useCallback(
        (tab: AdminOrderTab) => adminOrderHref(id, tab, searchParams),
        [id, searchParams],
    )

    if (!order) {
        return (
            <div className="sp-detail">
                <div style={{textAlign: "center", color: "var(--adm-muted)", padding: "60px 0"}}>
                    <i className="bx bx-folder-open" style={{fontSize: 48, opacity: 0.3, display: "block"}}/>
                    <p style={{marginTop: 8}}>{loading ? "Загрузка…" : "Заказ не найден"}</p>
                </div>
            </div>
        )
    }

    return <OrderDetail {...detailProps} order={order} activeTab={activeTab} tabHref={tabHref}/>
}
