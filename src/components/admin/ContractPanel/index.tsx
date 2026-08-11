"use client"

import {useState} from "react"
import {StatusBadge} from "@/components/app/AppCard"
import {CONTRACT_STATUS_LABEL, CONTRACT_STATUS_VARIANT} from "@/app/admin/orders/types"
import type {ContractFileLinkProps, ContractPanelProps} from "./types"
import {CONTRACT_ACTIONS} from "./types"
import {formatDate} from "./utils"
import {ContractFileLink} from "./ContractFileLink"

export function ContractPanel({
                                  contract,
                                  orderId,
                                  canGenerate,
                                  canSendToClient,
                                  canConfirm,
                                  onGenerate,
                                  onSendToClient,
                                  onConfirm,
                              }: ContractPanelProps) {
    const [generating, setGenerating] = useState(false)

    const handleGenerate = async () => {
        setGenerating(true)
        try {
            await onGenerate()
        } finally {
            setGenerating(false)
        }
    }

    const handleSendToClient = async () => {
        if (confirm("Отправить договор заказчику для подписания?")) {
            await onSendToClient()
        }
    }

    const handleConfirm = async () => {
        if (confirm("Подтвердить договор и активировать заказ?")) {
            await onConfirm()
        }
    }

    if (!contract) {
        return (
            <div className="sp-card" style={{marginTop: 12}}>
                <div className="sp-card-hd">
                    <span className="sp-label">Договор</span>
                </div>
                <div className="sp-card-bd">
                    <p style={{color: "var(--adm-muted)", margin: 0, fontSize: "0.85rem"}}>
                        Договор не создан
                    </p>
                    {canGenerate && (
                        <div style={{marginTop: 12}}>
                            <button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="sp-btn sp-btn-primary"
                            >
                                {generating ? "…" : "Создать и отправить договор дизайнеру"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const {label, icon} = CONTRACT_ACTIONS[contract.status]

    return (
        <div className="sp-card" style={{marginTop: 12}}>
            <div className="sp-card-hd">
                <span className="sp-label">Договор</span>
                <StatusBadge
                    variant={CONTRACT_STATUS_VARIANT[contract.status]}
                    label={CONTRACT_STATUS_LABEL[contract.status]}
                />
            </div>
            <div className="sp-card-bd">
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 12,
                        fontSize: "0.85rem",
                    }}
                >
                    <i className={`bx ${icon}`}/>
                    <span style={{color: "var(--adm-muted)"}}>{label}</span>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 12,
                        fontSize: "0.75rem",
                    }}
                >
                    <div>
                        <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Номер</div>
                        <div style={{fontWeight: 500}}>{contract.number}</div>
                    </div>
                    <div>
                        <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Создан</div>
                        <div>{formatDate(contract.createdAt)}</div>
                    </div>
                    {contract.sentToSpecialistAt && (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Отправлен дизайнеру</div>
                            <div>{formatDate(contract.sentToSpecialistAt)}</div>
                        </div>
                    )}
                    {contract.specialistSignedAt && (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Подписан дизайнером</div>
                            <div>{formatDate(contract.specialistSignedAt)}</div>
                        </div>
                    )}
                    {contract.sentToClientAt && (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Отправлен заказчику</div>
                            <div>{formatDate(contract.sentToClientAt)}</div>
                        </div>
                    )}
                    {contract.clientSignedAt && (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Подписан заказчиком</div>
                            <div>{formatDate(contract.clientSignedAt)}</div>
                        </div>
                    )}
                    {contract.confirmedAt && (
                        <div>
                            <div style={{color: "var(--adm-muted)", marginBottom: 2}}>Подтвержден</div>
                            <div>{formatDate(contract.confirmedAt)}</div>
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 12,
                        fontSize: "0.8rem",
                    }}
                >
                    {contract.s3Key && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--adm-muted)",
                            }}
                        >
                            <ContractFileLink contractId={contract.id} s3Key={contract.s3Key} label="Оригинал"/>
                        </div>
                    )}
                    {contract.specialistSignedS3Key && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--adm-muted)",
                            }}
                        >
                            <ContractFileLink contractId={contract.id} s3Key={contract.specialistSignedS3Key}
                                              label="Подпись дизайнера"/>
                        </div>
                    )}
                    {contract.clientSignedS3Key && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                color: "var(--adm-muted)",
                            }}
                        >
                            <ContractFileLink
                                contractId={contract.id}
                                s3Key={contract.clientSignedS3Key}
                                label="Подпись заказчика"
                            />
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                    }}
                >
                    {contract.status === "SPECIALIST_SIGNED" && canSendToClient && (
                        <button
                            onClick={handleSendToClient}
                            className="sp-btn sp-btn-primary sp-btn-sm"
                        >
                            Отправить заказчику
                        </button>
                    )}
                    {contract.status === "CLIENT_SIGNED" && canConfirm && (
                        <button
                            onClick={handleConfirm}
                            className="sp-btn sp-btn-success sp-btn-sm"
                        >
                            Подтвердить и активировать
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export {formatDate} from "./utils"
export type {ContractPanelProps, FileUploadModalProps, ContractFileLinkProps} from "./types"
