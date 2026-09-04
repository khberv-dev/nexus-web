import {geminiEditImage, geminiGenerate, isGeminiConfigured} from "@/lib/gemini-ai"
import {isYandexAiConfigured, yandexChat, yandexGenerateImage, type YandexMessage} from "@/lib/yandex-ai"

export type AiProvider = "gemini" | "yandex"
export type AiMessage = YandexMessage

export function getAiProvider(): AiProvider {
    const value = (process.env.AI_PROVIDER ?? "gemini").trim().toLowerCase()
    if (value !== "gemini" && value !== "yandex") throw new Error(`INVALID_AI_PROVIDER:${value}`)
    return value
}

export function isAiConfigured(): boolean {
    return getAiProvider() === "yandex" ? isYandexAiConfigured() : isGeminiConfigured()
}

export async function aiChat(messages: AiMessage[], maxTokens = 1024): Promise<string> {
    if (getAiProvider() === "yandex") return yandexChat(messages, maxTokens)
    const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n")
    const conversation = messages
        .filter((message) => message.role !== "system")
        .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
        .join("\n\n")
    return geminiGenerate(system, conversation, maxTokens)
}

export async function aiAsk(system: string, userPrompt: string, maxTokens = 1024): Promise<string> {
    return aiChat([{role: "system", content: system}, {role: "user", content: userPrompt}], maxTokens)
}

export async function aiGenerateAvatar(prompt: string, image: {data: string; mimeType: string}) {
    return getAiProvider() === "yandex" ? yandexGenerateImage(prompt) : geminiEditImage(prompt, image)
}

export function stripJsonFences(raw: string): string {
    return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
}
