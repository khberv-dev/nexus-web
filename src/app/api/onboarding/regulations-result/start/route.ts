import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {
    buildRegulationsQuizState,
    buildRegulationsSessionPayload,
} from "@/lib/onboarding/regulations-quiz"

/** POST — старт новой попытки: вопросы и варианты перемешиваются, у первого вопроса появляется дедлайн. */
export async function POST() {
    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const existing = profile.steps.find((s) => s.type === "REGULATIONS")
    if (existing?.status === "PASSED") {
        return NextResponse.json({error: "Тест по регламентам уже пройден"}, {status: 409})
    }

    const state = buildRegulationsQuizState()
    const comment = JSON.stringify(state)

    if (existing) {
        await prisma.onboardingStep.update({
            where: {id: existing.id},
            data: {status: "IN_PROGRESS", comment},
        })
    } else {
        await prisma.onboardingStep.create({
            data: {profileId: profile.id, type: "REGULATIONS", status: "IN_PROGRESS", comment},
        })
    }

    return NextResponse.json({session: buildRegulationsSessionPayload(state)})
}
