import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { audit, diff } from "@/lib/audit"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    rating?: number
    featuredOnLanding?: boolean
    formData?: Record<string, string>
  }

  const dbUser = await prisma.user.findUnique({
    where: { id },
    include: { specialistProfile: true },
  })
  if (!dbUser?.specialistProfile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const nextFormData =
    body.formData && typeof body.formData === "object"
      ? body.formData
      : (dbUser.specialistProfile.formData as Record<string, string> | null) ?? null

  const fullName = typeof nextFormData?.fullName === "string" && nextFormData.fullName.trim()
    ? nextFormData.fullName.trim()
    : dbUser.name
  const phone = typeof nextFormData?.phone === "string" && nextFormData.phone.trim()
    ? nextFormData.phone.trim()
    : null
  const bio = typeof nextFormData?.about === "string" && nextFormData.about.trim()
    ? nextFormData.about.trim()
    : null

  await prisma.user.update({
    where: { id },
    data: {
      name: fullName ?? undefined,
      phone,
    },
  })

  const updated = await prisma.specialistProfile.update({
    where: { userId: id },
    data: {
      rating: body.rating ?? undefined,
      featuredOnLanding: body.featuredOnLanding ?? undefined,
      bio,
      ...(body.formData ? { formData: nextFormData as Prisma.InputJsonValue } : {}),
    },
  })

  if (body.formData) {
    await audit(user.id, "specialist_profile_edited_by_admin", "User", id, diff(
      ((dbUser.specialistProfile.formData as Record<string, unknown> | null) ?? {}),
      nextFormData ?? {},
    ))
  }

  return NextResponse.json(updated)
}
