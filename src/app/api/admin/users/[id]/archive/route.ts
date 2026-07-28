import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { audit } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser()
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const { archived } = await req.json() as { archived?: boolean }
  if (typeof archived !== "boolean") {
    return NextResponse.json({ error: "archived must be boolean" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, archivedAt: true },
  })
  if (!target || (target.role !== "CLIENT" && target.role !== "SPECIALIST")) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const archivedAt = archived ? new Date() : null
  const updated = await prisma.user.update({
    where: { id },
    data: { archivedAt },
    select: { id: true, archivedAt: true, role: true },
  })

  await audit(admin.id, archived ? "user_archived" : "user_restored", "User", id, {
    archivedAt: { from: target.archivedAt?.toISOString() ?? null, to: archivedAt?.toISOString() ?? null },
  })

  return NextResponse.json({ ok: true, user: updated })
}
