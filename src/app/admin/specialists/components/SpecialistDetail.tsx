"use client"

import {useCallback, useState} from "react"
import type {OnboardingStatus} from "@/components/app/SpecialistCard"
import type {RawSpecialist, SpecialistDetailTab, SpecialistOrder, TestModalData} from "../types"
import {ONBOARDING_STEPS_UI} from "./specialist-detail/constants"
import {SpecialistDetailHeader} from "./specialist-detail/SpecialistDetailHeader"
import {SpecialistOrdersTab} from "./specialist-detail/SpecialistOrdersTab"
import {SpecialistPortfolioTab} from "./specialist-detail/SpecialistPortfolioTab"
import {SpecialistProfileTab} from "./specialist-detail/SpecialistProfileTab"
import {
    SpecialistContractTab,
    SpecialistFilesTab,
    SpecialistOnboardingStepsTab,
    SpecialistRatingLandingTab,
} from "./specialist-detail/SpecialistSectionTabPages"
import {Icon} from "@/components/ui/icon"

// Тип живёт рядом с текстами подтверждений (обычный .ts — его видят тесты),
// но реэкспортируется отсюда: на него уже ссылаются соседние компоненты.
import type {SpecialistOnboardingAdminAction} from "../onboarding-confirm"
import {userDisplayName} from "@/lib/user-name"
import {confirmDialog, promptDialog} from "@/lib/dialog-store"
import {toast} from "sonner"

export type {SpecialistOnboardingAdminAction}

export function SpecialistDetail({
                                     specialist,
                                     detailTab,
                                     setDetailTab,
                                     acting,
                                     ratingUpdating,
                                     ordersLoading,
                                     specOrders,
                                     onAct,
                                     onUpdateProfile,
                                     onToggleArchive,
                                     onRevokeSession,
                                     setTestModal,
                                     avatarUrl,
                                     onRefresh,
                                 }: {
    specialist: RawSpecialist | null
    detailTab: SpecialistDetailTab
    setDetailTab: (tab: SpecialistDetailTab) => void
    acting: string | null
    ratingUpdating: boolean
    ordersLoading: boolean
    specOrders: SpecialistOrder[]
    onAct: (userId: string, action: SpecialistOnboardingAdminAction) => void
    onUpdateProfile: (userId: string, patch: { rating?: number; featuredOnLanding?: boolean }) => void
    onToggleArchive: (userId: string, archived: boolean) => void
    onRevokeSession: (userId: string) => void
    setTestModal: (data: TestModalData | null) => void
    avatarUrl?: string | null
    onRefresh?: () => Promise<void>
}) {
    const [quizResetting, setQuizResetting] = useState(false)
    const [quizApproving, setQuizApproving] = useState(false)
    const [quizBypassing, setQuizBypassing] = useState(false)
    const [levelSetting, setLevelSetting] = useState(false)
    const specialistId = specialist?.id ?? null

    const handleQuizDraftReset = useCallback(async () => {
        if (!specialistId || !onRefresh) return
        if (!(await confirmDialog({
            title: "Удалить сохраненный прогресс теста?",
            description: "Специалист начнет квиз с первого вопроса.",
            variant: "destructive",
        }))) return
        setQuizResetting(true)
        try {
            const res = await fetch(`/api/admin/specialists/${specialistId}/quiz-reset`, {method: "POST"})
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(typeof data.error === "string" ? data.error : "Не удалось сбросить прогресс")
                return
            }
            await onRefresh()
        } finally {
            setQuizResetting(false)
        }
    }, [specialistId, onRefresh])

    const handleQuizLevelApprove = useCallback(async () => {
        if (!specialistId || !onRefresh) return
        if (!(await confirmDialog({title: "Подтвердить пройденный уровень теста и открыть следующий?"}))) return
        setQuizApproving(true)
        try {
            const res = await fetch(`/api/admin/specialists/${specialistId}/quiz-approve`, {method: "POST"})
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(typeof data.error === "string" ? data.error : "Не удалось подтвердить уровень")
                return
            }
            await onRefresh()
        } finally {
            setQuizApproving(false)
        }
    }, [specialistId, onRefresh])

    /** Закрывает шаг теста без сдачи — специалист сразу переходит к интервью. */
    const handleQuizBypass = useCallback(async () => {
        if (!specialistId || !onRefresh) return
        if (!(await confirmDialog({
            title: "Пропустить квалификационный тест?",
            description: "Шаг будет отмечен пройденным без сдачи, откроется этап интервью.",
            variant: "destructive",
        }))) return
        const reason = await promptDialog({
            title: "Причина пропуска теста",
            description: "Попадёт в историю и в уведомление специалисту.",
        })
        if (reason === null) return
        setQuizBypassing(true)
        try {
            const res = await fetch(`/api/admin/specialists/${specialistId}/quiz-bypass`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({reason}),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(typeof data.error === "string" ? data.error : "Не удалось пропустить тест")
                return
            }
            await onRefresh()
        } finally {
            setQuizBypassing(false)
        }
    }, [specialistId, onRefresh])

    /** Назначение квалификационного уровня без сдачи теста (уровни кумулятивные). */
    const handleSetLevel = useCallback(async (level: string) => {
        if (!specialistId || !onRefresh) return
        if (!(await confirmDialog({
            title: `Назначить уровень ${level} без сдачи теста?`,
            description: "Все уровни ниже будут отмечены пройденными, выше — сняты.",
            variant: "destructive",
        }))) return
        const reason = await promptDialog({
            title: "Причина",
            description: "Попадёт в историю и в письмо специалисту.",
        })
        if (reason === null) return
        setLevelSetting(true)
        try {
            const res = await fetch(`/api/admin/specialists/${specialistId}/level`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({level, reason}),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                toast.error(typeof data.error === "string" ? data.error : "Не удалось назначить уровень")
                return
            }
            await onRefresh()
        } finally {
            setLevelSetting(false)
        }
    }, [specialistId, onRefresh])

    if (!specialist) {
        return (
            <div className="sp-detail-empty">
                <Icon name="user-circle"/>
                <p>Выберите специалиста</p>
            </div>
        )
    }

    const sp = specialist
    const status = (sp.specialistProfile?.onboardingStatus ?? "PENDING") as OnboardingStatus
    const fd = sp.specialistProfile?.formData
    const displayName = userDisplayName(sp, "?")
    const canAdvance = !sp.archivedAt && status !== "ACTIVE" && status !== "REJECTED"
    const canReject = !sp.archivedAt && status !== "ACTIVE" && status !== "REJECTED"
    const steps = sp.specialistProfile?.steps ?? []
    const passedSet = new Set(steps.filter((s) => s.status === "PASSED").map((s) => s.type))

    const doneCount = ONBOARDING_STEPS_UI.filter((step) =>
        step.key === "FORM"
            ? (fd && Object.values(fd).some(Boolean)) || status !== "PENDING"
            : passedSet.has(step.key) || status === "ACTIVE",
    ).length

    const testStepRecord = steps.find((s) => s.type === "TEST")
    const regulationsStep = steps.find((s) => s.type === "REGULATIONS")
    const showTestAnswersBeforeAdvance =
        status === "TEST_INVITED" &&
        !!testStepRecord?.comment &&
        (testStepRecord.status === "PASSED" ||
            testStepRecord.status === "FAILED" ||
            testStepRecord.status === "IN_PROGRESS")

    return (
        <>
            <SpecialistDetailHeader
                specialist={sp}
                avatarUrl={avatarUrl}
                displayName={displayName}
                status={status}
                formData={fd}
                canAdvance={canAdvance}
                canReject={canReject}
                acting={acting}
                onAct={onAct}
                onToggleArchive={onToggleArchive}
                onRevokeSession={onRevokeSession}
                doneCount={doneCount}
                detailTab={detailTab}
                setDetailTab={setDetailTab}
                regulationsStepStatus={regulationsStep?.status ?? null}
            />

            <div className="sp-detail-body">
                {detailTab === "main" && (
                    <SpecialistProfileTab
                        specialist={sp}
                        status={status}
                        formData={fd}
                        steps={steps}
                        passedSet={passedSet}
                        doneCount={doneCount}
                        testStepRecord={testStepRecord}
                        showTestAnswersBeforeAdvance={showTestAnswersBeforeAdvance}
                        acting={acting}
                        quizResetting={quizResetting}
                        quizApproving={quizApproving}
                        quizBypassing={quizBypassing}
                        levelSetting={levelSetting}
                        handleQuizDraftReset={handleQuizDraftReset}
                        handleQuizLevelApprove={handleQuizLevelApprove}
                        handleQuizBypass={handleQuizBypass}
                        handleSetLevel={handleSetLevel}
                        onRefresh={onRefresh}
                        setTestModal={setTestModal}
                    />
                )}

                {detailTab === "contract" && <SpecialistContractTab specialist={sp} onRefresh={onRefresh}/>}

                {detailTab === "onboarding" && <SpecialistOnboardingStepsTab steps={steps} formData={fd}/>}

                {detailTab === "rating" && (
                    <SpecialistRatingLandingTab
                        specialistId={sp.id}
                        profile={sp.specialistProfile}
                        onboardingStatus={status}
                        ratingUpdating={ratingUpdating}
                        onUpdateProfile={onUpdateProfile}
                    />
                )}

                {detailTab === "files" && <SpecialistFilesTab files={sp.files}/>}

                {detailTab === "portfolio" && <SpecialistPortfolioTab specialistId={sp.id}/>}

                {detailTab === "orders" && (
                    <SpecialistOrdersTab ordersLoading={ordersLoading} specOrders={specOrders}/>
                )}
            </div>
        </>
    )
}
