import type {StageStatus, StageType} from "@/app/orders/[id]/types"
import {STAGE_STATUS} from "@/app/orders/[id]/types"

export type StageStatusViewerRole = "CLIENT" | "SPECIALIST" | "ADMIN"

export function stageStartOwnerHint(status: StageStatus, previousStatus?: StageStatus): string | null {
    if (status === "AWAITING_PAYMENT") return "Начало этапа: заказчик должен внести оплату."
    if (status === "PENDING") return "Начало этапа: специалист должен загрузить первые материалы."
    if (status !== "BLOCKED") return null

    switch (previousStatus) {
        case "AWAITING_PAYMENT":
        case "CLIENT_REVIEW":
        case "EXTRA_PAYMENT":
            return "Этап откроется после действия заказчика на предыдущем этапе."
        case "UPLOADED":
        case "MOD_REVIEW":
            return "Этап откроется после действия администратора на предыдущем этапе."
        case "PENDING":
        case "MOD_REVISION":
        case "CLIENT_REVISION":
            return "Этап откроется после действия специалиста на предыдущем этапе."
        default:
            return "Этап откроется после завершения предыдущего этапа."
    }
}

export function stageStatusLabelForViewer(args: {
    viewerRole: StageStatusViewerRole
    stageType: StageType
    status: StageStatus
}): string {
    const {viewerRole, stageType, status} = args
    if (stageType === "CONCEPT" && status === "PENDING") return "Ожидает старта"

    if (viewerRole === "SPECIALIST") {
        switch (status) {
            case "MOD_REVIEW":
                return "Ожидает подтверждения администратором"
            case "CLIENT_REVIEW":
                return "Отправлено заказчику — ожидает решения"
            case "MOD_REVISION":
                return "Доработка по правкам администратора"
            case "CLIENT_REVISION":
                return "Доработка по правкам заказчика"
            default:
                return STAGE_STATUS[status]?.label ?? status
        }
    }

    if (viewerRole === "CLIENT") {
        switch (status) {
            case "MOD_REVIEW":
            case "MOD_REVISION":
                return "На согласовании у администратора"
            case "UPLOADED":
                return "Материалы готовятся дизайнером"
            case "CLIENT_REVISION":
                return "Доработка у дизайнера"
            default:
                return STAGE_STATUS[status]?.label ?? status
        }
    }

    // ADMIN: используем нейтральные подписи (обычно уже есть свои UI)
    return STAGE_STATUS[status]?.label ?? status
}
