/** Без Prisma/Node — безопасно импортировать из клиентских компонентов. */

/** Файл может выступать «кадром», к которому подвязывают материалы (только изображения). */
export function isPortfolioVisualFile(mimeType: string | null, filename: string) {
    if (mimeType?.startsWith("image/")) return true
    return /\.(jpe?g|png|webp|gif)$/i.test(filename)
}
