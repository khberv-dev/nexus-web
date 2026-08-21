"use client"

import Link from "next/link"
import type {ClientOrder} from "./types"
import {DashListHeader} from "@/components/dashboard-ui/DashListHeader"
import {OrdersListView} from "./OrdersListView"

export function OrdersTab({
                              orders,
                          }: {
    orders: ClientOrder[]
}) {
    return (
        <div className="dash-projects-panel">
            <DashListHeader
                title="Мои проекты"
                action={
                    <Link href="/orders/new" className="dash-hero-project-btn dash-cta-new-project"
                          data-tour="btn-create-order">
                        <i className="bx bx-plus" aria-hidden/>
                        Создать проект
                    </Link>
                }
            />
            <div className="dash-projects-body">
                <div className="dash-projects-list-heading"><h3 className="dash-section-heading">Все заказы</h3></div>
                <OrdersListView orders={orders} listFilter="all"/>
            </div>
        </div>
    )
}
