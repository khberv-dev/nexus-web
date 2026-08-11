import type {StageStatus, StageType} from "@/app/orders/[id]/types"
import {STAGE_STATUS} from "@/app/orders/[id]/types"

export type StageStatusViewerRole = "CLIENT" | "SPECIALIST" | "ADMIN"

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

