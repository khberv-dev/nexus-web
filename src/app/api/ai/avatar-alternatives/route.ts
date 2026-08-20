import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"
import {geminiEditImage, GeminiImageError, isGeminiConfigured} from "@/lib/gemini-ai"

/** Общая часть промта: важнее всего — узнаваемость человека, это аватар, а не новый персонаж. */
const BASE_RULES = `Это фотография для аватара профиля дизайнера интерьеров на профессиональной платформе.
Переработай именно это фото, сохранив узнаваемость человека: черты лица, возраст, причёску, форму лица и телосложение не менять.
Не добавляй текст, логотипы, рамки и водяные знаки. Кадр квадратный, лицо в центре, портрет по грудь.`

// Не экспортируем: Next.js разрешает route-модулю экспортировать только обработчики и config.
const AVATAR_VARIANTS = [
    {
        id: "studio",
        label: "Студийный",
        prompt: `${BASE_RULES}
Сделай аккуратный студийный портрет: ровный нейтральный фон (светло-серый), мягкий рассеянный свет, деловой но не строгий образ, естественные цвета кожи.`,
    },
    {
        id: "editorial",
        label: "Журнальный",
        prompt: `${BASE_RULES}
Сделай журнальный портрет: чуть более контрастный свет с мягкой тенью, приглушённый тёплый фон, спокойный уверенный взгляд, лёгкая кинематографичная цветокоррекция.`,
    },
    {
        id: "interior",
        label: "В интерьере",
        prompt: `${BASE_RULES}
Помести человека в светлый минималистичный интерьер на заднем плане (размытая глубина резкости), дневной свет из окна, тёплая нейтральная палитра — образ практикующего дизайнера на рабочем месте.`,
    },
] as const

const MAX_IMAGE_BYTES = 4 * 1024 * 1024

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

/** POST — три AI-варианта аватара по загруженному фото. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    if (!isGeminiConfigured()) {
        return NextResponse.json(
            {error: "Генерация недоступна: не задан GEMINI_API_KEY", code: "NOT_CONFIGURED"},
            {status: 503},
        )
    }

    // Генерация картинок дороже текстовых запросов — лимит жёстче остальных ai-роутов.
    const rl = rateLimit(`ai-avatar:${user.id}`, 10, 60 * 60 * 1000)
    if (!rl.ok) {
        return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})
    }

    const body = await req.json().catch(() => ({})) as { image?: unknown }
    const image = parseDataUrl(body.image)
    if (!image) {
        return NextResponse.json(
            {error: "Нужно фото в формате data:image/jpeg|png;base64, не больше 4 МБ"},
            {status: 400},
        )
    }

    const results = await Promise.allSettled(
        AVATAR_VARIANTS.map((variant) => geminiEditImage(variant.prompt, image)),
    )

    const images = results.flatMap((result, i) =>
        result.status === "fulfilled"
            ? [{id: AVATAR_VARIANTS[i].id, label: AVATAR_VARIANTS[i].label, dataUrl: result.value.dataUrl}]
            : [],
    )

    if (images.length === 0) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined
        const err = first?.reason
        const code = err instanceof GeminiImageError ? err.code : "FAILED"
        const message = err instanceof GeminiImageError ? err.message : "Не удалось сгенерировать варианты"
        console.error("[ai/avatar-alternatives]", code, message)
        return NextResponse.json({error: message, code}, {status: code === "QUOTA" ? 429 : 502})
    }

    // Частичный успех — отдаём то, что получилось: пользователю есть из чего выбрать.
    return NextResponse.json({images, requested: AVATAR_VARIANTS.length})
}
