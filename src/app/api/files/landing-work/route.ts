import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

type SelectableCategory = "LANDING_WORK" | "PORTRAIT" | "INTRO_VIDEO"

// PUT /api/files/landing-work  body: { fileId: "...", category?: "LANDING_WORK"|"PORTRAIT"|"INTRO_VIDEO" }
// Marks one file in category as selected for homepage (landingOrder=0)
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { fileId, category } = (await req.json()) as { fileId?: string; category?: SelectableCategory }
  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 })
  const fileCategory: SelectableCategory = category ?? "LANDING_WORK"

  await prisma.userFile.updateMany({
    where: { userId: dbUser.id, category: fileCategory, landingOrder: { not: null } },
    data: { landingOrder: null },
  })

  const updated = await prisma.userFile.updateMany({
    where: { id: fileId, userId: dbUser.id, category: fileCategory },
    data: { landingOrder: 0 },
  })

  if (!updated.count) return NextResponse.json({ error: "File not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
