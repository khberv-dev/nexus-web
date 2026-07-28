"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { LandingUploaderLayout } from "./landing-uploader/LandingUploaderLayout"
import { LandingUploaderStyles } from "./landing-uploader/LandingUploaderStyles"
import { ConfirmDialog } from "./ConfirmDialog"
import { uploadFile, getPreviewUrl, getImageDimensions } from "./landing-uploader/api"
import { PORTRAIT_MIN_W, PORTRAIT_MIN_H, WORK_MIN_W, WORK_MIN_H, MAX_LANDING_PORTFOLIO } from "./landing-uploader/constants"
import type { LandingFile, LandingUploaderProps, PreviewState } from "./landing-uploader/types"

type SelectableCategory = "LANDING_WORK" | "PORTRAIT" | "INTRO_VIDEO"

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
  createdAt: string
  updatedAt: string
  items: { id: string; fileId: string; position: number }[]
}

const STATUS_LABEL: Record<Bundle["status"], string> = {
  DRAFT: "Черновик",
  PENDING_REVIEW: "На модерации",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
}

const STATUS_COLOR: Record<Bundle["status"], string> = {
  DRAFT: "#8f95b2",
  PENDING_REVIEW: "#ff9f43",
  APPROVED: "#28c76f",
  REJECTED: "#ea5455",
}

export default function LandingUploader({ featuredOnLanding, initialWorkPos, specialty, about, onReadinessChange }: LandingUploaderProps) {
  // --- bundles ---
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null)
  const activeBundle = bundles.find((b) => b.id === activeBundleId) ?? null

  const isEditable = activeBundle?.status === "DRAFT" || activeBundle?.status === "REJECTED"

  // --- files (same as before) ---
  const [portraitFiles, setPortraitFiles] = useState<LandingFile[]>([])
  const [portraitUrls, setPortraitUrls] = useState<Record<string, string>>({})
  const [selectedPortraitId, setSelectedPortraitId] = useState<string | null>(null)
  const portraitRef = useRef<HTMLInputElement>(null)

  const [workFiles, setWorkFiles] = useState<LandingFile[]>([])
  const [workUrls, setWorkUrls] = useState<Record<string, string>>({})
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [workPos, setWorkPos] = useState(initialWorkPos ?? "center center")
  const workRef = useRef<HTMLInputElement>(null)

  const [bundleSpecialty, setBundleSpecialty] = useState(specialty ?? "")
  const [bundleAbout, setBundleAbout] = useState(about ?? "")

  const [introVideoFiles, setIntroVideoFiles] = useState<LandingFile[]>([])
  const [introVideoUrls, setIntroVideoUrls] = useState<Record<string, string>>({})
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const videoRef = useRef<HTMLInputElement>(null)

  const [portfolioFiles, setPortfolioFiles] = useState<LandingFile[]>([])
  const [portfolioUrls, setPortfolioUrls] = useState<Record<string, string>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [uploading, setUploading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDeleteBundleId, setConfirmDeleteBundleId] = useState<string | null>(null)
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState>(null)

  const showToast = (msg: string) => setToast(msg)

  const safeFetch = async (url: string) => {
    const r = await fetch(url)
    if (!r.ok) return []
    return r.json()
  }

  const resolveUrls = async (files: LandingFile[]) => {
    const urls: Record<string, string> = {}
    await Promise.all(files.map(async (f) => { urls[f.id] = await getPreviewUrl(f.id) }))
    return urls
  }

  // --- load bundles ---
  const loadBundles = useCallback(async () => {
    const res = await fetch("/api/specialist/landing-bundle")
    if (!res.ok) return
    const data: Bundle[] = await res.json()
    setBundles(data)
    if (!activeBundleId && data.length > 0) {
      setActiveBundleId(data[0].id)
    }
  }, [activeBundleId])

  // --- load files ---
  const loadFiles = useCallback(async () => {
    const portraits: LandingFile[] = await safeFetch("/api/files?category=PORTRAIT")
    setPortraitFiles(portraits)
    setPortraitUrls(await resolveUrls(portraits))

    const works: LandingFile[] = await safeFetch("/api/files?category=LANDING_WORK")
    setWorkFiles(works)
    setWorkUrls(await resolveUrls(works))

    const videos: LandingFile[] = await safeFetch("/api/files?category=INTRO_VIDEO")
    setIntroVideoFiles(videos)
    setIntroVideoUrls(await resolveUrls(videos))

    const pf: LandingFile[] = await safeFetch("/api/files?category=PORTFOLIO")
    setPortfolioFiles(pf)
    const portfolioImageFiles = pf.filter((f) => f.mimeType?.startsWith("image/"))
    setPortfolioUrls(await resolveUrls(portfolioImageFiles))
  }, [])

  // sync bundle → selected state
  useEffect(() => {
    if (!activeBundle) return
    setSelectedPortraitId(activeBundle.portraitFileId)
    setSelectedWorkId(activeBundle.workFileId)
    setSelectedVideoId(activeBundle.videoFileId)
    setWorkPos(activeBundle.workPos ?? "center center")
    setBundleSpecialty(activeBundle.specialty ?? specialty ?? "")
    setBundleAbout(activeBundle.about ?? about ?? "")
    setSelectedIds(new Set(activeBundle.items.map((i) => i.fileId)))
  }, [activeBundle?.id, activeBundle?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBundles(); loadFiles() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  // --- bundle CRUD ---
  const patchBundle = async (data: Record<string, unknown>) => {
    if (!activeBundleId || !isEditable) return
    const res = await fetch(`/api/specialist/landing-bundle/${activeBundleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated: Bundle = await res.json()
      setBundles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    }
  }

  const createBundle = async () => {
    const res = await fetch("/api/specialist/landing-bundle", { method: "POST" })
    if (res.ok) {
      const bundle: Bundle = await res.json()
      setBundles((prev) => [bundle, ...prev])
      setActiveBundleId(bundle.id)
    } else {
      const err = await res.json().catch(() => null)
      showToast(err?.error ?? "Ошибка создания сборки")
    }
  }

  const deleteBundle = async (id: string) => {
    const res = await fetch(`/api/specialist/landing-bundle/${id}`, { method: "DELETE" })
    if (res.ok) {
      setBundles((prev) => prev.filter((b) => b.id !== id))
      if (activeBundleId === id) setActiveBundleId(bundles.find((b) => b.id !== id)?.id ?? null)
    }
  }

  const submitBundle = async () => {
    if (!activeBundleId) return
    const res = await fetch(`/api/specialist/landing-bundle/${activeBundleId}/submit`, { method: "POST" })
    if (res.ok) {
      const updated: Bundle = await res.json()
      setBundles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      showToast("Сборка отправлена на модерацию")
    } else {
      const err = await res.json()
      showToast(err.error ?? "Ошибка отправки")
    }
  }

  // --- file handlers (upload + patch bundle) ---
  const handlePortrait = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isEditable) return
    try {
      const { w, h } = await getImageDimensions(file)
      if (w < PORTRAIT_MIN_W || h < PORTRAIT_MIN_H) throw new Error(`Минимум ${PORTRAIT_MIN_W}x${PORTRAIT_MIN_H}px (у вас ${w}x${h})`)
      if (w > h) throw new Error("Нужна вертикальная фотография (высота > ширины)")
      setUploading("portrait")
      const saved = await uploadFile(file, "PORTRAIT")
      setPortraitFiles((prev) => [saved, ...prev])
      setPortraitUrls((prev) => ({ ...prev, [saved.id]: URL.createObjectURL(file) }))
      setSelectedPortraitId(saved.id)
      await patchBundle({ portraitFileId: saved.id })
    } catch (err) { showToast((err as Error).message) }
    finally { setUploading(null); if (portraitRef.current) portraitRef.current.value = "" }
  }

  const handleWork = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isEditable) return
    try {
      const { w, h } = await getImageDimensions(file)
      if (w < WORK_MIN_W || h < WORK_MIN_H) throw new Error(`Минимум ${WORK_MIN_W}x${WORK_MIN_H}px (у вас ${w}x${h})`)
      if (h > w) throw new Error("Нужна горизонтальная фотография (ширина > высоты)")
      setUploading("work")
      const saved = await uploadFile(file, "LANDING_WORK")
      setWorkFiles((prev) => [saved, ...prev])
      setWorkUrls((prev) => ({ ...prev, [saved.id]: URL.createObjectURL(file) }))
      setSelectedWorkId(saved.id)
      await patchBundle({ workFileId: saved.id })
    } catch (err) { showToast((err as Error).message) }
    finally { setUploading(null); if (workRef.current) workRef.current.value = "" }
  }

  const handleVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !isEditable) return
    try {
      if (!file.type.startsWith("video/")) throw new Error("Нужен видеофайл")
      if (file.size > 100 * 1024 * 1024) throw new Error("Максимум 100 МБ")
      setUploading("video")
      const saved = await uploadFile(file, "INTRO_VIDEO")
      setIntroVideoFiles((prev) => [saved, ...prev])
      setIntroVideoUrls((prev) => ({ ...prev, [saved.id]: URL.createObjectURL(file) }))
      setSelectedVideoId(saved.id)
      await patchBundle({ videoFileId: saved.id })
    } catch (err) { showToast((err as Error).message) }
    finally { setUploading(null); if (videoRef.current) videoRef.current.value = "" }
  }

  const saveWorkPos = async (pos: string) => {
    if (!isEditable) return
    setWorkPos(pos)
    await patchBundle({ workPos: pos })
  }

  const selectPortrait = async (id: string) => { if (!isEditable) return; setSelectedPortraitId(id); await patchBundle({ portraitFileId: id }) }
  const selectVideo = async (id: string) => { if (!isEditable) return; setSelectedVideoId(id); await patchBundle({ videoFileId: id }) }
  const selectWork = async (id: string) => { if (!isEditable) return; setSelectedWorkId(id); await patchBundle({ workFileId: id }) }

  const togglePortfolio = async (id: string) => {
    if (!isEditable) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else {
      if (next.size >= MAX_LANDING_PORTFOLIO) return
      const file = portfolioFiles.find((f) => f.id === id)
      if (!file?.mimeType?.startsWith("image/")) return
      next.add(id)
    }
    setSelectedIds(next)
    await patchBundle({ portfolioFileIds: Array.from(next) })
  }

  const handleDeleteFile = async (id: string) => {
    if (!isEditable) return
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" })
    if (!res.ok) { showToast("Ошибка удаления"); return }

    // Remove from all file lists
    setPortraitFiles((prev) => prev.filter((f) => f.id !== id))
    setWorkFiles((prev) => prev.filter((f) => f.id !== id))
    setIntroVideoFiles((prev) => prev.filter((f) => f.id !== id))
    setPortfolioFiles((prev) => prev.filter((f) => f.id !== id))

    // Clear selection in bundle if deleted file was selected
    const updates: Record<string, unknown> = {}
    if (selectedPortraitId === id) { setSelectedPortraitId(null); updates.portraitFileId = null }
    if (selectedWorkId === id) { setSelectedWorkId(null); updates.workFileId = null }
    if (selectedVideoId === id) { setSelectedVideoId(null); updates.videoFileId = null }
    if (selectedIds.has(id)) {
      const next = new Set(selectedIds)
      next.delete(id)
      setSelectedIds(next)
      updates.portfolioFileIds = Array.from(next)
    }
    if (Object.keys(updates).length > 0) await patchBundle(updates)
  }

  // --- readiness ---
  useEffect(() => {
    onReadinessChange?.({
      portrait: portraitFiles.length > 0,
      work: workFiles.length > 0,
      video: introVideoFiles.length > 0,
      portfolio: selectedIds.size,
      specialty: !!specialty?.trim(),
      about: !!about?.trim(),
    })
  }, [portraitFiles.length, workFiles.length, introVideoFiles.length, selectedIds.size, specialty, about, onReadinessChange])

  // --- bundle sidebar ---
  const canCreate = !bundles.some((b) => b.status === "DRAFT" || b.status === "PENDING_REVIEW")

  const bundleSidebar = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>Сборки</span>
        {canCreate && bundles.length > 0 && (
          <button
            onClick={createBundle}
            style={{
              border: "1px solid rgba(91,79,207,0.35)", background: "rgba(91,79,207,0.1)",
              color: "#5b4fcf", borderRadius: 8, padding: "6px 14px", fontSize: "0.78rem",
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <i className="bx bx-plus" />Новая сборка
          </button>
        )}
      </div>

      {bundles.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <i className="bx bx-globe" style={{ fontSize: 40, color: "var(--dash-muted, #8f95b2)", opacity: 0.4, display: "block", marginBottom: 12 }} />
          <p style={{ fontSize: "0.85rem", color: "var(--dash-muted, #8f95b2)", margin: "0 0 16px" }}>
            Нет сборок для лендинга
          </p>
          {canCreate && (
            <button
              onClick={createBundle}
              style={{
                border: "none", background: "#5b4fcf", color: "#fff",
                borderRadius: 10, padding: "12px 28px", fontSize: "0.9rem",
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <i className="bx bx-plus-circle" style={{ fontSize: "1.1rem" }} />
              Создать первую сборку
            </button>
          )}
        </div>
      )}

      {bundles.map((b) => {
        const active = b.id === activeBundleId
        return (
          <div
            key={b.id}
            onClick={() => setActiveBundleId(b.id)}
            style={{
              padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: active ? "1px solid rgba(91,79,207,0.4)" : "1px solid var(--dash-border, rgba(255,255,255,0.1))",
              background: active ? "rgba(91,79,207,0.08)" : "transparent",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: "0.76rem", fontWeight: 600 }}>
                {new Date(b.createdAt).toLocaleDateString("ru-RU")}
              </span>
              <span style={{ fontSize: "0.65rem", color: STATUS_COLOR[b.status], fontWeight: 500 }}>
                {STATUS_LABEL[b.status]}
              </span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--dash-muted, #8f95b2)" }}>
              {[b.portraitFileId && "портрет", b.workFileId && "интерьер", b.videoFileId && "видео", b.items.length > 0 && `${b.items.length} фото`]
                .filter(Boolean).join(" · ") || "пустая"}
            </div>
            {(b.status === "DRAFT" || b.status === "REJECTED") && (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteBundleId(b.id) }}
                style={{
                  marginTop: 6, border: "none", background: "none", color: "#d64c67",
                  fontSize: "0.65rem", cursor: "pointer", padding: 0,
                }}
              >
                <i className="bx bx-trash" style={{ marginRight: 2 }} />Удалить
              </button>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      {bundleSidebar}

      {activeBundle && (
        <div style={{ marginTop: 12 }}>
          {/* Reject reason */}
          {activeBundle.status === "REJECTED" && activeBundle.rejectReason && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 12,
              background: "rgba(234,84,85,0.08)", border: "1px solid rgba(234,84,85,0.2)",
              fontSize: "0.8rem", color: "#ea5455",
            }}>
              <i className="bx bx-error-circle" style={{ marginRight: 6 }} />
              <strong>Причина отказа:</strong> {activeBundle.rejectReason}
            </div>
          )}

          {/* Lock banner */}
          {!isEditable && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 12,
              background: "rgba(91,79,207,0.06)", border: "1px solid rgba(91,79,207,0.15)",
              fontSize: "0.8rem", color: "#5b4fcf",
            }}>
              <i className="bx bx-lock-alt" style={{ marginRight: 6 }} />
              {activeBundle.status === "PENDING_REVIEW" ? "Сборка на модерации — редактирование заблокировано" : "Сборка одобрена — создайте новую для изменений"}
            </div>
          )}

          <LandingUploaderLayout
            featuredOnLanding={featuredOnLanding}
            error={null}
            uploading={isEditable ? uploading : null}
            portraitFiles={portraitFiles}
            portraitUrls={portraitUrls}
            selectedPortraitId={selectedPortraitId}
            introVideoFiles={introVideoFiles}
            introVideoUrls={introVideoUrls}
            selectedVideoId={selectedVideoId}
            workFiles={workFiles}
            workUrls={workUrls}
            selectedWorkId={selectedWorkId}
            workPos={workPos}
            portfolioFiles={portfolioFiles}
            portfolioUrls={portfolioUrls}
            selectedIds={selectedIds}
            preview={preview}
            portraitRef={portraitRef}
            videoRef={videoRef}
            workRef={workRef}
            onPortraitChange={handlePortrait}
            onVideoChange={handleVideo}
            onWorkChange={handleWork}
            onSaveWorkPos={saveWorkPos}
            onSelectPortrait={selectPortrait}
            onSelectVideo={selectVideo}
            onSelectLandingWork={selectWork}
            onTogglePortfolio={togglePortfolio}
            onSetPreview={setPreview}
            onDeleteFile={(id) => setConfirmDeleteFileId(id)}
            disabled={!isEditable}
          />

          {/* Specialty & About for landing */}
          {isEditable && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--dash-muted, #8f95b2)", marginBottom: 4 }}>Специализация (на лендинге)</label>
                <input
                  type="text"
                  value={bundleSpecialty}
                  onChange={(e) => setBundleSpecialty(e.target.value)}
                  onBlur={() => patchBundle({ specialty: bundleSpecialty || null })}
                  placeholder="Минимализм · Сканди"
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--dash-border, rgba(255,255,255,0.1))", background: "var(--dash-surface2, rgba(32,29,29,0.015))", color: "var(--dash-text, #f3f5ff)", fontSize: "0.82rem", fontFamily: "inherit", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "var(--dash-muted, #8f95b2)", marginBottom: 4 }}>О себе (на лендинге)</label>
                <textarea
                  rows={2}
                  value={bundleAbout}
                  onChange={(e) => setBundleAbout(e.target.value)}
                  onBlur={() => patchBundle({ about: bundleAbout || null })}
                  placeholder="Краткое описание для карточки на главной"
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--dash-border, rgba(255,255,255,0.1))", background: "var(--dash-surface2, rgba(32,29,29,0.015))", color: "var(--dash-text, #f3f5ff)", fontSize: "0.82rem", fontFamily: "inherit", outline: "none", resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {/* Submit button */}
          {isEditable && (
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button
                onClick={submitBundle}
                disabled={!selectedPortraitId || !selectedWorkId}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: selectedPortraitId && selectedWorkId ? "#5b4fcf" : "rgba(91,79,207,0.2)",
                  color: "#fff", fontSize: "0.8rem", fontWeight: 600,
                }}
              >
                <i className="bx bx-send" style={{ marginRight: 4 }} />
                Отправить на модерацию
              </button>
              <button
                onClick={() => activeBundleId && setConfirmDeleteBundleId(activeBundleId)}
                style={{
                  padding: "8px 18px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid rgba(214,76,103,0.3)", background: "rgba(214,76,103,0.08)",
                  color: "#d64c67", fontSize: "0.8rem", fontWeight: 600,
                }}
              >
                <i className="bx bx-trash" style={{ marginRight: 4 }} />
                Удалить сборку
              </button>
            </div>
          )}
        </div>
      )}

      <LandingUploaderStyles />

      <ConfirmDialog
        open={!!confirmDeleteBundleId}
        title="Удалить сборку?"
        message="Сборка будет удалена без возможности восстановления."
        onConfirm={() => { if (confirmDeleteBundleId) { deleteBundle(confirmDeleteBundleId); setConfirmDeleteBundleId(null) } }}
        onCancel={() => setConfirmDeleteBundleId(null)}
      />
      <ConfirmDialog
        open={!!confirmDeleteFileId}
        title="Удалить файл?"
        message="Файл будет удален без возможности восстановления."
        onConfirm={() => { if (confirmDeleteFileId) { handleDeleteFile(confirmDeleteFileId); setConfirmDeleteFileId(null) } }}
        onCancel={() => setConfirmDeleteFileId(null)}
      />

      {toast && (
        <div style={{
          position: "fixed", right: 20, bottom: 20, zIndex: 1200, maxWidth: 360,
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(234,84,85,0.14)", border: "1px solid rgba(234,84,85,0.34)",
          color: "#ffb5b6", fontSize: 13, backdropFilter: "blur(8px)",
        }}>
          {toast}
        </div>
      )}
    </>
  )
}
