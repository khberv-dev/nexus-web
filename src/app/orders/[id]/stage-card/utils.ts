export function isVideoFilename(name: string) {
  return /\.(mp4|webm|mov)$/i.test(name.replace(/^🎬\s*/, ""))
}

export function formatWaveDt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function clientFileTimeIso(f: { createdAt?: string; uploadedAt?: string }) {
  return (f.createdAt?.trim() || f.uploadedAt?.trim() || "").trim()
}

