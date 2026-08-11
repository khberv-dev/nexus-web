import type {FileAudience, ReviewerRole, StageStatus, Verdict} from "@prisma/client"

type MinimalReview = {
    reviewerRole: ReviewerRole
    verdict: Verdict
    createdAt: Date
}

type MinimalFile = {
    id: string
    audience: FileAudience
    uploadedAt: Date
}

function fileVisibleMs(f: MinimalFile): number {
    return new Date(f.uploadedAt).getTime()
}

/**
 * Файлы сдачи (SHARED/CLIENT), которые заказчик может видеть и скачивать.
 * Показываем только то, что уже прошло выпуск к клиенту: одобрение модератора (переход в CLIENT_REVIEW).
 *
 * Важно: заказчик должен видеть НЕ "все файлы до последнего одобрения",
 * а только последний выпущенный комплект (последняя волна между modApprove).
 */
export function filterStageFilesVisibleToClient<
    F extends MinimalFile,
    R extends MinimalReview,
>(stage: { status: StageStatus; files: F[]; reviews: R[] }): F[] {
    const nonDesigner = stage.files.filter((f) => f.audience !== "DESIGNER")

    const releaseTimesAsc = stage.reviews
        .filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "APPROVED")
        .map((r) => new Date(r.createdAt).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => a - b)

    const lastReleaseMs = releaseTimesAsc.length > 0 ? releaseTimesAsc[releaseTimesAsc.length - 1]! : null
    const prevReleaseMs =
        releaseTimesAsc.length > 1 ? releaseTimesAsc[releaseTimesAsc.length - 2]! : null

    // Важно: даже если этап “случайно” оказался в CLIENT_REVIEW без записи о релизе (APPROVED модератора),
    // материалы заказчику не показываем. Заказчик видит только то, что явно выпущено администратором.
    if (lastReleaseMs === null) return []

    // Показываем только финальную итерацию внутри последней волны:
    // старт волны = предыдущий релиз (если был), затем сдвигаем старт до последнего REJECTED модератора в пределах волны.
    const waveStartMs = prevReleaseMs ?? Number.NEGATIVE_INFINITY
    const lastModRejectionInWaveMs = stage.reviews
        .filter((r) => r.reviewerRole === "MODERATOR" && r.verdict === "REJECTED")
        .map((r) => new Date(r.createdAt).getTime())
        .filter((t) => Number.isFinite(t) && t > waveStartMs && t <= lastReleaseMs)
        .reduce<number | null>((acc, t) => (acc === null || t > acc ? t : acc), null)

    const visibleStartMs = lastModRejectionInWaveMs ?? waveStartMs

    return nonDesigner.filter((f) => {
        const t = fileVisibleMs(f)
        if (!Number.isFinite(t)) return false
        return t > visibleStartMs && t <= lastReleaseMs
    })
}

export function isStageFileVisibleToClient<
    F extends MinimalFile,
    R extends MinimalReview,
>(stage: { status: StageStatus; files: F[]; reviews: R[] }, fileId: string): boolean {
    const visibleIds = new Set(filterStageFilesVisibleToClient(stage).map((f) => f.id))
    return visibleIds.has(fileId)
}
