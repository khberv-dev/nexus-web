import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {uploadToS3} from "@/lib/s3"
import {ActStatus} from "@prisma/client"

/**
 * POST /api/stages/[id]/act/upload
 * Дизайнер загружает акт (PDF файл)
 * Тело запроса: { file: File } - PDF файл акта
 * Ответ: { act: StageAct }
 */
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const {id: stageId} = await params
    const user = await getSessionUser()
    if (!user || user.role !== "SPECIALIST") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const stage = await prisma.projectStage.findUnique({
        where: {id: stageId},
        include: {
            order: true,
            act: true
        },
    })
    if (!stage) {
        return NextResponse.json({error: "Stage not found"}, {status: 404})
    }

    // Проверяем, что специалист этот этапа
    if (stage.order.specialistId !== user.id) {
        return NextResponse.json({error: "Forbidden: Not your stage"}, {status: 403})
    }

    // Проверяем, что атап в правильном статусе (APPROVED - работа принята заказчиком)
    if (stage.status !== "APPROVED") {
        return NextResponse.json(
            {
                error: "Stage must be APPROVED before uploading act",
                currentStatus: stage.status
            },
            {status: 409}
        )
    }

    // Создаем или обновляем акт
    let act = stage.act
    if (!act) {
        act = await prisma.stageAct.create({
            data: {
                stageId,
                generatedAt: new Date(),
                status: ActStatus.PENDING,
            },
        })
    }

    // Проверяем, что акт не уже загружен дизайнером (кроме случая отклонения)
    if (act.specialistActS3Key && act.status !== "REJECTED") {
        return NextResponse.json(
            {error: "Act already uploaded by specialist"},
            {status: 409}
        )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file || !(file instanceof File)) {
        return NextResponse.json({error: "File is required"}, {status: 400})
    }

    // Проверяем, что это PDF
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        return NextResponse.json({error: "Only PDF files are allowed for act"}, {status: 400})
    }

    // Проверяем размер файла (до 50МБ для актов)
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({error: "File size must not exceed 50MB"}, {status: 400})
    }

    // Загружаем файл в S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const s3Key = `orders/${stage.order.id}/acts/${stageId}-${Date.now()}-act.pdf`
    await uploadToS3(s3Key, buffer, "application/pdf")

    // Обновляем акт
    const now = new Date()
    const updatedAct = await prisma.stageAct.update({
        where: {id: act.id},
        data: {
            specialistActS3Key: s3Key,
            specialistUploadedAt: now,
            status: ActStatus.SPECIALIST_UPLOADED,
        },
    })

    return NextResponse.json({
        act: updatedAct,
        message: "Акт загружен. Ожидайте проверки администратором."
    })
}
