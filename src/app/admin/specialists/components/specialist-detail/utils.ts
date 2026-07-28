export function boolRu(v: string | undefined): string {
  if (v === "true") return "Да"
  if (v === "false") return "Нет"
  return ""
}

export async function openAdminFileDownload(fileId: string): Promise<void> {
  const r = await fetch(`/api/admin/files/${fileId}/url`)
  if (r.ok) {
    const { url } = (await r.json()) as { url: string }
    window.open(url, "_blank", "noopener,noreferrer")
  }
}
