/**
 * Cloudflare Workers AI — тонкая обертка над REST API.
 * Docs: https://developers.cloudflare.com/workers-ai/get-started/rest-api/
 *
 * Токен: в дашборде Workers AI → «Use REST API» → **Create Workers AI API Token**
 * (или свой токен с правами Account: Workers AI — Read + Edit).
 * Account ID — из того же раздела; должен совпадать с аккаунтом токена.
 *
 * Переменные: CF_ACCOUNT_ID / CF_API_KEY (или CF_API_TOKEN / CLOUDFLARE_API_TOKEN).
 */

function readEnvTrim(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]
    if (v == null || !String(v).trim()) continue
    return String(v)
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/^["']|["']$/g, "")
      .trim()
  }
  return ""
}

function accountId(): string {
  return readEnvTrim("CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID")
}

function apiToken(): string {
  return readEnvTrim("CF_API_KEY", "CF_API_TOKEN", "CLOUDFLARE_API_TOKEN")
}

function modelId(): string {
  return readEnvTrim("CF_AI_MODEL") || "@cf/meta/llama-3.1-8b-instruct"
}

/** Для маршрутов: можно ли вызывать Workers AI. */
export function isCloudflareAiConfigured(): boolean {
  return Boolean(accountId() && apiToken())
}

export type CfMessage = { role: "system" | "user" | "assistant"; content: string }

interface CfAiResponse {
  result: { response: string }
  success: boolean
  errors: { message: string }[]
}

/**
 * Отправляет запрос в Cloudflare Workers AI.
 * @param messages  Массив сообщений (system + user/assistant)
 * @param maxTokens Максимум токенов в ответе
 */
export async function cfAiChat(messages: CfMessage[], maxTokens = 1024): Promise<string> {
  if (!isCloudflareAiConfigured()) {
    throw new Error("CF_AI_NOT_CONFIGURED")
  }
  const acc = accountId()
  const tok = apiToken()
  const model = modelId()
  const url = `https://api.cloudflare.com/client/v4/accounts/${acc}/ai/run/${model}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tok}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, max_tokens: maxTokens }),
  })

  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401) {
      throw new Error(
        `CF_AI_HTTP_401:${text}`,
      )
    }
    throw new Error(`Cloudflare AI ${res.status}: ${text}`)
  }

  const data: CfAiResponse = await res.json()

  if (!data.success) {
    throw new Error(`Cloudflare AI error: ${data.errors.map(e => e.message).join(", ")}`)
  }

  return data.result.response.trim()
}

/**
 * Удобная обертка для простых (не-диалоговых) промтов.
 * Принимает системную инструкцию и пользовательский запрос.
 */
export async function cfAiAsk(system: string, userPrompt: string, maxTokens = 1024): Promise<string> {
  return cfAiChat(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    maxTokens,
  )
}

/** Убирает markdown-обертки вокруг JSON если модель их добавила. */
export function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
}
