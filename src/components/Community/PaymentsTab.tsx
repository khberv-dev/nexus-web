"use client"

import {useState} from "react"
import {StatusBadge} from "@/components/app/AppCard"
import {DashSurfaceCard} from "@/components/dashboard-ui/DashSurfaceCard"
import type {PaymentWithRelations, SpecAct, SpecContract} from "./types"
import {DISCOVER_HUES, PAYMENT_BADGE, STAGE_LABELS} from "./types"
import type {StageType} from "@prisma/client"

const CON_BADGE: Record<string, { variant: "done" | "pending" | "current" | "rejected"; label: string }> = {
    DRAFT: {variant: "pending", label: "Черновик"}, SIGNED_CLIENT: {variant: "current", label: "Подписан"},
    SIGNED_BOTH: {variant: "done", label: "Подписан"}, CANCELLED: {variant: "rejected", label: "Отменен"},
    AWAITING_SIGNATURE: {variant: "current", label: "Ожидает подписи"},
    SIGNED_BY_SPECIALIST: {variant: "done", label: "Подписан специалистом"},
    SIGNED_BY_ADMIN: {variant: "done", label: "Подписан платформой"},
    DECLINED_BY_SPECIALIST: {variant: "rejected", label: "Отклонен"},
}

function Section({title, icon, children}: { title: string; icon: string; children: React.ReactNode }) {
    return (
        <DashSurfaceCard padding="md" className="dash-surface-card--mb">
            <h3 style={{fontSize: "0.82rem", fontWeight: 600, margin: "0 0 10px", color: "var(--dash-text)"}}>
                <i className={`bx ${icon}`} style={{marginRight: 6, color: "var(--dash-accent)"}}/>{title}
            </h3>
            {children}
        </DashSurfaceCard>
    )
}

function ContractActions({contract: c}: { contract: SpecContract }) {
    const [loading, setLoading] = useState(false)

    const download = async () => {
        setLoading(true)
        try {
            const url = c.kind === "ONBOARDING"
                ? "/api/specialist/framework-contract"
                : `/api/contracts/${c.id}/download`
            const res = await fetch(url)
            if (!res.ok) {
                alert("Ошибка скачивания");
                return
            }
            const data = await res.json()
            const fileUrl = data.downloadUrl ?? data.url
            if (fileUrl) window.open(fileUrl, "_blank")
            else alert("Файл недоступен")
        } finally {
            setLoading(false)
        }
    }

    const uploadSigned = async () => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".pdf"
        input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            setLoading(true)
            try {
                const fd = new FormData()
                fd.set("file", file)
                const res = await fetch("/api/specialist/framework-contract", {method: "POST", body: fd})
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error ?? "Ошибка загрузки")
                }
                window.location.reload()
            } catch (e) {
                alert((e as Error).message)
            } finally {
                setLoading(false)
            }
        }
        input.click()
    }

    const canSign = c.kind === "ONBOARDING" && c.status === "AWAITING_SIGNATURE"
    const canDownload = !!c.s3Key

    return (
        <div style={{display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap"}}>
            {canDownload && (
                <button onClick={download} disabled={loading} style={{
                    background: "none",
                    border: "1px solid var(--dash-border)",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    color: "var(--dash-accent, #5b4fcf)",
                    fontFamily: "inherit"
                }}>
                    <i className="bx bx-download" style={{marginRight: 4}}/>{loading ? "..." : "Скачать"}
                </button>
            )}
            {canSign && (
                <button onClick={uploadSigned} disabled={loading} style={{
                    background: "rgba(91,79,207,0.1)",
                    border: "1px solid rgba(91,79,207,0.3)",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                    color: "#5b4fcf",
                    fontFamily: "inherit",
                    fontWeight: 600
                }}>
                    <i className="bx bx-upload"
                       style={{marginRight: 4}}/>{loading ? "Загрузка..." : "Загрузить подписанный"}
                </button>
            )}
        </div>
    )
}

export function PaymentsCol1({payments, formData, contracts, acts}: {
    payments: PaymentWithRelations[]; formData: Record<string, string> | null
    contracts: SpecContract[]; acts: SpecAct[]
}) {
    const fd = formData ?? {}
    const isIP = fd.taxStatus === "IP"
    const isSZ = fd.taxStatus === "SZ"
    const totalReleased = payments.filter(p => p.status === "RELEASED").reduce((s, p) => s + p.amount, 0)
    const totalHeld = payments.filter(p => p.status === "HELD").reduce((s, p) => s + p.amount, 0)
    const totalPending = payments.filter(p => p.status === "PENDING").reduce((s, p) => s + p.amount, 0)

    const stats = [
        {
            label: "Выплачено",
            value: totalReleased,
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
            label: "Ожидает",
            value: totalPending,
            icon: "bx-credit-card",
            color: "var(--dash-accent)",
            bg: "var(--dash-accent-bg)"
        },
    ].filter(s => s.value > 0)

    const reqRows = [
        {label: "Статус", value: isIP ? "ИП" : isSZ ? "Самозанятый (НПД)" : undefined},
        {label: "ИНН", value: fd.inn},
        isIP && {label: "ОГРНИП", value: fd.ogrnip},
        {label: isIP ? "Р/с" : "Счет карты / р/с", value: fd.bankAccount},
        {label: "Банк", value: fd.bankName},
        {label: "БИК", value: fd.bankBik},
    ].filter(Boolean) as { label: string; value?: string }[]
    const hasReqs = reqRows.some(r => r.value)

    return (
        <div>
            {stats.length > 0 && (
                <div className="dash-stats-row" style={{marginBottom: 12}}>
                    {stats.map(s => (
                        <div key={s.label} className="dash-stat-card">
                            <div className="dash-stat-card__icon" style={{background: s.bg, color: s.color}}><i
                                className={`bx ${s.icon}`}/></div>
                            <div><p className="dash-stat-card__value">{(s.value / 100).toLocaleString("ru-RU")} руб.</p>
                                <p className="dash-stat-card__label">{s.label}</p></div>
                        </div>
                    ))}
                </div>
            )}

            {/* Requisites */}
            <Section title="Реквизиты" icon="bx-building">
                {hasReqs ? (
                    <div
                        style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: "0.78rem"}}>
                        {reqRows.map(r => r.value ? (
                            <div key={r.label}><span style={{color: "var(--dash-muted)"}}>{r.label}: </span>{r.value}
                            </div>
                        ) : null)}
                    </div>
                ) : (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Не заполнены — укажите в
                        Настройках</p>
                )}
            </Section>

            {/* Contracts */}
            <Section title="Договоры" icon="bx-file">
                {contracts.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Договоров пока нет</p>
                ) : (
                    <div className="dash-finance-list">
                        {contracts.map(c => {
                            const b = CON_BADGE[c.status] ?? {variant: "pending" as const, label: c.status}
                            return (
                                <div key={c.id} className="dash-finance-card">
                                    <div className="dash-finance-card__row">
                                        <div className="dash-finance-card__meta">
                                            <span className="dash-finance-card__title">№ {c.number}</span>
                                            <span className="dash-finance-card__sub">
                        {c.kind === "ONBOARDING"
                            ? "Договор онбординга"
                            : c.orderId
                                ? `#${c.orderId.slice(-6).toUpperCase()}`
                                : "Без проекта"}{" "}
                                                · {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                                        </div>
                                        <StatusBadge variant={b.variant} label={b.label}/>
                                    </div>
                                    <ContractActions contract={c}/>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Section>

            {/* Acts */}
            <Section title="Акты выполненных работ" icon="bx-check-shield">
                {acts.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Актов пока нет</p>
                ) : (
                    <div className="dash-finance-list">
                        {acts.map(a => (
                            <div key={a.id} className="dash-finance-card">
                                <div className="dash-finance-card__row">
                                    <div className="dash-finance-card__meta">
                                        <span
                                            className="dash-finance-card__title">{STAGE_LABELS[a.stageType as StageType] ?? a.stageType}</span>
                                        <span
                                            className="dash-finance-card__sub">#{a.orderId.slice(-6).toUpperCase()}</span>
                                    </div>
                                    <StatusBadge variant={a.signedAt ? "done" : "current"}
                                                 label={a.signedAt ? "Подписан" : "Ожидает"}/>
                                </div>
                                <div className="dash-finance-card__sub" style={{marginTop: 8}}>
                                    {new Date(a.generatedAt).toLocaleDateString("ru-RU")}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Payments */}
            <Section title="История выплат" icon="bx-credit-card">
                {payments.length === 0 ? (
                    <p style={{fontSize: "0.8rem", color: "var(--dash-muted)", margin: 0}}>Выплат пока нет</p>
                ) : (
                    <div className="dash-finance-list">
                        {payments.map(p => {
                            const badge = PAYMENT_BADGE[p.status]
                            return (
                                <div key={p.id} className="dash-finance-card">
                                    <div className="dash-finance-card__row">
                                        <div className="dash-finance-card__meta">
                                            <span
                                                className="dash-finance-card__title">#{p.order.id.slice(-6).toUpperCase()}</span>
                                            <span
                                                className="dash-finance-card__sub">{new Date(p.createdAt).toLocaleDateString("ru-RU")}</span>
                                        </div>
                                        <span
                                            className="dash-finance-card__sum">{(p.amount / 100).toLocaleString("ru-RU")} руб.</span>
                                    </div>
                                    <div style={{marginTop: 8}}>
                                        <StatusBadge variant={badge.variant} label={badge.label}/>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Section>
        </div>
    )
}

export function PaymentsCol2({payments}: { payments: PaymentWithRelations[] }) {
    const totalReleased = payments.filter(p => p.status === "RELEASED").reduce((s, p) => s + p.amount, 0)
    const totalHeld = payments.filter(p => p.status === "HELD").reduce((s, p) => s + p.amount, 0)

    const statusBreakdown = [
        {label: "Выплачено", count: payments.filter(p => p.status === "RELEASED").length, icon: "bx-check-circle"},
        {label: "Удержано", count: payments.filter(p => p.status === "HELD").length, icon: "bx-lock-alt"},
        {label: "Ожидает", count: payments.filter(p => p.status === "PENDING").length, icon: "bx-hourglass"},
    ]

    return (
        <>
            <div className="dash-cards-container">
                <div className="dash-cards-heading-wrap"><h3 className="dash-section-heading">Итого</h3></div>
                <ul className="dash-cards">
                    {[
                        {
                            label: "Выплачено",
                            value: `${(totalReleased / 100).toLocaleString("ru-RU")} руб.`,
                            hue: 140,
                            icon: "bx-check-circle"
                        },
                        {
                            label: "Удержано",
                            value: `${(totalHeld / 100).toLocaleString("ru-RU")} руб.`,
                            hue: 200,
                            icon: "bx-time-five"
                        },
                        {label: "Транзакций", value: String(payments.length), hue: 247, icon: "bx-receipt"},
                    ].map(s => (
                        <li key={s.label} className="dash-card" style={{"--hue": s.hue} as React.CSSProperties}>
                            <div className="dash-card__img"><i className={`bx ${s.icon}`}/></div>
                            <div className="dash-card__img-overlay"/>
                            <div className="dash-card__body"><h3 className="dash-card__heading">{s.value}</h3><p
                                className="dash-card__sub">{s.label}</p></div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="dash-discover">
                <div className="dash-discover-heading-wrap"><h3 className="dash-section-heading">По статусам</h3></div>
                <ul className="dash-discover-places">
                    {statusBreakdown.map((item, i) => (
                        <li key={item.label} className="dash-discover__place">
                            <h4 className="dash-discover__place-heading">{item.label}</h4>
                            <p className="dash-discover__place-sub">{item.count} транзакций</p>
                            <div className="dash-discover__more">
                                <div className="dash-discover__more-icon"
                                     style={{background: `linear-gradient(20deg, hsl(${DISCOVER_HUES[i % DISCOVER_HUES.length].h1},72%,52%), hsl(${DISCOVER_HUES[i % DISCOVER_HUES.length].h2},72%,44%))`}}>
                                    <i className={`bx ${item.icon}`}/>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    )
}
