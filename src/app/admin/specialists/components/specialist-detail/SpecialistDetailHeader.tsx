import {StatusBadge} from "@/components/app/AppCard"
import {
    ONBOARDING_STATUS_LABEL,
    ONBOARDING_STATUS_VARIANT,
    type OnboardingStatus,
} from "@/components/app/SpecialistCard"
import {formatEdoProvidersLabel} from "@/lib/edo-providers"
import {ADVANCE_LABEL, ONBOARDING_STEPS_UI} from "./constants"
import type {RawSpecialist, SpecialistDetailTab} from "../../types"
import {ImageLightbox} from "@/components/ui/ImageLightbox"
import type {SpecialistOnboardingAdminAction} from "../SpecialistDetail"

export function SpecialistDetailHeader({
                                           specialist,
                                           avatarUrl,
                                           displayName,
                                           status,
                                           formData: fd,
                                           canAdvance,
                                           canReject,
                                           acting,
                                           onAct,
                                           onToggleArchive,
                                           onRevokeSession,
                                           doneCount,
                                           detailTab,
                                           setDetailTab,
                                           regulationsStepStatus,
                                       }: {
    specialist: RawSpecialist
    avatarUrl?: string | null
    displayName: string
    status: OnboardingStatus
    formData: Record<string, string> | null | undefined
    canAdvance: boolean
    canReject: boolean
    acting: string | null
    onAct: (userId: string, action: SpecialistOnboardingAdminAction) => void
    onToggleArchive: (userId: string, archived: boolean) => void
    onRevokeSession: (userId: string) => void
    doneCount: number
    detailTab: SpecialistDetailTab
    setDetailTab: (tab: SpecialistDetailTab) => void
    regulationsStepStatus: string | null
}) {
    const sp = specialist
    const isArchived = !!sp.archivedAt
    const edoLabel = formatEdoProvidersLabel(typeof fd?.edoProviders === "string" ? fd.edoProviders : undefined)
    const isRevoking = acting === sp.id + "revoke-session"

    return (
        <div className="sp-detail-sticky">
            <div className="sp-profile-header">
                <div className="sp-av-xl">
                    {avatarUrl
                        ? <ImageLightbox src={avatarUrl} alt="Аватар"><img src={avatarUrl} alt="" style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover"
                        }}/></ImageLightbox>
                        : displayName[0].toUpperCase()}
                </div>
                <div className="sp-profile-info">
                    <h4 className="sp-profile-name">{displayName}</h4>
                    <div className="sp-profile-meta">
                        <StatusBadge variant={ONBOARDING_STATUS_VARIANT[status]}
                                     label={ONBOARDING_STATUS_LABEL[status]}/>
                        {isArchived && <span className="sp-badge">В архиве</span>}
                        <span className="sp-profile-email">{sp.email}</span>
                        {sp.phone && <span className="sp-profile-email">{sp.phone}</span>}
                        {sp.files.length > 0 && (
                            <span className="sp-badge"><i className="bx bx-paperclip"
                                                          style={{marginRight: 3}}/>{sp.files.length} файл(ов)</span>
                        )}
                    </div>
                    {fd?.city && (
                        <div className="sp-profile-location">
                            <i className="bx bx-map"/> {fd.city}
                            {fd.experience ? ` · ${fd.experience} лет опыта` : ""}
                            {fd.software ? ` · ${fd.software}` : ""}
                        </div>
                    )}
                    <div className="sp-profile-edo" title={edoLabel || "не указано"}>
                        <i className="bx bx-transfer-alt"/> ЭДО: {edoLabel || "не указано"}
                    </div>
                </div>
                <div className="sp-profile-right">
                    <div className="sp-profile-actions">
                        {canAdvance && (
                            <>
                                <button onClick={() => onAct(sp.id, "advance")} disabled={acting !== null}
                                        className="sp-btn sp-btn-primary">
                                    {acting === sp.id + "advance" ? "..." : ADVANCE_LABEL[status]}
                                </button>
                                {status === "REGULATIONS" && regulationsStepStatus !== "PASSED" && (
                                    <span style={{
                                        fontSize: "0.75rem",
                                        color: "rgba(255,200,100,0.85)",
                                        alignSelf: "center"
                                    }}>
                    {regulationsStepStatus === "IN_PROGRESS"
                        ? "⚠ Специалист проходит тест"
                        : "⚠ Специалист ещё не прошёл тест регламентов"}
                  </span>
                                )}
                            </>
                        )}
                        {canReject && status === "PENDING" && (
                            <>
                                <button
                                    onClick={() => onAct(sp.id, "reject_no_education")}
                                    disabled={acting !== null}
                                    className="sp-btn sp-btn-danger"
                                    title="Отклонить анкету по причине отсутствия профильного образования"
                                >
                                    {acting === sp.id + "reject_no_education" ? "..." : "Отклонить — нет образования"}
                                </button>
                                <button
                                    onClick={() => onAct(sp.id, "reject_no_experience")}
                                    disabled={acting !== null}
                                    className="sp-btn sp-btn-danger"
                                    title="Отклонить анкету по причине недостаточного опыта"
                                >
                                    {acting === sp.id + "reject_no_experience" ? "..." : "Отклонить — нет опыта"}
                                </button>
                            </>
                        )}
                        {canReject && status !== "PENDING" && (
                            <button onClick={() => onAct(sp.id, "reject")} disabled={acting !== null}
                                    className="sp-btn sp-btn-danger">
                                {acting === sp.id + "reject" ? "..." : "Отклонить"}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (!confirm(isArchived ? "Восстановить специалиста из архива?" : "Перенести специалиста в архив?")) return
                                onToggleArchive(sp.id, !isArchived)
                            }}
                            disabled={acting !== null}
                            className="sp-btn"
                        >
                            {isArchived ? "Восстановить" : "В архив"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!confirm("Отозвать все сессии этого специалиста? Он будет перенаправлен на вход.")) return
                                onRevokeSession(sp.id)
                            }}
                            disabled={acting !== null}
                            className="sp-btn sp-btn-ghost"
                            title="Принудительно разлогинить специалиста"
                        >
                            <i className="bx bx-log-out" style={{marginRight: 4}}/>Отозвать сессии
                        </button>
                    </div>
                    <div className="sp-profile-stat">
                        <div className="sp-profile-stat__label">Онбординг:</div>
                        <div className="sp-profile-stat__value">{doneCount}/{ONBOARDING_STEPS_UI.length}</div>
                    </div>
                </div>
            </div>
            <div className="sp-detail-tabs">
                <button type="button" className={`sp-detail-tab${detailTab === "main" ? " sp-detail-tab--active" : ""}`}
                        onClick={() => setDetailTab("main")}>
                    Основной
                </button>
                <button
                    type="button"
                    className={`sp-detail-tab${detailTab === "contract" ? " sp-detail-tab--active" : ""}`}
                    onClick={() => setDetailTab("contract")}
                    title="Договор с платформой"
                >
                    Договор
                </button>
                <button
                    type="button"
                    className={`sp-detail-tab${detailTab === "onboarding" ? " sp-detail-tab--active" : ""}`}
                    onClick={() => setDetailTab("onboarding")}
                    title="Шаги онбординга"
                >
                    Онбординг
                </button>
                <button
                    type="button"
                    className={`sp-detail-tab${detailTab === "rating" ? " sp-detail-tab--active" : ""}`}
                    onClick={() => setDetailTab("rating")}
                    title="Оценка и лендинг"
                >
                    Оценка
                </button>
                <button type="button"
                        className={`sp-detail-tab${detailTab === "files" ? " sp-detail-tab--active" : ""}`}
                        onClick={() => setDetailTab("files")}>
                    Файлы
                </button>
                <button type="button"
                        className={`sp-detail-tab${detailTab === "portfolio" ? " sp-detail-tab--active" : ""}`}
                        onClick={() => setDetailTab("portfolio")}>
                    Портфолио
                </button>
                <button type="button"
                        className={`sp-detail-tab${detailTab === "orders" ? " sp-detail-tab--active" : ""}`}
                        onClick={() => setDetailTab("orders")}>
                    Заказы
                </button>
            </div>
        </div>
    )
}
