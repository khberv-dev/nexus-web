"use client"

import { useState, useEffect, useCallback } from "react"
import { ImageLightbox } from "@/components/ui/ImageLightbox"

interface BundleItem { id: string; fileId: string; position: number }
interface Bundle {
  id: string
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED"
  portraitFileId: string | null
  workFileId: string | null
  workPos: string | null
  videoFileId: string | null
  specialty: string | null
  about: string | null
  rejectReason: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  user: { id: string; name: string | null; email: string | null }
  items: BundleItem[]
}

const STATUS_LABEL: Record<Bundle["status"], string> = {
  DRAFT: "Черновик", PENDING_REVIEW: "На модерации", APPROVED: "Одобрена", REJECTED: "Отклонена",
}
const STATUS_CLASS: Record<Bundle["status"], string> = {
  DRAFT: "bg-label-secondary", PENDING_REVIEW: "bg-label-warning", APPROVED: "bg-label-success", REJECTED: "bg-label-danger",
}

type Filter = "ALL" | Bundle["status"]

export default function LandingBundlesClient() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("PENDING_REVIEW")
  const [selected, setSelected] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [rejectReason, setRejectReason] = useState("")
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const q = filter === "ALL" ? "" : `?status=${filter}`
    const res = await fetch(`/api/admin/landing-bundles${q}`)
    if (res.ok) setBundles(await res.json())
    setLoading(false)
  }, [filter])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const selectedBundle = bundles.find(b => b.id === selected) ?? null

  // Load preview URLs for selected bundle
  useEffect(() => {
    if (!selectedBundle) return
    const fileIds = [
      selectedBundle.portraitFileId,
      selectedBundle.workFileId,
      selectedBundle.videoFileId,
      ...selectedBundle.items.map(i => i.fileId),
    ].filter(Boolean) as string[]

    fileIds.forEach(async (fid) => {
      if (previews[fid]) return
      try {
        const r = await fetch(`/api/admin/files/${fid}/url`)
        if (r.ok) {
          const { url } = await r.json()
          if (url) setPreviews(p => ({ ...p, [fid]: url }))
        }
      } catch { }
    })
  }, [selectedBundle]) // eslint-disable-line react-hooks/exhaustive-deps

  const review = async (action: "approve" | "reject") => {
    if (!selected) return
    if (action === "reject" && !rejectReason.trim()) { alert("Укажите причину отказа"); return }
    setActing(true)
    const res = await fetch(`/api/admin/landing-bundles/${selected}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: rejectReason.trim() || undefined }),
    })
    if (res.ok) {
      setSelected(null)
      setRejectReason("")
      await load()
    } else {
      const err = await res.json().catch(() => null)
      alert(err?.error ?? "Ошибка")
    }
    setActing(false)
  }

  const filters: { value: Filter; label: string }[] = [
    { value: "PENDING_REVIEW", label: "На модерации" },
    { value: "APPROVED", label: "Одобренные" },
    { value: "REJECTED", label: "Отклоненные" },
    { value: "ALL", label: "Все" },
  ]

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0 fw-semibold">Сборки для лендинга</h5>
        <div className="d-flex gap-1">
          {filters.map(f => (
            <button key={f.value} onClick={() => { setFilter(f.value); setSelected(null) }}
              className={`btn btn-sm ${filter === f.value ? "btn-primary" : "btn-outline-secondary"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">Загрузка...</div>
      ) : bundles.length === 0 ? (
        <div className="text-center py-5 text-muted">Нет сборок</div>
      ) : (
        <div className="row g-3">
          {/* List */}
          <div className={selected ? "col-md-5" : "col-12"}>
            <div className="card">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th style={{ fontSize: "0.78rem" }}>Специалист</th>
                      <th style={{ fontSize: "0.78rem" }}>Статус</th>
                      <th style={{ fontSize: "0.78rem" }}>Содержимое</th>
                      <th style={{ fontSize: "0.78rem" }}>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.map(b => (
                      <tr key={b.id} role="button" tabIndex={0} onClick={() => { setSelected(b.id); setRejectReason("") }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(b.id); setRejectReason("") } }}
                        style={{ cursor: "pointer", background: selected === b.id ? "var(--adm-active-bg, rgba(99,102,241,0.06))" : undefined }}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: "0.82rem" }}>{b.user.name ?? b.user.email}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--adm-muted)" }}>{b.user.email}</div>
                        </td>
                        <td><span className={`badge ${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                        <td style={{ fontSize: "0.75rem", color: "var(--adm-muted)" }}>
                          {[b.portraitFileId && "портрет", b.workFileId && "интерьер", b.videoFileId && "видео", b.items.length > 0 && `${b.items.length} фото`]
                            .filter(Boolean).join(", ") || "—"}
                        </td>
                        <td style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>{new Date(b.updatedAt).toLocaleDateString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Detail */}
          {selectedBundle && (
            <div className="col-md-7">
              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <span className="fw-semibold" style={{ fontSize: "0.88rem" }}>
                    {selectedBundle.user.name ?? selectedBundle.user.email}
                  </span>
                  <span className={`badge ${STATUS_CLASS[selectedBundle.status]}`}>{STATUS_LABEL[selectedBundle.status]}</span>
                </div>
                <div className="card-body">
                  {/* Reject reason */}
                  {selectedBundle.status === "REJECTED" && selectedBundle.rejectReason && (
                    <div className="alert alert-warning py-2 px-3 mb-3" style={{ fontSize: "0.8rem" }}>
                      <strong>Причина отказа:</strong> {selectedBundle.rejectReason}
                    </div>
                  )}

                  {/* Preview grid */}
                  <div className="row g-2 mb-3">
                    {/* Portrait */}
                    <div className="col-4">
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>ПОРТРЕТ</div>
                      <div style={{ aspectRatio: "3/4", borderRadius: 8, overflow: "hidden", background: "rgba(99,102,241,0.06)", border: "1px solid var(--adm-sidebar-border, #e5e7eb)" }}>
                        {selectedBundle.portraitFileId && previews[selectedBundle.portraitFileId]
                          ? <ImageLightbox src={previews[selectedBundle.portraitFileId]} alt="Портрет"><img src={previews[selectedBundle.portraitFileId]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></ImageLightbox>
                          : <div className="d-flex align-items-center justify-content-center h-100 text-muted"><i className="bx bx-user" style={{ fontSize: 28 }} /></div>}
                      </div>
                    </div>
                    {/* Work */}
                    <div className="col-8">
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>ФОТО ИНТЕРЬЕРА</div>
                      <div style={{ aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", background: "rgba(99,102,241,0.06)", border: "1px solid var(--adm-sidebar-border, #e5e7eb)", position: "relative" }}>
                        {selectedBundle.workFileId && previews[selectedBundle.workFileId]
                          ? <ImageLightbox src={previews[selectedBundle.workFileId]} alt="Интерьер"><img src={previews[selectedBundle.workFileId]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: selectedBundle.workPos ?? "center center" }} /></ImageLightbox>
                          : <div className="d-flex align-items-center justify-content-center h-100 text-muted"><i className="bx bx-image" style={{ fontSize: 28 }} /></div>}
                        {selectedBundle.workPos && (
                          <span style={{ position: "absolute", bottom: 4, right: 4, fontSize: "0.6rem", background: "rgba(0,0,0,0.5)", color: "#fff", padding: "1px 6px", borderRadius: 4 }}>
                            {selectedBundle.workPos}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Video */}
                  {selectedBundle.videoFileId && (
                    <div className="mb-3">
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>ВИДЕО-ВИЗИТКА</div>
                      {previews[selectedBundle.videoFileId]
                        ? <video src={previews[selectedBundle.videoFileId]} controls playsInline preload="metadata" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} />
                        : <span className="text-muted" style={{ fontSize: "0.8rem" }}>Загрузка...</span>}
                    </div>
                  )}

                  {/* Portfolio */}
                  {selectedBundle.items.length > 0 && (
                    <div className="mb-3">
                      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>ПОРТФОЛИО ({selectedBundle.items.length})</div>
                      <div className="d-flex gap-2 flex-wrap">
                        {selectedBundle.items.map(item => (
                          <div key={item.id} style={{ width: 80, height: 60, borderRadius: 6, overflow: "hidden", background: "rgba(99,102,241,0.06)", border: "1px solid var(--adm-sidebar-border, #e5e7eb)" }}>
                            {previews[item.fileId]
                              ? <ImageLightbox src={previews[item.fileId]} alt="Портфолио"><img src={previews[item.fileId]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></ImageLightbox>
                              : <div className="d-flex align-items-center justify-content-center h-100 text-muted" style={{ fontSize: 14 }}><i className="bx bx-image" /></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="mb-3" style={{ fontSize: "0.8rem" }}>
                    {selectedBundle.specialty && <div><span className="text-muted">Специализация:</span> {selectedBundle.specialty}</div>}
                    {selectedBundle.about && <div><span className="text-muted">О себе:</span> {selectedBundle.about}</div>}
                  </div>

                  {/* Actions */}
                  {selectedBundle.status === "PENDING_REVIEW" && (
                    <div className="border-top pt-3">
                      <div className="mb-2">
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          placeholder="Причина отказа (обязательно при отклонении)"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                        />
                      </div>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-success" onClick={() => review("approve")} disabled={acting}>
                          <i className="bx bx-check" /> Одобрить
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => review("reject")} disabled={acting}>
                          <i className="bx bx-x" /> Отклонить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
