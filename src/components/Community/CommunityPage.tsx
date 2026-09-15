"use client"

import {type ReactNode, useCallback, useMemo, useState} from "react"
import {useRouter, useSelectedLayoutSegment} from "next/navigation"
import "./Community.css"
import {ClientDashFooter} from "@/components/Client/ClientDashFooter"
import {DashHeroFrame} from "@/components/dashboard-ui/DashHeroFrame"
import {DashMainLayout} from "@/components/dashboard-ui/DashMainLayout"
import {DashTopHeader} from "@/components/dashboard-ui/DashTopHeader"
import {buildSpecialistCabinetNavItems} from "@/components/Community/specialist-route-tabs"
import {
    SPECIALIST_CABINET_LOGO_HREF,
    SPECIALIST_CABINET_SECTIONS,
    type SpecialistCabinetSection,
    specialistSectionHref,
} from "@/lib/cabinet-shell"
import AvatarUpload from "./AvatarUpload"
import {HintTour, HintTourLauncher} from "@/components/app/HintTour"
import {buildSpecialistHintSteps} from "@/components/app/hint-tour-steps"
import {SPECIALIST_AVATAR_INPUT_ID, SpecialistCabinetContext, type SpecialistCabinetData} from "./SpecialistCabinetContext"
import type {
    OnboardingStep,
    OrderWithRelations,
    PaymentWithRelations,
    SpecAct,
    SpecContract,
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
    /** Раздел кабинета — страница из /work/(cabinet)/<section>. */
    children: ReactNode
}

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
                                          children,
                                      }: CommunityProps) {
    const router = useRouter()
    // Раздел берём из адреса: layout не знает, какая страница под ним открыта.
    const segment = useSelectedLayoutSegment()
    const activeTab: SpecialistCabinetSection =
        SPECIALIST_CABINET_SECTIONS.find((section) => section === segment) ?? "orders"
    // Экскурсия переключает разделы сама — переходом, а не состоянием вкладки.
    // true — переход начат, HintTour подождёт, пока страница раздела отрисуется.
    const setActiveTab = useCallback((tab: string) => {
        const section = SPECIALIST_CABINET_SECTIONS.find((s) => s === tab)
        if (!section) return false
        // Текущий адрес читаем в момент вызова: колбэк стабилен, и экскурсия
        // не пересобирает шаги посреди показа.
        const href = specialistSectionHref(section)
        if (window.location.pathname === href) return false
        router.push(href, {scroll: false})
        return true
    }, [router])

    const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null)
    const [hintsOpen, setHintsOpen] = useState(false)
    const specialistHintSteps = useMemo(() => buildSpecialistHintSteps(setActiveTab), [setActiveTab])

    const initials = name[0]?.toUpperCase() ?? "?"

    const totalEarned = payments.filter(p => p.status === "RELEASED").reduce((sum, p) => sum + p.amount, 0)

    const needsAction = orders.reduce(
        (count, order) => count + order.stages.filter(s => s.status === "MOD_REVISION" || s.status === "CLIENT_REVISION").length,
        0,
    )

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

    const cabinetData: SpecialistCabinetData = {
        name, email, city, experience, software, about, status,
        orders, payments, contracts, acts, formData, onboardingSteps,
        featuredOnLanding, landingWorkPos, avatarUrl,
    }

    return (
        <SpecialistCabinetContext.Provider value={cabinetData}>
        <div className="dash">
            {/* Подсказки после онбординга: показываем один раз, дальше — по кнопке в шапке. */}
            <HintTour
                steps={specialistHintSteps}
                storageKey={`specialist:v3:${email}`}
                enabled={status === "ACTIVE"}
                open={hintsOpen || undefined}
                onClose={() => setHintsOpen(false)}
            />
            <HintTourLauncher onClick={() => setHintsOpen(true)}/>
            <DashTopHeader
                email={email}
                name={name}
                title="Кабинет специалиста"
                logoHref={SPECIALIST_CABINET_LOGO_HREF}
                navItems={buildSpecialistCabinetNavItems(activeTab, {orders: needsAction})}
            />
            <DashMainLayout>
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
                                              inputId={SPECIALIST_AVATAR_INPUT_ID} onUploaded={setAvatarUrl}/>
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

                {/* Раздел кабинета */}
                <div className={`dash-content${activeTab === "payments" ? " dash-content--payments" : ""}`}>
                    {children}
                </div>

                <ClientDashFooter/>
            </DashMainLayout>
        </div>
        </SpecialistCabinetContext.Provider>
    )
}
