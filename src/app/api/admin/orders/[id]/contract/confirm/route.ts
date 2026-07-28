import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { ContractStatus, OrderStatus } from "@prisma/client"
import { syncStageSequentialLocks } from "@/lib/stage-sequencing"

/**
 * POST /api/admin/orders/[id]/contract/confirm
 * Администратор подтверждает договор (финальный шаг)
 * После этого договор активен и заказ переходит в работу
 * Ответ: { contract: Contract, order: Order }
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId, deletedAt: null },
    include: { 
      contracts: { orderBy: { createdAt: "desc" }, take: 1 },
      client: true,
      specialist: true
    },
  })
  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 })
  }

  const contract = order.contracts[0]
  if (!contract) {
    return NextResponse.json({ error: "Договор по заказу не найден" }, { status: 404 })
  }

  // Проверяем, что договор подписан обеими сторонами
  if (contract.status !== ContractStatus.CLIENT_SIGNED) {
    return NextResponse.json(
      { 
        error: "Договор должен быть подписан заказчиком",
        currentStatus: contract.status 
      },
      { status: 400 }
    )
  }

  if (!contract.clientSignedS3Key) {
    return NextResponse.json(
      { error: "Отсутствует подписанный файл от заказчика" },
      { status: 400 }
    )
  }

  const now = new Date()
  
  // Обновляем договор
  const updatedContract = await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: ContractStatus.CONFIRMED,
      confirmedAt: now,
    },
  })

  // Обновляем статус заказа (если он был в ожидании договора)
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.ACTIVE },
  })

  // Разблокировка цепочки этапов (первый этап может стать PENDING после активации заказа).
  await syncStageSequentialLocks(orderId)

  // Аудит
  await audit(user.id, "contract_confirmed", "Contract", contract.id, {
    orderId: { to: orderId },
    status: { from: ContractStatus.CLIENT_SIGNED, to: ContractStatus.CONFIRMED },
    orderStatus: { from: order.status, to: OrderStatus.ACTIVE },
  })

  // Уведомления
  void notify(
    order.specialistId!,
    "contract_activated",
    "Договор активирован",
    `Договор ${contract.number} по заказу #${orderId} подтвержден. Заказ активирован и готов к работе.`,
    `/orders/${orderId}`
  )
  
  void notify(
    order.clientId,
    "contract_activated",
    "Договор активирован",
    `Договор ${contract.number} по заказу #${orderId} подтвержден администратором. Заказ активирован.`,
    `/orders/${orderId}`
  )

  return NextResponse.json({
    contract: updatedContract,
    order: updatedOrder,
    message: "Договор подтвержден. Заказ активирован и готов к работе."
  })
}
