import type {Contract, ContractStatus} from "@/app/admin/orders/types"

export interface ContractPanelProps {
    contract: Contract | null
    orderId: string
    canGenerate: boolean
    canSendToClient: boolean
    canConfirm: boolean
    onGenerate: () => void
    onSendToClient: () => void
    onConfirm: () => void
}

export interface FileUploadModalProps {
    open: boolean
    onClose: () => void
    onUpload: (file: File) => Promise<{ success: boolean; error?: string }>
    title: string
    description: string
    accept?: string
}

export interface ContractFileLinkProps {
    contractId: string
    s3Key: string | null
    label: string
}

export const CONTRACT_ACTIONS: Record<ContractStatus, { label: string; icon: string }> = {
    DRAFT: {label: "Не создан", icon: "bx bx-file-blank"},
    SENT_TO_SPECIALIST: {label: "Ожидает подписи дизайнера", icon: "bx bx-user-check"},
    SPECIALIST_SIGNED: {label: "Ожидает отправки заказчику", icon: "bx bx-paper-plane"},
    SENT_TO_CLIENT: {label: "Ожидает подписи заказчика", icon: "bx bx-user-check"},
    CLIENT_SIGNED: {label: "Ожидает подтверждения", icon: "bx bx-check-circle"},
    CONFIRMED: {label: "Договор активен", icon: "bx bx-check-double"},
    CANCELLED: {label: "Отменен", icon: "bx bx-x-circle"},
}
