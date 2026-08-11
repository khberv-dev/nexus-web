import {redirect} from "next/navigation"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import RegulationsReadClient from "./RegulationsReadClient"

export default async function RegulationsReadPage() {
    const user = await getSessionUser()
    if (!user) redirect("/login")
    if (user.role !== "SPECIALIST") redirect("/orders")

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: user.id},
        include: {steps: true},
    })
    if (!profile) redirect("/onboarding")

    // If quiz already passed (old flow) — skip read step.
    const passed = new Set(profile.steps.filter(s => s.status === "PASSED").map(s => s.type))
    if (passed.has("REGULATIONS" as never)) redirect("/onboarding/regulations")

    return <RegulationsReadClient/>
}

