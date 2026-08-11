/**
 * POST /api/ai/brief-summary
 *
 * Для администратора: быстрое AI-резюме брифа клиента.
 * Вызывается на странице заказа когда статус BRIEF_REVIEW.
 * Помогает администратору быстро понять суть заказа
 * и принять решение о назначении специалиста.
 *
 * Тело запроса: { briefData: Record<string, string>, orderTitle?: string }
 * Ответ: { summary: { headline, keyPoints, flags, specialistNote } }
 */
import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {cfAiAsk, stripJsonFences} from "@/lib/cf-ai"
import {rateLimit} from "@/lib/rate-limit"

const SYSTEM = `Ты — опытный менеджер проектов в дизайн-студии. Анализируешь бриф клиента и готовишь краткое резюме для администратора платформы NEXUS.
Администратор использует резюме чтобы быстро понять суть заказа и выбрать подходящего специалиста.
Отвечай ТОЛЬКО валидным JSON объектом, без markdown, без пояснений.`

const BRIEF_LABELS: Record<string, string> = {
    objectType: "Тип объекта",
    area: "Площадь",
    address: "Адрес",
    style: "Стиль",
    materials: "Материалы и цвета",
    vision: "Образ и атмосфера",
    budget: "Бюджет",
    deadline: "Срок",
    rooms: "Помещения",
    notes: "Особые требования",
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") {
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    }

    const rl = rateLimit(`ai:${user.id}`, 50, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const {briefData, orderTitle} = await req.json() as {
        briefData: Record<string, string>
        orderTitle?: string
    }

    const briefText = Object.entries(briefData ?? {})
        .filter(([, v]) => String(v ?? "").trim())
        .map(([k, v]) => `${BRIEF_LABELS[k] ?? k}: ${v}`)
        .join("\n")

    const missingFields = Object.keys(BRIEF_LABELS)
        .filter(k => !String(briefData?.[k] ?? "").trim())
        .map(k => BRIEF_LABELS[k])

    const userPrompt = `${orderTitle ? `Название заказа: ${orderTitle}\n` : ""}
Содержимое брифа:
${briefText || "Бриф пустой"}

Незаполненные поля: ${missingFields.join(", ") || "все заполнены"}

Подготовь структурированное резюме брифа для администратора.

Ответь ТОЛЬКО JSON объектом в таком формате:
{
  "headline": "Одна строка: суть проекта (тип объекта, стиль, масштаб)",
  "keyPoints": ["Ключевой факт 1", "Ключевой факт 2", "..."],
  "flags": ["Риск или неясность 1", "..."],
  "specialistNote": "Что важно учесть при выборе специалиста"
}

Правила:
- headline: не более 100 символов, конкретно и по делу
- keyPoints: 3–5 самых важных параметров проекта
- flags: пустой массив если все ясно, иначе — неполные/противоречивые данные, нереалистичные сроки/бюджет
- specialistNote: специализация, опыт или стиль который важен для этого заказа`

    try {
        const raw = await cfAiAsk(SYSTEM, userPrompt, 800)
        const summary = JSON.parse(stripJsonFences(raw))
        return NextResponse.json({summary})
    } catch (err) {
        console.error("[ai/brief-summary]", err)
        return NextResponse.json({error: "AI недоступен"}, {status: 500})
    }
}
