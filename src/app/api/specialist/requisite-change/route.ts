import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { notify } from "@/lib/notifications"
import { audit } from "@/lib/audit"
import { parseJsonBody } from "@/lib/validate"

// Free-form requisite formData object — lenient (only known string fields are
// picked downstream via pickRequisites), but rejects non-object bodies.
const requisiteFormSchema = z.record(z.string(), z.unknown())

const REQUISITE_FIELDS = ["bankAccount", "bankName", "bankBik", "corrAccount", "inn", "kpp", "ogrn", "ogrnip", "legalAddress", "companyName", "ipName"] as const

function pickRequisites(data: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of REQUISITE_FIELDS) {
    if (typeof data[key] === "string" && data[key]) result[key] = data[key] as string
  }
  return result
}

function hasRequisiteChanges(oldData: Record<string, unknown>, newData: Record<string, unknown>): boolean {
  for (const key of REQUISITE_FIELDS) {
    const oldVal = typeof oldData[key] === "string" ? oldData[key] : ""
    const newVal = typeof newData[key] === "string" ? newData[key] : ""
    if (oldVal !== newVal) return true
  }
  return false
}

/** GET — получить текущий pending-запрос специалиста */
export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== "SPECIALIST") return NextResponse.json(null)

  const pending = await prisma.requisiteChangeRequest.findFirst({
    where: { specialistId: user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(pending)
}

/** POST — создать запрос на смену реквизитов */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const profile = await prisma.specialistProfile.findUnique({ where: { userId: user.id } })
  if (!profile) return NextResponse.json({ error: "Профиль не найден" }, { status: 404 })

  const parsed = await parseJsonBody(req, requisiteFormSchema)
  if (!parsed.ok) return parsed.response
  const newFormData = parsed.data as Record<string, unknown>
  const oldFormData = (profile.formData ?? {}) as Record<string, unknown>

  if (!hasRequisiteChanges(oldFormData, newFormData)) {
    return NextResponse.json({ error: "Реквизиты не изменились" }, { status: 400 })
  }

  // Check no pending request exists
  const existing = await prisma.requisiteChangeRequest.findFirst({
    where: { specialistId: user.id, status: "PENDING" },
  })
  if (existing) {
    return NextResponse.json({ error: "У вас уже есть запрос на рассмотрении" }, { status: 409 })
  }

  const request = await prisma.requisiteChangeRequest.create({
    data: {
      specialistId: user.id,
      oldData: pickRequisites(oldFormData),
      newData: pickRequisites(newFormData),
    },
  })

  // Notify admins
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
  for (const admin of admins) {
    void notify(admin.id, "requisite_change", "Запрос на смену реквизитов", `Специалист ${user.name ?? user.email} запросил смену реквизитов`, "/admin/specialists")
  }

  await audit(user.id, "requisite_change_requested", "User", user.id, { requestId: { to: request.id } })

  return NextResponse.json({ ok: true, requestId: request.id })
}
