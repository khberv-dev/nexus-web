import {NextRequest, NextResponse} from "next/server"
import {aiAsk, stripJsonFences} from "@/lib/ai-provider"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"

const SYSTEM = `Ты — HR-консультант платформы NEXUS для дизайнеров интерьера.
Помогаешь дизайнерам заполнить анкету верификации так, чтобы произвести лучшее впечатление на администраторов.
Отвечай ТОЛЬКО валидным JSON массивом, без markdown, без пояснений, без текста до или после JSON.`

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const rl = rateLimit(`ai:${user.id}`, 20, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const form = await req.json() as Record<string, string>

    const filled = [
        form.fullName && `Имя: ${form.fullName}`,
        form.city && `Город: ${form.city}`,
        form.experience && `Опыт: ${form.experience} лет`,
        form.specialty && `Специализация: ${form.specialty}`,
        form.methods && `Методы работы: ${form.methods}`,
        form.software && `Программы: ${form.software}`,
        form.portfolio && `Портфолио: ${form.portfolio}`,
        form.about && `О себе: ${form.about}`,
    ].filter(Boolean).join("\n")

    const userPrompt = `Анкета дизайнера:
${filled || "Анкета пока пустая"}

Дай 3–4 конкретные подсказки, которые помогут дизайнеру произвести лучшее впечатление на администраторов платформы.

Правила:
- Указывай одно из полей (ключи: fullName, city, experience, portfolio, software, about) или null для общей подсказки
- Поле "about" — самое важное, сфокусируйся на нем если оно заполнено слабо
- Если "about" заполнен хорошо — предложи конкретный улучшенный вариант текста
- Давай практичные советы, специфичные для дизайна интерьера
- Для software — предложи добавить профессиональные программы если их нет (ArchiCAD, 3ds Max, Revit, SketchUp, AutoCAD)

Ответь ТОЛЬКО JSON массивом:
[{"field":"about","tip":"...","reason":"...","example":"..."}]`

    try {
        const raw = await aiAsk(SYSTEM, userPrompt, 1024)
        const suggestions = JSON.parse(stripJsonFences(raw))
        return NextResponse.json({suggestions})
    } catch (err) {
        console.error("[ai/onboarding-suggest]", err)
        return NextResponse.json({error: "AI недоступен"}, {status: 500})
    }
}
