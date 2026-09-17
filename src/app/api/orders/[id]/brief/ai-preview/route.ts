import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"
import {aiGenerateImage, getAiProvider, isAiConfigured} from "@/lib/ai-provider"
import {GeminiImageError} from "@/lib/gemini-ai"
import {deleteObject, getDownloadUrl, putObject} from "@/lib/s3"

export const maxDuration = 180

const PREVIEW_COUNT = 4

/** Только визуально значимые поля брифа — бюджет и сроки на картинку не влияют. */
const PROMPT_FIELDS: { key: string; label: string }[] = [
    {key: "objectType", label: "Тип помещения"},
    {key: "objDesc", label: "Описание объекта"},
    {key: "objArea", label: "Площадь, м²"},
    {key: "styleDir", label: "Стиль"},
    {key: "colorPalette", label: "Цветовая гамма"},
    {key: "colorAvoid", label: "Нежелательные цвета"},
    {key: "lightingPref", label: "Освещение"},
    {key: "materials", label: "Материалы"},
    {key: "styleStory", label: "Образ пространства"},
    {key: "references", label: "Референсы"},
]

function buildPrompt(briefData: Record<string, unknown>): string {
    const lines = PROMPT_FIELDS
        .map(({key, label}) => {
            const value = briefData[key]
            return typeof value === "string" && value.trim() ? `${label}: ${value.trim()}` : null
        })
        .filter((line): line is string => Boolean(line))

    const details = lines.length > 0 ? lines.join("\n") : "Данных о стиле и объекте пока нет — предложи нейтральный современный интерьер."

    return `Фотореалистичный интерьерный рендер коммерческого помещения по следующим данным клиента:
${details}

Требования: реалистичное освещение и материалы, без людей, без текста, логотипов и водяных знаков, широкий ракурс помещения целиком.`
}

async function loadPreviews(orderId: string) {
    const rows = await prisma.$queryRaw<Array<{ id: string; fileId: string; s3Key: string }>>`
    SELECT obp."id", uf."id" as "fileId", uf."s3Key"
    FROM "OrderBriefAiPreview" obp
    JOIN "UserFile" uf ON uf."id" = obp."fileId"
    WHERE obp."orderId" = ${orderId}
    ORDER BY obp."createdAt" ASC
  `
    return Promise.all(
        rows.map(async (row) => ({id: row.fileId, url: (await getDownloadUrl(row.s3Key)).url})),
    )
}

async function loadOrderForClient(orderId: string, clientId: string) {
    return prisma.order.findUnique({
        where: {id: orderId},
        select: {id: true, clientId: true, deletedAt: true, status: true, briefData: true},
    }).then((order) => (order && !order.deletedAt && order.clientId === clientId ? order : null))
}

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {id: orderId} = await params
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const order = await loadOrderForClient(orderId, dbUser.id)
    if (!order) return NextResponse.json({error: "Not found"}, {status: 404})

    const images = await loadPreviews(orderId)
    return NextResponse.json({images})
}

export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: orderId} = await params
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const order = await loadOrderForClient(orderId, dbUser.id)
    if (!order) return NextResponse.json({error: "Not found"}, {status: 404})
    if (order.status !== "DRAFT") return NextResponse.json({error: "Brief is locked"}, {status: 409})

    if (!isAiConfigured()) {
        return NextResponse.json(
            {error: `Генерация недоступна: не настроен провайдер ${getAiProvider()}`, code: "NOT_CONFIGURED"},
            {status: 503},
        )
    }

    // Генерация 4 картинок — дорогая операция, лимит строже обычных ai-роутов.
    const rl = rateLimit(`ai-brief-preview:${dbUser.id}`, 5, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const prompt = buildPrompt((order.briefData as Record<string, unknown>) ?? {})

    let generated: Awaited<ReturnType<typeof aiGenerateImage>>[]
    try {
        generated = await Promise.all(
            Array.from({length: PREVIEW_COUNT}, () => aiGenerateImage(prompt)),
        )
    } catch (err) {
        const code = err instanceof GeminiImageError ? err.code : "FAILED"
        const message = err instanceof Error ? err.message : "Не удалось сгенерировать изображения"
        console.error("[ai/brief-preview]", code, message)
        return NextResponse.json({error: message, code}, {status: code === "QUOTA" ? 429 : 502})
    }

    // Загружаем сгенерированные картинки в хранилище до транзакции — не держим
    // сетевые вызовы к S3 внутри БД-транзакции.
    const uploaded = await Promise.all(generated.map(async (image, i) => {
        const ext = image.mimeType === "image/jpeg" ? "jpg" : (image.mimeType.split("/")[1] || "png")
        const fileId = crypto.randomUUID()
        const s3Key = `orders/${orderId}/brief/ai-preview/${fileId}.${ext}`
        const base64 = image.dataUrl.slice(image.dataUrl.indexOf(",") + 1)
        await putObject(s3Key, Buffer.from(base64, "base64"), image.mimeType)
        return {fileId, s3Key, ext, mimeType: image.mimeType, index: i}
    }))

    // Предыдущая пачка предпросмотра больше не нужна — заменяем, а не копим.
    const old = await prisma.$queryRaw<Array<{ fileId: string; s3Key: string }>>`
    SELECT uf."id" as "fileId", uf."s3Key"
    FROM "OrderBriefAiPreview" obp
    JOIN "UserFile" uf ON uf."id" = obp."fileId"
    WHERE obp."orderId" = ${orderId}
  `

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "OrderBriefAiPreview" WHERE "orderId" = ${orderId}`
        for (const o of old) {
            await tx.userFile.delete({where: {id: o.fileId}}).catch(() => undefined)
        }

        for (const u of uploaded) {
            await tx.userFile.create({
                data: {
                    id: u.fileId,
                    userId: dbUser.id,
                    category: "DOCUMENT",
                    s3Key: u.s3Key,
                    filename: `ai-preview-${u.index + 1}.${u.ext}`,
                    mimeType: u.mimeType,
                    title: "ИИ-превью интерьера",
                    description: `Заказ #${orderId.slice(-6).toUpperCase()}`,
                },
            })
            await tx.$executeRaw`
        INSERT INTO "OrderBriefAiPreview" ("id", "orderId", "fileId")
        VALUES (${crypto.randomUUID()}, ${orderId}, ${u.fileId})
      `
        }
    })

    for (const o of old) {
        await deleteObject(o.s3Key).catch(() => undefined)
    }

    const images = await Promise.all(
        uploaded.map(async (u) => ({id: u.fileId, url: (await getDownloadUrl(u.s3Key)).url})),
    )
    return NextResponse.json({images, provider: getAiProvider()})
}
