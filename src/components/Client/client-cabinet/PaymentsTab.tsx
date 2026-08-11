"use client"

import {StatusBadge} from "@/components/app/AppCard"
import {DashActionLink} from "@/components/dashboard-ui/DashActionLink"
import {DashDataTable} from "@/components/dashboard-ui/DashDataTable"
import {DashStatsRow} from "@/components/dashboard-ui/DashStatsRow"
import {validateClientRequisitesForm} from "@/lib/client-requisites-validation"
import {ACT_STAGE_LABEL, CON_BADGE, INV_BADGE, PAYMENT_BADGE} from "./constants"
import type {ClientAct, ClientContract, ClientInvoice, ClientPayment} from "./types"
import {DocSection} from "./DocSection"
import {FrameworkContractSection} from "./FrameworkContractSection"

export function PaymentsTab({
                                payments,
                                formData,
                                invoices,
                                contracts,
                                acts,
                                frameworkContract,
                                onSwitchToSettings,
                            }: {
    payments: ClientPayment[]
    formData: Record<string, string>
    invoices: ClientInvoice[]
    contracts: ClientContract[]
    acts: ClientAct[]
    frameworkContract: { status: string; number: string | null; hasFile: boolean }
    onSwitchToSettings: () => void
}) {
    const totalPaid = payments.filter(p => p.status === "RELEASED").reduce((s, p) => s + p.amount, 0)
    const totalHeld = payments.filter(p => p.status === "HELD").reduce((s, p) => s + p.amount, 0)
    const totalPending = payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0)

    const stats = [
        {
            label: "Оплачено",
            value: totalPaid,
            icon: "bx-check-circle",
            color: "var(--dash-success)",
            bg: "var(--dash-success-bg)"
        },
        {
            label: "Удержано",
            value: totalHeld,
            icon: "bx-time-five",
            color: "var(--dash-warn)",
            bg: "var(--dash-warn-bg)"
        },
        {
            label: "К оплате",
            value: totalPending,
            icon: "bx-credit-card",
            color: "var(--dash-danger)",
            bg: "var(--dash-danger-bg)"
        },
    ].filter(s => s.value > 0)

    const fd = formData
    const legalForm = fd.legalForm ?? ""
    const isIP = legalForm === "ИП"
    const reqRows = [
        {label: "Организация", value: legalForm ? `${legalForm} «${fd.company ?? ""}»` : fd.company},
        {label: "ИНН", value: fd.inn},
        !isIP && {label: "КПП", value: fd.kpp},
        {label: isIP ? "ОГРНИП" : "ОГРН", value: fd.ogrn},
        {label: isIP ? "Адрес регистрации" : "Юр. адрес", value: fd.legalAddress},
        {label: "Р/с", value: fd.bankAccount},
        {label: "Банк", value: fd.bankName},
        {label: "БИК", value: fd.bankBik},
        {label: "Корр. счет", value: fd.corrAccount},
    ].filter(Boolean) as { label: string; value?: string }[]
    const requisitesError = validateClientRequisitesForm(fd as Record<string, unknown>)
    const isComplete = requisitesError === null

    return (
        <div>
            {stats.length > 0 && (
                <div style={{marginBottom: 16}}>
                    <DashStatsRow
                        items={stats.map(s => ({
                            ...s,
                            value: `${(s.value / 100).toLocaleString("ru-RU")} руб.`,
                        }))}
                    />
                </div>
            )}

            {(frameworkContract.status !== "NONE" || frameworkContract.hasFile) && (
                <FrameworkContractSection initial={frameworkContract}/>
            )}

            <DocSection title="Реквизиты" icon="bx-building">
                {!isComplete ? (
                    <div style={{padding: "0.25rem 0"}}>
                        <p style={{
                            fontSize: "0.8rem",
                            color: "var(--dash-danger)",
                            fontWeight: 500,
                            margin: "0 0 8px"
                        }}>
                            Реквизиты не заполнены или заполнены не полностью
                        </p>
                        {requisitesError && (
                            <p style={{
                                fontSize: "0.75rem",
                                color: "var(--dash-muted)",
                                margin: "0 0 12px"
                            }}>{requisitesError}</p>
                        )}
                        <button
                            onClick={onSwitchToSettings}
                            style={{
                                padding: "0.5em 1.2em",
                                borderRadius: 8,
                                border: "1.5px solid var(--dash-accent)",
                                background: "var(--dash-accent-bg)",
                                color: "var(--dash-accent)",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            Заполнить реквизиты
                        </button>
                    </div>
                ) : (
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px"}}>
                        {reqRows.map(r =>
                            r.value ? (
                                <div key={r.label} style={{fontSize: "0.78rem"}}>
                                    <span style={{color: "var(--dash-muted)"}}>{r.label}: </span>
                                    <span style={{color: "var(--dash-text)"}}>{r.value}</span>
                                </div>
                            ) : null,
                        )}
                    </div>
                )}
            </DocSection>

            <DocSection title="Договоры по проектам" icon="bx-file">
                {contracts.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Договоров пока нет</p>
                ) : (
                    <DashDataTable
                        columns={[
                            {label: "Номер"},
                            {label: "Заказ"},
                            {label: "Дата"},
                            {label: "Статус"},
                            {label: "Файл", align: "right"},
                        ]}
                    >
                        {contracts.map(c => {
                            const b = CON_BADGE[c.status] ?? {variant: "pending" as const, label: c.status}
                            return (
                                <tr key={c.id} style={{borderBottom: "1px solid var(--dash-border)"}}>
                                    <td style={{padding: "8px 0", fontWeight: 500}}>№ {c.number}</td>
                                    <td style={{
                                        padding: "8px 0",
                                        color: "var(--dash-muted)"
                                    }}>#{c.orderId.slice(-6).toUpperCase()}</td>
                                    <td style={{padding: "8px 0", color: "var(--dash-muted)"}}>
                                        {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                                    </td>
                                    <td style={{padding: "8px 0"}}>
                                        <StatusBadge variant={b.variant} label={b.label}/>
                                    </td>
                                    <td style={{padding: "8px 0", textAlign: "right"}}>
                                        {c.s3Key ? (
                                            <DashActionLink
                                                href={`/api/files/download?key=${encodeURIComponent(c.s3Key)}`}
                                                iconClass="bx-download" native>
                                                Скачать
                                            </DashActionLink>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </DashDataTable>
                )}
            </DocSection>

            <DocSection title="Счета" icon="bx-receipt">
                {invoices.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Счетов пока нет</p>
                ) : (
                    <DashDataTable
                        columns={[
                            {label: "Номер"},
                            {label: "Назначение"},
                            {label: "Дата"},
                            {label: "Сумма", align: "right"},
                            {label: "Статус"},
                            {label: "Файл", align: "right"},
                        ]}
                    >
                        {invoices.map(inv => {
                            const b = INV_BADGE[inv.status] ?? {variant: "pending" as const, label: inv.status}
                            return (
                                <tr key={inv.id} style={{borderBottom: "1px solid var(--dash-border)"}}>
                                    <td style={{padding: "8px 0", fontWeight: 500}}>№ {inv.number}</td>
                                    <td style={{padding: "8px 0", color: "var(--dash-muted)"}}>{inv.purpose}</td>
                                    <td style={{padding: "8px 0", color: "var(--dash-muted)"}}>
                                        {new Date(inv.createdAt).toLocaleDateString("ru-RU")}
                                    </td>
                                    <td style={{padding: "8px 0", textAlign: "right", fontWeight: 600}}>
                                        {(inv.amount / 100).toLocaleString("ru-RU")} руб.
                                    </td>
                                    <td style={{padding: "8px 0"}}>
                                        <StatusBadge variant={b.variant} label={b.label}/>
                                    </td>
                                    <td style={{padding: "8px 0", textAlign: "right"}}>
                                        {inv.s3Key ? (
                                            <DashActionLink
                                                href={`/api/files/download?key=${encodeURIComponent(inv.s3Key)}`}
                                                iconClass="bx-download" native>
                                                Скачать
                                            </DashActionLink>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </DashDataTable>
                )}
            </DocSection>

            <DocSection title="Акты выполненных работ" icon="bx-check-shield">
                {acts.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Актов пока нет</p>
                ) : (
                    <div className="dash-finance-list">
                        {acts.map(a => (
                            <div key={a.id} className="dash-finance-card">
                                <div className="dash-finance-card__row">
                                    <div className="dash-finance-card__meta">
                                        <span
                                            className="dash-finance-card__title">{ACT_STAGE_LABEL[a.stageType] ?? a.stageType}</span>
                                        <span
                                            className="dash-finance-card__sub">#{a.orderId.slice(-6).toUpperCase()}</span>
                                    </div>
                                    <StatusBadge variant={a.signedAt ? "done" : "current"}
                                                 label={a.signedAt ? "Подписан" : "Ожидает подписи"}/>
                                </div>
                                <div className="dash-finance-card__sub" style={{marginTop: 8}}>
                                    {new Date(a.generatedAt).toLocaleDateString("ru-RU")}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DocSection>

            <DocSection title="История платежей" icon="bx-credit-card">
                {payments.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Платежей пока нет</p>
                ) : (
                    <DashDataTable
                        columns={[
                            {label: "Заказ"},
                            {label: "Тип"},
                            {label: "Дата"},
                            {label: "Сумма", align: "right"},
                            {label: "Статус"},
                        ]}
                    >
                        {payments.map(p => {
                            const badge = PAYMENT_BADGE[p.status]
                            const brief = p.order.briefData as Record<string, string> | null
                            return (
                                <tr key={p.id} style={{borderBottom: "1px solid var(--dash-border)"}}>
                                    <td style={{
                                        padding: "8px 0",
                                        fontWeight: 500
                                    }}>#{p.order.id.slice(-6).toUpperCase()}</td>
                                    <td style={{
                                        padding: "8px 0",
                                        color: "var(--dash-muted)"
                                    }}>{brief?.objectType ?? "—"}</td>
                                    <td style={{padding: "8px 0", color: "var(--dash-muted)"}}>
                                        {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                                    </td>
                                    <td style={{padding: "8px 0", textAlign: "right", fontWeight: 600}}>
                                        {(p.amount / 100).toLocaleString("ru-RU")} руб.
                                    </td>
                                    <td style={{padding: "8px 0"}}>
                                        <StatusBadge variant={badge.variant} label={badge.label}/>
                                    </td>
                                </tr>
                            )
                        })}
                    </DashDataTable>
                )}
            </DocSection>
        </div>
    )
}
