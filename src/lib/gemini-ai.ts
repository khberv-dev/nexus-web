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
