import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { notify } from "@/lib/notifications"

// POST — отправить сборку на модерацию
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const dbUser = await getOrCreateDbUser(user)

  const bundle = await prisma.landingBundle.findUnique({ where: { id }, include: { items: true } })
  if (!bundle || bundle.userId !== dbUser.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (bundle.status !== "DRAFT" && bundle.status !== "REJECTED") {
    return NextResponse.json({ error: "Нельзя отправить эту сборку" }, { status: 400 })
  }
  if (!bundle.portraitFileId || !bundle.workFileId) {
    return NextResponse.json({ error: "Портрет и фото интерьера обязательны" }, { status: 400 })
  }

  const updated = await prisma.landingBundle.update({
    where: { id },
    data: { status: "PENDING_REVIEW" },
    include: { items: { orderBy: { position: "asc" } } },
  })

  // Notify all admins
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
  const specName = dbUser.name ?? dbUser.email ?? "Специалист"
  for (const admin of admins) {
    await notify(admin.id, "landing_bundle_submitted", "Новая сборка на модерацию", `${specName} отправил сборку для лендинга`, "/admin/landing")
  }

  return NextResponse.json(updated)
}
