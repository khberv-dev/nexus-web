import { prisma } from "@/lib/db/prisma"
import { isPortfolioVisualFile } from "@/lib/portfolioVisualFile"

/**
 * Проверяет, что linkedVisualFileId — это главный файл карточки или файл одного из вложений,
 * и что это изображение. Возвращает нормализованный id или null.
 */
export async function resolvePortfolioAttachmentVisualLink(
  cardId: string,
  attachingFileId: string,
  linkedVisualFileId: string | null | undefined,
): Promise<string | null> {
  if (linkedVisualFileId == null || linkedVisualFileId === "") return null
  if (linkedVisualFileId === attachingFileId) {
    throw new Error("Нельзя привязать файл к самому себе")
  }

  const card = await prisma.portfolioCard.findFirst({
    where: { id: cardId },
    select: {
      mainFileId: true,
      attachments: { select: { fileId: true } },
    },
  })
  if (!card) throw new Error("Работа не найдена")

  const allowedIds = new Set<string>()
  if (card.mainFileId) allowedIds.add(card.mainFileId)
  for (const a of card.attachments) allowedIds.add(a.fileId)

  if (!allowedIds.has(linkedVisualFileId)) {
    throw new Error("Привязка возможна только к главному фото или к файлу из этой же работы")
  }

  const visual = await prisma.userFile.findFirst({
    where: { id: linkedVisualFileId },
    select: { mimeType: true, filename: true },
  })
  if (!visual || !isPortfolioVisualFile(visual.mimeType, visual.filename)) {
    throw new Error("Привязка возможна только к изображению (главное фото или кадр из галереи)")
  }

  return linkedVisualFileId
}
