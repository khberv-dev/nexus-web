import nodemailer, {type Transporter} from "nodemailer"

/**
 * Единая конфигурация почты для всех отправок: и магической ссылки входа (NextAuth),
 * и триггерных уведомлений. Основной канал — Resend, резервный — SMTP (nodemailer).
 */

export type MailProvider = "resend" | "smtp" | "none"

export function isPlaceholderResendKey(key: string | undefined): boolean {
    if (!key) return true
    const k = key.trim()
    if (!k) return true
    if (k === "re_your_resend_api_key") return true
    if (k === "re_placeholder") return true
    if (k.startsWith("re_") && k.includes("your")) return true
    return false
}

/** Рабочий ключ Resend либо null, если он не задан/оставлен плейсхолдер. */
export function getResendApiKey(): string | null {
    const key = process.env.RESEND_API_KEY?.trim()
    return isPlaceholderResendKey(key) ? null : (key as string)
}

/**
 * Адрес «From».
 *
 * Пока свой домен не верифицирован в Resend → поставьте RESEND_SANDBOX=1, тогда письма уходят
 * с NEXUS <onboarding@resend.dev> (разрешено без DNS, но только на адрес владельца аккаунта Resend).
 * После верификации домена: RESEND_SANDBOX=0 и EMAIL_FROM="NEXUS <noreply@ваш-домен>".
 *
 * Приоритет без песочницы: EMAIL_FROM → EMAIL_FROM_NAME + EMAIL_FROM_ADDRESS → EMAIL_FROM_ADDRESS.
 */
export function resolveResendFrom(): string {
    if (process.env.RESEND_SANDBOX === "1") {
        return process.env.RESEND_SANDBOX_FROM?.trim() || "NEXUS <onboarding@resend.dev>"
    }

    const explicit = process.env.EMAIL_FROM?.trim()
    if (explicit) return explicit

    const addr = process.env.EMAIL_FROM_ADDRESS?.trim()
    const name = process.env.EMAIL_FROM_NAME?.trim()
    if (addr && name) return `${name} <${addr}>`
    if (addr) return addr

    return "NEXUS <noreply@example.com>"
}

export type SmtpConfig = {
    host: string
    port: number
    secure: boolean
    user?: string
    pass?: string
    from: string
}

/** Резервный SMTP включается, только если задан SMTP_HOST. */
export function getSmtpConfig(): SmtpConfig | null {
    const host = process.env.SMTP_HOST?.trim()
    if (!host) return null

    const port = Number(process.env.SMTP_PORT ?? 587) || 587
    const secure = process.env.SMTP_SECURE === "1" || port === 465
    return {
        host,
        port,
        secure,
        user: process.env.SMTP_USER?.trim() || undefined,
        pass: process.env.SMTP_PASS?.trim() || undefined,
        from: process.env.SMTP_FROM?.trim() || resolveResendFrom(),
    }
}

let cachedTransport: Transporter | null = null
let cachedTransportKey = ""

export function getSmtpTransport(): Transporter | null {
    const config = getSmtpConfig()
    if (!config) return null

    const key = `${config.host}:${config.port}:${config.secure}:${config.user ?? ""}`
    if (cachedTransport && cachedTransportKey === key) return cachedTransport

    cachedTransport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user && config.pass ? {user: config.user, pass: config.pass} : undefined,
    })
    cachedTransportKey = key
    return cachedTransport
}

/** Канал, которым письмо уйдёт при текущем окружении. */
export function getMailProvider(): MailProvider {
    if (getResendApiKey()) return "resend"
    if (getSmtpConfig()) return "smtp"
    return "none"
}

export function isMailEnabled(): boolean {
    return getMailProvider() !== "none"
}

/** Безопасная для логов/ответов API сводка — без ключей и паролей. */
export function describeMailConfig() {
    const smtp = getSmtpConfig()
    return {
        provider: getMailProvider(),
        from: resolveResendFrom(),
        resendKeyConfigured: getResendApiKey() !== null,
        sandbox: process.env.RESEND_SANDBOX === "1",
        smtpFallback: smtp ? {host: smtp.host, port: smtp.port, secure: smtp.secure, auth: Boolean(smtp.user)} : null,
        devLog: process.env.NODE_ENV === "development" || process.env.AUTH_EMAIL_DEV_LOG === "1",
    }
}
