"use client"

import {quizOptionLetter} from "@/lib/dev-quiz-answers"

/**
 * Печать правильного варианта в консоль браузера при прохождении квиза.
 * Подсказка приходит с сервера (поле devAnswers) и только в dev — если её нет,
 * функция молчит, поэтому вызов безопасно оставлять в коде страницы.
 */
export function logQuizAnswerHint({
                                      quiz,
                                      position,
                                      total,
                                      question,
                                      options,
                                      correctIndex,
                                  }: {
    quiz: string
    /** Номер вопроса на экране, 1-based. */
    position: number
    total: number
    question: string
    options: readonly string[]
    /** Индекс правильного варианта в показанном порядке; undefined — подсказка выключена. */
    correctIndex: number | undefined
}): void {
    if (typeof correctIndex !== "number" || correctIndex < 0 || correctIndex >= options.length) return

    console.info(
        `%c[dev] ${quiz} · вопрос ${position}/${total}%c\n${question}\n→ ${quizOptionLetter(correctIndex)}. ${options[correctIndex]}`,
        "color:#a78bfa;font-weight:600",
        "color:inherit",
    )
}
