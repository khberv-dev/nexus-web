import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {uploadToS3} from "@/lib/s3"
import {audit} from "@/lib/audit"
import {notify} from "@/lib/notifications"
import {ContractStatus} from "@prisma/client"

/**
 * POST /api/orders/[id]/contract/specialist/sign
 * Дизайнер загружает подписанный скан договора
 * Тело запроса: { file: File } - PDF файл подписанного договора
 * Ответ: { contract: Contract }
 */
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const {id: orderId} = await params
    const user = await getSessionUser()
    if (!user || user.role !== "SPECIALIST") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const order = await prisma.order.findUnique({
        where: {id: orderId, deletedAt: null, specialistId: user.id},
        include: {contracts: {orderBy: {createdAt: "desc"}, take: 1}},
    })
    if (!order) {
        return NextResponse.json({error: "Заказ не найден или не ваш"}, {status: 404})
    }

    const contract = order.contracts[0]
    if (!contract) {
        return NextResponse.json({error: "Договор по заказу не найден"}, {status: 404})
    }

    // Проверяем, что договор в подходящем статусе
    if (contract.status !== ContractStatus.SENT_TO_SPECIALIST) {
        return NextResponse.json(
            {
                error: "Договор не в статусе для подписания",
                currentStatus: contract.status
            },
            {status: 400}
        )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file || !(file instanceof File)) {
        return NextResponse.json({error: "Файл обязателен"}, {status: 400})
    }

    // Проверяем, что это PDF
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        return NextResponse.json({error: "Загрузите файл в формате PDF"}, {status: 400})
    }

    // Проверяем размер файла (до 10МБ)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({error: "Размер файла не должен превышать 10МБ"}, {status: 400})
    }

    // Загружаем подписанный файл в S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const s3Key = `orders/${orderId}/contracts/${contract.number}-specialist-signed.pdf`
    await uploadToS3(s3Key, buffer, "application/pdf")

    // Обновляем договор
    const now = new Date()
    const updatedContract = await prisma.contract.update({
        where: {id: contract.id},
        data: {
            specialistSignedS3Key: s3Key,
            specialistSignedAt: now,
            status: ContractStatus.SPECIALIST_SIGNED,
        },
    })

    // Аудит
    await audit(user.id, "contract_specialist_signed", "Contract", contract.id, {
        orderId: {to: orderId},
        status: {from: ContractStatus.SENT_TO_SPECIALIST, to: ContractStatus.SPECIALIST_SIGNED},
    })

    // Уведомление администратору
    const admins = await prisma.user.findMany({where: {role: "ADMIN"}})
    for (const admin of admins) {
        void notify(
            admin.id,
            "contract_specialist_signed",
            "Договор подписан дизайнером",
            `Дизайнер подписал договор ${contract.number} по заказу #${orderId}. Проверьте и передайте заказчику.`,
            `/admin/orders/${orderId}`
        )
    }

    return NextResponse.json({
        contract: updatedContract,
        message: "Подписанный договор загружен. Ожидайте подтверждения администратора."
    })
}
