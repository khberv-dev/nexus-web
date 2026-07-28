"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { useRegisterAdminRefresh } from "@/components/admin/AdminRefreshContext"
import { StatusBadge, StatusVariant } from "@/components/app/AppCard"
import { Modal } from "@/components/ui/modal"
import { AuditTimeline } from "@/components/admin/AuditTimeline"
import { AdminClientProfileAccordion } from "@/components/admin/AdminClientProfileAccordion"
import { BriefEditor } from "@/components/admin/BriefEditor"
import {
  briefListProgressWidthPercent,
  countFilledBriefFields,
  formatBriefWizardProgress,
} from "@/lib/clientBriefDisplay"
import { formatEdoProvidersLabel } from "@/lib/edo-providers"

interface ClientOrder {
  id: string; status: string; title: string | null; briefData: Record<string, string> | null; briefStep: number; briefHelpRequested: boolean; createdAt: string
}

interface RawClient {
  id: string; email: string; name: string | null; phone: string | null; createdAt: string
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

const ORDER_LABEL: Record<string, string> = {
  DRAFT: "Черновик", BRIEFING: "Бриф", BRIEF_REVIEW: "Проверка",
  ACTIVE: "Активен", DONE: "Завершен", CANCELLED: "Отменен",
}
const ORDER_VARIANT: Record<string, StatusVariant> = {
  DRAFT: "pending", BRIEFING: "pending", BRIEF_REVIEW: "current",
  ACTIVE: "active", DONE: "done", CANCELLED: "rejected",
}

const FW_CONTRACT_STATUS_LABEL: Record<string, string> = {
  NONE: "Не размещен",
  AWAITING_SIGNATURE: "Ожидает подписи",
  SIGNED_BY_CLIENT: "Подписан заказчиком",
  SIGNED_BY_ADMIN: "Подписан (зафиксирован админом)",
  DECLINED_BY_CLIENT: "Отклонен заказчиком",
}

function ClientsPageInner() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("highlight")
  const [clients, setClients] = useState<RawClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string | null>(highlightId)
  const [briefModal, setBriefModal] = useState<ClientOrder | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/clients?includeArchived=1")
    if (res.ok) setClients(await res.json())
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  useRegisterAdminRefresh(load)

  const filtered = clients.filter(c => showArchived ? !!c.archivedAt : !c.archivedAt).filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  })

  const toggleArchive = async (userId: string, archived: boolean) => {
    await fetch(`/api/admin/users/${userId}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    })
    await load()
  }

  const client = filtered.find(c => c.id === selected) ?? filtered[0] ?? null

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { setSelected(filtered[0]?.id ?? null) }, [loading])

  return (
    <AdminLayout noPadding>
      <div className="cl-wrap">
        {/* ── List ── */}
        <aside className="cl-list">
          <div className="cl-list-hd">
            <span className="cl-label">Заказчики</span>
            <span className="cl-badge">{filtered.length}</span>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 12px 8px" }}>
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              style={{ padding: "6px 10px", borderRadius: 8, border: !showArchived ? "1px solid var(--adm-active-color)" : "1px solid var(--adm-sidebar-border)", background: !showArchived ? "var(--adm-active-bg)" : "transparent", color: !showArchived ? "var(--adm-active-color)" : "var(--adm-muted)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
            >
              Активные
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              style={{ padding: "6px 10px", borderRadius: 8, border: showArchived ? "1px solid var(--adm-active-color)" : "1px solid var(--adm-sidebar-border)", background: showArchived ? "var(--adm-active-bg)" : "transparent", color: showArchived ? "var(--adm-active-color)" : "var(--adm-muted)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
            >
              Архив
            </button>
          </div>
          <div className="cl-search">
            <i className="bx bx-search cl-search-icon" />
            <input className="cl-search-input" placeholder="Поиск…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loading && <div className="cl-empty">Загрузка…</div>}
          {!loading && filtered.length === 0 && <div className="cl-empty">Заказчиков нет</div>}

          {!loading && filtered.map(c => {
            const isOn = c.id === (selected ?? filtered[0]?.id)
            const displayName = c.name ?? c.email
            const cFd = c.clientProfile?.formData
            const edoLabel = formatEdoProvidersLabel(typeof cFd?.edoProviders === "string" ? cFd.edoProviders : undefined)
            return (
              <div key={c.id} role="button" tabIndex={0} onClick={() => setSelected(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c.id) } }} className={`cl-card${isOn ? " cl-card--on" : ""}`}>
                <div className="cl-card__top">
                  <div className="cl-card__av" style={{
                    background: isOn ? "linear-gradient(135deg, var(--adm-active-color), #a78bfa)" : "var(--adm-active-bg)",
                    color: isOn ? "#fff" : "var(--adm-active-color)",
                  }}>
                    {displayName[0].toUpperCase()}
                  </div>
                  <span className="cl-card__name">{displayName}</span>
                </div>
                <div className="cl-card__bottom">
                  <span className="cl-card__orders">{c.orders.length} заказ(ов)</span>
                  {c.orders.some(o => o.briefHelpRequested) ? (
                    <span style={{ fontSize: "0.65rem", color: "#ea5455", fontWeight: 600 }}><i className="bx bx-support" style={{ marginRight: 2 }} />Помощь</span>
                  ) : (
                    <span className="cl-card__date">{new Date(c.createdAt).toLocaleDateString("ru-RU")}</span>
                  )}
                </div>
                <div className="cl-card__edo" title={edoLabel || "не указано"}>
                  <i className="bx bx-transfer-alt" />
                  ЭДО: {edoLabel || "—"}
                </div>
              </div>
            )
          })}
        </aside>

        {/* ── Detail ── */}
        <div className="cl-detail">
          {!client ? (
            <div className="cl-detail-empty">
              <i className="bx bx-user" />
              <p>Выберите заказчика</p>
            </div>
          ) : (() => {
            const displayName = client.name ?? client.email
            const pendingReq = client.clientRequisiteChangeRequests?.[0] ?? null
            const baseFd = client.clientProfile?.formData
            const fd: Record<string, string> | null = (() => {
              const merged = { ...(baseFd ?? {}) } as Record<string, string>
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
                    {client.phone && <div className="cl-profile-email" style={{ marginTop: 2 }}>{client.phone}</div>}
                    {client.archivedAt && <div style={{ fontSize: "0.78rem", color: "var(--adm-muted)", marginTop: 4 }}>В архиве</div>}
                    {fd?.company && <div style={{ fontSize: "0.78rem", color: "var(--adm-muted)", marginTop: 2 }}><i className="bx bx-buildings" style={{ marginRight: 3 }} />{fd.company}</div>}
                    <div style={{ fontSize: "0.78rem", color: "var(--adm-muted)", marginTop: 4, lineHeight: 1.35 }} title={clientEdo || undefined}>
                      <i className="bx bx-transfer-alt" style={{ marginRight: 4 }} />
                      ЭДО: {clientEdo || "не указано"}
                    </div>
                  </div>
                  <div className="cl-profile-stats" style={{ flexWrap: "wrap", gap: 12 }}>
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
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(client.archivedAt ? "Восстановить клиента из архива?" : "Перенести клиента в архив?")) return
                          void toggleArchive(client.id, !client.archivedAt)
                        }}
                        style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid var(--adm-sidebar-border)", background: "transparent", color: "var(--adm-text)", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}
                      >
                        {client.archivedAt ? "Восстановить" : "В архив"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cl-grid">
                  {/* Left: full profile info */}
                  <div>
                    <div className="cl-info-card" style={{ padding: 14, marginBottom: 14 }}>
                      <div className="cl-section" style={{ marginBottom: 8 }}>
                        <span className="cl-label">Договор оказания услуг</span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--adm-muted)", margin: "0 0 10px", lineHeight: 1.45 }}>
                        PDF для подписания заказчиком. Пока договор не подписан (в ЛК или кнопкой ниже), отправка брифов из мастера заблокирована.
                      </p>
                      <div style={{ fontSize: "0.78rem", marginBottom: 10 }}>
                        <span style={{ color: "var(--adm-muted)" }}>Статус: </span>
                        <strong style={{ color: "var(--adm-text)" }}>
                          {FW_CONTRACT_STATUS_LABEL[fw?.frameworkContractStatus ?? "NONE"] ?? (fw?.frameworkContractStatus ?? "NONE")}
                        </strong>
                        {fw?.frameworkContractNumber && (
                          <span style={{ color: "var(--adm-muted)", marginLeft: 8 }}>№ {fw.frameworkContractNumber}</span>
                        )}
                      </div>
                      {fw?.frameworkContractS3Key &&
                        fw.frameworkContractStatus !== "SIGNED_BY_CLIENT" &&
                        fw.frameworkContractStatus !== "SIGNED_BY_ADMIN" && (
                          <div style={{ marginBottom: 12 }}>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm("Зафиксировать подписание договора? Черновики и брифы этого заказчика с заполненными данными перейдут в статус «Активен» — можно назначать специалистов.")) return
                                const res = await fetch(`/api/admin/clients/${client.id}/framework-contract/sign`, { method: "POST" })
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
                            <p style={{ fontSize: "0.7rem", color: "var(--adm-muted)", margin: "8px 0 0", maxWidth: 420, lineHeight: 1.4 }}>
                              Если договор подписан на бумаге или вне ЛК — нажмите после загрузки PDF. Заказы в статусах «Черновик» (с заполненным брифом), «Бриф» и «Проверка» станут «Активен».
                            </p>
                          </div>
                        )}
                      <form
                        onSubmit={async e => {
                          e.preventDefault()
                          const el = e.currentTarget
                          const fd = new FormData(el)
                          const res = await fetch(`/api/admin/clients/${client.id}/framework-contract`, { method: "POST", body: fd })
                          if (res.ok) {
                            el.reset()
                            load()
                          }
                        }}
                        style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}
                      >
                        <input type="file" name="file" accept=".pdf,application/pdf" required style={{ fontSize: "0.78rem", maxWidth: "100%" }} />
                        <input name="number" placeholder="Номер договора (необязательно)" style={{ width: "100%", maxWidth: 320, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--adm-sidebar-border)", background: "var(--adm-outer)", color: "var(--adm-text)", fontSize: "0.8rem" }} />
                        <button type="submit" style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--adm-active-color)", color: "#fff", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}>
                          Загрузить / заменить PDF
                        </button>
                      </form>
                      {fw?.signedContractS3Key && (
                        <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#22c55e", marginBottom: 4 }}>Заказчик загрузил подписанный скан</div>
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await fetch("/api/admin/s3-url?key=" + encodeURIComponent(fw.signedContractS3Key!))
                              if (r.ok) { const { url } = await r.json(); if (url) window.open(url, "_blank") }
                            }}
                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #22c55e", background: "transparent", color: "#22c55e", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}
                          >
                            Скачать скан
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="cl-info-card" style={{ padding: 14, marginBottom: 14 }}>
                      <div className="cl-section" style={{ marginBottom: 6 }}>
                        <span className="cl-label">Документы и ЭДО</span>
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--adm-muted)", margin: 0, lineHeight: 1.45 }}>
                        Счета и акты по заказам — в карточке заказа и во вкладке «Оплата» у заказчика. Операторы ЭДО заказчик указывает в настройках профиля (секция ниже «Электронный документооборот»): Контур.Диадок, Такском, СБИС, 1С-ЭДО.
                      </p>
                    </div>

                    <AdminClientProfileAccordion
                      formData={fd as Record<string, string> | undefined}
                      clientEmail={client.email}
                      clientPhone={client.phone}
                      clientName={client.name}
                      systemRows={[
                        { label: "ID", value: client.id.slice(-8).toUpperCase(), icon: "bx-hash" },
                        { label: "Регистрация", value: new Date(client.createdAt).toLocaleDateString("ru-RU"), icon: "bx-calendar" },
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
                      <div className="cl-empty" style={{ padding: "20px 0" }}>Заказов нет</div>
                    ) : (
                      <div className="cl-info-card" style={{ padding: 0 }}>
                        {client.orders.map(o => {
                          const title = o.title ?? o.briefData?.name ?? `#${o.id.slice(-6)}`
                          const briefFields = countFilledBriefFields(o.briefData)
                          const briefBarPct = briefListProgressWidthPercent(briefFields)
                          const isDraft = o.status === "DRAFT"
                          return (
                            <div key={o.id} className="cl-order-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <a href={`/admin/orders?highlight=${o.id}`} style={{ fontWeight: 500, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", color: "inherit", textDecoration: "none" }}>{title}</a>
                                  <div style={{ fontSize: "0.7rem", color: "var(--adm-muted)" }}>{new Date(o.createdAt).toLocaleDateString("ru-RU")}</div>
                                </div>
                                <StatusBadge variant={ORDER_VARIANT[o.status] ?? "pending"} label={ORDER_LABEL[o.status] ?? o.status} />
                                {o.briefData && Object.values(o.briefData).some(Boolean) && (
                                  <button
                                    onClick={() => setBriefModal(o)}
                                    style={{ background: "none", border: "1px solid var(--adm-sidebar-border)", borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontSize: "0.68rem", color: "var(--adm-active-color)", display: "flex", alignItems: "center", gap: 3 }}
                                  >
                                    <i className="bx bx-file" />Бриф
                                  </button>
                                )}
                              </div>
                              {isDraft && (
                                <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <span>Бриф: {briefFields} полей</span>
                                    <span style={{ color: "var(--adm-active-color)" }}>· {formatBriefWizardProgress(o.briefStep)}</span>
                                  </div>
                                  <div style={{ height: 3, background: "rgba(99,102,241,0.12)", borderRadius: 3, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${briefBarPct}%`, background: "var(--adm-active-color)", borderRadius: 3, transition: "width 0.3s" }} />
                                  </div>
                                </div>
                              )}
                              {o.briefHelpRequested && (
                                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, background: "rgba(234,84,85,0.1)", border: "1px solid rgba(234,84,85,0.25)", fontSize: "0.72rem", color: "#ea5455", fontWeight: 500 }}>
                                  <i className="bx bx-support" style={{ marginRight: 4 }} />Запрошена помощь менеджера
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
                    <div className="cl-info-card" style={{ position: "sticky", top: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <i className="bx bx-history" style={{ color: "var(--adm-active-color)" }} />
                        <span style={{ fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--adm-muted)" }}>История</span>
                      </div>
                      <div style={{ maxHeight: "60vh", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
                        {client.orders.map(o => (
                          <div key={o.id} style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--adm-muted)", marginBottom: 4 }}>#{o.id.slice(-6).toUpperCase()}</div>
                            <AuditTimeline entity="Order" entityId={o.id} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      <Modal open={!!briefModal} onClose={() => setBriefModal(null)} maxWidth={640}>
        {briefModal && <BriefEditor order={briefModal} onClose={() => setBriefModal(null)} onSaved={load} />}
      </Modal>

      <style>{`
        .cl-wrap { display: flex; height: 100%; overflow: hidden; }

        .cl-list {
          width: 260px; flex-shrink: 0;
          background: var(--adm-outer);
          border-right: 1px solid var(--adm-sidebar-border);
          overflow-y: auto; display: flex; flex-direction: column;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.12) transparent;
        }
        .cl-list::-webkit-scrollbar { width: 5px; }
        .cl-list::-webkit-scrollbar-track { background: transparent; }
        .cl-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
        .cl-list::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.22); }
        .cl-list-hd {
          padding: 10px 16px;
          border-bottom: 1px solid var(--adm-sidebar-border);
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0; background: var(--adm-sidebar);
        }
        .cl-label {
          font-size: 0.68rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--adm-muted);
        }
        .cl-badge {
          display: inline-flex; align-items: center;
          background: var(--adm-active-bg); color: var(--adm-active-color);
          padding: 2px 8px; border-radius: 10px;
          font-size: 0.72rem; font-weight: 600;
        }
        .cl-search { position: relative; padding: 8px 12px; flex-shrink: 0; }
        .cl-search-icon {
          position: absolute; left: 20px; top: 50%;
          transform: translateY(-50%); color: var(--adm-muted);
          font-size: 0.9rem; pointer-events: none;
        }
        .cl-search-input {
          width: 100%; height: 32px; padding: 0 8px 0 28px;
          border: 1px solid var(--adm-sidebar-border); border-radius: 6px;
          background: transparent; color: var(--adm-text);
          font-size: 0.8rem; outline: none; font-family: inherit;
        }
        .cl-search-input:focus { border-color: var(--adm-active-color); }
        .cl-search-input::placeholder { color: var(--adm-muted); }
        .cl-empty { padding: 24px 16px; font-size: 0.82rem; color: var(--adm-muted); text-align: center; }

        .cl-card {
          margin: 0 10px 8px; padding: 12px 14px;
          background: var(--adm-sidebar); border-radius: 8px;
          cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          transition: box-shadow 0.15s; border: 2px solid transparent;
        }
        .cl-card:first-child { margin-top: 4px; }
        .cl-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
        .cl-card--on { border-color: var(--adm-active-color); box-shadow: 0 4px 16px rgba(99,102,241,0.2); }
        .cl-card__top {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 10px; margin-bottom: 10px;
          border-bottom: 1px solid var(--adm-sidebar-border);
        }
        .cl-card__av {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
        }
        .cl-card__name {
          font-weight: 600; font-size: 0.82rem;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cl-card__bottom { display: flex; align-items: center; justify-content: space-between; }
        .cl-card__edo {
          margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--adm-sidebar-border);
          font-size: 0.65rem; color: var(--adm-muted); line-height: 1.25;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          display: flex; align-items: center; gap: 4px;
        }
        .cl-card__edo .bx { flex-shrink: 0; font-size: 0.75rem; opacity: 0.85; }
        .cl-card__orders { font-size: 0.72rem; color: var(--adm-active-color); }
        .cl-card__date { font-size: 0.68rem; color: var(--adm-muted); }

        .cl-detail { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
        .cl-detail-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; color: var(--adm-muted);
        }
        .cl-detail-empty i { font-size: 48px; opacity: 0.3; display: block; }
        .cl-detail-empty p { margin-top: 8px; }
        .cl-detail-scroll { flex: 1; overflow-y: auto; padding: 24px 28px; }

        .cl-profile-header {
          display: flex; align-items: flex-start; gap: 16px;
          padding-bottom: 20px; margin-bottom: 20px;
          border-bottom: 1px solid var(--adm-sidebar-border);
        }
        .cl-av-xl {
          width: 60px; height: 60px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; font-weight: 700; flex-shrink: 0;
          background: linear-gradient(135deg, #0ea5e9, #38bdf8);
          color: #fff; box-shadow: 0 4px 12px rgba(14,165,233,0.3);
        }
        .cl-profile-info { flex: 1; min-width: 0; }
        .cl-profile-name { font-weight: 600; font-size: 1.2rem; margin: 0 0 4px; color: var(--adm-text, #f1f5f9); }
        .cl-profile-email { color: var(--adm-muted); font-size: 0.82rem; }
        .cl-profile-stats {
          display: flex; gap: 20px; margin-left: auto; flex-shrink: 0;
        }
        .cl-stat { text-align: center; }
        .cl-stat__value { font-size: 1.2rem; font-weight: 700; }
        .cl-stat__label { font-size: 0.65rem; color: var(--adm-muted); text-transform: uppercase; letter-spacing: 0.04em; }

        .cl-grid { display: grid; grid-template-columns: 1fr 1fr 220px; gap: 0 20px; align-items: start; }
        @media (max-width: 900px) { .cl-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 720px) { .cl-grid { grid-template-columns: 1fr; } }

        .cl-section {
          display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
        }
        .cl-info-card {
          background: var(--adm-sidebar);
          border: 1px solid var(--adm-sidebar-border);
          border-radius: 8px; margin-bottom: 16px;
        }
        .cl-meta-row {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-bottom: 1px solid var(--adm-sidebar-border);
          font-size: 0.82rem;
        }
        .cl-meta-row:last-child { border-bottom: none; }
        .cl-meta-icon {
          width: 28px; height: 28px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.85rem; flex-shrink: 0;
        }
        .cl-meta-label { color: var(--adm-muted); min-width: 90px; flex-shrink: 0; }
        .cl-meta-value { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cl-meta-value--empty { color: var(--adm-muted); font-weight: 400; font-style: italic; opacity: 0.6; }

        .cl-order-row {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 14px; border-bottom: 1px solid var(--adm-sidebar-border);
        }
        .cl-order-row:last-child { border-bottom: none; }
      `}</style>
    </AdminLayout>
  )
}

export default function ClientsPage() {
  return <Suspense><ClientsPageInner /></Suspense>
}
