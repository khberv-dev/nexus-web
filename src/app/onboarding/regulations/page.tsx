import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import RegulationsClient from "./RegulationsClient"

export default async function OnboardingRegulationsPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "SPECIALIST") redirect("/orders")

  const profile = await prisma.specialistProfile.findUnique({
    where: { userId: user.id },
    include: { steps: true },
  })
  if (!profile) redirect("/onboarding")

  const passed = new Set(profile.steps.filter(s => s.status === "PASSED").map(s => s.type))
  // Backward-compat: if quiz already passed, allow access.
  const readDone = passed.has("REGULATIONS_READ" as never) || passed.has("REGULATIONS" as never)
  if (!readDone) redirect("/onboarding/regulations/read")

  return <RegulationsClient />
}
