# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"Nexus Pro" — a marketplace connecting clients with interior designers/architects for commercial spaces. Escrow-style model: client pays per stage upfront, funds are held on the platform, and released to the specialist only after the client accepts the stage. Full docs (in Russian) live in `docs/`:

- `docs/TECHNICAL.md` — architecture, DB schema, state machine, API routes, deploy (most useful reference for this file)
- `docs/HANDOFF.md` — server requirements, env vars, first-deploy checklist
- `docs/MIGRATION_GUIDE.md` — Prisma 7 migration workflow specifics
- `docs/ROADMAP.md` — MVP / Stage 2 / Stage 3 scope
- `README.md` — business process walkthrough (onboarding, order lifecycle, stages, payouts)

Three roles share one Next.js app, split by `role` on `User` (`CLIENT` / `SPECIALIST` / `ADMIN`): clients live under `/orders`, specialists under `/work`, admins under `/admin`. The admin is not just an operator — they sit *between* the two other roles (moderation review, both chat channels, contract activation), so most flows have three branches, not two.

Code comments and user-facing strings are largely in Russian; match the surrounding language when editing a file.

## Commands

```bash
npm run dev              # start dev server
npm run build            # next build (ESLint runs as part of the build)
npm run lint             # eslint (flat config, no `next lint`)
npm run test             # jest (run once, no watch flag configured)
npm run chat:ws          # order-chat WebSocket sidecar on CHAT_WS_PORT (default 3001)

npx jest __tests__/stage-machine.test.ts   # run a single test file
npx jest -t "test name pattern"            # run tests matching a name

npm run db:migrate       # prisma migrate dev (local schema changes)
npm run db:deploy        # prisma migrate deploy (apply existing migrations)
npm run db:generate      # regenerate Prisma client after schema/migration changes
npm run db:reset         # wipe DB and reapply all migrations
npm run db:reset:demo    # same, then seed demo data
npm run db:seed          # seed demo data only (no reset)
```

Prisma 7 does **not** support `url` in the `datasource` block of `schema.prisma` — the connection string comes from `prisma.config.ts` (which loads `.env` itself, since the Prisma CLI does not) or from `--url` CLI flags. If a Prisma CLI command fails with "datasource.url property is required", pass `--url "<connection-string>"` explicitly (see `docs/MIGRATION_GUIDE.md`).

Local infra (Postgres, Redis, MinIO, Zitadel) runs via Docker Compose:
```bash
docker compose up postgres redis minio minio-init zitadel -d
```

### Dev auth bypass and demo mode

Two separate escape hatches from real login:

- **`DEV_AUTH_BYPASS=true`** + `DEV_MOCK_ROLE=ADMIN|SPECIALIST|CLIENT` in `.env`. `src/proxy.ts` and `getSessionUser()` both check `isDevAuthBypass()` and resolve a seeded DB user instead of a JWT; role guards still apply, but against `DEV_MOCK_ROLE`. Hit `GET /api/mock-auth/session?role=ADMIN` to create the mock session, `GET /api/mock-auth/reset` to clear it. `DEV_AUTH_BYPASS`/`DEV_MOCK_ROLE` are re-exported through `next.config.ts` `env:` because Edge middleware otherwise can't see them.
- **Demo mode** — `POST /api/demo/login` mints a real NextAuth JWT for `demo-client@` / `demo-specialist@` given `DEMO_ACCESS_KEY`. It is rate-limited, and demo *admin* login is refused when `NODE_ENV === "production"`. Seeded by `DEMO_SEED=1` (`npm run db:reset:demo`).

Every `mock-*` route calls `devOnlyGuard()` (`src/lib/dev-only.ts`), which 404s in production. New dev-only endpoints must do the same.

## Architecture

Monolithic Next.js 16 App Router app (React 19), single deployable. Roles are separated by `proxy.ts` route guards + per-role folders, not by separate apps — with two sidecars: the Rust billing service (`services/tbank`) and the chat WebSocket server (`scripts/chat-ws-server.mjs`).

### Route guards (`src/proxy.ts`)

Next 16 renamed the middleware convention: the file must be `src/proxy.ts` and the handler must be exported as `proxy` (a default export is silently ignored).

| Path pattern | Allowed roles |
|---|---|
| `/admin/*` | `ADMIN` |
| `/work/*` | `SPECIALIST` |
| `/orders/*` | `CLIENT`, `ADMIN` |
| `/dashboard/*` | any authenticated role |

`/api/auth/*` is in the matcher only to force `Cache-Control: no-store`.

Middleware is a coarse gate. **Every Route Handler under `src/app/api/**` must independently re-check the session** — the convention across all ~120 handlers is `getSessionUser()` from `src/lib/session.ts`, never `getServerSession()` directly. That helper is what enforces `archivedAt` (archived users lose access immediately) and `sessionVersion` (admin-forced logout invalidates live JWTs); calling NextAuth directly bypasses both. `getServerSessionWithDevBypass()` is the equivalent when a full `Session` object is needed.

`shouldUseSecureAuthCookies()` must return the same value in `proxy.ts` and `authConfig` — a mismatch means `getToken` looks for `__Secure-next-auth.session-token` while sign-in set `next-auth.session-token`, and every protected route silently bounces to `/login`.

### Stage state machine — `src/lib/stage-machine.ts`

The core domain model. An `Order` moves `DRAFT → BRIEFING → BRIEF_REVIEW → ACTIVE → DONE` (or `CANCELLED`); an `ACTIVE` order has sequential `ProjectStage`s (`CONCEPT` → `PLANNING` → `VISUALIZATION` → `DOCUMENTATION` → `SPECIFICATION`, order in `STAGE_ORDER`). **All** `ProjectStage.status` changes must go through `transition(stageId, action, actorRole, ...)` — never write `status` directly via Prisma elsewhere.

Status flow: `AWAITING_PAYMENT` → `PENDING` → `UPLOADED` → `MOD_REVIEW` → (`CLIENT_REVIEW` | `MOD_REVISION` | `EXTRA_PAYMENT`) → ... → `APPROVED` (`BLOCKED` also exists). Free revision limits live in `src/lib/stage-constants.ts`: `MAX_FREE_CLIENT_REVISIONS = 3` client rounds and a hardcoded **1** moderator round — the round after that forces `EXTRA_PAYMENT`, bypassed entirely when `SKIP_STAGE_PAYMENTS=true`. `clientRound` and `modRound` are independent counters; a change to one branch does not affect the other, which is the easiest thing to break here.

The `MOD_REVIEW` state is overloaded: admin action there routes to `APPROVED` or `CLIENT_REVISION` depending on the latest `StageReview` with `reviewerRole = CLIENT`, not on the action alone.

Transitioning to `APPROVED` is transactional and fans out: creates a `StageAct`, calls billing-svc to release the held payment, calls `activateNextStage()` (which opens the next stage or flips `Order.status` to `DONE` if that was the last one), and notifies all order participants. Read the full transition graph in `docs/TECHNICAL.md` before changing anything.

### Payments — held funds via a separate Rust service

Billing is **not** in this repo's request path directly — `src/lib/billing.ts` is a thin HTTP client (`POST /payments`, `/payments/:id/release`, `/payments/extra`) to `services/tbank`, a separate **Rust** (axum + sqlx) workspace that talks to T-Bank's API. Flow: Next.js creates a payment via billing-svc → client redirected to T-Bank → T-Bank webhook hits `POST /api/payments/webhook` → the handler verifies `TBANK_WEBHOOK_SECRET`, marks `Payment.status = HELD`, then calls `transition(stageId, 'stagePaymentConfirmed', 'ADMIN')`. Release-on-approval happens inside the `APPROVED` transition above.

`billing-svc` is **commented out** in `docker-compose.yml` — uncomment it for a real payment flow. Two env flags gate payment enforcement and must stay in sync: `SKIP_STAGE_PAYMENTS` (server) and `NEXT_PUBLIC_SKIP_STAGE_PAYMENTS` (client) — when both `true`, stages never block on payment and `EXTRA_PAYMENT` is never entered. Both default to `true` in `.env.example`.

### File storage — two drivers behind `src/lib/s3.ts`

Every storage call goes through `src/lib/s3.ts`, which switches on `STORAGE_DRIVER`:

- **S3 (default)** — Next.js never proxies file bytes. `POST /api/stages/:id/upload/presign` returns a presigned PUT URL, the client PUTs directly to S3, then `POST /api/stages/:id/upload/confirm` creates the `StageFile` row. Download is symmetric (`GET /api/files/:id/url`, `GET /api/stages/:id/files/:fid/download`). `S3_PUBLIC_ENDPOINT` rewrites presigned hosts when the internal endpoint isn't browser-reachable.
- **`STORAGE_DRIVER=local`** — files land on disk under `uploads/` (or `STORAGE_LOCAL_ROOT`). Uploads go through HMAC-signed, 15-min `/api/storage/put` + `/api/storage/get` URLs signed with `STORAGE_URL_SECRET` (falls back to `NEXTAUTH_SECRET`; an empty value throws rather than signing with an empty key). **Downloads, however, resolve to unsigned static `/uploads/<key>`** — privacy rests only on the random UUID in the key, and `StageFile.audience` is not enforced at that layer. Keep this in mind before routing anything sensitive through the local driver.

`StageFile.audience` (`DESIGNER` / `CLIENT` / `SHARED`) controls who can see a file — enforced in `src/lib/client-stage-file-visibility.ts` and `src/lib/file-download-auth.ts`, never by S3 ACLs. Allowed extensions and the 500 MB cap live in `validateFile()`, with per-stage widenings (any raster for `CONCEPT` and for portfolio/landing images; Office formats for `SPECIFICATION`; SVG deliberately excluded).

The CSP in `next.config.ts` is assembled from `S3_ENDPOINT` / `S3_PUBLIC_ENDPOINT` (plus a wildcard for virtual-hosted buckets). If images or uploads break with no console error, check that block before the storage code.

### Auth

NextAuth v4, JWT session strategy. `buildProviders()` in `src/lib/auth/config.ts` always registers **two** providers — Resend email magic link and a credentials (password) provider — and adds Zitadel OIDC only if `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, and `ZITADEL_PROJECT_ID` are all set; otherwise the Zitadel code in `src/lib/zitadel/` is inert. Since Zitadel isn't wired up in production, the first admin user must be inserted directly into the `User` table (see `docs/HANDOFF.md` §5).

### AI features — provider-switchable

`src/lib/ai-provider.ts` is the only entry point the routes use: `aiAsk` / `aiChat` / `aiGenerateAvatar` dispatch on `AI_PROVIDER` (`gemini` — REST `generateContent`, `src/lib/gemini-ai.ts` — or `yandex` — YandexGPT + YandexART, `src/lib/yandex-ai.ts`); an unrecognized value throws `INVALID_AI_PROVIDER`. Both backends must make HTTP calls through `aiFetch()` (`src/lib/ai-proxy.ts`), which honours the optional `AI_PROXY_URL` (`http(s)://` or `socks5://`, undici dispatcher scoped to AI only — never set it as the global dispatcher). That's why Gemini doesn't use the `@google/genai` SDK: it calls global `fetch` with no way to pass a dispatcher. The two backends differ in capability (avatar generation is image *editing* on Gemini vs. text-to-image on YandexART, and YandexART caps prompt length), so add features through `ai-provider.ts` rather than importing a backend directly. `src/lib/cf-ai.ts` (Cloudflare Workers AI) is currently unreferenced — don't build on it without checking whether it is meant to come back.

Consumers are the ten `src/app/api/ai/*` routes: brief suggestion/summary/wizard, onboarding suggestions, portfolio chat/describe, about-text generation, avatar alternatives, revision feedback, stage-chat suggestions.

### Order chat — Redis pub/sub + a WebSocket sidecar

Chat has exactly two channels (`OrderChatChannel`): `ADMIN_CLIENT` and `ADMIN_SPECIALIST`. **Clients and specialists never talk to each other directly** — the admin is in both. Visibility rules are duplicated in `src/lib/order-chat-realtime.ts` (`canViewOrderChatChannel`) and in `scripts/chat-ws-server.mjs` (`canView`); change both together.

Messages are written over HTTP (`/api/orders/:id/chat`, `/api/stages/:id/chat`), then published to Redis; `npm run chat:ws` runs a standalone `ws` server that subscribes to Redis and fans out to browsers on `/ws/chat?token=…`. The token is a short-lived HS256 JWT signed with `CHAT_WS_SECRET` (falls back to `NEXTAUTH_SECRET`) carrying `sub`/`orderId`/`role`. Read state is tracked in `OrderChatReadState`.

### Notifications

Two channels, fired together on domain events: in-app (`notify()` in `src/lib/notifications.ts`, writes to `Notification` and publishes to Redis, streamed to browsers via SSE at `/api/notifications/stream`) and email (`src/lib/email.ts`, Resend primary / Nodemailer fallback, templates in `src/lib/email-template.ts`).

### Data model

`prisma/schema.prisma` is authoritative (~700 lines, ~35 models); `docs/TECHNICAL.md` describes it in prose. Key relationships: `User` (1) —(1:1)— `SpecialistProfile`/`ClientProfile` by role; `Order` —(1:N)— `ProjectStage` —(1:N)— `StageFile`/`StageReview`; `ProjectStage` —(1:1)— `Payment` and, on approval, `StageAct`. Around that core sit several self-contained subsystems: portfolio (`PortfolioProject` → `PortfolioCard` → attachments), landing bundles (`LandingBundle`/`LandingBundleItem`, admin-curated specialist showcases), documents (`Invoice`, `Contract`, framework contracts for both sides), `RequisiteChangeRequest` (bank-details changes need admin approval), and `AuditLog`.

Users are soft-deleted via `archivedAt`, and `sessionVersion` is the admin force-logout lever — both are checked in `getSessionUser()`, so any new auth path must check them too.

`SpecialistProfile.onboardingStatus` drives a separate state machine (`PENDING → TEST_INVITED → INTERVIEW_INVITED → REGULATIONS → CONTRACT → ACTIVE`, plus `REJECTED`), admin-driven because the qualification test/interview happen over Zoom, not in-app. The in-app parts (quiz, regulations acknowledgement) live in `src/lib/onboarding/`.

### Testing

Jest + ts-jest, `testEnvironment: "node"`, tests in `__tests__/`, `@/*` → `src/*` (mirrors `tsconfig.json`). Two gotchas in `jest.config.ts`: `testMatch` is `__tests__/**/*.test.ts` only, so a `.tsx` test file **will not run**; and `jest.setup.ts` (which imports `@testing-library/jest-dom`) is not wired into the config at all, despite the Testing Library deps being installed.

Heaviest coverage is on `stage-machine` transitions and API route handlers (`__tests__/api/*.test.ts`, with shared fixtures in `__tests__/helpers/api.ts`) — when changing stage transition logic or a route handler's auth/validation, check for an existing test file with the same name first. `__tests__/property.test.ts` uses `fast-check` for property-based tests; `services/tbank` has its own Rust proptest suite, not run by `npm test`.

### Deploy

Multistage `Dockerfile` (deps → builder [`prisma generate` + `next build`] → runner, Next `output: standalone`, runs as non-root `nextjs`, entry `scripts/start-production.mjs`). `docker-compose.yml` services: `app`, `migrate` (one-shot `prisma migrate deploy`, runs before `app`), `postgres`, `redis`, `minio`/`minio-init` (dev/staging only), `zitadel` (dev only), `billing-svc` (commented out, production only). Sentry is wired through `withSentryConfig` with `tunnelRoute: "/monitoring"` — that path must stay allowed by any proxy in front of the app. GitLab CI (`.gitlab-ci.yml`): `lint` → `test` (runs `prisma generate` first) → `build` (docker image, push to registry) → `deploy` (manual for `main`/production, automatic for `develop`/staging; both deploy jobs are still `echo` placeholders).
