import {LandingFile} from "./types"
import {uploadJsonWithProgress, type UploadProgress} from "@/lib/upload-progress"

export async function uploadFile(
    file: File,
    category: string,
    onProgress?: (progress: UploadProgress) => void,
): Promise<LandingFile> {
    const res = await fetch("/api/files", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({filename: file.name, mimeType: file.type, size: file.size, category, title: file.name}),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? "Ошибка создания файла")
    const {file: saved} = await res.json()

    await uploadJsonWithProgress(`/api/files/${saved.id}/upload`, file, {
        headers: {"Content-Type": file.type || "application/octet-stream"},
        fallbackError: "Ошибка загрузки",
        onProgress,
    })
    return saved
}

export async function getPreviewUrl(id: string): Promise<string> {
    const r = await fetch(`/api/files/${id}/url`)
    if (!r.ok) return ""
    const {url} = await r.json()
    return url ?? ""
}
