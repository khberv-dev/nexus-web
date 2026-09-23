"use client"

import {createContext, type ReactNode, useCallback, useContext, useEffect, useState} from "react"
import {useParams, useRouter, useSearchParams} from "next/navigation"
import {useRegisterAdminRefresh} from "@/components/admin/AdminRefreshContext"
import {Modal} from "@/components/ui/modal"
import {BriefEditor} from "@/components/admin/BriefEditor"
import {formatEdoProvidersLabel} from "@/lib/edo-providers"
import {adminClientHref} from "@/lib/admin-routes"
import {replaceQueryParams} from "@/lib/client/url-query"
import type {ClientOrder, RawClient} from "./client-types"
import {userDisplayName} from "@/lib/user-name"
import {Icon} from "@/components/ui/icon"

type ClientsShellContextValue = {
    clients: RawClient[]
    loading: boolean
    reload: () => Promise<void>
    toggleArchive: (userId: string, archived: boolean) => Promise<void>
    openBrief: (order: ClientOrder) => void
}

const ClientsShellContext = createContext<ClientsShellContextValue | null>(null)

export function useClientsShell(): ClientsShellContextValue {
    const value = useContext(ClientsShellContext)
    if (!value) throw new Error("useClientsShell must be used inside ClientsShell")
    return value
}

/**
 * Список заказчиков слева живёт в layout: выбранный заказчик — в пути (/admin/clients/:id),
 * поиск и архив — в query (?q=&archived=1).
 */
export function ClientsShell({children}: { children: ReactNode }) {
    const router = useRouter()
    const params = useParams<{ id?: string }>()
    const searchParams = useSearchParams()
    const selected = params.id ?? null
    const showArchived = searchParams.get("archived") === "1"
    const [search, setSearchState] = useState(() => searchParams.get("q") ?? "")
    const setSearch = (q: string) => {
        setSearchState(q)
        replaceQueryParams({q: q.trim() ? q : null})
    }
    const setShowArchived = (archived: boolean) => replaceQueryParams({archived: archived ? "1" : null})
    const [clients, setClients] = useState<RawClient[]>([])
    const [loading, setLoading] = useState(true)
    const [briefModal, setBriefModal] = useState<ClientOrder | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        const res = await fetch("/api/admin/clients?includeArchived=1")
        if (res.ok) setClients(await res.json())
        setLoading(false)
    }, [])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        load()
    }, [load])

    useRegisterAdminRefresh(load)

    const filtered = clients.filter(c => showArchived ? !!c.archivedAt : !c.archivedAt).filter(c => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return userDisplayName(c).toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    })

    const openClient = (id: string) => router.push(adminClientHref(id, window.location.search), {scroll: false})

    const toggleArchive = async (userId: string, archived: boolean) => {
        await fetch(`/api/admin/users/${userId}/archive`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({archived}),
        })
        await load()
    }

    const contextValue: ClientsShellContextValue = {
        clients,
        loading,
        reload: load,
        toggleArchive,
        openBrief: setBriefModal,
    }

    return (
        <ClientsShellContext.Provider value={contextValue}>
            <div className="cl-wrap">
                {/* ── List ── */}
                <aside className="cl-list">
                    <div className="cl-list-hd">
                        <span className="cl-label">Заказчики</span>
                        <span className="cl-badge">{filtered.length}</span>
                    </div>
                    <div style={{display: "flex", gap: 8, padding: "0 12px 8px"}}>
                        <button
                            type="button"
                            onClick={() => setShowArchived(false)}
                            style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: !showArchived ? "1px solid var(--adm-active-color)" : "1px solid var(--adm-sidebar-border)",
                                background: !showArchived ? "var(--adm-active-bg)" : "transparent",
                                color: !showArchived ? "var(--adm-active-color)" : "var(--adm-muted)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            Активные
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowArchived(true)}
                            style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                border: showArchived ? "1px solid var(--adm-active-color)" : "1px solid var(--adm-sidebar-border)",
                                background: showArchived ? "var(--adm-active-bg)" : "transparent",
                                color: showArchived ? "var(--adm-active-color)" : "var(--adm-muted)",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}
                        >
                            Архив
                        </button>
                    </div>
                    <div className="cl-search">
                        <Icon name="search" className="cl-search-icon"/>
                        <input className="cl-search-input" placeholder="Поиск…" value={search}
                               onChange={e => setSearch(e.target.value)}/>
                    </div>

                    {loading && <div className="cl-empty">Загрузка…</div>}
                    {!loading && filtered.length === 0 && <div className="cl-empty">Заказчиков нет</div>}

                    {!loading && filtered.map(c => {
                        const isOn = c.id === selected
                        const displayName = userDisplayName(c, "?")
                        const cFd = c.clientProfile?.formData
                        const edoLabel = formatEdoProvidersLabel(typeof cFd?.edoProviders === "string" ? cFd.edoProviders : undefined)
                        return (
                            <div key={c.id} role="button" tabIndex={0} onClick={() => openClient(c.id)}
                                 onKeyDown={(e) => {
                                     if (e.key === "Enter" || e.key === " ") {
                                         e.preventDefault();
                                         openClient(c.id)
                                     }
                                 }} className={`cl-card${isOn ? " cl-card--on" : ""}`}>
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
                                        <span style={{fontSize: "0.65rem", color: "#ea5455", fontWeight: 600}}><i
                                            className="bx bx-support" style={{marginRight: 2}}/>Помощь</span>
                                    ) : (
                                        <span
                                            className="cl-card__date">{new Date(c.createdAt).toLocaleDateString("ru-RU")}</span>
                                    )}
                                </div>
                                <div className="cl-card__edo" title={edoLabel || "не указано"}>
                                    <Icon name="transfer-alt"/>
                                    ЭДО: {edoLabel || "—"}
                                </div>
                            </div>
                        )
                    })}
                </aside>

                {/* ── Detail ── */}
                <div className="cl-detail">{children}</div>
            </div>

            <Modal open={!!briefModal} onClose={() => setBriefModal(null)} maxWidth={640}>
                {briefModal && <BriefEditor order={briefModal} onClose={() => setBriefModal(null)} onSaved={load}/>}
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
        </ClientsShellContext.Provider>
    )
}
