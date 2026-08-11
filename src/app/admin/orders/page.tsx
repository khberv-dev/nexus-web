"use client"

import {useCallback, useEffect, useState} from "react"
import {AdminLayout} from "@/components/admin/AdminLayout"
import {useRegisterAdminRefresh} from "@/components/admin/AdminRefreshContext"
import {Modal} from "@/components/ui/modal"
import type {Order, OrderStatus, SpecialistForAssignment} from "./types"
import {OrderList} from "./OrderList"
import {OrderDetail} from "./OrderDetail"
import "./orders.css"

const URL_FILTERS = ["ALL", "DRAFT", "BRIEFING", "BRIEF_REVIEW", "ACTIVE", "DONE", "CANCELLED"] as const

function readInitialFilter(): OrderStatus | "ALL" {
    if (typeof window === "undefined") return "ALL"
    const v = new URL(window.location.href).searchParams.get("filter")
    if (v && (URL_FILTERS as readonly string[]).includes(v)) return v as OrderStatus | "ALL"
    return "ALL"
}

function readInitialSearch(): string {
    if (typeof window === "undefined") return ""
    return new URL(window.location.href).searchParams.get("q") ?? ""
}

/** Выбранный заказ из `?order=` или якоря `#order-<id>`. */
function readInitialOrderId(): string | null {
    if (typeof window === "undefined") return null
    const url = new URL(window.location.href)
    const q = url.searchParams.get("order")
    if (q) return q
    if (url.hash.startsWith("#order-")) {
        const id = url.hash.slice("#order-".length)
        return id || null
    }
    return null
}

function pushOrderToHistory(orderId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set("order", orderId)
    url.hash = `order-${orderId}`
    window.history.pushState(null, "", url.toString())
}

function replaceOrderInUrl(orderId: string | null) {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    const before = `${url.pathname}${url.search}${url.hash}`
    if (orderId) {
        url.searchParams.set("order", orderId)
        url.hash = `order-${orderId}`
    } else {
        url.searchParams.delete("order")
        url.hash = ""
    }
    const after = `${url.pathname}${url.search}${url.hash}`
    if (before !== after) window.history.replaceState(null, "", url.toString())
}

export default function OrdersAdminPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<OrderStatus | "ALL">(readInitialFilter)
    const [search, setSearch] = useState(readInitialSearch)
    const [selected, setSelected] = useState<string | null>(readInitialOrderId)
    const [specialists, setSpecialists] = useState<SpecialistForAssignment[]>([])
    const [assignMap, setAssignMap] = useState<Record<string, string>>({})
    const [assigning, setAssigning] = useState<string | null>(null)
    const [acting, setActing] = useState<string | null>(null)
    const [revisionModal, setRevisionModal] = useState<{ stageId: string; stageName: string } | null>(null)
    const [revisionComment, setRevisionComment] = useState("")
    const [clientRevModal, setClientRevModal] = useState<{
        stageId: string;
        stageName: string;
        action: "accept" | "reject"
    } | null>(null)
    const [clientRevComment, setClientRevComment] = useState("")
    const [extraForm, setExtraForm] = useState<{ stageId: string; stageName: string } | null>(null)
    const [extraAmount, setExtraAmount] = useState("")
    const [extraReason, setExtraReason] = useState("")
    const [briefRejectModal, setBriefRejectModal] = useState<{ orderId: string } | null>(null)
    const [briefRejectComment, setBriefRejectComment] = useState("")

    const setUrlParams = useCallback((next: Record<string, string | null | undefined>, mode: "push" | "replace" = "replace") => {
        if (typeof window === "undefined") return
        const url = new URL(window.location.href)
        for (const [k, v] of Object.entries(next)) {
            if (v == null || v === "") url.searchParams.delete(k)
            else url.searchParams.set(k, v)
        }
        const method = mode === "push" ? window.history.pushState : window.history.replaceState
        method.call(window.history, null, "", url.toString())
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        const [ordRes, specRes] = await Promise.all([fetch("/api/admin/orders"), fetch("/api/admin/specialists")])
        if (ordRes.ok) setOrders(await ordRes.json())
        if (specRes.ok) {
            const all = await specRes.json() as SpecialistForAssignment[]
            setSpecialists(all.filter(s => s.specialistProfile?.onboardingStatus === "ACTIVE"))
        }
        setLoading(false)
    }, [])

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        load()
    }, [load])

    useRegisterAdminRefresh(load)

    const filtered = (filter === "ALL" ? orders : orders.filter(o => o.status === filter))
        .filter(o => {
            if (!search.trim()) return true
            const q = search.toLowerCase()
            const title = o.title ?? o.briefData?.name ?? o.id
            return title.toLowerCase().includes(q) || o.client.email.toLowerCase().includes(q) || (o.specialist?.email ?? "").toLowerCase().includes(q)
        })

    const filteredIdsKey = filtered.map((o) => o.id).join(",")

    // Сохраняем выбранный заказ; синхронизируем `?order=` и `#order-<id>`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (loading) return
        if (!filtered.length) {
            setSelected(null)
            replaceOrderInUrl(null)
            return
        }
        const stillExists = selected !== null && filtered.some((o) => o.id === selected)
        if (stillExists) {
            replaceOrderInUrl(selected)
            return
        }
        const fallback = filtered[0]!.id
        setSelected(fallback)
        replaceOrderInUrl(fallback)
    }, [loading, filteredIdsKey, selected])

    const order = filtered.find(o => o.id === selected) ?? filtered[0] ?? null

    const assign = async (orderId: string) => {
        const specialistId = assignMap[orderId]
        if (!specialistId) return
        setAssigning(orderId)
        await fetch(`/api/admin/orders/${orderId}/assign`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({specialistId})
        })
        await load();
        setAssigning(null)
    }

    const reviewStage = async (stageId: string, action: "modApprove" | "modRevision", stageName: string) => {
        if (action === "modRevision") {
            setRevisionComment("");
            setRevisionModal({stageId, stageName});
            return
        }
        setActing(stageId)
        await fetch(`/api/admin/stages/${stageId}/review`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action})
        })
        await load();
        setActing(null)
    }

    const clientRevision = async (stageId: string, action: "accept" | "reject", stageName: string) => {
        if (action === "reject") {
            setClientRevComment("")
            setClientRevModal({stageId, stageName, action})
            return
        }
        setActing(stageId)
        await fetch(`/api/admin/stages/${stageId}/client-revision`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "accept"}),
        })
        await load()
        setActing(null)
    }

    const submitClientRevReject = async () => {
        if (!clientRevModal || clientRevModal.action !== "reject") return
        setActing(clientRevModal.stageId)
        const stageId = clientRevModal.stageId
        setClientRevModal(null)
        await fetch(`/api/admin/stages/${stageId}/client-revision`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "reject", comment: clientRevComment || undefined}),
        })
        setClientRevComment("")
        await load()
        setActing(null)
    }

    const submitRevision = async () => {
        if (!revisionModal) return
        setActing(revisionModal.stageId);
        setRevisionModal(null)
        await fetch(`/api/admin/stages/${revisionModal.stageId}/review`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "modRevision", comment: revisionComment || undefined})
        })
        setRevisionComment("");
        await load();
        setActing(null)
    }

    const submitExtra = async () => {
        if (!extraForm || !extraAmount) return
        setActing(extraForm.stageId);
        setExtraForm(null)
        await fetch(`/api/admin/payments/${extraForm.stageId}/extra`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                amount: Math.round(Number(extraAmount) * 100),
                reason: extraReason || "Дополнительные правки"
            })
        })
        setExtraAmount("");
        setExtraReason("");
        await load();
        setActing(null)
    }

    const changeStatus = async (orderId: string, status: OrderStatus) => {
        await fetch(`/api/admin/orders/${orderId}/status`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status})
        })
        await load()
    }

    const briefApprove = async (orderId: string) => {
        setActing("brief-approve")
        await fetch(`/api/admin/orders/${orderId}/brief`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "approve"})
        })
        await load();
        setActing(null)
    }

    const briefReject = async (orderId: string) => {
        setBriefRejectComment("")
        setBriefRejectModal({orderId})
    }

    const submitBriefReject = async () => {
        if (!briefRejectModal || !briefRejectComment.trim()) return
        setActing("brief-reject")
        setBriefRejectModal(null)
        await fetch(`/api/admin/orders/${briefRejectModal.orderId}/brief`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "reject", comment: briefRejectComment})
        })
        setBriefRejectComment("")
        await load()
        setActing(null)
    }

    // ==================== Contract actions ====================
    const [contractGenerating, setContractGenerating] = useState<string | null>(null)

    const generateContract = async (orderId: string) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".pdf,application/pdf"
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            if (file.size > 10 * 1024 * 1024) {
                alert("Размер файла не должен превышать 10МБ")
                return
            }
            setContractGenerating(orderId)
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch(`/api/admin/orders/${orderId}/contract/generate`, {
                method: "POST",
                body: formData,
            })
            if (res.ok) {
                await load()
            } else {
                const err = await res.json()
                alert(err.error || "Ошибка генерации договора")
            }
            setContractGenerating(null)
        }
        input.click()
    }

    const sendContractToClient = async (orderId: string) => {
        const res = await fetch(`/api/admin/orders/${orderId}/contract/send-to-client`, {method: "POST"})
        if (res.ok) {
            await load()
        } else {
            const err = await res.json()
            alert(err.error || "Ошибка отправки договора")
        }
    }

    const confirmContract = async (orderId: string) => {
        const res = await fetch(`/api/admin/orders/${orderId}/contract/confirm`, {method: "POST"})
        if (res.ok) {
            await load()
        } else {
            const err = await res.json()
            alert(err.error || "Ошибка подтверждения договора")
        }
    }

    // ==================== Act actions ====================
    const approveAct = async (stageId: string, actId: string) => {
        const res = await fetch(`/api/stages/${stageId}/act/approve`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "approve"}),
        })
        if (res.ok) {
            await load()
        } else {
            const err = await res.json()
            alert(err.error || "Ошибка одобрения акта")
        }
    }

    const rejectAct = async (stageId: string, actId: string, comment: string) => {
        const res = await fetch(`/api/stages/${stageId}/act/approve`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "reject", comment}),
        })
        if (res.ok) {
            await load()
        } else {
            const err = await res.json()
            alert(err.error || "Ошибка отклонения акта")
        }
    }

    const confirmAct = async (stageId: string, actId: string) => {
        const res = await fetch(`/api/stages/${stageId}/act/confirm`, {method: "POST"})
        if (res.ok) {
            await load()
        } else {
            const err = await res.json()
            alert(err.error || "Ошибка подтверждения акта")
        }
    }

    return (
        <AdminLayout noPadding>
            {/* Revision modal */}
            <Modal open={!!revisionModal} onClose={() => setRevisionModal(null)} maxWidth={480}>
                <div style={{padding: "24px 24px 20px"}}>
                    <h5 style={{fontWeight: 600, margin: "0 0 4px"}}>На доработку</h5>
                    <p style={{
                        color: "var(--adm-muted)",
                        fontSize: "0.875rem",
                        margin: "0 0 16px"
                    }}>{revisionModal?.stageName}</p>
                    <textarea className="sp-textarea" rows={4} placeholder="Замечания…" value={revisionComment}
                              onChange={e => setRevisionComment(e.target.value)} autoFocus/>
                    <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                        <button className="sp-btn sp-btn-ghost" onClick={() => setRevisionModal(null)}>Отмена</button>
                        <button className="sp-btn sp-btn-danger" onClick={submitRevision}>Отправить</button>
                    </div>
                </div>
            </Modal>

            {/* Client revision decision modal */}
            <Modal open={!!clientRevModal} onClose={() => setClientRevModal(null)} maxWidth={480}>
                <div style={{padding: "24px 24px 20px"}}>
                    <h5 style={{fontWeight: 600, margin: "0 0 4px"}}>Отклонить правки клиента</h5>
                    <p style={{
                        color: "var(--adm-muted)",
                        fontSize: "0.875rem",
                        margin: "0 0 16px"
                    }}>{clientRevModal?.stageName}</p>
                    <textarea
                        className="sp-textarea"
                        rows={4}
                        placeholder="Причина…"
                        value={clientRevComment}
                        onChange={(e) => setClientRevComment(e.target.value)}
                        autoFocus
                    />
                    <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                        <button className="sp-btn sp-btn-ghost" onClick={() => setClientRevModal(null)}>
                            Отмена
                        </button>
                        <button className="sp-btn sp-btn-danger" onClick={submitClientRevReject}>
                            Отклонить
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Brief reject modal */}
            <Modal open={!!briefRejectModal} onClose={() => setBriefRejectModal(null)} maxWidth={480}>
                <div style={{padding: "24px 24px 20px"}}>
                    <h5 style={{fontWeight: 600, margin: "0 0 4px"}}>Вернуть бриф</h5>
                    <p style={{color: "var(--adm-muted)", fontSize: "0.875rem", margin: "0 0 16px"}}>Укажите причину
                        возврата</p>
                    <textarea className="sp-textarea" rows={4} placeholder="Причина возврата…"
                              value={briefRejectComment} onChange={e => setBriefRejectComment(e.target.value)}
                              autoFocus/>
                    <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                        <button className="sp-btn sp-btn-ghost" onClick={() => setBriefRejectModal(null)}>Отмена
                        </button>
                        <button className="sp-btn sp-btn-danger" onClick={submitBriefReject}
                                disabled={!briefRejectComment.trim()}>Вернуть
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Extra payment modal */}
            <Modal open={!!extraForm} onClose={() => setExtraForm(null)} maxWidth={480}>
                <div style={{padding: "24px 24px 20px"}}>
                    <h5 style={{fontWeight: 600, margin: "0 0 4px"}}>Доплата за правки</h5>
                    <p style={{
                        color: "var(--adm-muted)",
                        fontSize: "0.875rem",
                        margin: "0 0 16px"
                    }}>{extraForm?.stageName}</p>
                    <div style={{marginBottom: 12}}>
                        <label
                            style={{display: "block", fontSize: "0.75rem", color: "var(--adm-muted)", marginBottom: 4}}>Сумма
                            (руб.)</label>
                        <input type="number" className="sp-input" value={extraAmount}
                               onChange={e => setExtraAmount(e.target.value)} placeholder="5000"/>
                    </div>
                    <div style={{marginBottom: 16}}>
                        <label style={{
                            display: "block",
                            fontSize: "0.75rem",
                            color: "var(--adm-muted)",
                            marginBottom: 4
                        }}>Причина</label>
                        <input type="text" className="sp-input" value={extraReason}
                               onChange={e => setExtraReason(e.target.value)} placeholder="Дополнительные правки"/>
                    </div>
                    <div style={{display: "flex", gap: 8, justifyContent: "flex-end"}}>
                        <button className="sp-btn sp-btn-ghost" onClick={() => setExtraForm(null)}>Отмена</button>
                        <button className="sp-btn sp-btn-primary" onClick={submitExtra}
                                disabled={!extraAmount}>Выставить счет
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="sp-wrap">
                <OrderList
                    filtered={filtered} loading={loading}
                    selected={selected} search={search} filter={filter}
                    onSelect={(id) => {
                        setSelected(id)
                        pushOrderToHistory(id)
                    }}
                    onSearch={(q) => {
                        setSearch(q)
                        setUrlParams({q})
                    }}
                    onFilter={(f) => {
                        setFilter(f)
                        setUrlParams({filter: f})
                    }}
                />
                <OrderDetail
                    order={order} specialists={specialists}
                    assignMap={assignMap} assigning={assigning} acting={acting}
                    onAssignMapChange={(oid, sid) => setAssignMap(p => ({...p, [oid]: sid}))}
                    onAssign={assign} onReviewStage={reviewStage}
                    onClientRevision={clientRevision}
                    onExtraPayment={(sid, name) => {
                        setExtraAmount("");
                        setExtraReason("");
                        setExtraForm({stageId: sid, stageName: name})
                    }}
                    onChangeStatus={changeStatus}
                    onBriefApprove={briefApprove} onBriefReject={briefReject}
                    onBriefSaved={load}
                    onResolveHelp={async (orderId) => {
                        setActing("resolve-help")
                        await fetch(`/api/admin/orders/${orderId}/brief`, {
                            method: "PATCH",
                            headers: {"Content-Type": "application/json"},
                            body: JSON.stringify({action: "resolve_help"})
                        })
                        await load()
                        setActing(null)
                    }}
                    onGenerateContract={generateContract}
                    onSendContractToClient={sendContractToClient}
                    onConfirmContract={confirmContract}
                    onApproveAct={approveAct}
                    onRejectAct={rejectAct}
                    onConfirmAct={confirmAct}
                    contractGenerating={contractGenerating}
                />
            </div>
        </AdminLayout>
    )
}
