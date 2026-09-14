/**
 * Обновление фильтров списка в query без навигации: Next синхронизирует
 * `window.history.replaceState` с `useSearchParams`, поэтому серверный рендер
 * не перезапускается на каждое нажатие клавиши в поиске.
 */
export function replaceQueryParams(next: Record<string, string | null | undefined>): void {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(next)) {
        if (value == null || value === "") url.searchParams.delete(key)
        else url.searchParams.set(key, value)
    }
    if (url.href !== window.location.href) window.history.replaceState(null, "", url)
}
