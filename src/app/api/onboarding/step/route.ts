import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { audit } from "@/lib/audit"
import { rateLimit } from "@/lib/rate-limit"
import { getSessionUser } from "@/lib/session"
import { appendAttempt, gradeLevel, parseQuizLevelState, validateLevelAnswers } from "@/lib/onboarding/levels/state"
import type { QuizLevelCode } from "@/lib/onboarding/levels/types"
import { QUIZ_LEVEL_ORDER } from "@/lib/onboarding/levels/banks"
import { sendEmail } from "@/lib/email"
import { notify } from "@/lib/notifications"
import { OnboardingStatus } from "@prisma/client"

const MAX_ATTEMPTS_PER_LEVEL = 3
const RETRY_COOLDOWN_SEC = 60

const LEVEL_EMAIL_META: Record<QuizLevelCode, { rank: string; nextLevel?: QuizLevelCode }> = {
  L1: { rank: "начинающий", nextLevel: "L2" },
  L2: { rank: "профессионал", nextLevel: "L3" },
  L3: { rank: "мастер-дизайнер", nextLevel: "L4" },
  L4: { rank: "элита" },
}

const LEVEL_AWAIT_ADMIN_TEXT: Record<QuizLevelCode, string> = {
  L1: "Уровень 1 пройден. Ожидайте подтверждения администратора.",
  L2: "Уровень 2 пройден. Ожидайте подтверждения администратора.",
  L3: "Уровень 3 пройден. Ожидайте подтверждения администратора.",
  L4: "Уровень 4 пройден. Ожидайте подтверждения администратора.",
}

const FAILED_ATTEMPT_COMMENT: Record<number, string> = {
  2: "Ваши результаты не позволяют перейти на следующий уровень. Вы можете повторно пройти тест. У Вас осталось две попытки.",
  1: "Ваши результаты не позволяют перейти на следующий уровень. Вы можете повторно пройти тест. У Вас осталась одна попытка.",
}
const EXHAUSTED_L1_L3_COMMENT =
  "К сожалению, результаты не позволяют продолжить. Предлагаем пройти обучение у наших партнёров. Список программ направим отдельным письмом."
const EXHAUSTED_L4_COMMENT =
  "Попытки на уровне ELITE исчерпаны. Мы сохранили для вас доступ к интервью и приглашаем перейти к следующему этапу."

export async function POST(req: NextRequest) {
  const rl = rateLimit(`quiz-step:${req.headers.get("x-forwarded-for") ?? "unknown"}`, 10, 60_000)
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { type, answers: testAnswers, level } = body as { type?: string; answers?: unknown; level?: QuizLevelCode }

  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "Некорректный шаг" }, { status: 400 })
  }

  if (type === "INTERVIEW" || type === "REGULATIONS" || type === "CONTRACT") {
    return NextResponse.json(
      { error: "Переход на этот шаг подтверждается администратором" },
      { status: 403 }
    )
  }

  if (type === "TEST") {
    if (!level || !["L1", "L2", "L3", "L4"].includes(level)) {
      return NextResponse.json({ error: "Не указан уровень теста" }, { status: 400 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      include: {
        specialistProfile: {
          include: { steps: true },
        },
      },
    })

    if (!user?.specialistProfile) {
      return NextResponse.json({ error: "Профиль специалиста не найден" }, { status: 404 })
    }

    const profile = user.specialistProfile
    const formPassed = profile.steps.some((s) => s.type === "FORM" && s.status === "PASSED")
    if (!formPassed) {
      return NextResponse.json({ error: "Сначала заполните анкету" }, { status: 403 })
    }

    if (!["TEST_INVITED", "INTERVIEW_INVITED"].includes(profile.onboardingStatus)) {
      return NextResponse.json(
        { error: "Тест доступен только после приглашения администратора" },
        { status: 403 }
      )
    }

    // If fully completed and confirmed — disallow retake.
    const existingTestStep = profile.steps.find((s) => s.type === "TEST")
    if (existingTestStep?.status === "PASSED" && existingTestStep.comment) {
      const state = parseQuizLevelState(existingTestStep.comment)
      const passedSet = new Set<QuizLevelCode>(state?.passedLevels ?? [])
      const allPassed = ["L1", "L2", "L3", "L4"].every((lvl) => passedSet.has(lvl as QuizLevelCode))
      if (allPassed && !state?.pendingApprovalLevel) {
        return NextResponse.json(
          { error: "Тест уже завершён. Пересдача недоступна.", code: "TEST_COMPLETED" },
          { status: 403 }
        )
      }
    }

    if (!validateLevelAnswers(level, testAnswers)) {
      return NextResponse.json({ error: "Нужны ответы на все вопросы (индексы вариантов -1 или 0–3)" }, { status: 400 })
    }

    const grade = gradeLevel(level, testAnswers)
    const now = new Date().toISOString()
    // Wrap in serializable transaction to prevent race conditions on attempt counting
    const txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.onboardingStep.findFirst({
        where: { profileId: profile.id, type: "TEST" },
      })
      const prevState = parseQuizLevelState(existing?.comment ?? null)
      const passedSet = new Set<QuizLevelCode>(prevState?.passedLevels ?? [])
      const expectedLevel =
        QUIZ_LEVEL_ORDER.find((code) => !passedSet.has(code)) ??
        QUIZ_LEVEL_ORDER[QUIZ_LEVEL_ORDER.length - 1]
      if (level !== expectedLevel) {
        return { error: "LEVEL_LOCKED", expectedLevel } as const
      }
      const levelAttempts = (prevState?.attempts ?? []).filter((a) => a.level === level)
      const attemptsForLevel = levelAttempts.length
      if (attemptsForLevel >= MAX_ATTEMPTS_PER_LEVEL) {
        return { error: "ATTEMPTS_EXHAUSTED", attemptsForLevel } as const
      }
      // Server-side cooldown check
      const lastAttempt = levelAttempts[levelAttempts.length - 1]
      if (lastAttempt?.finishedAt) {
        const elapsed = (Date.now() - new Date(lastAttempt.finishedAt).getTime()) / 1000
        if (elapsed < RETRY_COOLDOWN_SEC) {
          return { error: "COOLDOWN", waitSec: Math.ceil(RETRY_COOLDOWN_SEC - elapsed) } as const
        }
      }
      const nextState = appendAttempt(
        prevState,
        level,
        {
          level,
          startedAt: now,
          finishedAt: now,
          passed: grade.passed,
          correctCount: grade.correctCount,
          total: grade.total,
          percent: grade.percent,
        },
        grade.passed,
        testAnswers as Record<string, number>
      )
      // После каждого уровня требуется подтверждение администратора → остаёмся IN_PROGRESS.
      const status = grade.passed ? "IN_PROGRESS" : "FAILED"
      if (existing) {
        await tx.onboardingStep.update({
          where: { id: existing.id },
          data: { status, comment: JSON.stringify(nextState) },
        })
      } else {
        await tx.onboardingStep.create({
          data: { profileId: profile.id, type: "TEST", status, comment: JSON.stringify(nextState) },
        })
      }
      return { error: null, attemptsForLevel, status, nextState } as const
    })

    if (txResult.error === "LEVEL_LOCKED") {
      return NextResponse.json(
        { error: "Сейчас доступен другой уровень теста", level: txResult.expectedLevel, code: "LEVEL_LOCKED" },
        { status: 409 }
      )
    }
    if (txResult.error === "ATTEMPTS_EXHAUSTED") {
      return NextResponse.json(
        {
          error: "Лимит попыток по уровню исчерпан",
          code: "ATTEMPTS_EXHAUSTED",
          level,
          attempts: txResult.attemptsForLevel,
          maxAttempts: MAX_ATTEMPTS_PER_LEVEL,
        },
        { status: 403 }
      )
    }
    if (txResult.error === "COOLDOWN") {
      return NextResponse.json(
        { error: `Подождите ${txResult.waitSec} сек. перед следующей попыткой`, code: "COOLDOWN", waitSec: txResult.waitSec },
        { status: 429 }
      )
    }

    const { attemptsForLevel, status } = txResult

    await audit(user.id, `onboarding_step_test`, "User", user.id, {
      step: { to: "TEST" },
      status: { to: status },
      level: { to: level },
      score: { to: `${grade.correctCount}/${grade.total}` },
    })

    if (!grade.passed) {
      const attemptsUsed = attemptsForLevel + 1
      const attemptsLeft = Math.max(0, MAX_ATTEMPTS_PER_LEVEL - attemptsUsed)

      if (attemptsLeft > 0 && user.email) {
        void sendEmail("onboarding_status", user.email, {
          status: "LEVEL_RETRY",
          level,
          attemptsUsed,
          attemptsLeft,
          maxAttempts: MAX_ATTEMPTS_PER_LEVEL,
          comment: FAILED_ATTEMPT_COMMENT[attemptsLeft] ?? undefined,
          paymentUrl: "/onboarding/test",
        })
      }

      if (attemptsLeft === 0) {
        if (["L1", "L2", "L3"].includes(level)) {
          await prisma.specialistProfile.update({
            where: { id: profile.id },
            data: { onboardingStatus: "REJECTED" },
          })
          if (user.email) {
            void sendEmail("onboarding_status", user.email, {
              status: "REJECTED",
              level,
              attemptsUsed,
              maxAttempts: MAX_ATTEMPTS_PER_LEVEL,
              comment: EXHAUSTED_L1_L3_COMMENT,
            })
          }
          void notify(
            user.id,
            "onboarding_status",
            "Попытки по тесту исчерпаны",
            EXHAUSTED_L1_L3_COMMENT,
            "/onboarding"
          )
          await audit(user.id, "specialist_rejected", "User", user.id, {
            onboardingStatus: { from: profile.onboardingStatus, to: "REJECTED" },
            reason: { to: "ATTEMPTS_EXHAUSTED_L1_L3" },
            level: { to: level },
          })
        } else {
          // Для ELITE после исчерпания попыток оставляем/открываем интервью.
          if (profile.onboardingStatus !== "INTERVIEW_INVITED") {
            await prisma.specialistProfile.update({
              where: { id: profile.id },
              data: { onboardingStatus: "INTERVIEW_INVITED" },
            })
          }
          if (user.email) {
            void sendEmail("onboarding_status", user.email, {
              status: "INTERVIEW_INVITED",
              level,
              attemptsUsed,
              maxAttempts: MAX_ATTEMPTS_PER_LEVEL,
              comment: EXHAUSTED_L4_COMMENT,
              paymentUrl: "/onboarding/interview",
            })
          }
          void notify(
            user.id,
            "onboarding_status",
            "Доступ к интервью сохранен",
            EXHAUSTED_L4_COMMENT,
            "/onboarding/interview"
          )
        }
      }

      return NextResponse.json(
        {
          ok: false,
          passed: false,
          correctCount: grade.correctCount,
          total: grade.total,
          percent: grade.percent,
          passPercent: grade.passPercent,
          attemptsUsed,
          attemptsLeft,
          maxAttempts: MAX_ATTEMPTS_PER_LEVEL,
          exhausted: attemptsLeft === 0,
          onboardingStatus:
            attemptsLeft === 0
              ? (["L1", "L2", "L3"].includes(level) ? "REJECTED" : "INTERVIEW_INVITED")
              : profile.onboardingStatus,
        },
        { status: 422 }
      )
    }

    // Уровень пройден, но переход к следующему уровню — только после подтверждения администратора.
    if (user.email) {
      const meta = LEVEL_EMAIL_META[level]
      void sendEmail("onboarding_status", user.email, {
        status: "LEVEL_PASSED",
        level,
        rank: meta.rank,
        comment: LEVEL_AWAIT_ADMIN_TEXT[level],
        paymentUrl: level === "L4" ? "/onboarding/interview" : "/onboarding/test",
      })
    }

    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
      for (const a of admins) {
        void notify(
          a.id,
          "onboarding_status",
          "Тест: требуется подтверждение",
          `Специалист прошёл уровень ${level}. Подтвердите в карточке специалиста, чтобы открыть следующий уровень.`,
          `/admin/specialists?highlight=${user.id}`
        )
      }
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      passed: true,
      level,
      correctCount: grade.correctCount,
      total: grade.total,
      percent: grade.percent,
      transitionText: LEVEL_AWAIT_ADMIN_TEXT[level],
      attemptsUsed: attemptsForLevel + 1,
      attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_LEVEL - (attemptsForLevel + 1)),
      maxAttempts: MAX_ATTEMPTS_PER_LEVEL,
    })
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const profile = await prisma.specialistProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  })

  const comment = testAnswers && typeof testAnswers === "object" ? JSON.stringify(testAnswers) : null

  const existing = await prisma.onboardingStep.findFirst({
    where: { profileId: profile.id, type: type as "INTERVIEW" | "REGULATIONS" | "CONTRACT" | "FORM" },
  })

  if (existing) {
    await prisma.onboardingStep.update({ where: { id: existing.id }, data: { status: "PASSED", comment } })
  } else {
    await prisma.onboardingStep.create({
      data: { profileId: profile.id, type: type as never, status: "PASSED", comment },
    })
  }

  await audit(user.id, `onboarding_step_${type.toLowerCase()}`, "User", user.id, {
    step: { to: type },
    status: { to: "PASSED" },
  })

  return NextResponse.json({ ok: true })
}

