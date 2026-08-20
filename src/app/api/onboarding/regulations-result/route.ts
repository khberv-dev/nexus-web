import {NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {
    buildRegulationsSessionPayload,
    gradeRegulationsQuiz,
    parseRegulationsQuizState,
    REGULATIONS_TOTAL,
} from "@/lib/onboarding/regulations-quiz"

/** GET — активная сессия теста регламентов (перемешанные вопросы + дедлайн) и последний результат. */
export async function GET() {
    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const step = profile.steps.find((s) => s.type === "REGULATIONS")
    if (!step?.comment) return NextResponse.json({session: null, result: null})

    const state = parseRegulationsQuizState(step.comment)
    if (state && step.status === "IN_PROGRESS") {
        return NextResponse.json({session: buildRegulationsSessionPayload(state), result: null})
    }

    let result: unknown = null
    try {
        const parsed = JSON.parse(step.comment) as Record<string, unknown>
        if (parsed?.finishedAt) {
            result = {
                score: Number(parsed.score ?? 0),
                total: Number(parsed.total ?? REGULATIONS_TOTAL),
                pct: Number(parsed.pct ?? 0),
                passed: Boolean(parsed.passed),
                sectionScores: parsed.sectionScores ?? {},
                finishedAt: parsed.finishedAt,
            }
        }
    } catch { /* ignore */
    }

    return NextResponse.json({session: null, result})
}

/** POST — завершение попытки: результат считается на сервере по сохранённым ответам. */
export async function POST() {
    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const existing = profile.steps.find((s) => s.type === "REGULATIONS")
    const state = parseRegulationsQuizState(existing?.comment ?? null)
    if (!state) {
        return NextResponse.json({error: "Активная попытка не найдена, начните тест заново"}, {status: 409})
    }

    const grade = gradeRegulationsQuiz(state.answers)
    const comment = JSON.stringify({
        score: grade.score,
        total: grade.total,
        pct: grade.pct,
        passed: grade.passed,
        sectionScores: grade.sectionScores,
        answers: state.answers,
        questionOrder: state.questionOrder,
        optionOrder: state.optionOrder,
        startedAt: state.startedAt,
        finishedAt: new Date().toISOString(),
    })

    if (existing) {
        await prisma.onboardingStep.update({
            where: {id: existing.id},
            data: {status: grade.passed ? "PASSED" : "IN_PROGRESS", comment},
        })
    } else {
        await prisma.onboardingStep.create({
            data: {
                profileId: profile.id,
                type: "REGULATIONS",
                status: grade.passed ? "PASSED" : "IN_PROGRESS",
                comment,
            },
        })
    }

    return NextResponse.json({ok: true, ...grade})
}
