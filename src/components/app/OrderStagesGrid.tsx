import Link from "next/link"
import {Badge} from "@/components/ui/badge"
import {Card} from "@/components/ui/card"
import {cn} from "@/lib/utils"
import type {OrderStage, StageType} from "@/app/orders/[id]/types"
import {STAGE_LABEL, STAGE_ORDER} from "@/app/orders/[id]/types"
import {MAX_FREE_CLIENT_REVISIONS} from "@/lib/stage-constants"
import {CheckCircle2, ChevronRight, CircleDot, Lock} from "lucide-react"
import {stageStatusLabelForViewer, type StageStatusViewerRole} from "@/lib/stage-status-ui"

type MiniBadge = { key: string; label: string; variant: "default" | "secondary" | "destructive" | "outline" }

const miniBadgeClass =
    "max-w-[100%] whitespace-normal py-0.5 px-2 leading-snug h-auto min-h-5 text-[0.65rem] font-medium [overflow-wrap:anywhere]"

function formatRubKopecks(k: number | null | undefined): string | null {
    if (k == null || k <= 0) return null
    return `${(k / 100).toLocaleString("ru-RU", {maximumFractionDigits: 0})} ₽`
}

/** Короткие подписи по акту (без договора — договор не показываем в сетке). */
function actMiniBadge(stage: OrderStage): MiniBadge | null {
    const act = stage.act
    if (!act || act.status === "PENDING") return null
    switch (act.status) {
        case "SPECIALIST_UPLOADED":
            return {key: "act", label: "Акт: проверка", variant: "secondary"}
        case "ADMIN_APPROVED":
            return {key: "act", label: "Акт: подпись", variant: "destructive"}
        case "CLIENT_SIGNED":
            return {key: "act", label: "Акт: у админа", variant: "secondary"}
        case "CONFIRMED":
            return {key: "act", label: "Акт ✓", variant: "outline"}
        case "REJECTED":
            return {key: "act", label: "Акт: правки", variant: "destructive"}
        default:
            return null
    }
}

function stageInsightBadges(stage: OrderStage): MiniBadge[] {
    const out: MiniBadge[] = []
    const rub = formatRubKopecks(stage.price ?? null)
    if (rub) out.push({key: "price", label: rub, variant: "outline"})

    if (stage.clientRound > 0) {
        out.push({
            key: "revs",
            label: `Правки ${stage.clientRound}/${MAX_FREE_CLIENT_REVISIONS}`,
            variant: stage.clientRound >= MAX_FREE_CLIENT_REVISIONS ? "destructive" : "secondary",
        })
    }

    const actB = actMiniBadge(stage)
    if (actB) out.push(actB)

    const pendingExtra =
        stage.extraPayments?.filter((e) => e.status === "PENDING").length ?? 0
    if (pendingExtra > 0 || stage.status === "EXTRA_PAYMENT") {
        out.push({key: "extra", label: "Доплата", variant: "destructive"})
    }

    return out
}

function stageStatusLabelForUI(viewerRole: StageStatusViewerRole, type: StageType, status: OrderStage["status"]): string {
    return stageStatusLabelForViewer({viewerRole, stageType: type, status})
}

type Activity =
    | { kind: "none" }
    | { kind: "file"; label: string; at: string }
    | { kind: "review"; label: string; at: string }
    | { kind: "act"; label: string; at: string }

function bestActivity(stage: OrderStage): Activity {
    const candidates: Array<{ at: string; activity: Activity }> = []

    const latestFile = stage.files[0]
    if (latestFile?.createdAt) {
        candidates.push({
            at: latestFile.createdAt,
            activity: {kind: "file", label: latestFile.filename, at: latestFile.createdAt},
        })
    }

    const latestReview = stage.reviews[0]
    if (latestReview?.createdAt) {
        const trimmed = latestReview.comment?.trim()
        const label = trimmed
            ? trimmed.slice(0, 140) + (trimmed.length > 140 ? "…" : "")
            : `Ревью: ${latestReview.verdict}`
        candidates.push({
            at: latestReview.createdAt,
            activity: {kind: "review", label, at: latestReview.createdAt},
        })
    }

    const actAt =
        stage.act?.adminConfirmedAt ??
        stage.act?.clientSignedAt ??
        stage.act?.adminApprovedAt ??
        stage.act?.specialistUploadedAt ??
        stage.act?.generatedAt ??
        null
    if (actAt) {
        candidates.push({
            at: actAt,
            activity: {kind: "act", label: "Акт обновлён", at: actAt},
        })
    }

    if (candidates.length === 0) return {kind: "none"}
    candidates.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    return candidates[0]!.activity
}

function statusBadgeVariant(status: OrderStage["status"]): "default" | "secondary" | "destructive" | "outline" {
    if (status === "APPROVED") return "default"
    if (status === "CLIENT_REVIEW") return "destructive"
    if (status === "MOD_REVISION" || status === "CLIENT_REVISION" || status === "EXTRA_PAYMENT") return "destructive"
    if (status === "UPLOADED" || status === "MOD_REVIEW") return "secondary"
    if (status === "BLOCKED") return "outline"
    return "outline"
}

export function OrderStagesGrid({
                                    orderId,
                                    stages,
                                    activeType,
                                    showHeading = true,
                                    hideLockedStages = false,
                                    className,
                                    /** Если задано — ссылка на этап (напр. кабинет дизайнера: `/work/:id/:stageType`). Иначе — страница этапа заказчика. */
                                    resolveStageHref,
                                    /** Нижний блок с последней активностью и датой (файл / ревью). У заказчика вкл., у дизайнера можно скрыть. */
                                    showActivityFooter = true,
                                    viewerRole = "CLIENT",
                                }: {
    orderId: string
    stages: OrderStage[]
    activeType?: StageType
    showHeading?: boolean
    hideLockedStages?: boolean
    className?: string
    resolveStageHref?: (args: { orderId: string; stageType: StageType; stageId: string }) => string
    showActivityFooter?: boolean
    viewerRole?: StageStatusViewerRole
}) {
    const approved = stages.filter((s) => s.status === "APPROVED").length
    const total = STAGE_ORDER.length

    const stageByType = new Map<StageType, OrderStage>()
    for (const s of stages) stageByType.set(s.type, s)

    return (
        <div className={cn("space-y-4", className)}>
            {showHeading ? (
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="text-sm font-semibold tracking-tight text-foreground">Ход работ</div>
                        <div className="mt-1 text-xs text-muted-foreground">Открывайте этапы по очереди — следующий
                            доступен после принятия предыдущего.
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                        <span className="font-medium tabular-nums text-foreground">{approved}</span>
                        <span>/</span>
                        <span className="tabular-nums">{total}</span>
                        <span className="hidden sm:inline">принято</span>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {STAGE_ORDER.map((type, idx) => {
                    const stage = stageByType.get(type)
                    if (!stage) return null

                    const prevType = idx > 0 ? STAGE_ORDER[idx - 1] : null
                    const prevStage = prevType ? stageByType.get(prevType) : null
                    const sequentialLocked = idx > 0 && prevStage?.status !== "APPROVED"
                    const locked = stage.status === "BLOCKED" || sequentialLocked
                    if (hideLockedStages && locked) return null

                    const statusLabel = stageStatusLabelForUI(viewerRole, type, stage.status)
                    const isDone = stage.status === "APPROVED"
                    const isActive = stage.status !== "PENDING" && stage.status !== "BLOCKED" && stage.status !== "APPROVED"
                    const activity = showActivityFooter ? bestActivity(stage) : ({kind: "none"} as const)
                    const isSelected = activeType === type
                    const insightBadges = !locked ? stageInsightBadges(stage) : []

                    const cardFrame = cn(
                        "group relative flex h-full min-h-0 flex-col overflow-hidden transition-all duration-200",
                        locked && "border-dashed border-muted-foreground/25 bg-muted/25 shadow-none",
                        !locked && isDone && "border-primary/35 bg-primary/[0.06] shadow-sm",
                        !locked && !isDone && isActive && "border-primary/20 shadow-md ring-1 ring-primary/15",
                        !locked && !isDone && !isActive && "border-border shadow-sm",
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )

                    const stageHref =
                        resolveStageHref?.({orderId, stageType: type, stageId: stage.id}) ??
                        `/orders/${orderId}/work/${type}`

                    const indexBadge = cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums shadow-inner",
                        locked && "bg-muted text-muted-foreground",
                        !locked && isDone && "bg-primary/15 text-primary",
                        !locked && !isDone && isActive && "bg-primary/10 text-primary",
                        !locked && !isDone && !isActive && "bg-muted/80 text-muted-foreground",
                    )

                    return (
                        <div key={type} className="flex min-h-[252px] sm:min-h-[272px] lg:min-h-[288px]">
                            <Card className={cn(cardFrame, "h-full w-full")}>
                                {locked ? (
                                    <div
                                        className="flex h-full min-h-[inherit] flex-col gap-2 p-5"
                                        aria-label={`Этап заблокирован: ${STAGE_LABEL[type]}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className={indexBadge}>{idx + 1}</div>
                                            <Lock className="size-5 shrink-0 text-muted-foreground/80" aria-hidden/>
                                        </div>
                                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                                            <p className="text-left text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere] line-clamp-4">
                                                {STAGE_LABEL[type]}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                <Badge variant="outline"
                                                       className={cn(miniBadgeClass, "text-muted-foreground")}>
                                                    Закрыто
                                                </Badge>
                                                <Badge variant="outline" className={miniBadgeClass}>
                                                    Ждёт предыдущий этап
                                                </Badge>
                                            </div>
                                            <p className="mt-auto text-left text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                                                Сначала примите предыдущий этап — затем откроется этот.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <Link
                                        href={stageHref}
                                        aria-label={`Открыть этап: ${STAGE_LABEL[type]}`}
                                        className={cn(
                                            "flex h-full min-h-[inherit] flex-col gap-2 p-5 outline-none transition-colors",
                                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                            "hover:bg-muted/35 active:bg-muted/50",
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className={indexBadge}>{idx + 1}</div>
                                            {isDone ? (
                                                <CheckCircle2 className="size-6 shrink-0 text-primary" aria-hidden/>
                                            ) : isActive ? (
                                                <CircleDot className="size-6 shrink-0 text-primary" strokeWidth={2}
                                                           aria-hidden/>
                                            ) : (
                                                <ChevronRight
                                                    className="size-5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
                                                    aria-hidden/>
                                            )}
                                        </div>

                                        <div className="flex min-h-0 flex-1 flex-col gap-3 text-left">
                                            <p className="line-clamp-4 text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
                                                {STAGE_LABEL[type]}
                                            </p>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Badge
                                                        variant={statusBadgeVariant(stage.status)}
                                                        className="max-w-full whitespace-normal py-1 text-left text-[0.72rem] font-medium leading-snug"
                                                    >
                                                        {statusLabel}
                                                    </Badge>
                                                </div>
                                                {insightBadges.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1" aria-label="Детали этапа">
                                                        {insightBadges.map((b) => (
                                                            <Badge key={b.key} variant={b.variant}
                                                                   className={miniBadgeClass}>
                                                                {b.label}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>

                                        {showActivityFooter ? (
                                            <div
                                                className="mt-auto flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-end sm:justify-between">
                                                <p className="min-w-0 flex-1 text-left text-[0.75rem] leading-relaxed text-muted-foreground [overflow-wrap:anywhere] line-clamp-4">
                                                    {activity.kind === "none" ? "Пока без действий" : activity.label}
                                                </p>
                                                <div
                                                    className="flex shrink-0 items-center justify-end gap-1.5 sm:flex-col sm:items-end sm:justify-center">
                                                    {activity.kind !== "none" ? (
                                                        <span
                                                            className="tabular-nums text-[0.7rem] text-muted-foreground">
                              {new Date(activity.at).toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit"})}
                            </span>
                                                    ) : null}
                                                    <ChevronRight
                                                        className="size-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5"
                                                        aria-hidden/>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-auto flex justify-end pt-2">
                                                <ChevronRight
                                                    className="size-4 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5"
                                                    aria-hidden/>
                                            </div>
                                        )}
                                    </Link>
                                )}
                            </Card>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
