"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { AdminLayout } from "@/components/admin/AdminLayout"
import { useRegisterAdminRefresh } from "@/components/admin/AdminRefreshContext"
import { StatusBadge } from "@/components/app/AppCard"
import {
  ONBOARDING_STATUS_LABEL,
  ONBOARDING_STATUS_VARIANT,
  type OnboardingStatus,
} from "@/components/app/SpecialistCard"
import { TestAnswersModal } from "./components/TestAnswersModal"
import { SpecialistDetail, type SpecialistOnboardingAdminAction } from "./components/SpecialistDetail"
import { formatEdoProvidersLabel } from "@/lib/edo-providers"
import type { RawSpecialist, SpecialistDetailTab, SpecialistOrder, TestModalData } from "./types"
import { SPECIALISTS_STYLES } from "./styles"

function SpecialistsPageInner() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("highlight")
  const [specialists, setSpecialists] = useState<RawSpecialist[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OnboardingStatus | "ALL">("ALL")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string | null>(highlightId)
  const [acting, setActing] = useState<string | null>(null)
  const [ratingUpdating, setRatingUpdating] = useState(false)
  const [detailTab, setDetailTab] = useState<SpecialistDetailTab>("main")
  const [testModal, setTestModal] = useState<TestModalData | null>(null)
  const [specOrders, setSpecOrders] = useState<SpecialistOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({})
  const [showArchived, setShowArchived] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/specialists?includeArchived=1")
    if (!res.ok) return
    const data: RawSpecialist[] = await res.json()
    setSpecialists(data)

    const avatarFiles = data
      .map((s) => ({ userId: s.id, fileId: s.files.find((f) => f.category === "AVATAR")?.id }))
      .filter((x): x is { userId: string; fileId: string } => !!x.fileId)
    const urls: Record<string, string> = {}
    await Promise.all(avatarFiles.map(async ({ userId, fileId }) => {
      try {
        const r = await fetch(`/api/admin/files/${fileId}/url`)
        if (r.ok) {
          const { url } = await r.json()
          urls[userId] = url
        }
      } catch {}
    }))
    setAvatarUrls((prev) => ({ ...prev, ...urls }))
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  const refreshAll = useCallback(async () => {
    await load()
    if (detailTab === "orders" && selected) {
      setOrdersLoading(true)
      try {
        const r = await fetch("/api/admin/orders")
        const all = (r.ok ? await r.json() : []) as (SpecialistOrder & {
          specialist: { id: string } | null
        })[]
        setSpecOrders(all.filter((o) => o.specialist?.id === selected))
      } finally {
        setOrdersLoading(false)
      }
    }
  }, [load, detailTab, selected])

  useRegisterAdminRefresh(refreshAll)

  const act = async (userId: string, action: SpecialistOnboardingAdminAction) => {
    setActing(userId + action)
    try {
      const res = await fetch(`/api/admin/specialists/${userId}/onboarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(String(res.status))
      await load()
    } catch {
      toast.error("Не удалось выполнить действие. Попробуйте ещё раз.")
    } finally {
      setActing(null)
    }
  }

  const updateProfile = async (userId: string, patch: { rating?: number; featuredOnLanding?: boolean }) => {
    setRatingUpdating(true)
    try {
      const res = await fetch(`/api/admin/specialists/${userId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(String(res.status))
      await load()
    } catch {
      toast.error("Не удалось обновить профиль.")
    } finally {
      setRatingUpdating(false)
    }
  }

  const toggleArchive = async (userId: string, archived: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      })
      if (!res.ok) throw new Error(String(res.status))
      await refreshAll()
    } catch {
      toast.error(archived ? "Не удалось архивировать пользователя." : "Не удалось восстановить пользователя.")
    }
  }

  const revokeSession = async (userId: string) => {
    setActing(userId + "revoke-session")
    try {
      const res = await fetch(`/api/admin/users/${userId}/revoke-session`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ошибка при отзыве сессий" }))
        alert(typeof err.error === "string" ? err.error : "Ошибка при отзыве сессий")
      } else {
        alert("Сессии отозваны. Специалист будет перенаправлен на вход при следующем обращении.")
      }
    } finally {
      setActing(null)
    }
  }

  const filtered = (filter === "ALL"
    ? specialists
    : specialists.filter((s) => (s.specialistProfile?.onboardingStatus ?? "PENDING") === filter)
  )
    .filter((s) => (showArchived ? !!s.archivedAt : !s.archivedAt))
    .filter((s) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const fd = s.specialistProfile?.formData
      const name = fd?.fullName ?? s.name ?? ""
      return name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (fd?.city ?? "").toLowerCase().includes(q)
    })

  const selectedSpec = filtered.find((s) => s.id === selected) ?? filtered[0] ?? null

  useEffect(() => {
    setSelected(filtered[0]?.id ?? null)
    setDetailTab("main")
    setSpecOrders([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, showArchived])

  useEffect(() => {
    if (detailTab !== "orders" || !selectedSpec) return
    let cancelled = false
    setOrdersLoading(true)
    fetch("/api/admin/orders")
      .then((r) => (r.ok ? r.json() : []))
      .then((all: {
        id: string
        status: string
        title: string | null
        briefData: Record<string, string> | null
        specialist: { id: string } | null
        client: { email: string; name: string | null }
      }[]) => {
        if (!cancelled) setSpecOrders(all.filter((o) => o.specialist?.id === selectedSpec.id))
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailTab, selectedSpec])

  const sp = selectedSpec

  return (
    <AdminLayout noPadding>
      <TestAnswersModal testModal={testModal} onClose={() => setTestModal(null)} />

      <div className="sp-wrap">
        <aside className="sp-list">
          <div className="sp-list-hd">
            <span className="sp-label">Специалисты</span>
            <span className="sp-badge">{filtered.length}</span>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 12px 8px" }}>
            <button
              type="button"
              className={`sp-filter-btn${!showArchived ? " sp-filter-btn--on" : ""}`}
              onClick={() => setShowArchived(false)}
            >
              Активные
            </button>
            <button
              type="button"
              className={`sp-filter-btn${showArchived ? " sp-filter-btn--on" : ""}`}
              onClick={() => setShowArchived(true)}
            >
              Архив
            </button>
          </div>
          <div className="sp-search">
            <i className="bx bx-search sp-search-icon" />
            <input
              type="text"
              className="sp-search-input"
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sp-filters">
            {([
              { value: "ALL", label: "Все" },
              { value: "PENDING", label: "Анкета" },
              { value: "TEST_INVITED", label: "Квалификационный тест" },
              { value: "INTERVIEW_INVITED", label: "Интервью" },
              { value: "ACTIVE", label: "Активен" },
              { value: "REJECTED", label: "Отклонен" },
            ] as { value: OnboardingStatus | "ALL"; label: string }[]).map((f) => (
              <button
                key={f.value}
                className={`sp-filter-btn${filter === f.value ? " sp-filter-btn--on" : ""}`}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading && <div className="sp-empty">Загрузка...</div>}
          {!loading && filtered.length === 0 && <div className="sp-empty">Нет специалистов</div>}

          {!loading && filtered.map((s) => {
            const status = s.specialistProfile?.onboardingStatus ?? "PENDING"
            const fd = s.specialistProfile?.formData
            const displayName = fd?.fullName ?? s.name ?? s.email
            const isActive = selected === s.id || (!selected && s === filtered[0])
            const rating = s.specialistProfile?.rating
            const edoLabel = formatEdoProvidersLabel(typeof fd?.edoProviders === "string" ? fd.edoProviders : undefined)

            return (
              <button
                type="button"
                key={s.id}
                onClick={() => {
                  setSelected(s.id)
                  setDetailTab("main")
                }}
                className={`sp-user-card${isActive ? " sp-user-card--on" : ""}`}
              >
                <div className="sp-user-card__top">
                  <div
                    className="sp-user-card__av"
                    style={{
                      background: avatarUrls[s.id]
                        ? undefined
                        : isActive
                          ? "linear-gradient(135deg, var(--adm-active-color), #a78bfa)"
                          : "var(--adm-active-bg)",
                      color: isActive ? "#fff" : "var(--adm-active-color)",
                    }}
                  >
                    {avatarUrls[s.id]
                      ? <img src={avatarUrls[s.id]} alt="" className="sp-user-card__av-img" />
                      : displayName[0].toUpperCase()}
                  </div>
                  <span className="sp-user-card__name">{displayName}</span>
                </div>
                <div className="sp-user-card__bottom">
                  <StatusBadge variant={ONBOARDING_STATUS_VARIANT[status]} label={ONBOARDING_STATUS_LABEL[status]} />
                  <span className="sp-user-card__extra">
                    {s.archivedAt ? "В архиве" : rating ? `★ ${rating.toFixed(1)}` : fd?.city ?? ""}
                  </span>
                </div>
                {s.phone && (
                  <div className="sp-user-card__edo" title={s.phone}>
                    <i className="bx bx-phone" />
                    {s.phone}
                  </div>
                )}
                <div className="sp-user-card__edo" title={edoLabel || "не указано"}>
                  <i className="bx bx-transfer-alt" />
                  ЭДО: {edoLabel || "—"}
                </div>
              </button>
            )
          })}
        </aside>

        <div className="sp-detail">
          <SpecialistDetail
            specialist={sp}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            acting={acting}
            ratingUpdating={ratingUpdating}
            ordersLoading={ordersLoading}
            specOrders={specOrders}
            onAct={act}
            onUpdateProfile={updateProfile}
            onToggleArchive={toggleArchive}
            onRevokeSession={revokeSession}
            setTestModal={setTestModal}
            avatarUrl={sp ? avatarUrls[sp.id] : null}
            onRefresh={refreshAll}
          />
        </div>
      </div>

      <style>{SPECIALISTS_STYLES}</style>
    </AdminLayout>
  )
}

export default function SpecialistsPage() {
  return <Suspense><SpecialistsPageInner /></Suspense>
}
