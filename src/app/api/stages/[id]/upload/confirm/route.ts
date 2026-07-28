import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { StageStatus } from "@prisma/client"
import { sendEmail } from "@/lib/email"
import { getSessionUser } from "@/lib/session"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (session.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { order: { include: { client: true } } },
  })
  if (!stage || stage.order.specialistId !== user?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const allowed: StageStatus[] = [
    StageStatus.PENDING,
    StageStatus.UPLOADED,
    StageStatus.MOD_REVISION,
    StageStatus.CLIENT_REVISION,
  ]
  if (!allowed.includes(stage.status)) {
    return NextResponse.json(
      { error: stage.status === StageStatus.BLOCKED ? "Этап закрыт до принятия предыдущего" : `Cannot confirm upload in status ${stage.status}` },
      { status: 409 },
    )
  }

  const nextStatus = stage.status === StageStatus.PENDING ? StageStatus.UPLOADED : stage.status
  const updated = await prisma.projectStage.update({ where: { id }, data: { status: nextStatus } })

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true } })
  for (const a of admins) {
    if (a.email) void sendEmail("file_uploaded", a.email, { stageId: id, orderId: stage.orderId })
  }

  return NextResponse.json({ ...updated, status: updated.status })
}
