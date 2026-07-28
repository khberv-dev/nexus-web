import { NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

// GET — список сборок текущего специалиста
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const dbUser = await getOrCreateDbUser(user)

  const bundles = await prisma.landingBundle.findMany({
    where: { userId: dbUser.id },
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(bundles)
}

// POST — создать черновик
export async function POST() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const dbUser = await getOrCreateDbUser(user)

    const existing = await prisma.landingBundle.findFirst({
      where: { userId: dbUser.id, status: { in: ["DRAFT", "PENDING_REVIEW"] } },
    })
    if (existing) return NextResponse.json({ error: "У вас уже есть активная сборка", id: existing.id }, { status: 409 })

    const bundle = await prisma.landingBundle.create({
      data: { userId: dbUser.id },
      include: { items: true },
    })
    return NextResponse.json(bundle)
  } catch (e) {
    console.error("[landing-bundle POST]", e)
    return NextResponse.json({ error: (e as Error).message ?? "Internal error" }, { status: 500 })
  }
}
