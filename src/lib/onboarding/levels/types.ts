export type QuizLevelCode = "L1" | "L2" | "L3" | "L4"

export type QuizLevelQuestion = {
  id: number
  section: string
  text: string
  options: readonly [string, string, string, string]
  correct: number
  explain: string
  source?: string
}

export type QuizLevelQuestionPublic = Omit<QuizLevelQuestion, "correct">

export type QuizLevelBank = {
  level: QuizLevelCode
  title: string
  passPercent: number
  questions: readonly QuizLevelQuestion[]
}

export type QuizLevelMeta = {
  code: QuizLevelCode
  title: string
  passPercent: number
  questionsCount: number
  isElite: boolean
}

export type QuizLevelAttempt = {
  level: QuizLevelCode
  startedAt: string
  finishedAt: string
  passed: boolean
  correctCount: number
  total: number
  percent: number
  /** Снимок ответов по вопросам (questionId → индекс 0–3 или -1) на момент завершения попытки. */
  answers?: Record<string, number>
}

export type QuizLevelStateStored = {
  version: 5
  phase: "level_in_progress" | "level_finished" | "awaiting_admin"
  currentLevel: QuizLevelCode
  currentQuestionId: number
  questionDeadlineAt: string | null
  answers: Record<string, number>
  answeredCount: number
  liveCorrect: number
  total: number
  lastQuestionId: number
  attempts: QuizLevelAttempt[]
  passedLevels: QuizLevelCode[]
  /** Level passed by specialist, awaiting admin confirmation */
  pendingApprovalLevel: QuizLevelCode | null
}
