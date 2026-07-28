import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { uploadToS3 } from "@/lib/s3"
import { ActStatus } from "@prisma/client"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { stageLabelRu } from "@/lib/stage-labels"

/**
 * POST /api/stages/[id]/act/client-sign
 * Заказчик загружает подписанный акт (PDF файл)
 * Тело запроса: { file: File } - PDF файл подписанного акта
 * Ответ: { act: StageAct }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: stageId } = await params
  const user = await getSessionUser()
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
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

  // Проверяем, что заказчик этого заказа
  if (stage.order.clientId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden: Not your order" }, { status: 403 })
  }

  const act = stage.act
  if (!act) {
    return NextResponse.json({ error: "Act not found" }, { status: 404 })
  }

  // Только после проверки администратором — до этого акт заказчику не выдаётся.
  if (act.status !== ActStatus.ADMIN_APPROVED) {
    return NextResponse.json(
      {
        error:
          act.status === ActStatus.SPECIALIST_UPLOADED
            ? "Акт ещё не проверен администратором"
            : "Акт не готов для подписания заказчиком",
        currentStatus: act.status,
      },
      { status: 409 },
    )
  }

  // Проверяем, что заказчик еще не загружал подписанный акт
  if (act.clientActS3Key) {
    return NextResponse.json(
      { error: "Act already signed by client" },
      { status: 409 }
    )
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 })
  }

  // Проверяем, что это PDF
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed for act" }, { status: 400 })
  }

  // Проверяем размер файла (до 50МБ)
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File size must not exceed 50MB" }, { status: 400 })
  }

  // Загружаем файл в S3
  const buffer = Buffer.from(await file.arrayBuffer())
  const s3Key = `orders/${stage.order.id}/acts/${stageId}-${Date.now()}-client-signed.pdf`
  await uploadToS3(s3Key, buffer, "application/pdf")

  // Обновляем акт
  const now = new Date()
  const updatedAct = await prisma.stageAct.update({
    where: { id: act.id },
    data: {
      clientActS3Key: s3Key,
      clientSignedAt: now,
      status: ActStatus.CLIENT_SIGNED,
    },
  })

  // Аудит
  await audit(user.id, "act_client_signed", "StageAct", act.id, {
    stageId: { to: stageId },
    status: { from: act.status, to: ActStatus.CLIENT_SIGNED }
  })

  // Уведомление администратору
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } })
  for (const admin of admins) {
    void notify(
      admin.id,
      "act_client_signed",
      "Акт подписан заказчиком",
      `Заказчик подписал акт по этапу ${stageLabelRu(stage.type)} (заказ #${stage.order.id}). Подтвердите для фиксации акта.`,
      `/admin/orders/${stage.order.id}`
    )
  }

  return NextResponse.json({
    act: updatedAct,
    message: "Подписанный акт загружен. Ожидайте подтверждения администратором."
  })
}
