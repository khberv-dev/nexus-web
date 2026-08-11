import {NextRequest, NextResponse} from "next/server"
import {
    BUDGET_FLEX,
    BUDGET_RANGE,
    BUDGET_SCOPE,
    LIGHTING,
    OBJ_STAGES,
    OBJECT_TYPES,
    PRIORITY,
    SQM_BUDGET,
    START_READY,
    STYLES,
    TASKS,
} from "@/app/orders/new/briefConfig"
import {cfAiAsk, isCloudflareAiConfigured, stripJsonFences} from "@/lib/cf-ai"
import {getSessionUser} from "@/lib/session"
import {rateLimit} from "@/lib/rate-limit"

/** Человекочитаемые подписи полей мастера брифа (orders/new). */
const WIZARD_LABELS: Record<string, string> = {
    objectType: "Тип объекта",
    companySegment: "Сегмент бизнеса",
    companyDesc: "Описание бизнеса",
    objAddress: "Адрес объекта",
    objStage: "Стадия объекта",
    objArea: "Площадь, м²",
    objFloors: "Этажей",
    objDesc: "Описание объекта",
    tasks: "Задачи проекта",
    taskMain: "Главная цель проекта",
    targetAudience: "Целевая аудитория",
    competitors: "Конкуренты / референсные объекты",
    currentProblem: "Что не устраивает в пространстве",
    styleDir: "Стилевое направление",
    colorPalette: "Цветовая гамма",
    colorAvoid: "Нежелательные цвета / элементы",
    lightingPref: "Освещение",
    materials: "Материалы",
    styleStory: "Образ / история пространства",
    references: "Референсы",
    antiReferences: "Антиреференсы",
    budgetScope: "Что включает бюджет",
    budgetRange: "Бюджет на реализацию",
    sqmBudget: "Бюджет руб./м²",
    budgetFlex: "Гибкость бюджета",
    deadlineDesign: "Срок дизайн-проекта",
    deadlineOpen: "Желаемое открытие",
    priority: "Качество или срок",
    startReady: "Когда готовы начать",
    constraints: "Сохраняемые элементы / ограничения",
    specialReqs: "Особые требования",
    additionalComments: "Комментарии для дизайнера",
}

const STEP_FOCUS: Record<string, string[]> = {
    object: ["companySegment", "companyDesc", "objDesc", "objAddress", "objStage", "objectType"],
    tasks: ["tasks", "taskMain", "targetAudience", "competitors", "currentProblem"],
    style: ["styleDir", "styleStory", "materials", "colorPalette", "colorAvoid", "lightingPref", "references", "antiReferences"],
    budget: ["budgetScope", "budgetRange", "sqmBudget", "budgetFlex", "priority", "startReady", "deadlineDesign", "deadlineOpen"],
    files: ["constraints", "specialReqs", "additionalComments"],
}

const SYSTEM = `Ты — эксперт по коммерческим интерьерам на B2B-платформе NEXUS.
Помогаешь заказчику заполнить бриф: конкретные формулировки, без воды, на русском.
Отвечай ТОЛЬКО валидным JSON-массивом, без markdown и текста вне JSON.`

function formatBriefLines(briefData: Record<string, string>): string {
    return Object.entries(briefData ?? {})
        .filter(([k, v]) => !k.startsWith("_") && String(v ?? "").trim())
        .map(([k, v]) => `${WIZARD_LABELS[k] ?? k}: ${v}`)
        .join("\n")
}

/** Llama иногда оборачивает JSON или добавляет текст — вытаскиваем массив. */
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
            try {
                return parseBlock(cleaned.slice(start, end + 1))
            } catch {
                throw new Error("AI_JSON_PARSE")
            }
        }
        throw new Error("AI_JSON_PARSE")
    }
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    if (!isCloudflareAiConfigured()) {
        return NextResponse.json(
            {
                error:
                    "ИИ не настроен: в .env задайте CF_ACCOUNT_ID и CF_API_KEY (или CF_API_TOKEN), без кавычек и лишних пробелов. Перезапустите dev-сервер.",
            },
            {status: 503},
        )
    }

    const rl = rateLimit(`ai:wizard:${user.id}`, 24, 60 * 60 * 1000)
    if (!rl.ok) return NextResponse.json({error: "Слишком много запросов. Попробуйте позже."}, {status: 429})

    let body: { briefData?: Record<string, string>; stepKey?: string }
    try {
        body = (await req.json()) as { briefData?: Record<string, string>; stepKey?: string }
    } catch {
        return NextResponse.json({error: "Некорректное тело запроса"}, {status: 400})
    }
    const {briefData, stepKey} = body

    const step = typeof stepKey === "string" && STEP_FOCUS[stepKey] ? stepKey : "object"
    const focus = STEP_FOCUS[step]
    const filled = formatBriefLines(briefData ?? {})

    const objectTypeLabels = OBJECT_TYPES.map(o => o.label).join(", ")
    const listsBlock = `
Допустимые значения (если предлагаешь вариант для поля — строка example должна ТОЧНО совпадать с одним из пунктов списка):
- objectType: ${objectTypeLabels}
- objStage: ${OBJ_STAGES.join(" | ")}
- tasks: перечисли через запятую подстроки из: ${TASKS.join(" | ")}
- styleDir: перечисли через запятую подстроки из: ${STYLES.join(" | ")}
- lightingPref: ${LIGHTING.join(" | ")}
- budgetScope: ${BUDGET_SCOPE.join(" | ")}
- budgetRange: ${BUDGET_RANGE.join(" | ")}
- sqmBudget: ${SQM_BUDGET.join(" | ")}
- budgetFlex: ${BUDGET_FLEX.join(" | ")}
- priority: ${PRIORITY.join(" | ")}
- startReady: ${START_READY.join(" | ")}
`

    const userPrompt = `Текущий шаг мастера брифа: «${step}».
Приоритетно помоги с полями: ${focus.map(k => `${k} (${WIZARD_LABELS[k] ?? k})`).join(", ")}.

Уже заполнено:
${filled || "пока пусто"}

${listsBlock}

Сделай 3–5 подсказок для самых «тяжёлых» или пустых полей этого шага.
Для длинных текстов (описания, цели, образ) — example: готовый абзац, который можно вставить в поле (2–6 предложений).
Для полей с фиксированными списками — example должен дословно совпадать с пунктом списка; для tasks/styleDir можно несколько значений через запятую из списка.
Для сроков deadlineDesign и deadlineOpen — НЕ подставляй вымышленные даты в example; вместо этого используй field: null и объясни в tip, как выбрать дату.
Если поле уже заполнено хорошо — дай уточнение или усиление формулировки с новым example.

Ответь ТОЛЬКО JSON-массивом объектов:
[{"field":"styleStory","tip":"краткий заголовок совета","reason":"почему это важно","example":"текст для поля или точная строка из списка"}]
Поле field: один из ключей ${focus.join(", ")}, либо null для общей подсказки по шагу.`

    try {
        const raw = await cfAiAsk(SYSTEM, userPrompt, 1400)
        const parsed = parseSuggestionsJson(raw)
        const allowedFields = new Set(focus)
        const suggestions = parsed
            .filter((x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
            .map(x => {
                const rawField = x.field === null || x.field === undefined ? null : String(x.field)
                const field = rawField && allowedFields.has(rawField) ? rawField : null
                return {
                    field,
                    tip: String(x.tip ?? ""),
                    reason: String(x.reason ?? ""),
                    example: String(x.example ?? ""),
                }
            })
            .filter(s => s.tip.length > 0)
        return NextResponse.json({suggestions})
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[ai/brief-wizard-suggest]", err)
        if (msg === "CF_AI_NOT_CONFIGURED") {
            return NextResponse.json(
                {error: "ИИ не настроен: CF_ACCOUNT_ID и CF_API_KEY (или CF_API_TOKEN) в .env."},
                {status: 503},
            )
        }
        if (msg.startsWith("CF_AI_HTTP_401:")) {
            return NextResponse.json(
                {
                    error:
                        "Cloudflare отклонил токен (401). Создайте токен в дашборде: Workers AI → «Use REST API» → Create Workers AI API Token. CF_ACCOUNT_ID должен быть ID того же аккаунта. Удалите кавычки вокруг значений в .env и перезапустите сервер.",
                },
                {status: 401},
            )
        }
        if (msg === "AI_JSON_PARSE") {
            return NextResponse.json(
                {error: "Модель вернула ответ в неожиданном формате. Нажмите «Обновить подсказки»."},
                {status: 502},
            )
        }
        if (msg.startsWith("Cloudflare AI")) {
            return NextResponse.json(
                {error: "Сервис ИИ временно недоступен. Попробуйте позже."},
                {status: 502},
            )
        }
        return NextResponse.json({error: "AI недоступен"}, {status: 500})
    }
}
