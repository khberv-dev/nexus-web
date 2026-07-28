import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { audit } from "@/lib/audit"
import { notify } from "@/lib/notifications"
import { parseQuizLevelState } from "@/lib/onboarding/levels/state"
import type { QuizLevelCode } from "@/lib/onboarding/levels/types"
import { sendEmail } from "@/lib/email"

/** Подтверждение админом пройденного уровня теста (L1–L4). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser()
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: userId } = await params

  const profile = await prisma.specialistProfile.findUnique({
    where: { userId },
    include: { steps: true, user: { select: { id: true } } },
  })
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const testStep = profile.steps.find((s) => s.type === "TEST")
  if (!testStep?.comment) return NextResponse.json({ error: "Нет данных теста" }, { status: 409 })

  const state = parseQuizLevelState(testStep.comment)
  const pending = state?.pendingApprovalLevel ?? null
  if (!state || !pending) {
    return NextResponse.json({ error: "Нет уровня, ожидающего подтверждения" }, { status: 409 })
  }

  const passed = new Set<QuizLevelCode>(state.passedLevels ?? [])
  passed.add(pending)
  const allPassed = ["L1", "L2", "L3", "L4"].every((lvl) => passed.has(lvl as QuizLevelCode))

  const nextState = {
    ...state,
    version: 5 as const,
    phase: "level_finished" as const,
    currentLevel: pending,
    currentQuestionId: 0,
    questionDeadlineAt: null,
    answers: {},
    answeredCount: 0,
    liveCorrect: 0,
    lastQuestionId: 0,
    passedLevels: Array.from(passed),
    pendingApprovalLevel: null,
  }

  await prisma.onboardingStep.update({
    where: { id: testStep.id },
    data: {
      status: allPassed ? "PASSED" : "IN_PROGRESS",
      comment: JSON.stringify(nextState),
    },
  })

  // If all levels confirmed — unlock interview stage.
  if (allPassed && profile.onboardingStatus === "TEST_INVITED") {
    await prisma.specialistProfile.update({
      where: { userId },
      data: { onboardingStatus: "INTERVIEW_INVITED" },
    })
    void notify(
      userId,
      "onboarding_status",
      "Интервью доступно",
      "Квалификационный тест полностью подтвержден администратором. Этап интервью открыт.",
      "/onboarding/interview"
    )
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (user?.email) {
      void sendEmail("onboarding_status", user.email, {
        status: "INTERVIEW_INVITED",
        comment: "Квалификационный тест подтвержден. Приглашаем перейти к интервью.",
        paymentUrl: "/onboarding/interview",
      })
    }
  }

  const dbAdmin = await prisma.user.findUnique({ where: { email: admin.email }, select: { id: true } })
  await audit(dbAdmin?.id ?? null, "specialist_quiz_level_approved", "User", userId, {
    specialistId: { to: userId },
    level: { to: pending },
    allPassed: { to: allPassed },
  })

  const msg = allPassed
    ? "Администратор подтвердил прохождение теста. Квалификационный тест завершён."
    : `Администратор подтвердил уровень ${pending}. Следующий уровень теста открыт.`

  void notify(userId, "onboarding_status", "Тест подтвержден", msg, "/onboarding/test")

  return NextResponse.json({ ok: true, approvedLevel: pending, allPassed })
}

