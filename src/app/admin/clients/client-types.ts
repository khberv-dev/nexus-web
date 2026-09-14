import type {StatusVariant} from "@/components/app/AppCard"

export interface ClientOrder {
    id: string;
    status: string;
    title: string | null;
    briefData: Record<string, string> | null;
    briefStep: number;
    briefHelpRequested: boolean;
    createdAt: string
}

export interface RawClient {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    createdAt: string
    archivedAt: string | null
    clientProfile: {
        formData: Record<string, string> | null
        frameworkContractS3Key?: string | null
        frameworkContractStatus?: string
        frameworkContractNumber?: string | null
        signedContractS3Key?: string | null
    } | null
    clientRequisiteChangeRequests?: Array<{
        id: string
        status: string
        createdAt: string
        oldData: Record<string, unknown>
        newData: Record<string, unknown>
    }>
    orders: ClientOrder[]
}

export const ORDER_LABEL: Record<string, string> = {
    DRAFT: "Черновик", BRIEFING: "Бриф", BRIEF_REVIEW: "Проверка",
    ACTIVE: "Активен", DONE: "Завершен", CANCELLED: "Отменен",
}
export const ORDER_VARIANT: Record<string, StatusVariant> = {
    DRAFT: "pending", BRIEFING: "pending", BRIEF_REVIEW: "current",
    ACTIVE: "active", DONE: "done", CANCELLED: "rejected",
}

export const FW_CONTRACT_STATUS_LABEL: Record<string, string> = {
    NONE: "Не размещен",
    AWAITING_SIGNATURE: "Ожидает подписи",
    SIGNED_BY_CLIENT: "Подписан заказчиком",
    SIGNED_BY_ADMIN: "Подписан (зафиксирован админом)",
    DECLINED_BY_CLIENT: "Отклонен заказчиком",
}
