import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { getDownloadUrl } from "@/lib/s3"

/** Download stage rules PDF (available to order participants). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { order: { select: { clientId: true, specialistId: true } } },
  })
  if (!stage?.rulesS3Key) return NextResponse.json({ error: "No rules" }, { status: 404 })

  const hasAccess =
    user.role === "ADMIN" ||
    user.id === stage.order.clientId ||
    user.id === stage.order.specialistId
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { url } = await getDownloadUrl(stage.rulesS3Key)
  return NextResponse.redirect(url)
}

