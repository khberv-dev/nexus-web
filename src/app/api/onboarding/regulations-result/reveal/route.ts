import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {QUIZ_QUESTIONS} from "@/app/onboarding/regulations/quiz-questions"

/** POST — сохранить один ответ квиза регламентов */
export async function POST(req: NextRequest) {
    const session = await getSessionUser()
    if (!session || session.role !== "SPECIALIST") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {questionIndex, selectedIndex} = await req.json() as {
        questionIndex: number
        selectedIndex: number
    }

    if (
        typeof questionIndex !== "number" ||
        !Number.isInteger(questionIndex) ||
        questionIndex < 0 ||
        questionIndex >= QUIZ_QUESTIONS.length ||
        typeof selectedIndex !== "number" ||
        !Number.isInteger(selectedIndex) ||
        selectedIndex < 0 ||
        selectedIndex > 3
    ) {
        return NextResponse.json({error: "Некорректные данные"}, {status: 400})
    }

    const profile = await prisma.specialistProfile.findUnique({
        where: {userId: session.id},
        include: {steps: true},
    })
    if (!profile) return NextResponse.json({error: "Not found"}, {status: 404})

    const q = QUIZ_QUESTIONS[questionIndex]
    const isCorrect = selectedIndex === q.correct

    const existing = profile.steps.find(s => s.type === "REGULATIONS")

    // Parse existing in-progress state
    let prevData: {
        answers?: Record<string, number>;
        score?: number;
        sectionScores?: Record<string, { correct: number; total: number }>
    } = {}
    if (existing?.status === "IN_PROGRESS" && existing.comment) {
        try {
            prevData = JSON.parse(existing.comment)
        } catch { /* ignore */
        }
    }

    // Don't overwrite already-saved answer
    if (prevData.answers?.[String(questionIndex)] !== undefined) {
        return NextResponse.json({isCorrect, correctIndex: q.correct, explain: q.explain})
    }

    const answers = {...(prevData.answers ?? {}), [String(questionIndex)]: selectedIndex}
    const score = (prevData.score ?? 0) + (isCorrect ? 1 : 0)

    // Update section scores
    const sectionScores: Record<string, { correct: number; total: number }> = prevData.sectionScores ?? {}
    if (!sectionScores[q.section]) {
        // Initialize all sections if first answer
        for (const question of QUIZ_QUESTIONS) {
            if (!sectionScores[question.section]) sectionScores[question.section] = {correct: 0, total: 0}
            sectionScores[question.section].total = QUIZ_QUESTIONS.filter(qq => qq.section === question.section).length
        }
    }
    if (isCorrect) sectionScores[q.section] = {
        ...sectionScores[q.section],
        correct: (sectionScores[q.section]?.correct ?? 0) + 1
    }

    const comment = JSON.stringify({answers, score, sectionScores})

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

    return NextResponse.json({isCorrect, correctIndex: q.correct, explain: q.explain})
}
