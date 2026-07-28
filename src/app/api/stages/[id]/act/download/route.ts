import { NextResponse } from "next/server"
import { ActStatus } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { getDownloadUrl } from "@/lib/s3"

/**
 * GET /api/stages/[id]/act/download
 * Скачивание акта по этапу
 * Возвращает URL для скачивания из S3
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: stageId } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stage = await prisma.projectStage.findUnique({
    where: { id: stageId },
    include: { 
      order: true,
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

  // Проверяем доступ: админ, специалист или заказчик этого заказа
  const hasAccess = 
    user.role === "ADMIN" ||
    user.id === stage.order.specialistId ||
    user.id === stage.order.clientId
  
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Заказчик получает PDF акта дизайнера только после проверки администратором.
  if (user.role === "CLIENT" && user.id === stage.order.clientId) {
    const allowedForClient: ActStatus[] = [ActStatus.ADMIN_APPROVED, ActStatus.CLIENT_SIGNED, ActStatus.CONFIRMED]
    if (!allowedForClient.includes(act.status)) {
      return NextResponse.json(
        { error: "Файл акта будет доступен после проверки администратором" },
        { status: 403 },
      )
    }
  }

  // Определяем, какой файл отдавать
  // Приоритет: clientActS3Key (если подписан заказчиком) → specialistActS3Key
  const s3Key = act.clientActS3Key ?? act.specialistActS3Key
  if (!s3Key) {
    return NextResponse.json({ error: "Act file not found" }, { status: 404 })
  }

  const { url } = await getDownloadUrl(s3Key)
  return NextResponse.redirect(url)
}
