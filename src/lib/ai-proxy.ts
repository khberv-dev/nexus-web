/**
 * Опциональный прокси для исходящих запросов к AI-провайдерам (Gemini, YandexGPT/ART).
 *
 * AI_PROXY_URL — если не задан, запросы идут напрямую через глобальный fetch.
 * Поддерживаемые схемы:
 *   http://[user:pass@]host:port
 *   https://[user:pass@]host:port
 *   socks5://[user:pass@]host:port   (DNS резолвится на стороне прокси)
 *   socks5h://… и socks://…           (синонимы socks5://)
 *
 * Прокси применяется только к AI — глобальный диспетчер не трогаем, чтобы биллинг,
 * почта и прочие интеграции не пошли через него.
 */

import {fetch as undiciFetch, ProxyAgent, Socks5ProxyAgent, type Dispatcher} from "undici"

function proxyUrl(): string {
    return (process.env.AI_PROXY_URL ?? "").trim().replace(/^['"]|['"]$/g, "")
}

let cached: {url: string; dispatcher: Dispatcher} | null = null

function createDispatcher(raw: string): Dispatcher {
    let url: URL
    try {
        url = new URL(raw)
    } catch {
        throw new Error("INVALID_AI_PROXY_URL")
    }
    switch (url.protocol) {
        case "http:":
        case "https:":
            return new ProxyAgent(url.toString())
        case "socks5:":
        case "socks5h:":
        case "socks:":
            // undici всегда передаёт прокси имя хоста, так что socks5 уже ведёт себя как socks5h.
            url.protocol = "socks5:"
            return new Socks5ProxyAgent(url.toString())
        default:
            throw new Error("INVALID_AI_PROXY_URL")
    }
}

/** Диспетчер для AI-запросов или null, если AI_PROXY_URL не задан. */
export function getAiProxyDispatcher(): Dispatcher | null {
    const url = proxyUrl()
    if (!url) return null
    if (cached?.url !== url) {
        const dispatcher = createDispatcher(url)
        void cached?.dispatcher.close().catch(() => {})
        cached = {url, dispatcher}
    }
    return cached.dispatcher
}

/** fetch для AI-провайдеров: через AI_PROXY_URL, если он задан, иначе обычный fetch. */
export async function aiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const dispatcher = getAiProxyDispatcher()
    if (!dispatcher) return fetch(input, init)
    const response = await undiciFetch(input, {
        ...(init as Parameters<typeof undiciFetch>[1]),
        dispatcher,
    })
    return response as unknown as Response
}
