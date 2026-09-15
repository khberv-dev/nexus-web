/** Проверка документов перед загрузкой — общая для формы и тестов, без зависимостей от React. */

export const DEFAULT_DOCUMENT_ACCEPT = ".pdf,application/pdf"
export const DEFAULT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`
}

/** Файл подходит под accept (расширения с точкой, MIME или `type/*`) и лимит размера? Возвращает текст ошибки или null. */
export function validateDocumentFile(
    file: { name: string; type?: string; size: number },
    accept = DEFAULT_DOCUMENT_ACCEPT,
    maxSizeBytes = DEFAULT_DOCUMENT_MAX_SIZE,
): string | null {
    const tokens = accept.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    const name = file.name.toLowerCase()
    const type = (file.type || "").toLowerCase()
    const allowed = tokens.length === 0 || tokens.some((token) =>
        token.startsWith(".")
            ? name.endsWith(token)
            : token.endsWith("/*") ? type.startsWith(token.slice(0, -1)) : type === token,
    )
    if (!allowed) {
        const extensions = tokens.filter((t) => t.startsWith(".")).map((t) => t.slice(1).toUpperCase())
        return extensions.length ? `Допустимые форматы: ${extensions.join(", ")}` : "Неподдерживаемый формат файла"
    }
    if (file.size === 0) return "Файл пустой"
    if (file.size > maxSizeBytes) return `Размер файла не должен превышать ${formatFileSize(maxSizeBytes)}`
    return null
}
