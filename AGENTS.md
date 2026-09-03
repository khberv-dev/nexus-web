# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 App Router application. Routes, layouts, and API handlers live in `src/app/`; reusable UI is grouped by feature in `src/components/`; shared logic and integrations belong in `src/lib/`; and TypeScript definitions live in `src/types/`. Jest suites are under `__tests__/`. Prisma schema, migrations, and seed data are in `prisma/`. Static files belong in `public/`, scripts in `scripts/`, and architecture notes in `docs/`. The payment integration is a separate Rust workspace under `services/tbank/`.

## Build, Test, and Development Commands

- `npm install` installs the locked Node dependencies.
- `npm run dev` starts the local Next.js development server.
- `npm run build` creates the production build; `npm start` serves it.
- `npm run lint` runs ESLint with Next.js Core Web Vitals and TypeScript rules.
- `npm test` runs all Jest tests; use `npm test -- orders.test.ts` for one suite.
- `npm run db:generate` regenerates Prisma Client after schema changes.
- `npm run db:migrate` creates/applies a development migration; use `npm run db:deploy` in deployed environments.
- `cargo test --manifest-path services/tbank/Cargo.toml` tests the Rust workspace.

## Coding Style & Naming Conventions

Use strict TypeScript and the `@/` alias for imports from `src`. Follow existing formatting: two-space indentation, double quotes, semicolons, and trailing commas. Name React components and their files in `PascalCase`; utilities, route segments, and non-component modules use descriptive `kebab-case` or existing domain conventions. Keep server-only logic in `src/lib` or route handlers, and colocate feature-specific styles and types with their components. Run `npm run lint` before submitting changes.

## Testing Guidelines

Jest, `ts-jest`, Testing Library, and `fast-check` are configured. Add tests as `__tests__/**/*.test.ts`; use `__tests__/api/` for route behavior and `__tests__/lib/` for domain logic. Cover success, authorization, validation, and failure paths. No numeric coverage threshold is enforced, but changed behavior should have focused regression tests.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit subjects such as `feat: add real-time order chat` and `fix: align specialist switcher`. Keep commits focused and use an imperative, concise subject. Pull requests should explain the user-visible change, note schema or environment impacts, link the relevant issue, and include screenshots for UI work. Report `lint`, test, and build results; commit Prisma migrations alongside schema changes.

## Security & Configuration

Copy `.env.example` for local configuration. Never commit credentials, tokens, production database URLs, or generated uploads. Treat `npm run db:reset` and `db:reset:demo` as destructive local-only commands.
