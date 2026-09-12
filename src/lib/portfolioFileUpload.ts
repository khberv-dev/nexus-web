/** Загрузка файла в UserFile (S3 через API), для портфолио-карточек. */

import {uploadWithProgress, type UploadProgress} from "@/lib/upload-progress"

export interface MinimalUserFile {
    id: string
    filename: string
    mimeType: string | null
    title: string | null
}

export async function uploadUserFileToPortfolio(
    file: File,
    category: "PORTFOLIO" | "DOCUMENT",
    meta?: { title?: string; description?: string | null },
    onProgress?: (progress: UploadProgress) => void,
): Promise<MinimalUserFile> {
    const res = await fetch("/api/files", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            category,
            title: meta?.title ?? file.name.replace(/\.[^.]+$/, ""),
            description: meta?.description ?? null,
        }),
    })
    const text = await res.text()
    let data: { file?: MinimalUserFile; error?: string }
    try {
        data = JSON.parse(text) as { file?: MinimalUserFile; error?: string }
    } catch {
        throw new Error(text.slice(0, 160) || `Ошибка сервера (${res.status})`)
    }
    if (!res.ok) throw new Error(data.error ?? `Не удалось создать запись файла (${res.status})`)
    const saved = data.file
    if (!saved?.id) throw new Error("Сервер не вернул id файла")

    const putRes = await uploadWithProgress(`/api/files/${saved.id}/upload`, file, {
        headers: {"Content-Type": file.type || "application/octet-stream"},
        onProgress,
    })
    if (!putRes.ok) throw new Error(`Ошибка загрузки в хранилище (${putRes.status})`)
    return saved
}
