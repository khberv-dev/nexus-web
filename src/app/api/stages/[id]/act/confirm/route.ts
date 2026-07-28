import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { ActStatus, StageStatus } from "@prisma/client"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { stageLabelRu } from "@/lib/stage-labels"
import { syncStageSequentialLocks } from "@/lib/stage-sequencing"

/**
 * POST /api/stages/[id]/act/confirm
 * Администратор подтверждает акт (финальный шаг)
 * После этого активируется оплата следующего этапа
 * Ответ: { act: StageAct, stage: ProjectStage }
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: stageId } = await params
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const stage = await prisma.projectStage.findUnique({
    where: { id: stageId },
    include: {
      order: {
        include: {
          client: true,
          specialist: true,
          stages: { orderBy: { type: "asc" } },
        },
      },
      act: true,
      payment: true,
    },
  })
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 })
  }

  const act = stage.act
  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 })
  }

  // Проверяем, что акт подписан заказчиком
  if (act.status !== ActStatus.CLIENT_SIGNED) {
    return NextResponse.json(
      { 
        error: "Act must be signed by client first",
        currentStatus: act.status
      },
      { status: 409 }
    )
  }

  if (!act.clientActS3Key) {
    return NextResponse.json(
      { error: "Client signed act file is missing" },
      { status: 400 }
    )
  }

  const now = new Date()
  
  // Обновляем акт
  const updatedAct = await prisma.stageAct.update({
    where: { id: act.id },
    data: {
      status: ActStatus.CONFIRMED,
      adminConfirmedAt: now,
      // Обновляем legacy поле для обратной совместимости
      signedAt: now,
      signedById: user.id,
    },
  })

  // В новой схеме: оплата только перед первым этапом (CONCEPT).
  // Переход к следующему этапу управляется фактом APPROVED предыдущего этапа и правилами UI/процесса.
  const stageIndex = stage.order.stages.findIndex(s => s.id === stageId)
  const nextStage = stage.order.stages[stageIndex + 1]

  // После подтверждения акта админом можно открыть следующий этап (если цепочка позволяет).
  await syncStageSequentialLocks(stage.orderId)

  // Аудит
  await audit(user.id, "act_confirmed", "StageAct", act.id, {
    status: { from: ActStatus.CLIENT_SIGNED, to: ActStatus.CONFIRMED },
    ...(nextStage?.id ? { nextStageId: { to: nextStage.id } } : {}),
  })

  // Уведомления
  void notify(
    stage.order.specialistId!,
    "act_confirmed",
    "Акт подтвержден",
    `Акт по этапу ${stageLabelRu(stage.type)} (заказ #${stage.order.id}) подтвержден.${nextStage ? ` Следующий этап: "${stageLabelRu(nextStage.type)}".` : " Работа над этапом завершена."}`,
    `/work/${stage.order.id}`
  )
  
  void notify(
    stage.order.clientId,
    "act_confirmed",
    "Акт подтвержден",
    `Акт по этапу ${stageLabelRu(stage.type)} (заказ #${stage.order.id}) подтвержден.${nextStage ? ` Теперь доступен следующий этап "${stageLabelRu(nextStage.type)}".` : " Работа над заказом завершена."}`,
    `/orders/${stage.order.id}`
  )

  return NextResponse.json({
    act: updatedAct,
    stage: {
      ...stage,
      act: updatedAct,
    },
    nextStage,
    message: nextStage 
      ? `Акт подтвержден. Следующий этап "${stageLabelRu(nextStage.type)}".`
      : "Акт подтвержден. Работа над этапом завершена."
  })
}
