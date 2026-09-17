/**
 * Google Gemini API — через REST (`generateContent`).
 * Docs: https://ai.google.dev/api/generate-content
 *
 * SDK `@google/genai` ходит через глобальный fetch и не принимает свой диспетчер,
 * поэтому запросы идут напрямую через aiFetch — так работает AI_PROXY_URL.
 *
 * Ключ: Google AI Studio → Get API key.
 * Переменные: GEMINI_API_KEY (обязательно), GEMINI_MODEL (опционально, по умолчанию
 * gemini-2.5-flash — актуальный список моделей см. в доках выше, они меняются часто).
 */

import {aiFetch} from "@/lib/ai-proxy"

function apiKey(): string {
    return (process.env.GEMINI_API_KEY ?? "").trim()
}

function modelId(): string {
    return (process.env.GEMINI_MODEL ?? "").trim() || "gemini-2.5-flash"
}

/**
 * Модель для генерации изображений (image-to-image). Отдельная от текстовой:
 * у неё свои квоты и на бесплатном тарифе она недоступна (limit: 0).
 */
function imageModelId(): string {
    return (process.env.GEMINI_IMAGE_MODEL ?? "").trim() || "gemini-2.5-flash-image"
}

export function isGeminiConfigured(): boolean {
    return Boolean(apiKey())
}

type GeminiPart = {
    text?: string
    thought?: boolean
    inlineData?: {data?: string; mimeType?: string}
}

type GeminiResponse = {
    candidates?: Array<{content?: {parts?: GeminiPart[]}}>
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

async function generateContent(model: string, body: Record<string, unknown>): Promise<GeminiResponse> {
    if (!isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED")
    const res = await aiFetch(`${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: {"x-goog-api-key": apiKey(), "Content-Type": "application/json"},
        body: JSON.stringify(body),
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`GEMINI_HTTP_${res.status}:${raw.slice(0, 500)}`)
    return JSON.parse(raw) as GeminiResponse
}

/** Простой (не-диалоговый) промт: системная инструкция + пользовательский запрос. */
export async function geminiGenerate(system: string, userPrompt: string, maxTokens = 512): Promise<string> {
    const response = await generateContent(modelId(), {
        systemInstruction: {parts: [{text: system}]},
        contents: [{role: "user", parts: [{text: userPrompt}]}],
        generationConfig: {
            maxOutputTokens: maxTokens,
            // Prompts here are straightforward rewrites, not multi-step reasoning — without
            // this, 2.5+ "thinking" models can burn most of maxOutputTokens on internal
            // reasoning and return a truncated (or empty) visible response.
            thinkingConfig: {thinkingBudget: 0},
        },
    })
    const parts = response.candidates?.[0]?.content?.parts ?? []
    const text = parts
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("")
        .trim()
    if (!text) throw new Error("Empty AI response")
    return text
}

/** Причина отказа генерации — чтобы роут отдал внятное сообщение, а не «AI недоступен». */
export type GeminiImageErrorCode = "NOT_CONFIGURED" | "QUOTA" | "SAFETY" | "EMPTY" | "FAILED"

export class GeminiImageError extends Error {
    constructor(public readonly code: GeminiImageErrorCode, message: string) {
        super(message)
        this.name = "GeminiImageError"
    }
}

export type GeneratedImage = {
    /** data:image/...;base64,... — готово к <img src> и к обратной загрузке в S3. */
    dataUrl: string
    mimeType: string
}

function classifyImageError(err: unknown): GeminiImageError {
    const raw = err instanceof Error ? err.message : String(err)
    if (/RESOURCE_EXHAUSTED|"code":\s*429|quota/i.test(raw)) {
        return new GeminiImageError(
            "QUOTA",
            "Генерация изображений недоступна на текущем тарифе Gemini: у моделей *-image лимит бесплатного тарифа равен нулю. Включите billing в Google AI Studio или укажите ключ с платным тарифом.",
        )
    }
    if (/SAFETY|blocked|PROHIBITED_CONTENT/i.test(raw)) {
        return new GeminiImageError("SAFETY", "Модель отклонила изображение по правилам безопасности.")
    }
    return new GeminiImageError("FAILED", raw.slice(0, 300))
}

function firstImageFromResponse(response: GeminiResponse): GeneratedImage {
    const parts = response.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
        const inline = part.inlineData
        if (inline?.data) {
            const mimeType = inline.mimeType ?? "image/png"
            return {dataUrl: `data:${mimeType};base64,${inline.data}`, mimeType}
        }
    }
    throw new GeminiImageError("EMPTY", "Модель не вернула изображение")
}

/**
 * Image-to-image: на вход фото, на выход — переработанный вариант.
 * Возвращает первую картинку из ответа; текстовые части модели игнорируем.
 */
export async function geminiEditImage(
    prompt: string,
    image: { data: string; mimeType: string },
): Promise<GeneratedImage> {
    if (!isGeminiConfigured()) {
        throw new GeminiImageError("NOT_CONFIGURED", "GEMINI_API_KEY не задан")
    }

    let response
    try {
        response = await generateContent(imageModelId(), {
            contents: [
                {
                    role: "user",
                    parts: [
                        {inlineData: {data: image.data, mimeType: image.mimeType}},
                        {text: prompt},
                    ],
                },
            ],
        })
    } catch (err) {
        throw classifyImageError(err)
    }

    return firstImageFromResponse(response)
}

/**
 * Text-to-image: без исходного фото — генерация с нуля по текстовому описанию
 * (например, интерьер по брифу, до того как есть какая-либо картинка-референс).
 */
export async function geminiGenerateImage(prompt: string): Promise<GeneratedImage> {
    if (!isGeminiConfigured()) {
        throw new GeminiImageError("NOT_CONFIGURED", "GEMINI_API_KEY не задан")
    }

    let response
    try {
        response = await generateContent(imageModelId(), {
            contents: [{role: "user", parts: [{text: prompt}]}],
        })
    } catch (err) {
        throw classifyImageError(err)
    }

    return firstImageFromResponse(response)
}
