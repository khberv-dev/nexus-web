"use client"

/** Подпись решения для админки (модератор / заказчик). */
export function formatReviewLabel(r: { reviewerRole: string; verdict: string }) {
    if (r.reviewerRole === "MODERATOR") {
        if (r.verdict === "APPROVED") return "Модератор: выпуск заказчику на согласование"
        return "Модератор: возврат дизайнеру на доработку"
    }
    if (r.verdict === "APPROVED") return "Заказчик: этап принят"
    return "Заказчик: запрошены правки"
}

