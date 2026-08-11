import type {OrderData, OrderStage} from "@/app/orders/[id]/types"

/** GET /api/orders/:id отдаёт Prisma-форму (uploadedAt у файлов), клиентский UI ждёт createdAt и фильтрует модератора / DESIGNER. */
export function normalizeStagesFromOrdersApiPayload(stages: unknown): OrderData["stages"] {
    if (!Array.isArray(stages)) return []
    return stages.map((raw) => {
        const s = raw as OrderStage
        type RawFile = OrderStage["files"][number] & { uploadedAt?: string }
        const files = (s.files ?? [])
            .filter((f) => (f as RawFile).audience !== "DESIGNER")
            .map((f) => {
                const rf = f as RawFile
                const iso = rf.createdAt?.trim() || rf.uploadedAt?.trim() || ""
                return {id: rf.id, filename: rf.filename, audience: rf.audience, createdAt: iso}
            })
        const reviews = (s.reviews ?? []).filter((r) => r.reviewerRole !== "MODERATOR")
        const lastRejected =
            reviews
                .filter((r) => r.reviewerRole === "CLIENT" && r.verdict === "REJECTED")
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt ?? null

        return {
            ...s,
            files,
            reviews,
            lastRejectedAt: lastRejected ?? s.lastRejectedAt ?? null,
        }
    })
}
