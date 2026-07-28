import { NextResponse } from "next/server"
import { getSessionUser, getSessionDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { SpecialistContractStatus } from "@prisma/client"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"

/**
 * Админ фиксирует договор после того, как специалист нажал «Подписан» в онбординге.
 * Ставит SIGNED_BY_ADMIN и отмечает шаг CONTRACT пройденным — дизайнер видит этап завершенным.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const dbAdmin = await getSessionDbUser(user)
  const { id: specialistUserId } = await params

  const profile = await prisma.specialistProfile.findUnique({ where: { userId: specialistUserId } })
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!profile.specialistContractS3Key?.trim()) {
    return NextResponse.json({ error: "Сначала загрузите PDF договора." }, { status: 400 })
  }

  if (profile.specialistContractStatus === SpecialistContractStatus.SIGNED_BY_ADMIN) {
    return NextResponse.json({ ok: true, alreadySigned: true })
  }

  if (profile.specialistContractStatus !== SpecialistContractStatus.SIGNED_BY_SPECIALIST) {
    return NextResponse.json(
      { error: "Специалист еще не подтвердил подписание договора в онбординге." },
      { status: 409 },
    )
  }

  await prisma.specialistProfile.update({
    where: { id: profile.id },
    data: { specialistContractStatus: SpecialistContractStatus.SIGNED_BY_ADMIN },
  })

  const existing = await prisma.onboardingStep.findFirst({
    where: { profileId: profile.id, type: "CONTRACT" },
  })
  if (existing) {
    await prisma.onboardingStep.update({
      where: { id: existing.id },
      data: { status: "PASSED", comment: existing.comment },
    })
  } else {
    await prisma.onboardingStep.create({
      data: { profileId: profile.id, type: "CONTRACT", status: "PASSED" },
    })
  }

  // Auto-activate if all steps passed
  const allSteps = await prisma.onboardingStep.findMany({ where: { profileId: profile.id } })
  const passedTypes = new Set(allSteps.filter(s => s.status === "PASSED").map(s => s.type))
  const has = (t: string) => {
    if (t === "REGULATIONS_READ") return passedTypes.has("REGULATIONS_READ" as never) || passedTypes.has("REGULATIONS" as never)
    return passedTypes.has(t as never)
  }
  const allPassed = ["FORM", "TEST", "INTERVIEW", "REGULATIONS_READ", "REGULATIONS", "CONTRACT"].every(has)
  if (allPassed && profile.onboardingStatus !== "ACTIVE") {
    await prisma.specialistProfile.update({
      where: { id: profile.id },
      data: { onboardingStatus: "ACTIVE" },
    })
  }

  await audit(dbAdmin?.id ?? null, "specialist_contract_admin_signed", "SpecialistProfile", profile.id, {
    specialistContractStatus: { to: "SIGNED_BY_ADMIN" },
  })

  await notify(specialistUserId, "contract_confirmed", "Договор подтвержден", "Администратор подтвердил ваш договор. Добро пожаловать на платформу!", "/work/community")

  return NextResponse.json({ ok: true })
}
