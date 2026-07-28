import { NextRequest, NextResponse } from "next/server"
import { getOrCreateDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

async function getScopedProject(projectId: string, userId: string) {
  return prisma.portfolioProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { projectId } = await params
  const project = await getScopedProject(projectId, dbUser.id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const rows = await prisma.portfolioProjectAttachment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      file: { select: { id: true, filename: true, mimeType: true, title: true } },
    },
  })

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { projectId } = await params
  const project = await getScopedProject(projectId, dbUser.id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json()) as { fileId?: string }
  if (!body.fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })

  const file = await prisma.userFile.findFirst({
    where: { id: body.fileId, userId: dbUser.id },
    select: { id: true },
  })
  if (!file) return NextResponse.json({ error: "Invalid file ownership" }, { status: 400 })

  const row = await prisma.portfolioProjectAttachment.upsert({
    where: { projectId_fileId: { projectId, fileId: body.fileId } },
    create: { projectId, fileId: body.fileId },
    update: {},
    select: {
      id: true,
      file: { select: { id: true, filename: true, mimeType: true, title: true } },
    },
  })

  return NextResponse.json(row, { status: 201 })
}
