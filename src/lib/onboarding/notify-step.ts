import {prisma} from "@/lib/db/prisma"
import {sendEmail} from "@/lib/email"
import {notify} from "@/lib/notifications"

/**
 * Уведомление дизайнера о шаге онбординга, который выполнил администратор.
 * Всегда два канала сразу: запись в колокольчик + письмо на почту.
 *
 * Ошибка доставки не должна ронять действие админа — статус в БД уже изменён,
 * поэтому и почта, и in-app пишутся best-effort, но с логом.
 */
export type SpecialistStepNotification = {
    userId: string
    /** Если не передан — email возьмём из БД по userId. */
    email?: string | null
    /** Статус для шаблона письма (см. renderOnboardingEmail в src/lib/email.ts). */
    status: string
    /** Заголовок in-app уведомления. */
    title: string
    /** Текст: идёт и в колокольчик, и в письмо (data.comment). */
    message: string
    /** Ссылка: и в in-app уведомлении, и кнопкой в письме. */
    url?: string
    /** Дополнительные поля шаблона письма (level, reason, contractNumber…). */
    extra?: Record<string, unknown>
    /** Тип in-app уведомления, по умолчанию onboarding_status. */
    notificationType?: string
}

export async function notifySpecialistStep({
                                               userId,
                                               email,
                                               status,
                                               title,
                                               message,
                                               url,
                                               extra,
                                               notificationType = "onboarding_status",
                                           }: SpecialistStepNotification): Promise<void> {
    try {
        await notify(userId, notificationType, title, message, url)
    } catch (err) {
        console.error(`[onboarding] in-app уведомление не создано (user ${userId}, ${status}):`, err)
    }

    let address = email?.trim() || null
    if (!address) {
        const user = await prisma.user.findUnique({where: {id: userId}, select: {email: true}})
        address = user?.email?.trim() || null
    }
    if (!address) {
        console.warn(`[onboarding] у специалиста ${userId} нет email — письмо о шаге «${status}» не отправлено`)
        return
    }

    const result = await sendEmail("onboarding_status", address, {
        status,
        comment: message,
        ...(url ? {paymentUrl: url} : {}),
        ...(extra ?? {}),
    })
    if (!result.ok) {
        console.error(`[onboarding] письмо о шаге «${status}» для ${address} не ушло: ${result.error ?? "unknown"}`)
    }
}
