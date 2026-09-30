import {prisma} from "@/lib/db/prisma"
import {audit} from "@/lib/audit"
import {notify} from "@/lib/notifications"
import {OrderStatus} from "@prisma/client"
import {bothOrderContractsConfirmed, syncStageSequentialLocks} from "@/lib/stage-sequencing"

/**
 * Заказ активируется, когда ОБА договора по нему (со специалистом и с заказчиком)
 * подтверждены администратором. Вызывается после подтверждения любого из двух —
 * сама проверяет готовность второго и не активирует заказ повторно.
 * Этапы разблокируются всегда, даже если заказ уже был ACTIVE (например, после
 * подписания рамочного договора или ручной смены статуса) — иначе первый этап
 * остаётся в BLOCKED.
 */
export async function activateOrderIfBothContractsConfirmed(orderId: string, adminUserId: string): Promise<void> {
    const order = await prisma.order.findUnique({
        where: {id: orderId},
        include: {contracts: true},
    })
    if (!order || !bothOrderContractsConfirmed(order.contracts)) return

    if (order.status === OrderStatus.ACTIVE) {
        await syncStageSequentialLocks(orderId)
        return
    }

    await prisma.order.update({where: {id: orderId}, data: {status: OrderStatus.ACTIVE}})
    await syncStageSequentialLocks(orderId)

    await audit(adminUserId, "order_status_changed", "Order", orderId, {
        status: {from: order.status, to: OrderStatus.ACTIVE},
    })

    if (order.specialistId) {
        void notify(
            order.specialistId,
            "contract_activated",
            "Заказ активирован",
            `Оба договора по заказу #${orderId} подтверждены. Заказ активирован и готов к работе.`,
            `/work/orders/${orderId}`,
        )
    }
    void notify(
        order.clientId,
        "contract_activated",
        "Заказ активирован",
        `Оба договора по заказу #${orderId} подтверждены. Заказ активирован и готов к работе.`,
        `/orders/${orderId}`,
    )
}
