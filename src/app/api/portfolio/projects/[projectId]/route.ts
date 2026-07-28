import { NextRequest, NextResponse } from "next/server"
import { getOrCreateDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

async function getScopedProject(projectId: string, userId: string) {
  return prisma.portfolioProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { projectId } = await params
  const project = await getScopedProject(projectId, dbUser.id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json()) as { name?: string }
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: "Project name is required" }, { status: 400 })

  const updated = await prisma.portfolioProject.update({
    where: { id: projectId },
    data: { name },
    select: { id: true, name: true, updatedAt: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { projectId } = await params
  const project = await getScopedProject(projectId, dbUser.id)
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.portfolioProject.delete({ where: { id: projectId } })
  return NextResponse.json({ ok: true })
}
