"use client"

import {formatBriefWizardProgress} from "@/lib/clientBriefDisplay"

export function OrderAlerts({
                                needsAssign,
                                modStagesCount,
                                briefHelpRequested,
                                briefStep,
                            }: {
    needsAssign: boolean
    modStagesCount: number
    briefHelpRequested: boolean
    briefStep: number
}) {
    return (
        <>
            {needsAssign && (
                <div className="sp-alert sp-alert--warn">
                    <i className="bx bx-user-plus"/>
                    <span>Специалист не назначен</span>
                </div>
            )}
            {modStagesCount > 0 && (
                <div className="sp-alert sp-alert--info">
                    <i className="bx bx-time"/>
                    <span>{modStagesCount} этап(а) ожидают модерации</span>
                </div>
            )}
            {briefHelpRequested && (
                <div className="sp-alert sp-alert--warn">
                    <i className="bx bx-support"/>
                    <span>
            Заказчик запросил помощь с брифом. Текущий этап: {formatBriefWizardProgress(briefStep)}
          </span>
                </div>
            )}
        </>
    )
}

