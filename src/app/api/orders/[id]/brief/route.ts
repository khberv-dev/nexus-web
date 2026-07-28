import { NextRequest, NextResponse } from "next/server"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { audit, diff } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const dbUser = await getSessionDbUser(user)
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order || order.deletedAt || order.clientId !== dbUser?.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (order.status !== "DRAFT") return NextResponse.json({ error: "Brief is locked" }, { status: 409 })

  const body = await req.json()
  const { _briefStep, _briefHelpRequested, ...rest } = body as Record<string, unknown>

  // Save all brief fields
  const briefData: Record<string, string> = {}
  for (const [k, v] of Object.entries(rest)) {
    if (typeof v === "string") briefData[k] = v.slice(0, 2000)
    else if (typeof v === "number" && Number.isFinite(v)) briefData[k] = String(v).slice(0, 2000)
    else if (typeof v === "boolean") briefData[k] = (v ? "true" : "false").slice(0, 2000)
  }

  const before = (order.briefData as Record<string, string>) ?? {}
  const merged = { ...before, ...briefData }

  const data: Record<string, unknown> = { briefData: merged }
  if (typeof _briefStep === "number") data.briefStep = _briefStep
  if (typeof _briefHelpRequested === "boolean") data.briefHelpRequested = _briefHelpRequested

  const changes = diff(before, merged)

  const updated = await prisma.order.update({ where: { id }, data })

  if (changes) await audit(dbUser?.id ?? null, "brief_updated", "Order", id, changes)

  return NextResponse.json(updated)
}
