import {NextRequest, NextResponse} from "next/server"
import {Role} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {aiAsk, isAiConfigured, stripJsonFences} from "@/lib/ai-provider"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"
import type {StageType} from "@/app/orders/[id]/types"
import {STAGE_LABEL} from "@/app/orders/[id]/types"

const SYSTEM = `Ты помогаешь заказчику коммерческого интерьера (платформа NEXUS) сформулировать вежливые, конкретные сообщения дизайнеру в чате по текущему этапу проекта.
Текст должен быть готов к отправке как есть: без приветствий «уважаемый робот», без канцелярита, по делу, на русском.
Отвечай ТОЛЬКО валидным JSON-массивом, без markdown и текста вне JSON.

Формат каждого элемента:
{"field":null,"tip":"короткий заголовок карточки","reason":"зачем так писать дизайнеру","example":"2–6 предложений — готовое сообщение в чат"}

Дай ровно 3 варианта с разными акцентами (например: общие правки / конкретика по материалам и цвету / вопросы и следующий шаг).`

function formatBriefLines(briefData: Record<string, string> | null): string {
    if (!briefData) return ""
    return Object.entries(briefData)
        .filter(([k, v]) => !k.startsWith("_") && String(v ?? "").trim())
        .map(([k, v]) => `${k}: ${String(v).trim()}`)
        .join("\n")
        .slice(0, 8000)
}

function parseSuggestionsJson(raw: string): unknown[] {
    const cleaned = stripJsonFences(raw.trim())
    const parseBlock = (s: string): unknown[] => {
        const v = JSON.parse(s) as unknown
        if (!Array.isArray(v)) throw new Error("AI_JSON_PARSE")
        return v
    }
    try {
        return parseBlock(cleaned)
    } catch {
        const start = cleaned.indexOf("[")
        const end = cleaned.lastIndexOf("]")
        if (start >= 0 && end > start) {
            return parseBlock(cleaned.slice(start, end + 1))
        }
        throw new Error("AI_JSON_PARSE")
    }
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== Role.CLIENT) return NextResponse.json({error: "Forbidden"}, {status: 403})

    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "User not found"}, {status: 404})

    if (!isAiConfigured()) {
        return NextResponse.json(
            {
                error:
                    "ИИ не настроен: проверьте AI_PROVIDER и ключ выбранного провайдера в .env. Перезапустите dev-сервер.",
            },
            {status: 503},
        )
    }

    const rl = rateLimit(`ai:stage_chat:${user.id}`, 24, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    let body: { orderId?: string; stageId?: string; draft?: string }
    try {
        body = (await req.json()) as { orderId?: string; stageId?: string; draft?: string }
    } catch {
        return NextResponse.json({error: "Некорректное тело запроса"}, {status: 400})
    }

    const orderId = typeof body.orderId === "string" ? body.orderId : ""
    const stageId = typeof body.stageId === "string" ? body.stageId : ""
    const draft = typeof body.draft === "string" ? body.draft.trim().slice(0, 8000) : ""

    if (!orderId || !stageId) return NextResponse.json({error: "orderId и stageId обязательны"}, {status: 400})

    const order = await prisma.order.findUnique({
        where: {id: orderId},
        select: {clientId: true, briefData: true},
    })
    if (!order || order.clientId !== dbUser.id) return NextResponse.json({error: "Forbidden"}, {status: 403})

    const stage = await prisma.projectStage.findFirst({
        where: {id: stageId, orderId},
        select: {type: true},
    })
    if (!stage) return NextResponse.json({error: "Not found"}, {status: 404})

    const stageTitle = STAGE_LABEL[stage.type as StageType] ?? stage.type
    const briefLines = formatBriefLines(order.briefData as Record<string, string> | null)

    const userPrompt = `Этап проекта: ${stageTitle} (${stage.type})
${draft ? `Черновик сообщения заказчика (можно переформулировать или дополнить):\n${draft}\n` : "Черновика пока нет — предложи с нуля.\n"}
Краткий контекст из брифа (поля и значения):
${briefLines || "нет данных"}

Верни JSON-массив из трёх элементов в указанном формате.`

    try {
        const raw = await aiAsk(SYSTEM, userPrompt, 1400)
        const rows = parseSuggestionsJson(raw)
        const suggestions = rows.map((row, i) => {
            const o = row && typeof row === "object" ? (row as Record<string, unknown>) : {}
            const tip = typeof o.tip === "string" ? o.tip : ""
            const reason = typeof o.reason === "string" ? o.reason : ""
            const example = typeof o.example === "string" ? o.example : ""
            return {
                field: null as string | null,
                tip: tip || `Вариант ${i + 1}`,
                reason: reason || "",
                example,
            }
        })
        return NextResponse.json({suggestions})
    } catch (e) {
        console.error("[ai/stage-chat-suggest]", e)
        return NextResponse.json({error: "Не удалось получить подсказки ИИ"}, {status: 500})
    }
}
