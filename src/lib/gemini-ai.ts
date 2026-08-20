/**
 * Google Gemini API — через официальный SDK `@google/genai`.
 * Docs: https://ai.google.dev/gemini-api/docs
 *
 * Ключ: Google AI Studio → Get API key.
 * Переменные: GEMINI_API_KEY (обязательно), GEMINI_MODEL (опционально, по умолчанию
 * gemini-2.5-flash — актуальный список моделей см. в доках выше, они меняются часто).
 */

import {GoogleGenAI} from "@google/genai"

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

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
    if (!isGeminiConfigured()) throw new Error("GEMINI_NOT_CONFIGURED")
    if (!client) client = new GoogleGenAI({apiKey: apiKey()})
    return client
}

/** Простой (не-диалоговый) промт: системная инструкция + пользовательский запрос. */
export async function geminiGenerate(system: string, userPrompt: string, maxTokens = 512): Promise<string> {
    const ai = getClient()
    const response = await ai.models.generateContent({
        model: modelId(),
        contents: userPrompt,
        config: {
            systemInstruction: system,
            maxOutputTokens: maxTokens,
            // Prompts here are straightforward rewrites, not multi-step reasoning — without
            // this, 2.5+ "thinking" models can burn most of maxOutputTokens on internal
            // reasoning and return a truncated (or empty) visible response.
            thinkingConfig: {thinkingBudget: 0},
        },
    })
    const text = response.text?.trim()
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
        response = await getClient().models.generateContent({
            model: imageModelId(),
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
