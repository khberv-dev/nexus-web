"use client"

import {useState} from "react"
import {ClientContractPanel} from "@/components/Client/ClientContractPanel"
import {FrameworkContractSection} from "@/components/Client/client-cabinet/FrameworkContractSection"
import {isFrameworkContractEffectiveSigned} from "@/lib/framework-contract"
import type {Contract} from "@/app/orders/[id]/types"

type FrameworkContract = {
    status: string
    number: string | null
    hasFile: boolean
    hasSignedFile: boolean
}

export function ClientContractFlow({
                                       frameworkContract: initialFrameworkContract,
                                       projectContract,
                                       orderId,
                                       onUploadProjectContract,
                                       onFrameworkContractChange,
                                   }: {
    frameworkContract: FrameworkContract
    projectContract: Contract | null
    orderId: string
    onUploadProjectContract: (file: File) => Promise<{ success: boolean; error?: string }>
    onFrameworkContractChange?: (contract: FrameworkContract) => void
}) {
    const [frameworkContract, setFrameworkContract] = useState(initialFrameworkContract)
    const platformSigned = isFrameworkContractEffectiveSigned(frameworkContract.status)
    const projectSigned = projectContract?.status === "CLIENT_SIGNED" || projectContract?.status === "CONFIRMED"
    const updateFrameworkContract = (next: FrameworkContract) => {
        setFrameworkContract(next)
        onFrameworkContractChange?.(next)
    }

    if (platformSigned && projectSigned) return null

    return (
        <div id="order-contract" style={{marginTop: 16, marginBottom: 16, scrollMarginTop: 88}}>
            {!platformSigned ? (
                <FrameworkContractSection
                    initial={frameworkContract}
                    title="Договор с платформой NEXUS"
                    compact
                    onStatusChange={updateFrameworkContract}
                />
            ) : (
                <ClientContractPanel
                    contract={projectContract}
                    orderId={orderId}
                    userRole="CLIENT"
                    title="Договор с дизайнером"
                    onUploadSigned={onUploadProjectContract}
                />
            )}
        </div>
    )
}
