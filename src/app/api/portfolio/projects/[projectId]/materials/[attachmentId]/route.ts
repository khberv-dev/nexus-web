import { NextRequest, NextResponse } from "next/server"
import { getOrCreateDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; attachmentId: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { projectId, attachmentId } = await params

  const row = await prisma.portfolioProjectAttachment.findFirst({
    where: {
      id: attachmentId,
      projectId,
      project: { userId: dbUser.id },
    },
    select: { id: true },
  })
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.portfolioProjectAttachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
