import { NextRequest, NextResponse } from "next/server"
import { getOrCreateDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { resolvePortfolioAttachmentVisualLink } from "@/lib/portfolioLinkedVisual"

async function getScopedCard(cardId: string, userId: string) {
  return prisma.portfolioCard.findFirst({
    where: { id: cardId, project: { userId } },
    select: { id: true },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { cardId } = await params
  const card = await getScopedCard(cardId, dbUser.id)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json()) as { fileId?: string; linkedVisualFileId?: string | null }
  if (!body.fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })

  const file = await prisma.userFile.findFirst({
    where: { id: body.fileId, userId: dbUser.id },
    select: { id: true },
  })
  if (!file) return NextResponse.json({ error: "Invalid file ownership" }, { status: 400 })

  const hasKey = "linkedVisualFileId" in body
  let linkedVisualFileId: string | null = null
  try {
    linkedVisualFileId = hasKey
      ? await resolvePortfolioAttachmentVisualLink(cardId, body.fileId, body.linkedVisualFileId ?? null)
      : null
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const link = await prisma.portfolioCardAttachment.upsert({
    where: { cardId_fileId: { cardId, fileId: body.fileId } },
    create: { cardId, fileId: body.fileId, linkedVisualFileId },
    update: hasKey ? { linkedVisualFileId } : {},
    select: {
      id: true,
      linkedVisualFileId: true,
      file: { select: { id: true, filename: true, mimeType: true, title: true } },
    },
  })

  return NextResponse.json(link, { status: 201 })
}
