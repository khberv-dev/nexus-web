import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"

/** GET — вернуть текущий прогресс (resume) квиза регламентов */
export async function GET() {
    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const step = profile.steps.find(s => s.type === "REGULATIONS")
    if (!step?.comment) return NextResponse.json({resume: null})

    try {
        const data = JSON.parse(step.comment)
        // Only return resume if quiz is in progress (not yet finished)
        if (step.status === "IN_PROGRESS" && data.answers) {
            return NextResponse.json({
                resume: {
                    answers: data.answers,
                    score: data.score ?? 0,
                    sectionScores: data.sectionScores ?? {}
                }
            })
        }
    } catch { /* ignore */
    }

    return NextResponse.json({resume: null})
}

/** POST — сохранить результаты квиза регламентов в comment шага REGULATIONS */
export async function POST(req: NextRequest) {
    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {score, total, pct, sectionScores, answers} = await req.json() as {
        score: number; total: number; pct: number; passed: boolean
        sectionScores: Record<string, { correct: number; total: number }>
        answers: Record<string, number>
    }
    const passed = total > 0 && Math.round((score / total) * 100) >= 80

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const comment = JSON.stringify({
        score,
        total,
        pct,
        passed,
        sectionScores,
        answers,
        finishedAt: new Date().toISOString()
    })

    const existing = profile.steps.find(s => s.type === "REGULATIONS")
    if (existing) {
        await prisma.onboardingStep.update({
            where: {id: existing.id},
            data: {status: passed ? "PASSED" : "IN_PROGRESS", comment},
        })
    } else {
        await prisma.onboardingStep.create({
            data: {profileId: profile.id, type: "REGULATIONS", status: passed ? "PASSED" : "IN_PROGRESS", comment},
        })
    }

    return NextResponse.json({ok: true})
}
