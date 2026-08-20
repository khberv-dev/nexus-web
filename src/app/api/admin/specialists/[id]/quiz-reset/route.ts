import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {notifySpecialistStep} from "@/lib/onboarding/notify-step"

/** Сброс незавершенного квиза (шаг TEST в статусе IN_PROGRESS). Только администратор. */
export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const admin = await getSessionUser()
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: userId} = await params

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const testStep = profile.steps.find((s) => s.type === "TEST")
    if (!testStep || testStep.status !== "IN_PROGRESS") {
        return NextResponse.json({ok: true, cleared: false})
    }

    await prisma.onboardingStep.delete({where: {id: testStep.id}})

    const dbAdmin = await prisma.user.findUnique({where: {email: admin.email}, select: {id: true}})
    await audit(dbAdmin?.id ?? null, "specialist_quiz_progress_reset", "User", userId, {
        specialistId: {to: userId},
    })

    await notifySpecialistStep({
        userId,
        status: "TEST_RESET",
        title: "Прогресс теста сброшен",
        message: "Администратор сбросил сохранённый прогресс квалификационного теста — попытку можно начать заново.",
        url: "/onboarding/test",
    })

    return NextResponse.json({ok: true, cleared: true})
}
