import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { FileAudience, ReviewerRole } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { filterStageFilesVisibleToClient } from "@/lib/client-stage-file-visibility"

const STAGE_ACT_ACTIONS = ["act_admin_approved", "act_admin_rejected", "act_client_signed", "act_confirmed"] as const

/** Visible audit rows for full order timeline (client/specialist). */
const CLIENT_HISTORY_OR: Prisma.AuditLogWhereInput[] = [
  { entity: "Order", action: { in: ["brief_updated", "brief_submitted", "specialist_assigned", "order_status_changed", "framework_contract_admin_signed"] } },
  {
    entity: "Contract",
    action: { in: ["contract_generated", "contract_specialist_signed", "contract_sent_to_client", "contract_client_signed", "contract_confirmed"] },
  },
  { entity: "StageAct", action: { in: [...STAGE_ACT_ACTIONS] } },
]

function parseLimit(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : 15
  if (!Number.isFinite(n)) return 15
  return Math.min(50, Math.max(1, n))
}

type Anchor =
  | { kind: "hash"; hash: string }
  | { kind: "path"; path: string; hash?: string }

type StageTimelineCursor = { sortAt: number; id: string }

function encodeStageCursor(c: StageTimelineCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url")
}

function decodeStageCursor(raw: string | null): StageTimelineCursor | null {
  if (!raw) return null
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8")
    const o = JSON.parse(json) as { sortAt?: number; id?: string }
    if (typeof o.sortAt !== "number" || typeof o.id !== "string") return null
    return { sortAt: o.sortAt, id: o.id }
  } catch {
    return null
  }
}

type UnifiedStageItem = {
  id: string
  sortAt: number
  action: string
  entity: string
  createdAt: Date
  changes: Record<string, { from?: unknown; to?: unknown }> | null
  user: { name: string | null; email: string; role: string } | null
}

function reviewAction(reviewerRole: string, verdict: string): string {
  if (reviewerRole === "MODERATOR") {
    return verdict === "APPROVED" ? "stage_mod_passed" : "stage_mod_revision"
  }
  return verdict === "APPROVED" ? "stage_client_approved" : "stage_client_revision"
}

/** История этапа: файлы + отзывы + аудит акта — без этого лента пуста до акта.
 * Для заказчика скрываем внутреннюю линию модератор↔дизайнер (отзывы модератора, файлы только для дизайнера).
 * Загрузки до выпуска модератором не попадают в ленту заказчика. */
async function buildStageTimelineItems(
  stageId: string,
  anchor: Anchor,
  limit: number,
  cursorDecoded: StageTimelineCursor | null,
  hideModeratorDesignerThread: boolean,
) {
  let files: { id: string; filename: string; uploadedAt: Date; audience: FileAudience }[]
  let reviews: { id: string; reviewerRole: ReviewerRole; verdict: string; comment: string | null; createdAt: Date }[]

  const actIdRows = await prisma.stageAct.findMany({
    where: { stageId },
    select: { id: true },
  })

  if (hideModeratorDesignerThread) {
    const stage = await prisma.projectStage.findUnique({
      where: { id: stageId },
      select: {
        status: true,
        files: {
          where: { audience: { not: FileAudience.DESIGNER } },
          select: { id: true, filename: true, uploadedAt: true, audience: true },
          orderBy: { uploadedAt: "desc" },
        },
        reviews: {
          select: { id: true, reviewerRole: true, verdict: true, comment: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })
    if (!stage) {
      files = []
      reviews = []
    } else {
      const visible = filterStageFilesVisibleToClient({
        status: stage.status,
        files: stage.files,
        reviews: stage.reviews,
      })
      files = visible.map((f) => ({
        id: f.id,
        filename: f.filename,
        uploadedAt: f.uploadedAt,
        audience: f.audience,
      }))
      reviews = stage.reviews.filter((r) => r.reviewerRole === ReviewerRole.CLIENT)
    }
  } else {
    const [f, r] = await Promise.all([
      prisma.stageFile.findMany({
        where: { stageId },
        select: { id: true, filename: true, uploadedAt: true, audience: true },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.stageReview.findMany({
        where: { stageId },
        select: { id: true, reviewerRole: true, verdict: true, comment: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ])
    files = f
    reviews = r
  }

  const fileIds = files.map(f => f.id)

  const [auditLogs, fileMarkupAudits] = await Promise.all([
    actIdRows.length === 0
      ? Promise.resolve([])
      : prisma.auditLog.findMany({
          where: {
            entity: "StageAct",
            entityId: { in: actIdRows.map(a => a.id) },
            action: { in: [...STAGE_ACT_ACTIONS] },
          },
          include: { user: { select: { name: true, email: true, role: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
    fileIds.length === 0
      ? Promise.resolve([])
      : prisma.auditLog.findMany({
          where: {
            entity: "StageFile",
            entityId: { in: fileIds },
            action: "stage_file_annotations_saved",
          },
          include: { user: { select: { name: true, email: true, role: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
  ])

  const unified: UnifiedStageItem[] = []

  for (const f of files) {
    const t = f.uploadedAt.getTime()
    unified.push({
      id: `file:${f.id}`,
      sortAt: t,
      action: "stage_file_uploaded",
      entity: "StageFile",
      createdAt: f.uploadedAt,
      changes: {
        filename: { to: f.filename },
        ...(f.audience ? { audience: { to: String(f.audience) } } : {}),
      },
      user: null,
    })
  }

  for (const r of reviews) {
    const t = r.createdAt.getTime()
    const ch: Record<string, { from?: unknown; to?: unknown }> = {
      verdict: { to: r.verdict },
      reviewer: { to: r.reviewerRole === "MODERATOR" ? "Модератор" : "Заказчик" },
    }
    if (r.comment) ch.comment = { to: r.comment }
    unified.push({
      id: `review:${r.id}`,
      sortAt: t,
      action: reviewAction(r.reviewerRole, r.verdict),
      entity: "StageReview",
      createdAt: r.createdAt,
      changes: ch,
      user: null,
    })
  }

  for (const log of auditLogs) {
    const t = log.createdAt.getTime()
    unified.push({
      id: `audit:${log.id}`,
      sortAt: t,
      action: log.action,
      entity: log.entity,
      createdAt: log.createdAt,
      changes: (log.changes && typeof log.changes === "object" && !Array.isArray(log.changes)
        ? (log.changes as Record<string, { from?: unknown; to?: unknown }>)
        : null),
      user: log.user
        ? {
            name: log.user.name,
            email: log.user.email ?? "",
            role: String(log.user.role),
          }
        : null,
    })
  }

  for (const log of fileMarkupAudits) {
    const t = log.createdAt.getTime()
    unified.push({
      id: `file_markup:${log.id}`,
      sortAt: t,
      action: log.action,
      entity: log.entity,
      createdAt: log.createdAt,
      changes: (log.changes && typeof log.changes === "object" && !Array.isArray(log.changes)
        ? (log.changes as Record<string, { from?: unknown; to?: unknown }>)
        : null),
      user: log.user
        ? {
            name: log.user.name,
            email: log.user.email ?? "",
            role: String(log.user.role),
          }
        : null,
    })
  }

  unified.sort((a, b) => {
    if (b.sortAt !== a.sortAt) return b.sortAt - a.sortAt
    return b.id.localeCompare(a.id)
  })

  let start = 0
  if (cursorDecoded) {
    const idx = unified.findIndex(r => r.sortAt === cursorDecoded.sortAt && r.id === cursorDecoded.id)
    start = idx >= 0 ? idx + 1 : 0
  }

  const window = unified.slice(start, start + limit + 1)
  const rowsOut = window.slice(0, limit)
  const items = rowsOut.map(r => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    createdAt: r.createdAt,
    changes: r.changes,
    user: r.user,
    anchor,
  }))

  const lastRow = rowsOut[rowsOut.length - 1] ?? null
  const hasMore = window.length > limit
  const nextCursor =
    hasMore && lastRow ? encodeStageCursor({ sortAt: lastRow.sortAt, id: lastRow.id }) : null

  return { items, nextCursor }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id: orderId } = await params

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, specialistId: true, deletedAt: true },
  })
  if (!order || order.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (user.role === "CLIENT" && order.clientId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (user.role === "SPECIALIST" && order.specialistId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (user.role !== "CLIENT" && user.role !== "SPECIALIST") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"))
  const cursorId = req.nextUrl.searchParams.get("cursor")
  const stageIdParam = req.nextUrl.searchParams.get("stageId")

  /** Stage-scoped: файлы этапа + отзывы + аудит акта (объединённая лента). */
  if (stageIdParam) {
    const stage = await prisma.projectStage.findFirst({
      where: { id: stageIdParam, orderId },
      select: { id: true },
    })
    if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 })

    const stageCursor = decodeStageCursor(req.nextUrl.searchParams.get("cursor"))
    const anchor: Anchor = { kind: "hash", hash: `#stage-${stageIdParam}` }

    const { items, nextCursor } = await buildStageTimelineItems(
      stageIdParam,
      anchor,
      limit,
      stageCursor,
      user.role === "CLIENT",
    )

    return NextResponse.json({ items, nextCursor })
  }

  let cursorCreatedAt: Date | undefined
  if (cursorId) {
    const c = await prisma.auditLog.findUnique({ where: { id: cursorId }, select: { createdAt: true } })
    if (c) cursorCreatedAt = c.createdAt
  }

  const cursorClause: Prisma.AuditLogWhereInput[] =
    cursorCreatedAt && cursorId
      ? [
          {
            OR: [
              { createdAt: { lt: cursorCreatedAt } },
              { AND: [{ createdAt: cursorCreatedAt }, { id: { lt: cursorId } }] },
            ],
          },
        ]
      : []

  const [contracts, stageActs] = await Promise.all([
    prisma.contract.findMany({ where: { orderId }, select: { id: true } }),
    prisma.stageAct.findMany({
      where: { stage: { orderId } },
      select: { id: true },
    }),
  ])
  const contractIds = contracts.map(c => c.id)
  const stageActIds = stageActs.map(a => a.id)

  const scopeOr: Prisma.AuditLogWhereInput[] = [{ entity: "Order", entityId: orderId }]
  if (contractIds.length) scopeOr.push({ entity: "Contract", entityId: { in: contractIds } })
  if (stageActIds.length) scopeOr.push({ entity: "StageAct", entityId: { in: stageActIds } })

  const where: Prisma.AuditLogWhereInput = {
    AND: [{ OR: CLIENT_HISTORY_OR }, ...cursorClause, { OR: scopeOr }],
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { user: { select: { name: true, email: true, role: true } } },
  })

  const page = rows.slice(0, limit)
  const nextCursor = rows.length > limit ? page[page.length - 1]?.id ?? null : null

  const actIdsOnPage = page.filter(l => l.entity === "StageAct").map(l => l.entityId)
  let actStageMap: Record<string, string> = {}
  if (actIdsOnPage.length) {
    const actsResolved = await prisma.stageAct.findMany({
      where: { id: { in: actIdsOnPage }, stage: { orderId } },
      select: { id: true, stageId: true },
    })
    actStageMap = Object.fromEntries(actsResolved.map(a => [a.id, a.stageId]))
  }

  function anchorFor(log: (typeof page)[0]): Anchor | null {
    if (log.entity === "StageAct") {
      const sid = actStageMap[log.entityId]
      if (sid) return { kind: "path", path: `/orders/${orderId}`, hash: `#order-act-${sid}` }
      return null
    }
    if (log.entity === "Order") {
      const a = log.action
      if (a === "brief_updated" || a === "brief_submitted") return { kind: "path", path: `/orders/${orderId}`, hash: "#order-brief" }
      if (a === "specialist_assigned" || a === "order_status_changed") return { kind: "path", path: `/orders/${orderId}`, hash: "#order-brief" }
      if (a === "framework_contract_admin_signed") return { kind: "path", path: `/orders/${orderId}`, hash: "#order-contract" }
      return null
    }
    if (log.entity === "Contract") {
      return { kind: "path", path: `/orders/${orderId}`, hash: "#order-contract" }
    }
    return null
  }

  const items = page.map(log => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    createdAt: log.createdAt,
    changes: log.changes,
    user: log.user
      ? {
          name: log.user.name,
          email: log.user.email ?? "",
          role: String(log.user.role),
        }
      : null,
    anchor: anchorFor(log),
  }))

  return NextResponse.json({ items, nextCursor })
}
