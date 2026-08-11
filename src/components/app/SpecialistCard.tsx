"use client"

import type {StatusVariant} from "./AppCard"
import {InfoRow, SectionLabel, StatusBadge} from "./AppCard"
import {splitPortfolioLinks} from "@/components/ui/PortfolioLinksField"

// ── Типы ──────────────────────────────────────────────────────────────────────

export type OnboardingStatus =
    | "PENDING" | "TEST_INVITED" | "INTERVIEW_INVITED"
    | "REGULATIONS" | "CONTRACT" | "ACTIVE" | "REJECTED"

export interface SpecialistFormData {
    fullName?: string
    city?: string
    experience?: string
    portfolio?: string
    software?: string
    aiServices?: string
    about?: string
}

export interface SpecialistCardData {
    id: string
    email: string
    name: string | null
    createdAt?: string
    onboardingStatus: OnboardingStatus
    formData: SpecialistFormData | null
    steps: { type: string; status: string; comment: string | null }[]
    portfolioCount?: number
}

// ── Константы ─────────────────────────────────────────────────────────────────

export const ONBOARDING_STATUS_LABEL: Record<OnboardingStatus, string> = {
    PENDING: "Анкета", TEST_INVITED: "Квалификационный тест", INTERVIEW_INVITED: "Интервью",
    REGULATIONS: "Регламенты", CONTRACT: "Договор", ACTIVE: "Активен", REJECTED: "Отклонен",
}

export const ONBOARDING_STATUS_VARIANT: Record<OnboardingStatus, StatusVariant> = {
    PENDING: "pending", TEST_INVITED: "current", INTERVIEW_INVITED: "current",
    REGULATIONS: "current", CONTRACT: "current", ACTIVE: "done", REJECTED: "rejected",
}

const STEPS = [
    {label: "Анкета", stepKey: "FORM"},
    {label: "Квалификационный тест", stepKey: "TEST"},
    {label: "Интервью", stepKey: "INTERVIEW"},
    {label: "Регламенты", stepKey: "REGULATIONS"},
    {label: "Договор", stepKey: "CONTRACT"},
]

// ── Прогресс шагов ────────────────────────────────────────────────────────────

function StepProgress({
                          status,
                          steps,
                          hasForm,
                      }: {
    status: OnboardingStatus
    steps: { type: string; status: string }[]
    hasForm: boolean
}) {
    const isRejected = status === "REJECTED"
    const passedSet = new Set(steps.filter(s => s.status === "PASSED").map(s => s.type))

    // Анкета пройдена если form заполнена или статус уже дальше PENDING
    const isDone = (stepKey: string, i: number): boolean => {
        if (isRejected) return false
        if (stepKey === "FORM") return hasForm || status !== "PENDING"
        return passedSet.has(stepKey) || status === "ACTIVE"
    }

    // «Текущий» шаг — первый незавершенный (не для ACTIVE и не для REJECTED)
    const firstIncomplete = STEPS.findIndex(({stepKey}, i) => !isDone(stepKey, i))
    const isActive = status === "ACTIVE"

    return (
        <div className="d-flex align-items-center gap-0 w-100" style={{marginTop: "0.75rem"}}>
            {STEPS.map((step, i) => {
                const done = isDone(step.stepKey, i)
                const current = !isRejected && !isActive && i === firstIncomplete
                const active = done || current

                const dotColor = isRejected ? "#d9534f"
                    : done ? "#28a745"
                        : current ? "#fd7e14"
                            : "#c9cdd4"

                const lineColor = (done && i < STEPS.length - 1)
                    ? "#28a745" : "#e0e2e5"

                return (
                    <div key={i} className="d-flex align-items-center"
                         style={{flex: i < STEPS.length - 1 ? "1" : "none"}}>
                        {/* Dot + label */}
                        <div className="d-flex flex-column align-items-center" style={{gap: 3}}>
                            <div style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: active && !isRejected ? dotColor : "transparent",
                                border: `2px solid ${dotColor}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.7rem", fontWeight: 700,
                                color: active && !isRejected ? "#fff" : dotColor,
                                flexShrink: 0,
                                transition: "all 0.2s",
                            }}>
                                {done ? <i className="bx bx-check" style={{fontSize: "0.85rem"}}/> : i + 1}
                            </div>
                            <span style={{
                                fontSize: "0.62rem", whiteSpace: "nowrap",
                                color: active ? (isRejected ? "#d9534f" : current ? "#fd7e14" : "#28a745") : "#adb5bd",
                                fontWeight: active ? 600 : 400,
                            }}>
                {step.label}
              </span>
                        </div>

                        {/* Connecting line */}
                        {i < STEPS.length - 1 && (
                            <div style={{
                                flex: 1, height: 2, background: lineColor,
                                marginBottom: 16, marginLeft: 2, marginRight: 2,
                                transition: "background 0.2s",
                            }}/>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ── Основная карточка ──────────────────────────────────────────────────────────

interface SpecialistCardProps {
    specialist: SpecialistCardData
    expanded: boolean
    onToggle: () => void
    /** Кнопки действий (advance/reject) — передаются снаружи */
    actions?: React.ReactNode
}

export function SpecialistCard({specialist, expanded, onToggle, actions}: SpecialistCardProps) {
    const {email, name, onboardingStatus, formData: fd, steps, portfolioCount = 0} = specialist
    const hasForm = fd && Object.values(fd).some(Boolean)
    const displayName = fd?.fullName ?? name ?? email

    return (
        <div>
            {/* ── Строка (кликабельная) ── */}
            <div
                className="px-4 py-3 d-flex align-items-center gap-3"
                style={{cursor: "pointer"}}
                onClick={onToggle}
            >
                {/* Аватар */}
                <div className="avatar avatar-md flex-shrink-0">
          <span className="avatar-initial rounded-circle bg-label-primary fw-semibold">
            {displayName[0].toUpperCase()}
          </span>
                </div>

                {/* Основная инфо */}
                <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <span className="fw-semibold">{displayName}</span>
                        <StatusBadge
                            variant={ONBOARDING_STATUS_VARIANT[onboardingStatus]}
                            label={ONBOARDING_STATUS_LABEL[onboardingStatus]}
                        />
                        {portfolioCount > 0 && (
                            <span className="badge bg-label-info rounded-pill" style={{fontSize: "0.62rem"}}>
                <i className="bx bx-images me-1"/>{portfolioCount} фото
              </span>
                        )}
                        {!hasForm && onboardingStatus === "PENDING" && (
                            <span className="badge bg-label-warning rounded-pill" style={{fontSize: "0.62rem"}}>анкета не заполнена</span>
                        )}
                    </div>
                    <small className="text-muted">
                        {email}
                        {fd?.city ? ` · ${fd.city}` : ""}
                        {fd?.experience ? ` · ${fd.experience} лет опыта` : ""}
                    </small>
                </div>

                <i className={`bx ${expanded ? "bx-chevron-up" : "bx-chevron-down"} text-muted fs-5 flex-shrink-0`}/>
            </div>

            {/* ── Раскрытое содержимое ── */}
            {expanded && (
                <div className="border-top" style={{background: "#f8f8f8"}}>
                    <div className="px-4 pt-3 pb-4">

                        {/* Прогресс шагов */}
                        <div className="card mb-4">
                            <div className="card-body pb-2">
                                <SectionLabel>Прогресс онбординга</SectionLabel>
                                <StepProgress status={onboardingStatus} steps={steps} hasForm={!!hasForm}/>
                            </div>
                        </div>

                        {/* Данные анкеты */}
                        {hasForm ? (
                            <div className="card mb-4">
                                <div className="card-body">
                                    <SectionLabel>Анкета специалиста</SectionLabel>
                                    <div className="row g-3">
                                        {fd?.fullName && (
                                            <div className="col-sm-6">
                                                <InfoRow icon="bx-user" label="ФИО" value={fd.fullName}/>
                                            </div>
                                        )}
                                        {fd?.city && (
                                            <div className="col-sm-6">
                                                <InfoRow icon="bx-map" label="Город" value={fd.city}/>
                                            </div>
                                        )}
                                        {fd?.experience && (
                                            <div className="col-sm-6">
                                                <InfoRow icon="bx-time-five" label="Опыт работы"
                                                         value={`${fd.experience} лет`}/>
                                            </div>
                                        )}
                                        {fd?.portfolio && (
                                            <div className="col-sm-6">
                                                <div className="d-flex align-items-start gap-2 mb-2">
                                                    <i className="bx bx-link-external text-muted mt-1"/>
                                                    <div>
                                                        <div className="text-uppercase text-muted"
                                                             style={{fontSize: "0.7rem", letterSpacing: "0.05em"}}>Портфолио</div>
                                                        {splitPortfolioLinks(fd.portfolio).map((link) => (
                                                            <a key={link} href={link} target="_blank" rel="noopener noreferrer"
                                                               className="text-primary d-block"
                                                               style={{fontSize: "0.875rem"}}>{link}</a>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {fd?.software && (
                                            <div className="col-12">
                                                <div className="text-uppercase text-muted fw-semibold mb-2"
                                                     style={{fontSize: "0.68rem", letterSpacing: "0.07em"}}>
                                                    Программы
                                                </div>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {fd.software.split(",").map(s => s.trim()).filter(Boolean).map(sw => (
                                                        <span key={sw}
                                                              className="badge bg-label-primary rounded-pill">{sw}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {fd?.aiServices && (
                                            <div className="col-12">
                                                <div className="text-uppercase text-muted fw-semibold mb-2"
                                                     style={{fontSize: "0.68rem", letterSpacing: "0.07em"}}>
                                                    Нейросети
                                                </div>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {fd.aiServices.split(",").map(s => s.trim()).filter(Boolean).map(ai => (
                                                        <span key={ai}
                                                              className="badge bg-label-primary rounded-pill">{ai}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {fd?.about && (
                                            <div className="col-12">
                                                <div className="text-uppercase text-muted fw-semibold mb-1"
                                                     style={{fontSize: "0.68rem", letterSpacing: "0.07em"}}>О себе
                                                </div>
                                                <p className="mb-0" style={{
                                                    fontSize: "0.875rem",
                                                    whiteSpace: "pre-wrap",
                                                    color: "#555"
                                                }}>{fd.about}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="alert alert-warning d-flex align-items-center gap-2 mb-4"
                                 style={{fontSize: "0.875rem"}}>
                                <i className="bx bx-info-circle fs-5"/>
                                Специалист еще не заполнил анкету
                            </div>
                        )}


                        {/* Действия */}
                        {actions && (
                            <div className="d-flex gap-2 flex-wrap">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
