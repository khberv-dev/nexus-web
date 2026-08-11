import type {OnboardingStatus} from "@/components/app/SpecialistCard"
import ProfileForm from "@/app/(dashboard)/work/profile/ProfileForm"
import type {RawSpecialist, TestModalData} from "../../types"
import {SpecialistProfileOnboardingSection} from "./SpecialistProfileOnboardingSection"
import {AdminAccordion} from "@/components/admin/AdminAccordion"
import {AuditTimeline} from "@/components/admin/AuditTimeline"
import {PlatformMetaCard, QuestionnaireCard, RejectionHistoryCard, SystemInfoCard} from "./cards"
import {RequisiteChangesCard} from "./cards/RequisiteChangesCard"

type OnboardingStepRow = NonNullable<RawSpecialist["specialistProfile"]>["steps"][number]

export function SpecialistProfileTab({
                                         specialist,
                                         status,
                                         formData: fd,
                                         steps,
                                         passedSet,
                                         doneCount,
                                         testStepRecord,
                                         showTestAnswersBeforeAdvance,
                                         acting,
                                         quizResetting,
                                         quizApproving,
                                         handleQuizDraftReset,
                                         handleQuizLevelApprove,
                                         onRefresh,
                                         setTestModal,
                                     }: {
    specialist: RawSpecialist
    status: OnboardingStatus
    formData: Record<string, string> | null | undefined
    steps: OnboardingStepRow[]
    passedSet: Set<string>
    doneCount: number
    testStepRecord: OnboardingStepRow | undefined
    showTestAnswersBeforeAdvance: boolean
    acting: string | null
    quizResetting: boolean
    quizApproving: boolean
    handleQuizDraftReset: () => void
    handleQuizLevelApprove: () => void
    onRefresh?: () => Promise<void>
    setTestModal: (data: TestModalData | null) => void
}) {
    const sp = specialist
    const prof = sp.specialistProfile
    const fdWithPhone: Record<string, string> = {
        ...(fd ?? {}),
        phone: (typeof (fd as Record<string, string> | null | undefined)?.phone === "string" && (fd as Record<string, string>).phone.trim())
            ? (fd as Record<string, string>).phone.trim()
            : (sp.phone ?? ""),
    }

    return (
        <>
            <SpecialistProfileOnboardingSection
                formData={fdWithPhone}
                status={status}
                steps={steps}
                passedSet={passedSet}
                doneCount={doneCount}
                testStepRecord={testStepRecord}
                showTestAnswersBeforeAdvance={showTestAnswersBeforeAdvance}
                quizResetting={quizResetting}
                quizApproving={quizApproving}
                acting={acting}
                handleQuizDraftReset={handleQuizDraftReset}
                handleQuizLevelApprove={handleQuizLevelApprove}
                onRefresh={onRefresh}
                setTestModal={setTestModal}
            />

            <RequisiteChangesCard userId={sp.id}/>

            <div style={{display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start"}}>
                {/* Left: accordions */}
                <div style={{display: "flex", flexDirection: "column", gap: 0}}>
                    <AdminAccordion icon="bx-cog" title="Системная информация" defaultOpen>
                        <SystemInfoCard specialist={sp}/>
                    </AdminAccordion>
                    {prof && (
                        <AdminAccordion icon="bx-info-circle" title="Мета-данные профиля" defaultOpen>
                            <PlatformMetaCard profile={prof}/>
                        </AdminAccordion>
                    )}
                    <AdminAccordion icon="bx-clipboard" title="Анкета специалиста"
                                    badge={fd ? `${Object.values(fd).filter(Boolean).length} полей` : "не заполнена"}
                                    defaultOpen>
                        {fd ? <QuestionnaireCard formData={fdWithPhone}/> : (
                            <div className="sp-warn"><i className="bx bx-info-circle" style={{marginRight: 6}}/>Анкета
                                не заполнена</div>
                        )}
                    </AdminAccordion>
                    <AdminAccordion icon="bx-x-circle" title="История отклонений" defaultOpen>
                        <RejectionHistoryCard userId={sp.id}/>
                    </AdminAccordion>
                    <AdminAccordion icon="bx-edit" title="Редактирование анкеты" defaultOpen>
                        <div style={{
                            "--dash-accent": "var(--adm-active-color, #6366f1)",
                            "--dash-success": "#22c55e",
                            "--dash-success-bg": "rgba(34,197,94,0.1)",
                            "--dash-border": "var(--adm-sidebar-border, #e5e7eb)",
                            "--dash-surface2": "var(--adm-outer, #f3f4f6)",
                            "--dash-text": "var(--adm-text, #111827)",
                            "--dash-muted": "var(--adm-muted, #9ca3af)",
                            "--dash-danger": "#ef4444",
                            "--dash-danger-bg": "rgba(239,68,68,0.08)",
                        } as React.CSSProperties}>
                            <ProfileForm
                                initialData={fdWithPhone}
                                submitUrl={`/api/admin/specialists/${sp.id}/profile`}
                                submitMethod="PATCH"
                                submitLabel="Сохранить анкету"
                                onSuccess={async () => {
                                    await onRefresh?.()
                                }}
                            />
                        </div>
                    </AdminAccordion>
                </div>

                {/* Right: audit timeline */}
                <div style={{
                    position: "sticky",
                    top: 24,
                    border: "1px solid var(--adm-sidebar-border, rgba(0,0,0,0.08))",
                    borderRadius: 8,
                    background: "var(--adm-sidebar)",
                    padding: 14
                }}>
                    <div style={{display: "flex", alignItems: "center", gap: 6, marginBottom: 10}}>
                        <i className="bx bx-history" style={{color: "var(--adm-active-color)"}}/>
                        <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "var(--adm-muted)"
                        }}>История</span>
                    </div>
                    <div style={{
                        maxHeight: "70vh",
                        overflowY: "auto",
                        scrollbarWidth: "thin",
                        scrollbarColor: "rgba(255,255,255,0.15) transparent"
                    }}>
                        <AuditTimeline entity="User" entityId={sp.id}/>
                    </div>
                </div>
            </div>
        </>
    )
}
