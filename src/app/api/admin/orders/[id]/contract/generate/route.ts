import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { uploadToS3 } from "@/lib/s3"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { ContractStatus } from "@prisma/client"

/**
 * POST /api/admin/orders/[id]/contract/generate
 * Администратор генерирует договор и отправляет его дизайнеру
 * Тело запроса: { file: File } - PDF файл договора
 * Ответ: { contract: Contract }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId, deletedAt: null },
    include: { specialist: true, contracts: true },
  })
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 })
  }
  if (!order.specialistId) {
    return NextResponse.json({ error: "К заказу не прикреплен специалист" }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Файл договора обязателен" }, { status: 400 })
  }

  // Проверяем, что это PDF
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return NextResponse.json({ error: "Загрузите файл в формате PDF" }, { status: 400 })
  }

  // Проверяем размер файла (например, до 10МБ)
  const MAX_FILE_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Размер файла не должен превышать 10МБ" }, { status: 400 })
  }

  // Генерируем номер договора (например, NEXUS-ORDER-001)
  const contractNumber = `NEXUS-ORDER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

  // Загружаем файл в S3
  const buffer = Buffer.from(await file.arrayBuffer())
  const s3Key = `orders/${orderId}/contracts/${contractNumber}-original.pdf`
  await uploadToS3(s3Key, buffer, "application/pdf")

  // Создаем или обновляем договор
  const now = new Date()
  const existingContract = await prisma.contract.findFirst({ where: { orderId } })
  const contract = await prisma.contract.upsert({
    where: { id: existingContract?.id ?? "" },
    create: {
      orderId,
      number: existingContract?.number ?? contractNumber,
      s3Key,
      status: ContractStatus.SENT_TO_SPECIALIST,
      sentToSpecialistAt: now,
    },
    update: {
      number: contractNumber,
      s3Key,
      status: ContractStatus.SENT_TO_SPECIALIST,
      sentToSpecialistAt: now,
      // Сбрасываем предыдущие подписи
      specialistSignedS3Key: null,
      specialistSignedAt: null,
      sentToClientAt: null,
      clientSignedS3Key: null,
      clientSignedAt: null,
      confirmedAt: null,
    },
  })

  // Аудит
  await audit(user.id, "contract_generated", "Contract", contract.id, {
    orderId: { to: orderId },
    number: { to: contractNumber },
    status: { to: ContractStatus.SENT_TO_SPECIALIST },
  })

  // Уведомление специалисту
  void notify(
    order.specialistId,
    "contract_sent",
    "Новый договор по заказу",
    `Администратор сформировал договор ${contractNumber} по заказу #${orderId}. Скачайте, подпишите и загрузите скан.`,
    `/orders/${orderId}`
  )

  return NextResponse.json({ contract, message: "Договор сгенерирован и отправлен специалисту" })
}
