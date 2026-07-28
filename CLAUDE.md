# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"Nexus Pro" — a marketplace connecting clients with interior designers/architects for commercial spaces. Escrow-style model: client pays per stage upfront, funds are held on the platform, and released to the specialist only after the client accepts the stage. Full docs (in Russian) live in `docs/`:

- `docs/TECHNICAL.md` — architecture, DB schema, state machine, API routes, deploy (most useful reference for this file)
- `docs/HANDOFF.md` — server requirements, env vars, first-deploy checklist
- `docs/MIGRATION_GUIDE.md` — Prisma 7 migration workflow specifics
- `docs/ROADMAP.md` — MVP / Stage 2 / Stage 3 scope
- `README.md` — business process walkthrough (onboarding, order lifecycle, stages, payouts)

Three roles share one Next.js app, split by `role` on `User` (`CLIENT` / `SPECIALIST` / `ADMIN`): clients live under `/orders`, specialists under `/work`, admins under `/admin`.

## Commands

```bash
npm run dev              # start dev server
npm run build            # next build (also runs lint as part of build)
npm run lint             # eslint
npm run test             # jest (run once, no watch flag configured)
npx jest __tests__/stage-machine.test.ts   # run a single test file
npx jest -t "test name pattern"            # run tests matching a name

npm run db:migrate       # prisma migrate dev (local schema changes)
npm run db:deploy        # prisma migrate deploy (apply existing migrations)
npm run db:generate      # regenerate Prisma client after schema/migration changes
npm run db:reset         # wipe DB and reapply all migrations
npm run db:reset:demo    # same, then seed demo data
npm run db:seed          # seed demo data only (no reset)
```

Prisma 7 does **not** support `url` in the `datasource` block of `schema.prisma` — connection strings are supplied via `prisma.config.ts` or `--url` CLI flags. If a Prisma CLI command fails with "datasource.url property is required", pass `--url "<connection-string>"` explicitly (see `docs/MIGRATION_GUIDE.md`).

Local infra (Postgres, Redis, MinIO, Zitadel) runs via Docker Compose:
```bash
docker compose up postgres redis minio minio-init zitadel -d
```

### Dev auth bypass

Real auth is email magic-link via Resend (NextAuth). To skip it locally, set in `.env`:
```
DEV_AUTH_BYPASS=true
DEV_MOCK_ROLE=ADMIN   # ADMIN | SPECIALIST | CLIENT
```
then hit `GET /api/mock-auth/session?role=ADMIN` to create a mock session, `GET /api/mock-auth/reset` to clear it. `src/middleware.ts` checks `isDevAuthBypass()` and skips the real JWT/session check when this is on — role guards still apply, but against `DEV_MOCK_ROLE` instead of a real token.

## Architecture

Monolithic Next.js 16 App Router app (React 19), single deployable, roles separated entirely by `middleware.ts` route guards + per-role folders — not separate apps/services (except billing, see below).

### Route guards (`src/middleware.ts`)

| Path pattern | Allowed roles |
|---|---|
| `/admin/*` | `ADMIN` |
| `/work/*` | `SPECIALIST` |
| `/orders/*` | `CLIENT`, `ADMIN` |
| `/dashboard/*` | any authenticated role |

Middleware is a coarse gate. Every Route Handler under `src/app/api/**` must independently re-check `getServerSession()` — middleware alone is not sufficient authorization.

### Stage state machine — `src/lib/stage-machine.ts`

The core domain model. An `Order` has sequential `ProjectStage`s (`CONCEPT` → `PLANNING` → `VISUALIZATION` → `DOCUMENTATION` → `SPECIFICATION`). **All** `ProjectStage.status` changes must go through `transition(stageId, event, actorRole)` — never write `status` directly via Prisma elsewhere.

Status flow: `AWAITING_PAYMENT` → `PENDING` → `UPLOADED` → `MOD_REVIEW` → (`CLIENT_REVIEW` | `MOD_REVISION` | `EXTRA_PAYMENT`) → ... → `APPROVED`. Free revision limits: 2 client rounds, 1 moderator round — the round after that forces `EXTRA_PAYMENT` (bypassed entirely when `SKIP_STAGE_PAYMENTS=true`).

Transitioning a stage to `APPROVED` is transactional and fans out: creates a `StageAct`, calls billing-svc to release the held payment, calls `activateNextStage()` (which either opens the next stage or flips `Order.status` to `DONE` if that was the last one), and sends notifications to all order participants. When touching stage logic, read the full transition graph in `docs/TECHNICAL.md` before changing anything — it's easy to break a role-specific branch (moderator vs. client revision counters are independent).

### Payments — held funds via a separate Go service

Billing is **not** in this repo's request path directly — `src/lib/billing.ts` is an HTTP client to `services/tbank`, a separate Go service that talks to T-Bank's API. Flow: Next.js creates a payment via billing-svc → client redirected to T-Bank → T-Bank webhook hits `POST /api/payments/webhook` → webhook handler verifies `TBANK_WEBHOOK_SECRET`, marks `Payment.status = HELD`, then calls `transition(stageId, 'stagePaymentConfirmed', 'ADMIN')`. Release-on-approval happens inside the `APPROVED` transition above.

`billing-svc` is commented out in `docker-compose.yml` by default — must be uncommented for a real payment flow to work. Two env flags gate payment enforcement and must stay in sync: `SKIP_STAGE_PAYMENTS` (server) and `NEXT_PUBLIC_SKIP_STAGE_PAYMENTS` (client) — when both `true`, stages never block on payment and `EXTRA_PAYMENT` is never entered.

### File storage — client uploads directly to S3

Next.js never proxies file bytes. Upload: `POST /api/stages/:id/upload/presign` returns a presigned PUT URL, client PUTs directly to S3, then `POST /api/stages/:id/upload/confirm` tells the server to create the `StageFile` row. Download is symmetric: `GET /api/files/:id/url` / `GET /api/stages/:id/files/:fid/download` return a presigned GET URL. `StageFile.audience` (`DESIGNER` / `CLIENT` / `SHARED`) controls who can see a file — enforced in `src/lib/client-stage-file-visibility.ts`, not by S3 ACLs.

### Auth

NextAuth v4, email magic link via Resend is the only active provider in the current deployment. A Zitadel OIDC provider exists (`src/lib/zitadel/`, `src/lib/auth/providers.ts`) and auto-registers only if `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, and `ZITADEL_PROJECT_ID` are all set — otherwise it's inert. Since Zitadel isn't wired up in production, the first admin user must be inserted directly into the `User` table (see `docs/HANDOFF.md` §5).

### Data model

Full schema described in `docs/TECHNICAL.md`; `prisma/schema.prisma` is authoritative. Key relationships: `User` (1) —(1:1)— `SpecialistProfile`/`ClientProfile` by role; `Order` —(1:N)— `ProjectStage` —(1:N)— `StageFile`/`StageReview`; `ProjectStage` —(1:1)— `Payment` and, on approval, `StageAct`. `SpecialistProfile.onboardingStatus` drives a separate onboarding state machine (`PENDING → TEST_INVITED → INTERVIEW_INVITED → REGULATIONS → CONTRACT → ACTIVE`, admin-driven since the qualification test/interview happen over Zoom, not in-app).

### Notifications

Two channels, fired together on domain events: in-app (`notify()` in `src/lib/notifications.ts`, writes to `Notification` table, streamed to clients via SSE at `/api/notifications/stream`) and email (`src/lib/email.ts`, Resend primary / Nodemailer fallback, templates in `src/lib/email-template.ts`).

### Testing

Jest + ts-jest, tests in `__tests__/`, `@/*` path alias maps to `src/*` (mirrors `tsconfig.json`). Heaviest coverage is on `stage-machine` transitions and API route handlers (`__tests__/api/*.test.ts`) — when changing stage transition logic or a route handler's auth/validation, check for an existing test file with the same name first. `__tests__/property.test.ts` uses `fast-check` for property-based tests.

### Deploy

Multistage `Dockerfile` (deps → builder [`prisma generate` + `next build`] → runner, Next `output: standalone`, runs as non-root `nextjs`). `docker-compose.yml` services: `app`, `migrate` (one-shot `prisma migrate deploy`, runs before `app`), `postgres`, `redis`, `minio`/`minio-init` (dev/staging only), `zitadel` (dev only), `billing-svc` (commented out, production only). GitLab CI (`.gitlab-ci.yml`): `lint` → `test` → `build` (docker image, push to registry) → `deploy` (manual for `main`/production, automatic for `develop`/staging).
