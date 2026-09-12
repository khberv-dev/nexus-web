/** Загрузка с прогрессом. fetch не отдаёт событий отправки тела, поэтому под капотом XHR. */

export type UploadProgress = { loaded: number; total: number; percent: number }

export type UploadResult = { ok: boolean; status: number; text: string }

export type UploadOptions = {
    method?: string
    headers?: Record<string, string>
    onProgress?: (progress: UploadProgress) => void
    signal?: AbortSignal
}

export function uploadWithProgress(url: string, body: XMLHttpRequestBodyInit, options: UploadOptions = {}): Promise<UploadResult> {
    const {method = "POST", headers = {}, onProgress, signal} = options

    return new Promise<UploadResult>((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException("Загрузка отменена", "AbortError"))
            return
        }

        const xhr = new XMLHttpRequest()
        const abort = () => xhr.abort()

        xhr.upload.onprogress = (e) => {
            if (!onProgress || !e.lengthComputable) return
            onProgress({loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100)})
        }
        // Тело ушло целиком, но ответ ещё не пришёл: держим 100 %, чтобы полоса не «залипала» на 99.
        xhr.upload.onload = () => onProgress?.({loaded: 1, total: 1, percent: 100})

        xhr.onload = () => {
            signal?.removeEventListener("abort", abort)
            resolve({ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText})
        }
        xhr.onerror = () => {
            signal?.removeEventListener("abort", abort)
            reject(new Error("Ошибка сети при загрузке"))
        }
        xhr.onabort = () => {
            signal?.removeEventListener("abort", abort)
            reject(new DOMException("Загрузка отменена", "AbortError"))
        }

        xhr.open(method, url)
        // FormData сам проставляет boundary в Content-Type — переопределять его нельзя.
        const isFormData = typeof FormData !== "undefined" && body instanceof FormData
        for (const [key, value] of Object.entries(headers)) {
            if (isFormData && key.toLowerCase() === "content-type") continue
            xhr.setRequestHeader(key, value)
        }
        signal?.addEventListener("abort", abort)
        xhr.send(body)
    })
}

/** Тот же вызов, но с разбором JSON-ответа и единым текстом ошибки. */
export async function uploadJsonWithProgress<T>(
    url: string,
    body: XMLHttpRequestBodyInit,
    options: UploadOptions & { fallbackError?: string } = {},
): Promise<T> {
    const {fallbackError = "Ошибка загрузки", ...rest} = options
    const res = await uploadWithProgress(url, body, rest)
    let parsed: unknown = null
    try {
        parsed = res.text ? JSON.parse(res.text) : null
    } catch {
        parsed = null
    }
    if (!res.ok) {
        const message = (parsed as { error?: string } | null)?.error
        throw new Error(message ?? `${fallbackError} (${res.status})`)
    }
    return parsed as T
}
