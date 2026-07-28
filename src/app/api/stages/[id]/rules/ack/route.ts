import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"

/**
 * POST /api/stages/:id/rules/ack
 * Specialist confirms they've read/downloaded the rules for the stage.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { order: { select: { specialistId: true } } },
  })
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!stage.rulesS3Key) return NextResponse.json({ error: "No rules" }, { status: 409 })
  if (stage.order.specialistId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date()
  await prisma.$executeRaw`
    UPDATE "ProjectStage"
    SET "rulesAckAt" = ${now}, "rulesAckS3Key" = ${stage.rulesS3Key}
    WHERE id = ${stage.id}
  `

  return NextResponse.json({ ok: true, rulesAckAt: now.toISOString(), rulesAckS3Key: stage.rulesS3Key })
}

