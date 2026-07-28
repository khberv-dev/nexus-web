import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

// PATCH — обновить черновик / отклоненную сборку
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const dbUser = await getOrCreateDbUser(user)

  const bundle = await prisma.landingBundle.findUnique({ where: { id } })
  if (!bundle || bundle.userId !== dbUser.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (bundle.status !== "DRAFT" && bundle.status !== "REJECTED") {
    return NextResponse.json({ error: "Сборка заблокирована для редактирования" }, { status: 403 })
  }

  const { portraitFileId, workFileId, workPos, videoFileId, specialty, about, portfolioFileIds } = await req.json()

  await prisma.landingBundle.update({
    where: { id },
    data: {
      ...(portraitFileId !== undefined && { portraitFileId }),
      ...(workFileId !== undefined && { workFileId }),
      ...(workPos !== undefined && { workPos }),
      ...(videoFileId !== undefined && { videoFileId }),
      ...(specialty !== undefined && { specialty }),
      ...(about !== undefined && { about }),
      ...(bundle.status === "REJECTED" && { rejectReason: null }),
    },
  })

  if (Array.isArray(portfolioFileIds)) {
    await prisma.landingBundleItem.deleteMany({ where: { bundleId: id } })
    if (portfolioFileIds.length > 0) {
      await prisma.landingBundleItem.createMany({
        data: portfolioFileIds.slice(0, 3).map((fileId: string, i: number) => ({
          bundleId: id, fileId, position: i,
        })),
      })
    }
  }

  const updated = await prisma.landingBundle.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } } },
  })
  return NextResponse.json(updated)
}

// DELETE — удалить черновик
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const dbUser = await getOrCreateDbUser(user)

  const bundle = await prisma.landingBundle.findUnique({ where: { id } })
  if (!bundle || bundle.userId !== dbUser.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (bundle.status === "APPROVED") {
    return NextResponse.json({ error: "Нельзя удалить одобренную сборку" }, { status: 403 })
  }

  await prisma.landingBundle.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
