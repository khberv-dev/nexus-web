import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "https://7e7edbbe6c6164368fb646ff4943fdbb@o4511409328816128.ingest.de.sentry.io/4511417100337232",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  debug: false,
})
