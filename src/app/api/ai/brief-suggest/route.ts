import { NextRequest, NextResponse } from "next/server"
import { cfAiAsk, stripJsonFences } from "@/lib/cf-ai"
import { getSessionUser } from "@/lib/session"
import { rateLimit } from "@/lib/rate-limit"

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

const SYSTEM = `Ты — опытный консультант по дизайну коммерческих интерьеров на B2B-платформе NEXUS.
Клиенты — владельцы и управляющие коммерческих объектов (офисы, рестораны, ретейл, шоурумы, гостиницы, кофейни, салоны красоты).
Твоя задача: давать конкретные, деловые подсказки по заполнению брифа с учетом эргономики, зонирования и специфики коммерческих пространств.
Отвечай ТОЛЬКО валидным JSON массивом, без markdown, без пояснений, без текста до или после JSON.`

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rl = rateLimit(`ai:${user.id}`, 20, 60 * 60 * 1000)
  if (!rl.ok) return NextResponse.json({ error: "Слишком много запросов. Попробуйте позже." }, { status: 429 })

  const { briefData } = await req.json() as { briefData: Record<string, string> }

  const filled = Object.entries(briefData ?? {})
    .filter(([, v]) => String(v ?? "").trim())
    .map(([k, v]) => `${BRIEF_LABELS[k] ?? k}: ${v}`)
    .join("\n")

  const missing = Object.keys(BRIEF_LABELS)
    .filter(k => !String(briefData?.[k] ?? "").trim())
    .map(k => BRIEF_LABELS[k])

  const userPrompt = `Заполненные поля брифа:
${filled || "Пока ничего не заполнено"}

Незаполненные поля: ${missing.join(", ") || "все заполнены"}

Дай 3–4 конкретные, экспертные подсказки, которые помогут клиенту сделать бриф точнее, профессиональнее и практичнее.

Правила:
- Указывай конкретное поле (один из ключей: objectType, area, address, style, materials, vision, budget, deadline, rooms, notes) или null для общей подсказки
- Говори на языке бизнеса, не упрощай
- Учитывай эргономику: проходимость, доступность, удобство для персонала и клиентов
- Учитывай зонирование: разделение пространства на функциональные зоны (прием, работа, отдых, склад и т.д.)
- Поле "vision" очень важно — помоги описать атмосферу, ощущение пространства и психологическое воздействие на посетителей
- Для "materials" — предложи конкретные, практичные сочетания с учетом нагрузки (мрамор + латунь, дерево + металл, керамика + бетон и т.д.)
- Для "rooms" — подсказывай о необходимых вспомогательных помещениях (санузлы, хранилище, бытовка)
- Если поле уже заполнено — предложи уточнение, дополнение или альтернативу с примером
- Для "budget" — помоги разбить бюджет по категориям (отделка, мебель, оборудование, свет)

Отвечь ТОЛЬКО JSON массивом:
[{"field":"vision","tip":"...","reason":"...","example":"..."}]`

  try {
    const raw = await cfAiAsk(SYSTEM, userPrompt, 1024)
    const suggestions = JSON.parse(stripJsonFences(raw))
    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error("[ai/brief-suggest]", err)
    return NextResponse.json({ error: "AI недоступен" }, { status: 500 })
  }
}
