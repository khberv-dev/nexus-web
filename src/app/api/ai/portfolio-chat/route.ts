import {NextRequest, NextResponse} from "next/server"
import {aiChat, type AiMessage} from "@/lib/ai-provider"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const rl = rateLimit(`ai:${user.id}`, 20, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    const {messages, title, currentDescription} = await req.json() as {
        messages: { role: "user" | "assistant"; content: string }[]
        title?: string
        currentDescription?: string
    }

    const context = [
        title && `Название работы: «${title}»`,
        currentDescription && `Текущее описание: «${currentDescription}»`,
    ].filter(Boolean).join("\n")

    const systemContent = `Ты — помощник дизайнера интерьеров на платформе NEXUS. Помогаешь составить описание работы в портфолио.
${context ? `\nКонтекст:\n${context}\n` : ""}
Задай 2–3 коротких уточняющих вопроса о проекте: тип объекта (офис, ресторан, квартира…), стиль, площадь, что особенного в решении. Веди диалог дружелюбно и кратко.

Когда наберешь достаточно информации — составь готовое описание до 500 символов и обязательно выдели его в конце сообщения вот так:

---
Текст готового описания здесь.
---

Пиши только по-русски.`

    const chatMessages: AiMessage[] = [
        {role: "system", content: systemContent},
        ...(messages.length > 0
                ? messages
                : [{role: "user" as const, content: "Помоги мне написать описание для этой работы."}]
        ),
    ]

    try {
        const reply = await aiChat(chatMessages, 600)
        return NextResponse.json({reply})
    } catch (err) {
        console.error("[ai/portfolio-chat]", err)
        return NextResponse.json({error: "AI недоступен"}, {status: 500})
    }
}
