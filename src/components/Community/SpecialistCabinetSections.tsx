"use client"

import {useState} from "react"
import {useRouter} from "next/navigation"
import {DashActionLink} from "@/components/dashboard-ui/DashActionLink"
import {DashEmptyState} from "@/components/dashboard-ui/DashEmptyState"
import {DashSectionCard} from "@/components/dashboard-ui/DashSectionCard"
import {specialistSectionHref} from "@/lib/cabinet-shell"
import {landingRequirements} from "@/lib/landing/bundle-requirements"
import LandingUploader from "./LandingUploader"
import PortfolioProjects from "./PortfolioProjects"
import {OrdersCol1, OrdersCol2} from "./OrdersTab"
import {PaymentsCol1, PaymentsCol2} from "./PaymentsTab"
import {SettingsCol1, SettingsCol2} from "./SettingsTab"
import {useSpecialistCabinet} from "./SpecialistCabinetContext"
import type {ActItem, UrgentItem} from "./types"

/** Разделы кабинета специалиста — по одной странице на /work/<section>. */

export function SpecialistOrdersSection() {
    const {orders} = useSpecialistCabinet()
    const urgentItems: UrgentItem[] = orders.flatMap(order =>
        order.stages.filter(s => s.status === "MOD_REVISION" || s.status === "CLIENT_REVISION").map(stage => ({
            order,
            stage
        }))
    )
    const actItems: ActItem[] = orders.flatMap(order =>
        order.stages.filter(s => s.act && s.act.signedAt === null).map(stage => ({order, stage}))
    )

    const signAct = async (stageId: string) => {
        const res = await fetch(`/api/stages/${stageId}/act/sign`, {method: "POST"})
        if (res.ok) window.location.reload()
        else alert("Ошибка подписания акта")
    }

    return (
        <>
            <div className="dash-col1" data-tour="orders-list"><OrdersCol1 orders={orders}/></div>
            <div className="dash-col2" data-tour="orders-actions"><OrdersCol2 orders={orders} urgentItems={urgentItems}
                                                                   actItems={actItems} onSignAct={signAct}/></div>
        </>
    )
}

export function SpecialistPortfolioSection() {
    return <PortfolioProjects/>
}

export function SpecialistLandingSection({portfolioProjectsCount}: { portfolioProjectsCount: number }) {
    const router = useRouter()
    const {formData, about, featuredOnLanding, landingWorkPos, avatarUrl} = useSpecialistCabinet()
    const [landingReadiness, setLandingReadiness] = useState({
        avatar: Boolean(avatarUrl),
        work: false,
        video: false,
        portfolio: 0,
        specialty: !!(formData?.specialty?.trim() || formData?.specialization?.trim()),
        about: !!about?.trim(),
    })

    if (portfolioProjectsCount === 0) {
        return (
            <div style={{gridColumn: "1 / -1"}}>
                <DashEmptyState
                    iconClass="bx-image-alt"
                    message="Сначала создайте проект портфолио — лендинг собирается из его материалов."
                >
                    <DashActionLink href={specialistSectionHref("portfolio")} iconClass="bx-plus">
                        Создать проект портфолио
                    </DashActionLink>
                </DashEmptyState>
            </div>
        )
    }

    return (
        <>
            <div className="dash-col1" data-tour="landing-readiness">
                <DashEmptyState
                    iconClass="bx-globe"
                    message={
                        <>
                            Материалы для<br/>главной страницы
                            <br/>
                            <span style={{
                                display: "inline-block",
                                marginTop: 8,
                                fontSize: 12,
                                textAlign: "left",
                                lineHeight: 1.45
                            }}>
                        {landingRequirements(landingReadiness).map((item) => (
                            <span key={item.key}>
                                <span style={{
                                    color: item.done
                                        ? "var(--dash-success, #28c76f)"
                                        : "var(--dash-muted, #8f95b2)",
                                }}>
                                    {item.done ? "✓" : "○"} {item.label}
                                    {item.optional && (
                                        <span style={{opacity: 0.7}}> · необязательно</span>
                                    )}
                                </span>
                                <br/>
                            </span>
                        ))}
                      </span>
                        </>
                    }
                    style={{paddingTop: 16}}
                />
            </div>
            <div className="dash-col2" data-tour="landing-uploader">
                <DashSectionCard title="Карусель на лендинге">
                    <LandingUploader
                        featuredOnLanding={featuredOnLanding}
                        avatarUrl={avatarUrl}
                        specialty={formData?.specialty ?? formData?.specialization}
                        about={about}
                        onGoToSettings={() => router.push(specialistSectionHref("settings"), {scroll: false})}
                        initialWorkPos={landingWorkPos}
                        onReadinessChange={setLandingReadiness}
                    />
                </DashSectionCard>
            </div>
        </>
    )
}

export function SpecialistPaymentsSection() {
    const {payments, formData, contracts, acts} = useSpecialistCabinet()
    return (
        <>
            <div className="dash-col1" data-tour="payments-summary"><PaymentsCol1 payments={payments} formData={formData ?? null}
                                                                     contracts={contracts} acts={acts}/></div>
            <div className="dash-col2" data-tour="payments-history"><PaymentsCol2 payments={payments}/></div>
        </>
    )
}

export function SpecialistSettingsSection() {
    const {name, email, city, experience, software, about, status, onboardingSteps, formData, featuredOnLanding} =
        useSpecialistCabinet()
    return (
        <>
            <div className="dash-col1" data-tour="settings-overview">
                <SettingsCol1 name={name} email={email} city={city} experience={experience}
                              software={software} about={about} status={status}
                              onboardingSteps={onboardingSteps}/>
            </div>
            <div className="dash-col2" data-tour="settings-form">
                <SettingsCol2 name={name} email={email} formData={formData ?? null} status={status}
                              onboardingSteps={onboardingSteps} featuredOnLanding={featuredOnLanding}/>
            </div>
        </>
    )
}
