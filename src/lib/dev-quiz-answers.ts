/**
 * Dev-подсказка: сервер кладёт в payload квиза правильные варианты, клиент печатает их
 * в консоль браузера. Нужна, чтобы не проходить 25–32 вопроса вручную на каждой правке.
 *
 * Гейт только серверный (env читается на сервере) — в продакшн-сборке подсказка
 * не попадает в ответ ни при каких значениях флага.
 */
export function isQuizAnswerHintEnabled(): boolean {
    // Guard: никогда не работает в production, даже если флаг выставлен явно.
    if (process.env.NODE_ENV === "production") return false

    const raw = process.env.DEV_QUIZ_ANSWERS?.trim().toLowerCase() ?? ""
    // В dev включено по умолчанию; выключается явным DEV_QUIZ_ANSWERS=false.
    return !(raw === "false" || raw === "0" || raw === "no")
}

/** Подпись варианта так же, как в интерфейсе квиза: А / Б / В / Г. */
export const QUIZ_OPTION_LETTERS = ["А", "Б", "В", "Г"] as const

export function quizOptionLetter(index: number): string {
    return QUIZ_OPTION_LETTERS[index] ?? String(index + 1)
}
