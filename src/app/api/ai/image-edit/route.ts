import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {rateLimit} from "@/lib/rate-limit"
import {aiEditImage, aiSupportsImageEditing, getAiProvider, isAiConfigured} from "@/lib/ai-provider"
import {GeminiImageError} from "@/lib/gemini-ai"
import {getObjectBuffer} from "@/lib/s3"

export const maxDuration = 180

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_PROMPT_LENGTH = 600

/** Общие ограничения кадра: правим именно это фото, человек должен остаться узнаваемым. */
const CONTEXT_RULES: Record<string, string> = {
    avatar: `Это фотография для аватара профиля дизайнера интерьеров на профессиональной платформе.
Переработай именно это фото, сохранив узнаваемость человека: черты лица, возраст, причёску, форму лица и телосложение не менять.
Не добавляй текст, логотипы, рамки и водяные знаки. Кадр квадратный, лицо в центре, портрет по грудь.`,
    portrait: `Это портрет дизайнера интерьеров для витрины на главной странице платформы.
Переработай именно это фото, сохранив узнаваемость человека: черты лица, возраст, причёску, форму лица и телосложение не менять.
Не добавляй текст, логотипы, рамки и водяные знаки. Кадр вертикальный, человек в центре, портрет по пояс.`,
}

type Body = { image?: unknown; fileId?: unknown; prompt?: unknown; context?: unknown }

function parseDataUrl(value: unknown): { data: string; mimeType: string } | null {
    if (typeof value !== "string") return null
    const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value.trim())
    if (!match) return null
    const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1]
    const data = match[2]
    // base64 → байты: 4 символа кодируют 3 байта.
    if (Math.floor((data.length * 3) / 4) > MAX_IMAGE_BYTES) return null
    return {data, mimeType}
}

/** Исходник из уже загруженного UserFile — чтобы не гонять картинку через браузер и не упираться в CORS канваса. */
async function imageFromUserFile(fileId: string, userId: string): Promise<{ data: string; mimeType: string } | null> {
    const file = await prisma.userFile.findUnique({where: {id: fileId}})
    if (!file || file.userId !== userId) return null
    const {buffer, contentType} = await getObjectBuffer(file.s3Key)
    if (buffer.length > MAX_IMAGE_BYTES) return null
    const mimeType = (contentType ?? file.mimeType ?? "image/jpeg").split(";")[0].trim()
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) return null
    return {data: buffer.toString("base64"), mimeType}
}

/** POST — один шаг диалога: свободный промт пользователя поверх текущего кадра. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    if (!isAiConfigured()) {
        return NextResponse.json(
            {error: `Генерация недоступна: не настроен провайдер ${getAiProvider()}`, code: "NOT_CONFIGURED"},
            {status: 503},
        )
    }

    // Генерация картинок дороже текстовых запросов — лимит жёстче остальных ai-роутов.
    const rl = rateLimit(`ai-image-edit:${user.id}`, 30, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const body = await req.json().catch(() => ({})) as Body

    const prompt = typeof body.prompt === "string" ? body.prompt.replace(/\s+/g, " ").trim() : ""
    if (!prompt) return NextResponse.json({error: "Опишите, что изменить на фото"}, {status: 400})
    if (prompt.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({error: `Запрос длиннее ${MAX_PROMPT_LENGTH} символов`}, {status: 400})
    }

    let image = parseDataUrl(body.image)
    if (!image && typeof body.fileId === "string" && body.fileId) {
        const dbUser = await getOrCreateDbUser(user)
        image = await imageFromUserFile(body.fileId, dbUser.id).catch(() => null)
        if (!image) return NextResponse.json({error: "Не удалось прочитать исходное фото"}, {status: 400})
    }
    if (!image) {
        return NextResponse.json(
            {error: "Нужно фото в формате data:image/jpeg|png|webp;base64, не больше 4 МБ"},
            {status: 400},
        )
    }

    const contextKey = typeof body.context === "string" ? body.context : ""
    const rules = CONTEXT_RULES[contextKey]
    const fullPrompt = rules ? `${rules}\nЗапрос пользователя: ${prompt}` : prompt

    try {
        const result = await aiEditImage(fullPrompt, image)
        return NextResponse.json({
            image: {dataUrl: result.dataUrl, mimeType: result.mimeType},
            provider: getAiProvider(),
            // Клиент предупреждает пользователя, если исходник в генерацию не ушёл.
            sourceImageUsed: aiSupportsImageEditing(),
        })
    } catch (err) {
        const code = err instanceof GeminiImageError ? err.code : "FAILED"
        const message = err instanceof Error ? err.message : "Не удалось обработать изображение"
        console.error("[ai/image-edit]", code, message)
        return NextResponse.json({error: message, code}, {status: code === "QUOTA" ? 429 : 502})
    }
}
