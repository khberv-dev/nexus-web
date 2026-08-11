import {LandingFile} from "./types"

export function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            resolve({w: img.width, h: img.height})
            URL.revokeObjectURL(img.src)
        }
        img.onerror = reject
        img.src = URL.createObjectURL(file)
    })
}

export async function uploadFile(file: File, category: string): Promise<LandingFile> {
    const res = await fetch("/api/files", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({filename: file.name, mimeType: file.type, size: file.size, category, title: file.name}),
    })
    if (!res.ok) throw new Error((await res.json()).error ?? "Ошибка создания файла")
    const {file: saved} = await res.json()

    const put = await fetch(`/api/files/${saved.id}/upload`, {
        method: "PUT",
        body: file,
        headers: {"Content-Type": file.type || "application/octet-stream"},
    })
    if (!put.ok) throw new Error("Ошибка загрузки")
    return saved
}

export async function getPreviewUrl(id: string): Promise<string> {
    const r = await fetch(`/api/files/${id}/url`)
    if (!r.ok) return ""
    const {url} = await r.json()
    return url ?? ""
}
