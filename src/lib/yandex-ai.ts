export type YandexMessage = {role: "system" | "user" | "assistant"; content: string}

function env(name: string): string {
    return (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "")
}

function apiKey(): string {
    return env("YANDEX_GPT_API_KEY")
}

function folderId(): string {
    return env("YANDEX_CLOUD_FOLDER_ID")
}

function authHeaders(): Record<string, string> {
    return {Authorization: `Api-Key ${apiKey()}`, "Content-Type": "application/json"}
}

export function isYandexAiConfigured(): boolean {
    return Boolean(apiKey() && folderId())
}

function requireConfig(): void {
    if (!isYandexAiConfigured()) throw new Error("YANDEX_AI_NOT_CONFIGURED")
}

export async function yandexChat(messages: YandexMessage[], maxTokens = 1024): Promise<string> {
    requireConfig()
    const modelUri = env("YANDEX_GPT_MODEL_URI") || `gpt://${folderId()}/yandexgpt/latest`
    const res = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            modelUri,
            completionOptions: {stream: false, temperature: 0.3, maxTokens: String(maxTokens)},
            messages: messages.map(({role, content}) => ({role, text: content})),
        }),
    })
    const raw = await res.text()
    if (!res.ok) throw new Error(`YANDEX_AI_HTTP_${res.status}:${raw.slice(0, 500)}`)
    const data = JSON.parse(raw) as {result?: {alternatives?: Array<{message?: {text?: string}}>}}
    const text = data.result?.alternatives?.[0]?.message?.text?.trim()
    if (!text) throw new Error("Empty YandexGPT response")
    return text
}

type YandexOperation = {
    id?: string
    done?: boolean
    error?: {code?: number; message?: string}
    response?: {image?: string}
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** YandexART is text-to-image; the source image is used only as prompt context by callers. */
export async function yandexGenerateImage(prompt: string): Promise<{dataUrl: string; mimeType: string}> {
    requireConfig()
    const modelUri = env("YANDEX_ART_MODEL_URI") || `art://${folderId()}/yandex-art/latest`
    const created = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            modelUri,
            messages: [{text: prompt, weight: "1"}],
            generationOptions: {mimeType: "image/jpeg", aspectRatio: {widthRatio: "1", heightRatio: "1"}},
        }),
    })
    const createdRaw = await created.text()
    if (!created.ok) throw new Error(`YANDEX_ART_HTTP_${created.status}:${createdRaw.slice(0, 500)}`)
    let operation = JSON.parse(createdRaw) as YandexOperation
    if (!operation.id) throw new Error("YandexART did not return an operation ID")

    for (let attempt = 0; attempt < 60 && !operation.done; attempt += 1) {
        await wait(2000)
        const polled = await fetch(`https://operation.api.cloud.yandex.net/operations/${operation.id}`, {
            headers: {Authorization: `Api-Key ${apiKey()}`},
        })
        const polledRaw = await polled.text()
        if (!polled.ok) throw new Error(`YANDEX_OPERATION_HTTP_${polled.status}:${polledRaw.slice(0, 500)}`)
        operation = JSON.parse(polledRaw) as YandexOperation
    }
    if (!operation.done) throw new Error("YandexART generation timed out")
    if (operation.error) throw new Error(`YandexART error: ${operation.error.message ?? operation.error.code}`)
    if (!operation.response?.image) throw new Error("YandexART returned no image")
    return {dataUrl: `data:image/jpeg;base64,${operation.response.image}`, mimeType: "image/jpeg"}
}
