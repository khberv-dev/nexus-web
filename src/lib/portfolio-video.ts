export function isPortfolioVideo(file: {mimeType?: string | null; filename: string}): boolean {
    return file.mimeType?.startsWith("video/") === true || /\.(mp4|webm|mov)$/i.test(file.filename)
}
