import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {notify} from "@/lib/notifications"
import {ContractStatus} from "@prisma/client"

/**
 * POST /api/admin/orders/[id]/contract/send-to-client
 * Администратор проверяет подпись дизайнера и отправляет договор заказчику
 * Ответ: { contract: Contract }
 */
export async function POST(_req: Request, {params}: { params: Promise<{ id: string }> }) {
    const {id: orderId} = await params
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const order = await prisma.order.findUnique({
        where: {id: orderId, deletedAt: null},
        include: {
            contracts: {orderBy: {createdAt: "desc"}, take: 1},
            client: true
        },
    })
    if (!order) {
        return NextResponse.json({error: "Заказ не найден"}, {status: 404})
    }

    const contract = order.contracts[0]
    if (!contract) {
        return NextResponse.json({error: "Договор по заказу не найден"}, {status: 404})
    }

    // Проверяем, что договор подписан дизайнером
    if (contract.status !== ContractStatus.SPECIALIST_SIGNED) {
        return NextResponse.json(
            {
                error: "Договор должен быть подписан дизайнером",
                currentStatus: contract.status
            },
            {status: 400}
        )
    }

    if (!contract.specialistSignedS3Key) {
        return NextResponse.json(
            {error: "Отсутствует подписанный файл от дизайнера"},
            {status: 400}
        )
    }

    // Обновляем статус договора
    const now = new Date()
    const updatedContract = await prisma.contract.update({
        where: {id: contract.id},
        data: {
            status: ContractStatus.SENT_TO_CLIENT,
            sentToClientAt: now,
        },
    })

    // Аудит
    await audit(user.id, "contract_sent_to_client", "Contract", contract.id, {
        orderId: {to: orderId},
        status: {from: ContractStatus.SPECIALIST_SIGNED, to: ContractStatus.SENT_TO_CLIENT},
    })

    // Уведомление заказчику
    void notify(
        order.clientId,
        "contract_sent",
        "Новый договор по заказу",
        `Администратор передал вам договор ${contract.number} по заказу #${orderId}. Скачайте, подпишите и загрузите скан.`,
        `/orders/${orderId}`
    )

    return NextResponse.json({
        contract: updatedContract,
        message: "Договор отправлен заказчику для подписания"
    })
}
