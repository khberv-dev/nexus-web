import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { ActStatus } from "@prisma/client"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { stageLabelRu } from "@/lib/stage-labels"

/**
 * POST /api/stages/[id]/act/approve
 * Администратор проверяет акт дизайнера и отправляет заказчику на подписание
 * Тело запроса: { action: "approve" | "reject", comment?: string }
 * Ответ: { act: StageAct }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: stageId } = await params
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as { action: string; comment?: string }
  const { action, comment } = body

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action. Use 'approve' or 'reject'" }, { status: 400 })
  }

  const stage = await prisma.projectStage.findUnique({
    where: { id: stageId },
    include: { 
      order: { include: { client: true } },
      act: true
    },
  })
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 })
  }

  const act = stage.act
  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 })
  }

  // Проверяем, что акт загружен дизайнером
  if (act.status !== ActStatus.SPECIALIST_UPLOADED) {
    return NextResponse.json(
      { 
        error: "Act must be uploaded by specialist first",
        currentStatus: act.status
      },
      { status: 409 }
    )
  }

  const now = new Date()
  
  if (action === "approve") {
    // Админapproved акта
    const updatedAct = await prisma.stageAct.update({
      where: { id: act.id },
      data: {
        status: ActStatus.ADMIN_APPROVED,
        adminApprovedAt: now,
      },
    })

    // Аудит
    await audit(user.id, "act_admin_approved", "StageAct", act.id, {
      status: { from: ActStatus.SPECIALIST_UPLOADED, to: ActStatus.ADMIN_APPROVED }
    })

    // Уведомление заказчику
    void notify(
      stage.order.clientId,
      "act_ready_for_signature",
      "Акт готов для подписания",
      `Администратор проверил акт по этапу ${stageLabelRu(stage.type)}. Скачайте, подпишите и загрузите скан.`,
      `/orders/${stage.order.id}`
    )

    return NextResponse.json({
      act: updatedAct,
      message: "Акт проверен и отправлен заказчику для подписания"
    })
  }

  // action === "reject"
  const updatedAct = await prisma.stageAct.update({
    where: { id: act.id },
    data: {
      status: ActStatus.REJECTED,
      adminApprovedAt: now,
    },
  })

  // Аудит
  await audit(user.id, "act_admin_rejected", "StageAct", act.id, {
    status: { from: ActStatus.SPECIALIST_UPLOADED, to: ActStatus.REJECTED },
    ...(comment ? { comment: { to: comment } } : {}),
  })

  // Уведомление дизайнеру
  void notify(
    stage.order.specialistId!,
    "act_rejected",
    "Акт требует доработки",
    `Администратор вернул акт по этапу ${stageLabelRu(stage.type)} на доработку.${comment ? ` Комментарий: "${comment}"` : ""}`,
    `/work/${stage.order.id}`
  )

  return NextResponse.json({
    act: updatedAct,
    message: "Акт отправлен на доработку"
  })
}
