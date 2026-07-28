import { NextRequest, NextResponse } from "next/server"
import { StageStatus } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { transition } from "@/lib/stage-machine"

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const stage = await prisma.projectStage.findUnique({ where: { id }, select: { status: true } })
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 })

  /** Доплата за правки → без оплаты вернуть этап дизайнеру (как paymentConfirmed после webhook). */
  const action =
    stage.status === StageStatus.EXTRA_PAYMENT ? "paymentConfirmed" : "stagePaymentConfirmed"

  try {
    const newStatus = await transition(id, action, "ADMIN", undefined, user.id)
    return NextResponse.json({ status: newStatus })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 })
  }
}
