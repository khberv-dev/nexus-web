"use client"

import {usePathname, useRouter, useSearchParams} from "next/navigation"
import {useCallback, useMemo, useState} from "react"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {DashHeroFrame} from "@/components/dashboard-ui/DashHeroFrame"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashSidebarNav} from "@/components/dashboard-ui/DashSidebarNav"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import "../../Community/Community.css"
import {CLIENT_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import {buildClientCabinetNavItems, SIDEBAR_TABS} from "./constants"
import type {ClientCabinetProps} from "./types"
import {OrdersSidebar} from "./OrdersSidebar"
import {OrdersTab} from "./OrdersTab"
import {HintTour, HintTourLauncher} from "@/components/app/HintTour"
import {buildClientHintSteps} from "@/components/app/hint-tour-steps"
import {PaymentsTab} from "./PaymentsTab"
import {SettingsTab} from "./SettingsTab"

const VALID_TABS: Set<string> = new Set(SIDEBAR_TABS.map(t => t.id))

export default function ClientCabinetPage({
                                              name,
                                              email,
                                              formData = {},
                                              orders = [],
                                              payments = [],
                                              invoices = [],
                                              contracts = [],
                                              acts = [],
                                              frameworkContract = {status: "NONE", number: null, hasFile: false},
                                          }: ClientCabinetProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const rawTab = searchParams.get("tab") ?? "orders"
    const activeTab = VALID_TABS.has(rawTab) ? rawTab : "orders"

    const setActiveTab = useCallback((tab: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (tab === "orders") params.delete("tab")
        else params.set("tab", tab)
        const qs = params.toString()
        router.push(qs ? `${pathname}?${qs}` : pathname, {scroll: false})
    }, [searchParams, router, pathname])
    const initials = (name || email)[0].toUpperCase()

    const needsAction = orders.filter(o => o.stages.some(s => s.status === "CLIENT_REVIEW")).length

    const [hintsOpen, setHintsOpen] = useState(false)
    const clientHintSteps = useMemo(() => buildClientHintSteps(setActiveTab), [setActiveTab])

    return (
        <div className="dash">
            {/* Подсказки по кабинету: один раз при первом входе, дальше — по кнопке «?». */}
            <HintTour
                steps={clientHintSteps}
                storageKey={`client:v3:${email}`}
                open={hintsOpen || undefined}
                onClose={() => setHintsOpen(false)}
            />
            <HintTourLauncher onClick={() => setHintsOpen(true)} hidden={hintsOpen}/>
            <DashTopHeader
                email={email}
                title="Кабинет заказчика"
                logoHref={CLIENT_CABINET_LOGO_HREF}
                navItems={buildClientCabinetNavItems(activeTab)}
                primaryAction={
                    activeTab === "orders"
                        ? {
                            href: "/orders/new",
                            label: "Создать проект",
                            iconClassName: "bx bx-plus",
                        }
                        : null
                }
                showPrimaryActionInHeader={false}
            />
            <DashMainLayout
                sidebar={
                    <DashSidebarNav
                        tabs={SIDEBAR_TABS}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        badgeCountByTab={{orders: needsAction}}
                    />
                }
            >
                <DashHeroFrame>
                    <div className="dash-hero" data-tour="client-hero">
                        <div
                            style={{
                                width: 72,
                                height: 72,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, hsl(247,60%,58%), hsl(282,60%,48%))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.6rem",
                                fontWeight: 700,
                                color: "#fff",
                                flexShrink: 0,
                            }}
                        >
                            {initials}
                        </div>
                        <div className="dash-hero__info">
                            <h2 className="dash-hero__name">{name || email}</h2>
                            <p className="dash-hero__desc">Личный кабинет заказчика</p>
                            <p className="dash-hero__sub">
                                <span>{email}</span>
                                {formData?.city && <span> · {formData.city}</span>}
                                {formData?.company && <span> · {formData.company}</span>}
                            </p>
                            {needsAction > 0 && (
                                <div
                                    style={{
                                        marginTop: 6,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "3px 10px",
                                        borderRadius: 6,
                                        background: "var(--dash-warn-bg)",
                                        color: "var(--dash-warn)",
                                        fontSize: "0.78rem",
                                        fontWeight: 600,
                                    }}
                                >
                                    <i className="bx bx-bell"/>
                                    {needsAction} проект{needsAction > 1 ? "а" : ""} ожидают решения
                                </div>
                            )}
                        </div>
                    </div>
                </DashHeroFrame>

                {activeTab === "payments" ? (
                    <div style={{padding: "0 1rem"}} data-tour="client-payments">
                        <PaymentsTab
                            payments={payments}
                            formData={formData}
                            invoices={invoices}
                            contracts={contracts}
                            acts={acts}
                            frameworkContract={frameworkContract}
                            onSwitchToSettings={() => setActiveTab("settings")}
                        />
                    </div>
                ) : activeTab === "settings" ? (
                    <div style={{padding: "0 1rem"}} data-tour="client-settings">
                        <SettingsTab name={name} email={email} formData={formData}/>
                    </div>
                ) : (
                    <div className="dash-content">
                        {activeTab === "orders" && (
                            <>
                                <div className="dash-col1" data-tour="client-orders">
                                    <OrdersTab orders={orders}/>
                                </div>
                                <div className="dash-col2" data-tour="client-stages">
                                    <OrdersSidebar orders={orders} payments={payments}/>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <ClientDashFooter/>
            </DashMainLayout>
        </div>
    )
}
