import { prisma } from "@/lib/db/prisma"
import { isPortfolioVisualFile } from "@/lib/portfolioVisualFile"

export type AttachmentCreateSpec = { fileId: string; linkedVisualFileId?: string | null }

/**
 * Валидация при создании работы: привязки только к главному файлу или к файлу из того же списка вложений (изображения).
 */
export async function validateAttachmentSpecsForNewCard(
  userId: string,
  mainFileId: string | null,
  specs: AttachmentCreateSpec[],
) {
  const fileIds = [...new Set(specs.map((s) => s.fileId))]
  if (fileIds.length === 0) return

  const files = await prisma.userFile.findMany({
    where: { id: { in: fileIds }, userId },
    select: { id: true, mimeType: true, filename: true },
  })
  if (files.length !== fileIds.length) {
    throw new Error("Недопустимые файлы вложений")
  }
  const meta = new Map(files.map((f) => [f.id, f]))

  for (const s of specs) {
    const L = s.linkedVisualFileId ?? null
    if (L == null || L === "") continue
    if (L === s.fileId) throw new Error("Нельзя привязать файл к самому себе")
    if (L !== mainFileId && !fileIds.includes(L)) {
      throw new Error("Привязка возможна только к главному фото или к изображению из той же работы")
    }
    const target = meta.get(L)
    if (!target || !isPortfolioVisualFile(target.mimeType, target.filename)) {
      throw new Error("Привязка возможна только к изображению")
    }
  }
}
