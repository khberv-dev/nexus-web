"use client"

import React, {useCallback, useEffect, useMemo, useState} from "react"
import {useRouter, useSearchParams} from "next/navigation"
import "./Community.css"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {DashEmptyState} from "@/components/dashboard-ui/DashEmptyState"
import {DashHeroFrame} from "@/components/dashboard-ui/DashHeroFrame"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashSectionCard} from "@/components/dashboard-ui/DashSectionCard"
import {DashSidebarNav} from "@/components/dashboard-ui/DashSidebarNav"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {buildSpecialistCabinetNavItems} from "@/components/Community/specialist-route-tabs"
import {SPECIALIST_CABINET_LOGO_HREF} from "@/lib/cabinet-shell"
import AvatarUpload from "./AvatarUpload"
import {HintTour, HintTourLauncher} from "@/components/app/HintTour"
import {buildSpecialistHintSteps} from "@/components/app/hint-tour-steps"
import LandingUploader from "./LandingUploader"
import PortfolioProjects from "./PortfolioProjects"
import {OrdersCol1, OrdersCol2} from "./OrdersTab"
import {PaymentsCol1, PaymentsCol2} from "./PaymentsTab"
import {SettingsCol1, SettingsCol2} from "./SettingsTab"
import type {
    ActItem,
    OnboardingStep,
    OrderWithRelations,
    PaymentWithRelations,
    SpecAct,
    SpecContract,
    UrgentItem
} from "./types"
import {ONBOARDING_STEPS} from "./types"

interface CommunityProps {
    name: string;
    email: string;
    city?: string
    experience?: string;
    software?: string;
    about?: string;
    status?: string
    orders?: OrderWithRelations[]
    payments?: PaymentWithRelations[]
    contracts?: SpecContract[]
    acts?: SpecAct[]
    formData?: Record<string, string> | null
    onboardingSteps?: OnboardingStep[]
    avatarUrl?: string | null
    featuredOnLanding?: boolean
    landingWorkPos?: string
    rating?: number | null
}

const SIDEBAR_TABS = [
    {id: "orders", icon: "bx-folder", label: "Проекты"},
    {id: "portfolio", icon: "bx-image-alt", label: "Портфолио"},
    {id: "landing", icon: "bx-globe", label: "Лендинг"},
    {id: "payments", icon: "bx-credit-card", label: "Выплаты"},
    {id: "settings", icon: "bx-cog", label: "Настройки"},
]

const VALID_TABS = new Set(SIDEBAR_TABS.map(t => t.id))

export default function CommunityPage({
                                          name,
                                          email,
                                          city,
                                          experience,
                                          software,
                                          about,
                                          status,
                                          orders = [],
                                          payments = [],
                                          contracts = [],
                                          acts = [],
                                          formData,
                                          onboardingSteps = [],
                                          avatarUrl: initialAvatarUrl,
                                          featuredOnLanding,
                                          landingWorkPos,
                                          rating,
                                      }: CommunityProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const tabFromUrl = searchParams.get("tab")
    const initialTab = tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : "orders"

    const [activeTab, setActiveTabState] = useState(initialTab)
    const setActiveTab = useCallback((tab: string) => {
        setActiveTabState(tab)
        const url = tab === "orders" ? SPECIALIST_CABINET_LOGO_HREF : `${SPECIALIST_CABINET_LOGO_HREF}?tab=${tab}`
        router.replace(url, {scroll: false})
    }, [router])

    // Sync when browser back/forward changes the URL
    useEffect(() => {
        const t = searchParams.get("tab")
        const resolved = t && VALID_TABS.has(t) ? t : "orders"
        setActiveTabState(resolved)
    }, [searchParams])

    const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null)
    const [hintsOpen, setHintsOpen] = useState(false)
    const specialistHintSteps = useMemo(() => buildSpecialistHintSteps(setActiveTab), [setActiveTab])
    const [landingReadiness, setLandingReadiness] = useState({
        portrait: false,
        work: false,
        video: false,
        portfolio: 0,
        specialty: !!(formData?.specialty?.trim() || formData?.specialization?.trim()),
        about: !!about?.trim(),
    })

    const initials = name[0]?.toUpperCase() ?? "?"

    const totalEarned = payments.filter(p => p.status === "RELEASED").reduce((sum, p) => sum + p.amount, 0)

    const urgentItems: UrgentItem[] = orders.flatMap(order =>
        order.stages.filter(s => s.status === "MOD_REVISION" || s.status === "CLIENT_REVISION").map(stage => ({
            order,
            stage
        }))
    )
    const actItems: ActItem[] = orders.flatMap(order =>
        order.stages.filter(s => s.act && s.act.signedAt === null).map(stage => ({order, stage}))
    )
    const needsAction = urgentItems.length

    const testStep = onboardingSteps.find(s => s.type === "TEST")
    const testScoreText = (() => {
        const raw = testStep?.comment
        if (!raw) return "—"
        try {
            const parsed = JSON.parse(raw) as { correctCount?: number; total?: number; percent?: number }
            if (typeof parsed.correctCount === "number" && typeof parsed.total === "number") {
                const pct = typeof parsed.percent === "number" ? ` (${parsed.percent}%)` : ""
                return `${parsed.correctCount}/${parsed.total}${pct}`
            }
        } catch {
        }
        return "—"
    })()
    const specialistLevel = (() => {
        const raw = testStep?.comment
        if (!raw) return null
        try {
            const parsed = JSON.parse(raw) as { passedLevels?: string[] }
            const labels: Record<string, string> = {L1: "JUNIOR", L2: "SENIOR", L3: "MASTER", L4: "ELITE"}
            const highest = [...(parsed.passedLevels ?? [])].sort().at(-1)
            return highest ? (labels[highest] ?? highest) : null
        } catch {
            return null
        }
    })()
    const passedStepsCount = onboardingSteps.filter(s => s.status === "PASSED").length
    const onboardingBadge = `${passedStepsCount}/${ONBOARDING_STEPS.length}`
    const doneOrdersCount = orders.filter(o => o.status === "DONE").length

    const signAct = async (stageId: string) => {
        const res = await fetch(`/api/stages/${stageId}/act/sign`, {method: "POST"})
        if (res.ok) window.location.reload()
        else alert("Ошибка подписания акта")
    }

    return (
        <div className="dash">
            {/* Подсказки после онбординга: показываем один раз, дальше — по кнопке в шапке. */}
            <HintTour
                steps={specialistHintSteps}
                storageKey={`specialist:v2:${email}`}
                enabled={status === "ACTIVE"}
                open={hintsOpen || undefined}
                onClose={() => setHintsOpen(false)}
            />
            <HintTourLauncher onClick={() => setHintsOpen(true)} hidden={hintsOpen}/>
            <DashTopHeader
                email={email}
                title="Кабинет специалиста"
                logoHref={SPECIALIST_CABINET_LOGO_HREF}
                navItems={buildSpecialistCabinetNavItems(activeTab)}
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
                {/* Hero */}
                <DashHeroFrame>
                    <div className="rwd-grid-2" style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "stretch"}}>

                        {/* LEFT — identity */}
                        <div data-tour="hero-profile" style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            padding: "18px 20px",
                            borderRadius: 12,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--dash-border2)"
                        }}>
                            <div style={{display: "flex", alignItems: "center", gap: 14}}>
                                <AvatarUpload heroMode initials={initials} currentUrl={avatarUrl}
                                              onUploaded={setAvatarUrl}/>
                                <div style={{minWidth: 0}}>
                                    <h2 className="dash-hero__name" style={{marginBottom: 4}}>{name}</h2>
                                    {specialistLevel && (
                                        <span style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 5,
                                            padding: "2px 10px",
                                            borderRadius: 999,
                                            fontSize: 11,
                                            fontWeight: 700,
                                            letterSpacing: "0.06em",
                                            border: "1px solid rgba(52,211,153,0.4)",
                                            background: "rgba(52,211,153,0.12)",
                                            color: "#6ee7b7"
                                        }}>
                      <i className="bx bx-trophy" style={{fontSize: 11}}/> {specialistLevel}
                    </span>
                                    )}
                                </div>
                            </div>
                            <div className="dash-hero__rating">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <i key={n}
                                       className={`bx ${rating != null && n <= Math.round(rating) ? "bxs-star" : "bx-star"}`}/>
                                ))}
                                <span
                                    className="dash-hero__rating-value">{rating != null ? rating.toFixed(1) : "—"}</span>
                            </div>
                            {about && <p className="dash-hero__bio" style={{margin: 0}}>{about}</p>}
                            <p className="dash-hero__sub" style={{margin: 0}}>
                                <span>{email}</span>{city && <span> · {city}</span>}
                                {experience && <span> · {experience} лет опыта</span>}
                            </p>
                        </div>

                        {/* RIGHT — 2×2 stats grid */}
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gridTemplateRows: "1fr 1fr",
                            gap: 8
                        }}>

                            {/* Верификация */}
                            <div style={{
                                padding: "14px 16px",
                                borderRadius: 12,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--dash-border2)",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between"
                            }}>
                                <div style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.07em",
                                    color: "var(--dash-muted)",
                                    marginBottom: 8
                                }}>Верификация
                                </div>
                                <div style={{display: "flex", gap: 3, marginBottom: 6}}>
                                    {ONBOARDING_STEPS.map(step => {
                                        const done = onboardingSteps.some(s => s.type === step.key && s.status === "PASSED")
                                        return <div key={step.key} style={{
                                            flex: 1,
                                            height: 5,
                                            borderRadius: 3,
                                            background: done ? "linear-gradient(to right, hsl(247,72%,62%), hsl(282,72%,52%))" : "var(--dash-border)"
                                        }}/>
                                    })}
                                </div>
                                <div style={{
                                    fontSize: 12,
                                    color: "var(--dash-muted)"
                                }}>{onboardingSteps.filter(s => s.status === "PASSED").length} / {ONBOARDING_STEPS.length} шагов
                                </div>
                            </div>

                            {/* Квалификация */}
                            <div style={{
                                padding: "14px 16px",
                                borderRadius: 12,
                                background: specialistLevel ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${specialistLevel ? "rgba(52,211,153,0.2)" : "var(--dash-border2)"}`,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between"
                            }}>
                                <div style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.07em",
                                    color: "var(--dash-muted)",
                                    marginBottom: 8
                                }}>Квалификация
                                </div>
                                <div style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: specialistLevel ? "#6ee7b7" : "var(--dash-muted)"
                                }}>{specialistLevel ?? "—"}</div>
                                <div style={{
                                    fontSize: 11,
                                    color: "var(--dash-muted)",
                                    marginTop: 4
                                }}>Тест: {testScoreText}</div>
                            </div>

                            {/* Проекты */}
                            <div style={{
                                padding: "14px 16px",
                                borderRadius: 12,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--dash-border2)",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between"
                            }}>
                                <div style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.07em",
                                    color: "var(--dash-muted)",
                                    marginBottom: 8
                                }}>Проекты
                                </div>
                                <div style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: "var(--dash-text)"
                                }}>{doneOrdersCount}</div>
                                <div style={{
                                    fontSize: 11,
                                    color: "var(--dash-muted)",
                                    marginTop: 4
                                }}>завершено{totalEarned > 0 ? ` · ${(totalEarned / 100).toLocaleString("ru-RU")} ₽` : ""}</div>
                            </div>

                            {/* Лендинг */}
                            <div style={{
                                padding: "14px 16px",
                                borderRadius: 12,
                                background: featuredOnLanding ? "rgba(52,211,153,0.05)" : "rgba(255,255,255,0.03)",
                                border: `1px solid ${featuredOnLanding ? "rgba(52,211,153,0.2)" : "var(--dash-border2)"}`,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between"
                            }}>
                                <div style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.07em",
                                    color: "var(--dash-muted)",
                                    marginBottom: 8
                                }}>Лендинг
                                </div>
                                <div style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: featuredOnLanding ? "#6ee7b7" : "var(--dash-muted)"
                                }}>{featuredOnLanding ? "Активен" : "Скрыт"}</div>
                                <div style={{fontSize: 11, color: "var(--dash-muted)", marginTop: 4}}>публичный
                                    профиль
                                </div>
                            </div>

                        </div>
                    </div>
                </DashHeroFrame>

                {/* Tab content */}
                <div className="dash-content">
                    {activeTab === "orders" && (
                        <>
                            <div className="dash-col1" data-tour="orders-list"><OrdersCol1 orders={orders}/></div>
                            <div className="dash-col2" data-tour="orders-actions"><OrdersCol2 orders={orders} urgentItems={urgentItems}
                                                                   actItems={actItems} onSignAct={signAct}/></div>
                        </>
                    )}
                    {activeTab === "portfolio" && <PortfolioProjects/>}
                    {activeTab === "landing" && (
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
                        <span
                            style={{color: landingReadiness.portrait ? "var(--dash-success, #28c76f)" : "var(--dash-muted, #8f95b2)"}}>{landingReadiness.portrait ? "✓" : "○"} Портрет</span><br/>
                        <span
                            style={{color: landingReadiness.work ? "var(--dash-success, #28c76f)" : "var(--dash-muted, #8f95b2)"}}>{landingReadiness.work ? "✓" : "○"} Фото интерьера</span><br/>
                        <span
                            style={{color: landingReadiness.video ? "var(--dash-success, #28c76f)" : "var(--dash-muted, #8f95b2)"}}>{landingReadiness.video ? "✓" : "○"} Видео-визитка</span><br/>
                        <span
                            style={{color: landingReadiness.portfolio > 0 ? "var(--dash-success, #28c76f)" : "var(--dash-muted, #8f95b2)"}}>{landingReadiness.portfolio > 0 ? "✓" : "○"} Портфолио: {landingReadiness.portfolio}/3</span><br/>
                        <span
                            style={{color: landingReadiness.specialty ? "var(--dash-success, #28c76f)" : "var(--dash-muted, #8f95b2)"}}>{landingReadiness.specialty ? "✓" : "○"} Специализация</span><br/>
                        <span
                            style={{color: landingReadiness.about ? "var(--dash-success, #28c76f)" : "var(--dash-muted, #8f95b2)"}}>{landingReadiness.about ? "✓" : "○"} О себе</span>
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
                                        specialty={formData?.specialty ?? formData?.specialization}
                                        about={about}
                                        onGoToSettings={() => setActiveTab("settings")}
                                        initialWorkPos={landingWorkPos}
                                        onReadinessChange={setLandingReadiness}
                                    />
                                </DashSectionCard>
                            </div>
                        </>
                    )}
                    {activeTab === "payments" && (
                        <>
                            <div className="dash-col1" data-tour="payments-summary"><PaymentsCol1 payments={payments} formData={formData ?? null}
                                                                     contracts={contracts} acts={acts}/></div>
                            <div className="dash-col2" data-tour="payments-history"><PaymentsCol2 payments={payments}/></div>
                        </>
                    )}
                    {activeTab === "settings" && (
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
                    )}
                </div>

                <ClientDashFooter/>
            </DashMainLayout>
        </div>
    )
}
