import {NextRequest, NextResponse} from "next/server"
import {aiAsk} from "@/lib/ai-provider"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"

const SYSTEM = `Ты — ассистент дизайнера интерьеров на платформе NEXUS.
Пишешь краткие профессиональные описания работ для портфолио.
Отвечай ТОЛЬКО текстом описания — без кавычек, без markdown, без пояснений.`

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const rl = rateLimit(`ai:${user.id}`, 20, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const {title, current} = await req.json() as { title?: string; current?: string }

    const userPrompt = `Название работы: "${title || "Без названия"}"
${current ? `Текущее описание: "${current}"` : ""}

${current
        ? "Улучши и дополни текущее описание. Сделай его более профессиональным и информативным."
        : "Напиши краткое профессиональное описание для этой работы в портфолио дизайнера."
    }

Требования:
- 2–3 предложения, 30–60 слов
- Упомяни стиль, тип объекта или особенности если они угадываются из названия
- Профессиональный, но живой тон
- На русском языке`

    try {
        const text = await aiAsk(SYSTEM, userPrompt, 300)
        return NextResponse.json({text})
    } catch (err) {
        console.error("[ai/portfolio-describe]", err)
        return NextResponse.json({error: "AI недоступен"}, {status: 500})
    }
}
