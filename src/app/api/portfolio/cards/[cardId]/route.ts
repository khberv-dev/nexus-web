import { NextRequest, NextResponse } from "next/server"
import { getOrCreateDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

async function getScopedCard(cardId: string, userId: string) {
  return prisma.portfolioCard.findFirst({
    where: {
      id: cardId,
      project: { userId },
    },
    select: { id: true },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { cardId } = await params
  const card = await prisma.portfolioCard.findFirst({
    where: { id: cardId, project: { userId: dbUser.id } },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
      mainFile: { select: { id: true, filename: true, mimeType: true, title: true } },
      attachments: {
        select: {
          id: true,
          linkedVisualFileId: true,
          file: { select: { id: true, filename: true, mimeType: true, title: true } },
        },
      },
    },
  })
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(card)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { cardId } = await params
  const card = await getScopedCard(cardId, dbUser.id)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json()) as {
    title?: string
    description?: string | null
    mainFileId?: string | null
  }
  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json({ error: "Укажите название работы" }, { status: 400 })
  }

  if (body.mainFileId) {
    const file = await prisma.userFile.findFirst({
      where: { id: body.mainFileId, userId: dbUser.id },
      select: { id: true },
    })
    if (!file) return NextResponse.json({ error: "Invalid file ownership" }, { status: 400 })
  }

  const updated = await prisma.portfolioCard.update({
    where: { id: cardId },
    data: {
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      description: typeof body.description === "string" ? body.description.trim() : body.description,
      mainFileId: body.mainFileId !== undefined ? body.mainFileId : undefined,
    },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      mainFile: { select: { id: true, filename: true, mimeType: true, title: true } },
      attachments: {
        select: {
          id: true,
          linkedVisualFileId: true,
          file: { select: { id: true, filename: true, mimeType: true, title: true } },
        },
      },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { cardId } = await params
  const card = await getScopedCard(cardId, dbUser.id)
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.portfolioCard.delete({ where: { id: cardId } })
  return NextResponse.json({ ok: true })
}
