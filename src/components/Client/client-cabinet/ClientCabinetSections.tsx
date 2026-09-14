"use client"

import {createContext, useContext} from "react"
import {useRouter} from "next/navigation"
import {clientSectionHref} from "@/lib/cabinet-shell"
import type {ClientCabinetProps} from "./types"
import {OrdersSidebar} from "./OrdersSidebar"
import {OrdersTab} from "./OrdersTab"
import {PaymentsTab} from "./PaymentsTab"
import {SettingsTab} from "./SettingsTab"

/** Данные кабинета заказчика: грузятся один раз в layout и читаются разделами-страницами. */
export const ClientCabinetContext = createContext<ClientCabinetProps | null>(null)

function useClientCabinet(): ClientCabinetProps {
    const value = useContext(ClientCabinetContext)
    if (!value) throw new Error("useClientCabinet must be used inside ClientCabinetPage")
    return value
}

export function ClientOrdersSection() {
    const {orders, payments} = useClientCabinet()
    return (
        <div className="dash-content">
            <div className="dash-col1" data-tour="client-orders">
                <OrdersTab orders={orders}/>
            </div>
            <div className="dash-col2" data-tour="client-stages">
                <OrdersSidebar orders={orders} payments={payments}/>
            </div>
        </div>
    )
}

export function ClientPaymentsSection() {
    const router = useRouter()
    const {payments, formData, invoices, contracts, acts, frameworkContract} = useClientCabinet()
    return (
        <div style={{padding: "0 1rem"}} data-tour="client-payments">
            <PaymentsTab
                payments={payments}
                formData={formData}
                invoices={invoices}
                contracts={contracts}
                acts={acts}
                frameworkContract={frameworkContract ?? {status: "NONE", number: null, hasFile: false}}
                onSwitchToSettings={() => router.push(clientSectionHref("settings"), {scroll: false})}
            />
        </div>
    )
}

export function ClientSettingsSection() {
    const {name, email, formData} = useClientCabinet()
    return (
        <div style={{padding: "0 1rem"}} data-tour="client-settings">
            <SettingsTab name={name} email={email} formData={formData}/>
        </div>
    )
}
