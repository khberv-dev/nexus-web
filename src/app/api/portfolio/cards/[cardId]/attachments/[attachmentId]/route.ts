import { NextRequest, NextResponse } from "next/server"
import { getOrCreateDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { resolvePortfolioAttachmentVisualLink } from "@/lib/portfolioLinkedVisual"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string; attachmentId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { cardId, attachmentId } = await params

  const attachment = await prisma.portfolioCardAttachment.findFirst({
    where: {
      id: attachmentId,
      cardId,
      card: { project: { userId: dbUser.id } },
    },
    select: { id: true, fileId: true },
  })
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json()) as { linkedVisualFileId?: string | null }
  if (!("linkedVisualFileId" in body)) {
    return NextResponse.json({ error: "linkedVisualFileId is required" }, { status: 400 })
  }

  let linkedVisualFileId: string | null
  try {
    linkedVisualFileId = await resolvePortfolioAttachmentVisualLink(
      cardId,
      attachment.fileId,
      body.linkedVisualFileId,
    )
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const updated = await prisma.portfolioCardAttachment.update({
    where: { id: attachmentId },
    data: { linkedVisualFileId },
    select: {
      id: true,
      linkedVisualFileId: true,
      file: { select: { id: true, filename: true, mimeType: true, title: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string; attachmentId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { cardId, attachmentId } = await params

  const attachment = await prisma.portfolioCardAttachment.findFirst({
    where: {
      id: attachmentId,
      cardId,
      card: { project: { userId: dbUser.id } },
    },
    select: { id: true },
  })
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.portfolioCardAttachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
