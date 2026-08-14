import {NextRequest, NextResponse} from "next/server"
import {geminiGenerate} from "@/lib/gemini-ai"
import {getClientIp, rateLimit} from "@/lib/rate-limit"

const SYSTEM = `Ты — редактор платформы NEXUS для дизайнеров интерьера.
Твоя задача — превратить черновой набросок раздела «О себе» в развёрнутый, официальный и профессиональный текст для анкеты специалиста.
Пиши от первого лица, деловым тоном, без лишнего пафоса и воды, 4–6 предложений.
Сохраняй все факты из черновика и ничего не выдумывай сверх того, что написал пользователь — не добавляй конкретные годы опыта, проекты или награды, которых нет в черновике или контексте анкеты.
Отвечай ТОЛЬКО готовым текстом — без markdown, без кавычек, без вводных фраз вроде "Вот текст:".`

export async function POST(req: NextRequest) {
    // Публичный эндпоинт (без сессии) — лимитируем по IP, а не по userId.
    const rl = rateLimit(`ai-about:${getClientIp(req)}`, 10, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const body = await req.json().catch(() => ({})) as {
        text?: string
        fullName?: string
        city?: string
        experience?: string
        specialty?: string
        software?: string
    }
    const draft = typeof body.text === "string" ? body.text.trim() : ""
    if (!draft) return NextResponse.json({error: "Сначала напишите пару слов о себе"}, {status: 400})

    const context = [
        body.fullName && `Имя: ${body.fullName}`,
        body.city && `Город: ${body.city}`,
        body.experience && `Опыт: ${body.experience} лет`,
        body.specialty && `Специализация: ${body.specialty}`,
        body.software && `Программы: ${body.software}`,
    ].filter(Boolean).join("\n")

    const userPrompt = `${context ? `Контекст анкеты:\n${context}\n\n` : ""}Черновик раздела «О себе»:\n${draft}\n\nПерепиши это в развёрнутый профессиональный текст для анкеты дизайнера интерьера.`

    try {
        const text = await geminiGenerate(SYSTEM, userPrompt, 500)
        return NextResponse.json({text})
    } catch (err) {
        console.error("[ai/generate-about]", err)
        return NextResponse.json({error: "ИИ временно недоступен, попробуйте позже"}, {status: 500})
    }
}
