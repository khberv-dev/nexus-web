/**
 * POST /api/ai/revision-feedback
 *
 * Для клиента: помогает сформулировать конкретные замечания
 * при отклонении этапа работ.
 *
 * Клиенты часто пишут расплывчато: "не нравится", "переделайте".
 * AI помогает структурировать обратную связь в конкретные
 * технические требования, которые специалист может выполнить.
 *
 * Тело запроса:
 *   { stageType: string, rawFeedback: string, files?: string[] }
 * Ответ:
 *   { result: { structured: string, checklist: string[] } }
 */
import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {aiAsk, stripJsonFences} from "@/lib/ai-provider"
import {rateLimit} from "@/lib/rate-limit"

const STAGE_NAMES: Record<string, string> = {
    CONCEPT: "Концепция",
    PLANNING: "Планировочное решение",
    VISUALIZATION: "Визуализация",
    DOCUMENTATION: "Рабочая документация",
    SPECIFICATION: "Спецификация на материалы",
}

const SYSTEM = `Ты — опытный арт-директор в дизайн-студии. Помогаешь клиентам формулировать конкретные и профессиональные замечания к работе дизайнера.
Твоя задача — превратить субъективные ощущения клиента в четкие технические требования.
Отвечай ТОЛЬКО валидным JSON объектом, без markdown, без пояснений.`

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "CLIENT") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const rl = rateLimit(`ai:${user.id}`, 20, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const {stageType, rawFeedback, files} = await req.json() as {
        stageType: string
        rawFeedback: string
        files?: string[]
    }

    const stageName = STAGE_NAMES[stageType] ?? stageType

    const userPrompt = `Этап работ: ${stageName}
${files?.length ? `Загруженные файлы: ${files.join(", ")}` : ""}

Замечание клиента (в свободной форме):
"${rawFeedback}"

Помоги клиенту сформулировать замечание профессионально и конкретно.

Ответь ТОЛЬКО JSON объектом:
{
  "structured": "Переформулированное замечание (2–4 предложения, четко и по-деловому)",
  "checklist": [
    "Конкретное действие которое должен сделать дизайнер 1",
    "Конкретное действие 2",
    "..."
  ]
}

Правила:
- structured: сохрани суть замечания клиента, но сделай его профессиональным и конкретным
- checklist: 2–5 четких пунктов что именно нужно изменить/исправить/добавить
- Пиши с точки зрения клиента (от первого лица не нужно, просто технические требования)
- Если замечание слишком расплывчатое — сформулируй наиболее вероятные требования для данного этапа
- На русском языке`

    try {
        const raw = await aiAsk(SYSTEM, userPrompt, 600)
        const result = JSON.parse(stripJsonFences(raw))
        return NextResponse.json({result})
    } catch (err) {
        console.error("[ai/revision-feedback]", err)
        return NextResponse.json({error: "AI недоступен"}, {status: 500})
    }
}
