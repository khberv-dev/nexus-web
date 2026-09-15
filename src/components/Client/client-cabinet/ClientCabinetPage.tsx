"use client"

import {useRouter, useSelectedLayoutSegment} from "next/navigation"
import {type ReactNode, useCallback, useMemo, useState} from "react"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {DashHeroFrame} from "@/components/dashboard-ui/DashHeroFrame"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import "../../Community/Community.css"
import {CLIENT_CABINET_LOGO_HREF, CLIENT_CABINET_SECTIONS, type ClientCabinetSection, clientSectionHref} from "@/lib/cabinet-shell"
import {buildClientCabinetNavItems} from "./constants"
import type {ClientCabinetProps} from "./types"
import {HintTour, HintTourLauncher} from "@/components/app/HintTour"
import {buildClientHintSteps} from "@/components/app/hint-tour-steps"
import {ClientCabinetContext} from "./ClientCabinetSections"

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
                                              children,
                                          }: ClientCabinetProps & { children: ReactNode }) {
    const router = useRouter()
    // Раздел берём из адреса: у списка проектов (/orders) дочернего сегмента нет.
    const segment = useSelectedLayoutSegment()
    const activeTab: ClientCabinetSection =
        CLIENT_CABINET_SECTIONS.find((section) => section === segment) ?? "orders"

    // Экскурсия переключает разделы сама — переходом на адрес раздела.
    // true — переход начат, HintTour подождёт, пока страница раздела отрисуется.
    const setActiveTab = useCallback((tab: string) => {
        const section = CLIENT_CABINET_SECTIONS.find((s) => s === tab)
        if (!section) return false
        // Текущий адрес читаем в момент вызова: колбэк стабилен, и экскурсия
        // не пересобирает шаги посреди показа.
        const href = clientSectionHref(section)
        if (window.location.pathname === href) return false
        router.push(href, {scroll: false})
        return true
    }, [router])
    const initials = (name || email)[0].toUpperCase()

    const needsAction = orders.filter(o => o.stages.some(s => s.status === "CLIENT_REVIEW")).length

    const [hintsOpen, setHintsOpen] = useState(false)
    const clientHintSteps = useMemo(() => buildClientHintSteps(setActiveTab), [setActiveTab])

    const cabinetData: ClientCabinetProps = {
        name, email, formData, orders, payments, invoices, contracts, acts, frameworkContract,
    }

    return (
        <ClientCabinetContext.Provider value={cabinetData}>
        <div className="dash">
            {/* Подсказки по кабинету: один раз при первом входе, дальше — по кнопке «?». */}
            <HintTour
                steps={clientHintSteps}
                storageKey={`client:v3:${email}`}
                open={hintsOpen || undefined}
                onClose={() => setHintsOpen(false)}
            />
            <HintTourLauncher onClick={() => setHintsOpen(true)}/>
            <DashTopHeader
                email={email}
                name={name}
                title="Кабинет заказчика"
                logoHref={CLIENT_CABINET_LOGO_HREF}
                navItems={buildClientCabinetNavItems(activeTab, {orders: needsAction})}
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
            <DashMainLayout>
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

                {children}

                <ClientDashFooter/>
            </DashMainLayout>
        </div>
        </ClientCabinetContext.Provider>
    )
}
