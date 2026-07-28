import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"

/** Упрощённое подписание без PDF; заказчик не допускается — только `/act/client-sign` после проверки админа. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: stageId } = await params

  const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const stage = await prisma.projectStage.findUnique({
    where: { id: stageId },
    include: { order: true, act: true },
  })
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 })
  if (!stage.act) return NextResponse.json({ error: "Act not generated yet" }, { status: 404 })
  if (stage.status !== "APPROVED") return NextResponse.json({ error: "Stage not approved" }, { status: 409 })

  const isClient = stage.order.clientId === dbUser.id
  const isSpecialist = stage.order.specialistId === dbUser.id
  if (!isClient && !isSpecialist && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (isClient) {
    return NextResponse.json(
      { error: "Подписание заказчиком — только загрузкой PDF после проверки администратора" },
      { status: 403 },
    )
  }

  if (stage.act.signedAt) {
    return NextResponse.json({ error: "Act already signed" }, { status: 409 })
  }

  const updated = await prisma.stageAct.update({
    where: { id: stage.act.id },
    data: { signedAt: new Date(), signedById: dbUser.id },
  })

  return NextResponse.json(updated)
}
