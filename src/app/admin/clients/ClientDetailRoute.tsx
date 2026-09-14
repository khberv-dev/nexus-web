"use client"

import Link from "next/link"
import {StatusBadge} from "@/components/app/AppCard"
import {AuditTimeline} from "@/components/admin/AuditTimeline"
import {AdminClientProfileAccordion} from "@/components/admin/AdminClientProfileAccordion"
import {adminOrderHref} from "@/lib/admin-routes"
import {
    briefListProgressWidthPercent,
    countFilledBriefFields,
    formatBriefWizardProgress,
} from "@/lib/clientBriefDisplay"
import {formatEdoProvidersLabel} from "@/lib/edo-providers"
import {FW_CONTRACT_STATUS_LABEL, ORDER_LABEL, ORDER_VARIANT} from "./client-types"
import {useClientsShell} from "./ClientsShell"

/** Карточка заказчика по адресу /admin/clients/:id; данные и действия — из списка в layout. */
export function ClientDetailRoute({id}: { id: string }) {
    const {clients, loading, reload: load, toggleArchive, openBrief: setBriefModal} = useClientsShell()
    const client = clients.find(c => c.id === id) ?? null

    if (!client) {
        return (
            <div className="cl-detail-empty">
                <i className="bx bx-user"/>
                <p>{loading ? "Загрузка…" : "Заказчик не найден"}</p>
            </div>
        )
    }

    const displayName = client.name ?? client.email
    const pendingReq = client.clientRequisiteChangeRequests?.[0] ?? null
    const baseFd = client.clientProfile?.formData
    const fd: Record<string, string> | null = (() => {
        const merged = {...(baseFd ?? {})} as Record<string, string>
        if (pendingReq?.newData && typeof pendingReq.newData === "object") {
            for (const [k, v] of Object.entries(pendingReq.newData)) {
                if (typeof v === "string" && v.trim()) merged[k] = v
            }
        }
        return Object.keys(merged).length ? merged : null
    })()
    const clientEdo = formatEdoProvidersLabel(typeof fd?.edoProviders === "string" ? fd.edoProviders : undefined)
    const doneOrders = client.orders.filter(o => o.status === "DONE")
    const pipelineActive = client.orders.filter(o => ["ACTIVE", "BRIEFING", "BRIEF_REVIEW"].includes(o.status)).length
    const draftCount = client.orders.filter(o => o.status === "DRAFT").length
    const fw = client.clientProfile

    return (
        <div className="cl-detail-scroll">
            {/* Header */}
            <div className="cl-profile-header">
                <div className="cl-av-xl">{displayName[0].toUpperCase()}</div>
                <div className="cl-profile-info">
                    <h4 className="cl-profile-name">{fd?.fullName || displayName}</h4>
                    <div className="cl-profile-email">{client.email}</div>
                    {client.phone && <div className="cl-profile-email"
                                          style={{marginTop: 2}}>{client.phone}</div>}
                    {client.archivedAt && <div
                        style={{fontSize: "0.78rem", color: "var(--adm-muted)", marginTop: 4}}>В
                        архиве</div>}
                    {fd?.company &&
                        <div style={{fontSize: "0.78rem", color: "var(--adm-muted)", marginTop: 2}}>
                            <i className="bx bx-buildings" style={{marginRight: 3}}/>{fd.company}
                        </div>}
                    <div style={{
                        fontSize: "0.78rem",
                        color: "var(--adm-muted)",
                        marginTop: 4,
                        lineHeight: 1.35
                    }} title={clientEdo || undefined}>
                        <i className="bx bx-transfer-alt" style={{marginRight: 4}}/>
                        ЭДО: {clientEdo || "не указано"}
                    </div>
                </div>
                <div className="cl-profile-stats" style={{flexWrap: "wrap", gap: 12}}>
                    <div className="cl-stat">
                        <div className="cl-stat__value">{client.orders.length}</div>
                        <div className="cl-stat__label">Заказов</div>
                    </div>
                    <div className="cl-stat">
                        <div className="cl-stat__value">{pipelineActive}</div>
                        <div className="cl-stat__label">Активных</div>
                    </div>
                    <div className="cl-stat">
                        <div className="cl-stat__value">{draftCount}</div>
                        <div className="cl-stat__label">Черновиков</div>
                    </div>
                    <div className="cl-stat">
                        <div className="cl-stat__value">{doneOrders.length}</div>
                        <div className="cl-stat__label">Завершено</div>
                    </div>
                    <div style={{display: "flex", alignItems: "center"}}>
                        <button
                            type="button"
                            onClick={() => {
                                if (!confirm(client.archivedAt ? "Восстановить клиента из архива?" : "Перенести клиента в архив?")) return
                                void toggleArchive(client.id, !client.archivedAt)
                            }}
                            style={{
                                padding: "8px 14px",
                                borderRadius: 6,
                                border: "1px solid var(--adm-sidebar-border)",
                                background: "transparent",
                                color: "var(--adm-text)",
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                cursor: "pointer"
                            }}
                        >
                            {client.archivedAt ? "Восстановить" : "В архив"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="cl-grid">
                {/* Left: full profile info */}
                <div>
                    <div className="cl-info-card" style={{padding: 14, marginBottom: 14}}>
                        <div className="cl-section" style={{marginBottom: 8}}>
                            <span className="cl-label">Договор оказания услуг</span>
                        </div>
                        <p style={{
                            fontSize: "0.75rem",
                            color: "var(--adm-muted)",
                            margin: "0 0 10px",
                            lineHeight: 1.45
                        }}>
                            PDF для подписания заказчиком. Пока договор не подписан (в ЛК или
                            кнопкой ниже), отправка брифов из мастера заблокирована.
                        </p>
                        <div style={{fontSize: "0.78rem", marginBottom: 10}}>
                            <span style={{color: "var(--adm-muted)"}}>Статус: </span>
                            <strong style={{color: "var(--adm-text)"}}>
                                {FW_CONTRACT_STATUS_LABEL[fw?.frameworkContractStatus ?? "NONE"] ?? (fw?.frameworkContractStatus ?? "NONE")}
                            </strong>
                            {fw?.frameworkContractNumber && (
                                <span style={{
                                    color: "var(--adm-muted)",
                                    marginLeft: 8
                                }}>№ {fw.frameworkContractNumber}</span>
                            )}
                        </div>
                        {fw?.frameworkContractS3Key &&
                            fw.frameworkContractStatus !== "SIGNED_BY_CLIENT" &&
                            fw.frameworkContractStatus !== "SIGNED_BY_ADMIN" && (
                                <div style={{marginBottom: 12}}>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!confirm("Зафиксировать подписание договора? Черновики и брифы этого заказчика с заполненными данными перейдут в статус «Активен» — можно назначать специалистов.")) return
                                            const res = await fetch(`/api/admin/clients/${client.id}/framework-contract/sign`, {method: "POST"})
                                            const data = await res.json().catch(() => ({}))
                                            if (!res.ok) {
                                                alert(typeof data.error === "string" ? data.error : "Ошибка")
                                                return
                                            }
                                            const n = typeof data.promotedCount === "number" ? data.promotedCount : 0
                                            alert(n > 0 ? `Готово. Переведено заказов в «Активен»: ${n}.` : "Статус договора обновлен.")
                                            load()
                                        }}
                                        style={{
                                            padding: "8px 14px",
                                            borderRadius: 6,
                                            border: "none",
                                            background: "var(--dash-success, #16a34a)",
                                            color: "#fff",
                                            fontWeight: 600,
                                            fontSize: "0.78rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Договор подписан
                                    </button>
                                    <p style={{
                                        fontSize: "0.7rem",
                                        color: "var(--adm-muted)",
                                        margin: "8px 0 0",
                                        maxWidth: 420,
                                        lineHeight: 1.4
                                    }}>
                                        Если договор подписан на бумаге или вне ЛК — нажмите после
                                        загрузки PDF. Заказы в статусах «Черновик» (с заполненным
                                        брифом), «Бриф» и «Проверка» станут «Активен».
                                    </p>
                                </div>
                            )}
                        <form
                            onSubmit={async e => {
                                e.preventDefault()
                                const el = e.currentTarget
                                const fd = new FormData(el)
                                const res = await fetch(`/api/admin/clients/${client.id}/framework-contract`, {
                                    method: "POST",
                                    body: fd
                                })
                                if (res.ok) {
                                    el.reset()
                                    load()
                                }
                            }}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                alignItems: "flex-start"
                            }}
                        >
                            <input type="file" name="file" accept=".pdf,application/pdf" required
                                   style={{fontSize: "0.78rem", maxWidth: "100%"}}/>
                            <input name="number" placeholder="Номер договора (необязательно)"
                                   style={{
                                       width: "100%",
                                       maxWidth: 320,
                                       padding: "6px 10px",
                                       borderRadius: 6,
                                       border: "1px solid var(--adm-sidebar-border)",
                                       background: "var(--adm-outer)",
                                       color: "var(--adm-text)",
                                       fontSize: "0.8rem"
                                   }}/>
                            <button type="submit" style={{
                                padding: "6px 14px",
                                borderRadius: 6,
                                border: "none",
                                background: "var(--adm-active-color)",
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.78rem",
                                cursor: "pointer"
                            }}>
                                Загрузить / заменить PDF
                            </button>
                        </form>
                        {fw?.signedContractS3Key && (
                            <div style={{
                                marginTop: 12,
                                padding: "8px 12px",
                                borderRadius: 6,
                                background: "rgba(34,197,94,0.08)",
                                border: "1px solid rgba(34,197,94,0.25)"
                            }}>
                                <div style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    color: "#22c55e",
                                    marginBottom: 4
                                }}>Заказчик загрузил подписанный скан
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const r = await fetch("/api/admin/s3-url?key=" + encodeURIComponent(fw.signedContractS3Key!))
                                        if (r.ok) {
                                            const {url} = await r.json();
                                            if (url) window.open(url, "_blank")
                                        }
                                    }}
                                    style={{
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #22c55e",
                                        background: "transparent",
                                        color: "#22c55e",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    Скачать скан
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="cl-info-card" style={{padding: 14, marginBottom: 14}}>
                        <div className="cl-section" style={{marginBottom: 6}}>
                            <span className="cl-label">Документы и ЭДО</span>
                        </div>
                        <p style={{
                            fontSize: "0.75rem",
                            color: "var(--adm-muted)",
                            margin: 0,
                            lineHeight: 1.45
                        }}>
                            Счета и акты по заказам — в карточке заказа и во вкладке «Оплата» у
                            заказчика. Операторы ЭДО заказчик указывает в настройках профиля (секция
                            ниже «Электронный документооборот»): Контур.Диадок, Такском, СБИС,
                            1С-ЭДО.
                        </p>
                    </div>

                    <AdminClientProfileAccordion
                        formData={fd as Record<string, string> | undefined}
                        clientEmail={client.email}
                        clientPhone={client.phone}
                        clientName={client.name}
                        systemRows={[
                            {
                                label: "ID",
                                value: client.id.slice(-8).toUpperCase(),
                                icon: "bx-hash"
                            },
                            {
                                label: "Регистрация",
                                value: new Date(client.createdAt).toLocaleDateString("ru-RU"),
                                icon: "bx-calendar"
                            },
                        ]}
                    />
                </div>

                {/* Right: orders */}
                <div>
                    <div className="cl-section">
                        <span className="cl-label">Заказы</span>
                        <span className="cl-badge">{client.orders.length}</span>
                    </div>
                    {client.orders.length === 0 ? (
                        <div className="cl-empty" style={{padding: "20px 0"}}>Заказов нет</div>
                    ) : (
                        <div className="cl-info-card" style={{padding: 0}}>
                            {client.orders.map(o => {
                                const title = o.title ?? o.briefData?.name ?? `#${o.id.slice(-6)}`
                                const briefFields = countFilledBriefFields(o.briefData)
                                const briefBarPct = briefListProgressWidthPercent(briefFields)
                                const isDraft = o.status === "DRAFT"
                                return (
                                    <div key={o.id} className="cl-order-row" style={{
                                        flexDirection: "column",
                                        alignItems: "stretch",
                                        gap: 6
                                    }}>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12
                                        }}>
                                            <div style={{flex: 1, minWidth: 0}}>
                                                <Link href={adminOrderHref(o.id)} style={{
                                                    fontWeight: 500,
                                                    fontSize: "0.85rem",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                    display: "block",
                                                    color: "inherit",
                                                    textDecoration: "none"
                                                }}>{title}</Link>
                                                <div style={{
                                                    fontSize: "0.7rem",
                                                    color: "var(--adm-muted)"
                                                }}>{new Date(o.createdAt).toLocaleDateString("ru-RU")}</div>
                                            </div>
                                            <StatusBadge
                                                variant={ORDER_VARIANT[o.status] ?? "pending"}
                                                label={ORDER_LABEL[o.status] ?? o.status}/>
                                            {o.briefData && Object.values(o.briefData).some(Boolean) && (
                                                <button
                                                    onClick={() => setBriefModal(o)}
                                                    style={{
                                                        background: "none",
                                                        border: "1px solid var(--adm-sidebar-border)",
                                                        borderRadius: 5,
                                                        padding: "2px 8px",
                                                        cursor: "pointer",
                                                        fontSize: "0.68rem",
                                                        color: "var(--adm-active-color)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 3
                                                    }}
                                                >
                                                    <i className="bx bx-file"/>Бриф
                                                </button>
                                            )}
                                        </div>
                                        {isDraft && (
                                            <div style={{
                                                fontSize: "0.72rem",
                                                color: "var(--adm-muted)",
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 4
                                            }}>
                                                <div style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 6,
                                                    flexWrap: "wrap"
                                                }}>
                                                    <span>Бриф: {briefFields} полей</span>
                                                    <span
                                                        style={{color: "var(--adm-active-color)"}}>· {formatBriefWizardProgress(o.briefStep)}</span>
                                                </div>
                                                <div style={{
                                                    height: 3,
                                                    background: "rgba(99,102,241,0.12)",
                                                    borderRadius: 3,
                                                    overflow: "hidden"
                                                }}>
                                                    <div style={{
                                                        height: "100%",
                                                        width: `${briefBarPct}%`,
                                                        background: "var(--adm-active-color)",
                                                        borderRadius: 3,
                                                        transition: "width 0.3s"
                                                    }}/>
                                                </div>
                                            </div>
                                        )}
                                        {o.briefHelpRequested && (
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 5,
                                                padding: "4px 8px",
                                                borderRadius: 6,
                                                background: "rgba(234,84,85,0.1)",
                                                border: "1px solid rgba(234,84,85,0.25)",
                                                fontSize: "0.72rem",
                                                color: "#ea5455",
                                                fontWeight: 500
                                            }}>
                                                <i className="bx bx-support"
                                                   style={{marginRight: 4}}/>Запрошена помощь
                                                менеджера
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Timeline column */}
                <div>
                    <div className="cl-info-card" style={{position: "sticky", top: 24}}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 10
                        }}>
                            <i className="bx bx-history"
                               style={{color: "var(--adm-active-color)"}}/>
                            <span style={{
                                fontSize: "0.72rem",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                color: "var(--adm-muted)"
                            }}>История</span>
                        </div>
                        <div style={{
                            maxHeight: "60vh",
                            overflowY: "auto",
                            scrollbarWidth: "thin",
                            scrollbarColor: "rgba(255,255,255,0.15) transparent"
                        }}>
                            {client.orders.map(o => (
                                <div key={o.id} style={{marginBottom: 8}}>
                                    <div style={{
                                        fontSize: "0.68rem",
                                        color: "var(--adm-muted)",
                                        marginBottom: 4
                                    }}>#{o.id.slice(-6).toUpperCase()}</div>
                                    <AuditTimeline entity="Order" entityId={o.id}/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
