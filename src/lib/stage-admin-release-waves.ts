/**
 * Разбиение файлов этапа для админки по «волнам выпуска заказчику»
 * (каждое решение модератора APPROVED = выпуск на CLIENT_REVIEW).
 * Внутри волны отдельно показываются замечания модератора и заказчика до этого выпуска.
 */

export type AdminWaveReview = {
  createdAt: string
  comment: string | null
}

export type AdminWaveFile = {
  id: string
  filename: string
  uploadedAt?: string
  /** Fallback времени загрузки (как в GET заказа / SSR). */
  createdAt?: string
  audience?: string
}

export type AdminStageReleaseWave = {
  waveIndex: number
  displayNumber: number
  releasedAt: string
  moderatorRejections: AdminWaveReview[]
  clientRejections: AdminWaveReview[]
  files: AdminWaveFile[]
  /** Разбиение файлов этой волны на итерации между возвратами модератора. */
  bundles?: AdminPendingDraft["bundles"]
  /** Последний выпуск и этап принят заказчиком — итоговый комплект */
  isFinalAcceptedBundle: boolean
  /** Эта волна сейчас на согласовании у заказчика */
  isAtClientReview: boolean
}

export type AdminPendingDraft = {
  moderatorRejections: AdminWaveReview[]
  /** Замечания заказчика после последнего выпуска (CLIENT/REJECTED). */
  clientRejections: AdminWaveReview[]
  files: AdminWaveFile[]
  /** Разбиение файлов на итерации между возвратами модератора. */
  bundles?: Array<{
    bundleIndex: number
    label: string
    /** Если есть — модератор вернул в этот момент, после него началась следующая итерация. */
    moderatorRejectedAt?: string
    /** Комментарий модератора, который закрыл эту итерацию (если был). */
    moderatorRejection?: AdminWaveReview | null
    files: AdminWaveFile[]
  }>
}

function tMs(iso: string): number {
  return new Date(iso).getTime()
}

function fileMs(f: AdminWaveFile): number | null {
  const iso = (f.uploadedAt?.trim() || f.createdAt?.trim() || "").trim()
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

function isClientVisibleFile(f: AdminWaveFile): boolean {
  // DESIGNER files must not be part of "released to client" bundles.
  return String(f.audience ?? "").toUpperCase() !== "DESIGNER"
}

export function buildAdminStageReleaseWaves(stage: {
  status: string
  files: AdminWaveFile[]
  reviews: Array<{ reviewerRole: string; verdict: string; comment: string | null; createdAt: string }>
}): { waves: AdminStageReleaseWave[]; pendingDraft: AdminPendingDraft | null } {
  const releasesAsc = stage.reviews
    .filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "APPROVED")
    .sort((a, b) => tMs(a.createdAt) - tMs(b.createdAt))

  if (releasesAsc.length === 0) {
    const modRej = stage.reviews
      .filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "REJECTED")
      .sort((a, b) => tMs(a.createdAt) - tMs(b.createdAt))
      .map((r) => ({ createdAt: r.createdAt, comment: r.comment }))

    const rejTs = modRej.map((r) => tMs(r.createdAt)).filter((x) => Number.isFinite(x))
    const sortedFiles = [...stage.files].sort((a, b) => (fileMs(a) ?? Number.POSITIVE_INFINITY) - (fileMs(b) ?? Number.POSITIVE_INFINITY))
    const bundles =
      sortedFiles.length === 0
        ? []
        : (() => {
            const boundaries = [...rejTs].sort((a, b) => a - b)
            const out: AdminPendingDraft["bundles"] = []
            let start = Number.NEGATIVE_INFINITY
            for (let i = 0; i < boundaries.length; i++) {
              const end = boundaries[i]!
              const rejection = modRej.find((r) => tMs(r.createdAt) === end) ?? null
              const files = sortedFiles.filter((f) => {
                const ft = fileMs(f)
                if (ft == null) return false
                return ft > start && ft <= end
              })
              if (files.length > 0) {
                out!.push({
                  bundleIndex: out!.length,
                  label: out!.length === 0 ? "Первая загрузка" : `После доработки ${out!.length}`,
                  moderatorRejectedAt: new Date(end).toISOString(),
                  moderatorRejection: rejection,
                  files,
                })
              }
              start = end
            }
            // After last rejection (or everything if no timestamps)
            const tailFiles = sortedFiles.filter((f) => {
              const ft = fileMs(f)
              if (ft == null) return boundaries.length === 0
              const last = boundaries.length > 0 ? boundaries[boundaries.length - 1]! : Number.NEGATIVE_INFINITY
              return ft > last
            })
            if (tailFiles.length > 0) {
              const hasRej = boundaries.length > 0
              out!.push({
                bundleIndex: out!.length,
                label: hasRej ? "Текущая итерация" : "Черновик",
                moderatorRejection: null,
                files: tailFiles,
              })
            }
            // Fallback: if all files had null time, keep single bundle.
            if (out!.length === 0 && sortedFiles.length > 0) {
              out!.push({ bundleIndex: 0, label: boundaries.length > 0 ? "Текущая итерация" : "Черновик", moderatorRejection: null, files: sortedFiles })
            }
            return out
          })()
    const pending =
      stage.files.length > 0 || modRej.length > 0
        ? { moderatorRejections: modRej, clientRejections: [], files: [...stage.files], bundles }
        : null
    return { waves: [], pendingDraft: pending }
  }

  const waves: AdminStageReleaseWave[] = []

  for (let i = 0; i < releasesAsc.length; i++) {
    const prevTs = i === 0 ? null : tMs(releasesAsc[i - 1]!.createdAt)
    const currTs = tMs(releasesAsc[i]!.createdAt)

    const moderatorRejections = stage.reviews
      .filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "REJECTED")
      .filter((r) => {
        const rt = tMs(r.createdAt)
        if (prevTs !== null && rt <= prevTs) return false
        return rt <= currTs
      })
      .sort((a, b) => tMs(a.createdAt) - tMs(b.createdAt))
      .map((r) => ({ createdAt: r.createdAt, comment: r.comment }))

    const clientRejections = stage.reviews
      .filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "REJECTED")
      .filter((r) => {
        const rt = tMs(r.createdAt)
        if (prevTs !== null && rt <= prevTs) return false
        return rt <= currTs
      })
      .sort((a, b) => tMs(a.createdAt) - tMs(b.createdAt))
      .map((r) => ({ createdAt: r.createdAt, comment: r.comment }))

    const filesInWave = stage.files.filter((f) => {
      const ft = fileMs(f)
      if (ft === null) return i === releasesAsc.length - 1
      if (prevTs !== null && ft <= prevTs) return false
      return ft <= currTs
    }).filter(isClientVisibleFile)

    // Split this wave's files into bundles by moderator rejection moments inside the wave.
    const waveBundles =
      filesInWave.length === 0
        ? []
        : (() => {
            const rejTs = moderatorRejections.map((r) => tMs(r.createdAt)).filter((x) => Number.isFinite(x))
            const sortedFiles = [...filesInWave].sort(
              (a, b) => (fileMs(a) ?? Number.POSITIVE_INFINITY) - (fileMs(b) ?? Number.POSITIVE_INFINITY),
            )
            const boundaries = [...rejTs].sort((a, b) => a - b)
            const out: AdminPendingDraft["bundles"] = []

            let start = prevTs ?? Number.NEGATIVE_INFINITY
            for (let i = 0; i < boundaries.length; i++) {
              const end = boundaries[i]!
              const rejection = moderatorRejections.find((r) => tMs(r.createdAt) === end) ?? null
              const files = sortedFiles.filter((f) => {
                const ft = fileMs(f)
                if (ft == null) return false
                return ft > start && ft <= end
              })
              if (files.length > 0) {
                out!.push({
                  bundleIndex: out!.length,
                  label: out!.length === 0 ? "Первая загрузка" : `После доработки ${out!.length}`,
                  moderatorRejectedAt: new Date(end).toISOString(),
                  moderatorRejection: rejection,
                  files,
                })
              }
              start = end
            }

            const tailFiles = sortedFiles.filter((f) => {
              const ft = fileMs(f)
              if (ft == null) return boundaries.length === 0
              const last = boundaries.length > 0 ? boundaries[boundaries.length - 1]! : (prevTs ?? Number.NEGATIVE_INFINITY)
              return ft > last
            })
            if (tailFiles.length > 0) {
              out!.push({
                bundleIndex: out!.length,
                label: boundaries.length > 0 ? "Текущая итерация" : "Выпуск",
                moderatorRejection: null,
                files: tailFiles,
              })
            }

            if (out!.length === 0 && sortedFiles.length > 0) {
              out!.push({
                bundleIndex: 0,
                label: boundaries.length > 0 ? "Текущая итерация" : "Выпуск",
                moderatorRejection: null,
                files: sortedFiles,
              })
            }

            return out
          })()

    const lastIdx = releasesAsc.length - 1
    const isFinalAcceptedBundle = stage.status === "APPROVED" && i === lastIdx
    const isAtClientReview =
      i === lastIdx &&
      (stage.status === "CLIENT_REVIEW" || stage.status === "EXTRA_PAYMENT")

    waves.push({
      waveIndex: i,
      displayNumber: i + 1,
      releasedAt: releasesAsc[i]!.createdAt,
      moderatorRejections,
      clientRejections,
      files: filesInWave,
      bundles: waveBundles,
      isFinalAcceptedBundle,
      isAtClientReview,
    })
  }

  const lastReleaseTs = tMs(releasesAsc[releasesAsc.length - 1]!.createdAt)
  const unreleasedFiles = stage.files.filter((f) => {
    const ft = fileMs(f)
    if (ft === null) return false
    return ft > lastReleaseTs
  })

  const unreleasedModRej = stage.reviews
    .filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "REJECTED")
    .filter((r) => tMs(r.createdAt) > lastReleaseTs)
    .sort((a, b) => tMs(a.createdAt) - tMs(b.createdAt))
    .map((r) => ({ createdAt: r.createdAt, comment: r.comment }))

  const unreleasedClientRej = stage.reviews
    .filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "REJECTED")
    .filter((r) => tMs(r.createdAt) > lastReleaseTs)
    .sort((a, b) => tMs(a.createdAt) - tMs(b.createdAt))
    .map((r) => ({ createdAt: r.createdAt, comment: r.comment }))

  // Same bundles logic for "draft after last release": split unreleased files by moderator rejection timestamps.
  const unreleasedBundles =
    unreleasedFiles.length === 0
      ? []
      : (() => {
          const rejTs = unreleasedModRej.map((r) => tMs(r.createdAt)).filter((x) => Number.isFinite(x))
          const sortedFiles = [...unreleasedFiles].sort(
            (a, b) => (fileMs(a) ?? Number.POSITIVE_INFINITY) - (fileMs(b) ?? Number.POSITIVE_INFINITY),
          )
          const boundaries = [...rejTs].sort((a, b) => a - b)
          const out: AdminPendingDraft["bundles"] = []

          let start = lastReleaseTs
          for (let i = 0; i < boundaries.length; i++) {
            const end = boundaries[i]!
            const rejection = unreleasedModRej.find((r) => tMs(r.createdAt) === end) ?? null
            const files = sortedFiles.filter((f) => {
              const ft = fileMs(f)
              if (ft == null) return false
              return ft > start && ft <= end
            })
            if (files.length > 0) {
              out!.push({
                bundleIndex: out!.length,
                label: out!.length === 0 ? "После выпуска" : `После доработки ${out!.length}`,
                moderatorRejectedAt: new Date(end).toISOString(),
                moderatorRejection: rejection,
                files,
              })
            }
            start = end
          }

          const tailFiles = sortedFiles.filter((f) => {
            const ft = fileMs(f)
            if (ft == null) return boundaries.length === 0
            const last = boundaries.length > 0 ? boundaries[boundaries.length - 1]! : lastReleaseTs
            return ft > last
          })
          if (tailFiles.length > 0) {
            out!.push({
              bundleIndex: out!.length,
              label: boundaries.length > 0 ? "Текущая итерация" : "Черновик",
              moderatorRejection: null,
              files: tailFiles,
            })
          }

          if (out!.length === 0 && sortedFiles.length > 0) {
            out!.push({
              bundleIndex: 0,
              label: boundaries.length > 0 ? "Текущая итерация" : "Черновик",
              moderatorRejection: null,
              files: sortedFiles,
            })
          }

          return out
        })()

  const pendingDraft =
    unreleasedFiles.length > 0 || unreleasedModRej.length > 0 || unreleasedClientRej.length > 0
      ? {
          moderatorRejections: unreleasedModRej,
          clientRejections: unreleasedClientRej,
          files: unreleasedFiles,
          bundles: unreleasedBundles,
        }
      : null

  return { waves, pendingDraft }
}
