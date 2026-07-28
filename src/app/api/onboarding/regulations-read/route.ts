import { NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"

/** GET — статус шага ознакомления с регламентом */
export async function GET() {
  const session = await getSessionUser()
  if (!session || session.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const profile = await prisma.specialistProfile.findUnique({
    where: { userId: session.id },
    include: { steps: true },
  })
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const step = profile.steps.find(s => s.type === "REGULATIONS_READ")
  // Backward-compat: if quiz passed, treat read as done.
  const quiz = profile.steps.find(s => s.type === "REGULATIONS" && s.status === "PASSED")
  const done = Boolean(quiz) || step?.status === "PASSED"
  return NextResponse.json({ done })
}

/** POST — отметить шаг ознакомления как пройденный */
export async function POST() {
  const session = await getSessionUser()
  if (!session || session.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const profile = await prisma.specialistProfile.findUnique({
    where: { userId: session.id },
    include: { steps: true },
  })
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const existing = profile.steps.find(s => s.type === "REGULATIONS_READ")
  const comment = JSON.stringify({ confirmedAt: new Date().toISOString() })

  if (existing) {
    await prisma.onboardingStep.update({
      where: { id: existing.id },
      data: { status: "PASSED", comment },
    })
  } else {
    await prisma.onboardingStep.create({
      data: { profileId: profile.id, type: "REGULATIONS_READ", status: "PASSED", comment },
    })
  }

  return NextResponse.json({ ok: true })
}

