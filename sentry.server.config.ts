import * as Sentry from "@sentry/nextjs"

// NextAuth email sign-in errors that are expected business logic (not bugs)
const EXPECTED_NEXTAUTH_MESSAGES = [
  "Такого аккаунта еще нет",
  "RESEND_API_KEY не задан",
]

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "https://7e7edbbe6c6164368fb646ff4943fdbb@o4511409328816128.ingest.de.sentry.io/4511417100337232",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  debug: false,
  beforeSend(event, hint) {
    const msg = hint?.originalException instanceof Error
      ? hint.originalException.message
      : String(hint?.originalException ?? "")
    if (EXPECTED_NEXTAUTH_MESSAGES.some((m) => msg.includes(m))) return null
    return event
  },
})
