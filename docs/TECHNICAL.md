# TECHNICAL.md — Nexus Pro CRM

Техническая документация для разработчиков. Описывает архитектуру, схему данных, ключевые модули и процедуры развёртывания.

---

## Содержание

- [Стек технологий](#стек-технологий)
- [Структура репозитория](#структура-репозитория)
- [Схема базы данных](#схема-базы-данных)
- [Аутентификация и авторизация](#аутентификация-и-авторизация)
- [Стейт-машина этапов](#стейт-машина-этапов)
- [Платёжная интеграция](#платёжная-интеграция)
- [Файловое хранилище S3](#файловое-хранилище-s3)
- [API маршруты](#api-маршруты)
- [Уведомления](#уведомления)
- [Docker и деплой](#docker-и-деплой)
- [Локальная разработка](#локальная-разработка)
- [Известные задачи](#известные-задачи)

---

## Стек технологий

| Компонент | Технология | Версия |
|---|---|---|
| Фреймворк | Next.js (App Router) | 16.2.0 |
| UI | React | 19 |
| БД | PostgreSQL | 15 |
| ORM | Prisma | 7 |
| Аутентификация | NextAuth + email magic link (Resend) | v4 |
| Файловое хранилище | S3-совместимое (cloud.ru / MinIO) | AWS SDK v3 |
| Кэш / очереди | Redis | 7 (ioredis) |
| Почта | Resend + Nodemailer (fallback) | — |
| Мониторинг ошибок | Sentry | — |
| Платёжный сервис | Go-сервис billing-svc (T-Bank) | — |
| Инфраструктура | Docker Compose, GitLab CI | — |

---

## Структура репозитория

```
crm/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Страницы логина
│   │   ├── (dashboard)/     # Кабинеты (admin/, orders/, work/)
│   │   ├── api/             # Route Handlers
│   │   ├── onboarding/      # Онбординг специалиста
│   │   ├── legal/           # Оферта, политика конфиденциальности
│   │   └── page.tsx         # Лендинг
│   ├── components/
│   │   ├── admin/           # Компоненты кабинета администратора
│   │   ├── Client/          # Компоненты кабинета заказчика
│   │   ├── Community/       # Компоненты кабинета специалиста
│   │   ├── landing/         # Компоненты лендинга
│   │   ├── stage/           # Компоненты работы с этапами заказа
│   │   └── ui/              # shadcn/ui компоненты
│   ├── lib/
│   │   ├── db/prisma.ts     # Prisma client singleton
│   │   ├── stage-machine.ts # Стейт-машина этапов (центральный модуль)
│   │   ├── billing.ts       # HTTP-клиент billing-svc
│   │   ├── s3.ts            # S3 клиент (AWS SDK)
│   │   ├── notifications.ts # In-app уведомления
│   │   ├── email.ts         # Отправка email
│   │   ├── audit.ts         # Журнал аудита
│   │   ├── payments/        # Логика платежей
│   │   └── zitadel/         # Zitadel API клиент
│   ├── proxy.ts              # Route guards (бывший middleware.ts)
│   └── types/               # TypeScript типы
├── services/
│   └── tbank/               # Go-сервис billing-svc
├── __tests__/               # Jest тесты
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yml
├── Dockerfile
├── s3-cors.xml
└── .gitlab-ci.yml
```

---

## Схема базы данных

### User

Единый пользователь для всех ролей.

| Поле | Тип | Описание |
|---|---|---|
| `id` | cuid | Первичный ключ |
| `email` | String (unique) | Email |
| `zitadelId` | String (unique) | ID пользователя в Zitadel |
| `role` | Enum | `CLIENT` / `SPECIALIST` / `ADMIN` |
| `phone` | String? | Телефон |
| `archivedAt` | DateTime? | Мягкая архивация |
| `sessionVersion` | Int | Инкрементируется при инвалидации сессий |

### SpecialistProfile

Профиль специалиста, 1:1 с `User`.

| Поле | Тип | Описание |
|---|---|---|
| `onboardingStatus` | Enum | Статус онбординга (см. таблицу ниже) |
| `formData` | JSON | Данные анкеты |
| `rating` | Float | Рейтинг 1–5 |
| `bio` | String? | Биография |
| `videoUrl` | String? | Ссылка на видео-визитку |
| `featuredOnLanding` | Boolean | Показывать на лендинге |
| `specialistContractStatus` | Enum | Статус договора специалиста |

Статусы `onboardingStatus`:

| Значение | Описание |
|---|---|
| `PENDING` | Анкета не подана |
| `TEST_INVITED` | Приглашён на тест |
| `INTERVIEW_INVITED` | Приглашён на интервью |
| `REGULATIONS` | Изучение регламентов |
| `CONTRACT` | Подписание договора |
| `ACTIVE` | Активный специалист |
| `REJECTED` | Отказ |

### OnboardingStep

Шаги онбординга специалиста.

| Поле | Тип | Значения |
|---|---|---|
| `type` | Enum | `FORM`, `TEST`, `INTERVIEW`, `REGULATIONS_READ`, `REGULATIONS`, `CONTRACT` |
| `status` | Enum | `PENDING`, `IN_PROGRESS`, `PASSED`, `FAILED` |

### RegulationDocument

Редактируемый администратором текст шага «Ознакомление с регламентом» (`/admin/regulations`, API `GET|PUT /api/admin/regulations`). Хранится в markdown и рендерится через `react-markdown`.

| Поле | Тип | Описание |
|---|---|---|
| `slug` | String | Уникальный ключ документа, сейчас единственный — `onboarding` |
| `title` | String | Заголовок документа |
| `content` | String | Текст в markdown |
| `updatedById` | String? | FK → User (админ, сохранивший версию) |

Пока записи в таблице нет, специалисту показывается текст по умолчанию из `src/lib/onboarding/regulations-default.ts` (`getRegulationsDocument()` в `src/lib/regulations.ts`).

### ClientProfile

Профиль заказчика, 1:1 с `User`.

| Поле | Тип | Описание |
|---|---|---|
| `formData` | JSON | Данные анкеты |
| `frameworkContractStatus` | Enum | Статус рамочного договора |

Статусы `frameworkContractStatus`:

| Значение |
|---|
| `NONE` |
| `AWAITING_SIGNATURE` |
| `SIGNED_BY_CLIENT` |
| `SIGNED_BY_ADMIN` |

### Order

| Поле | Тип | Описание |
|---|---|---|
| `clientId` | String | FK → User |
| `specialistId` | String? | FK → User, nullable до назначения |
| `briefData` | JSON | Данные брифа |
| `briefStep` | Int | Текущий шаг брифа |
| `deletedAt` | DateTime? | Soft delete |
| `status` | Enum | Статус заказа |

Статусы `Order.status`:

| Значение |
|---|
| `DRAFT` |
| `BRIEFING` |
| `BRIEF_REVIEW` |
| `ACTIVE` |
| `DONE` |
| `CANCELLED` |

### ProjectStage

Этап заказа.

| Поле | Тип | Описание |
|---|---|---|
| `type` | Enum | `CONCEPT`, `PLANNING`, `VISUALIZATION`, `DOCUMENTATION`, `SPECIFICATION` |
| `status` | Enum | Текущий статус (см. ниже) |
| `modRound` | Int | Счётчик раундов модерации |
| `clientRound` | Int | Счётчик раундов правок от клиента |
| `version` | Int | Версия этапа |
| `rulesS3Key` | String? | S3-ключ PDF-инструкции от администратора |

Статусы `ProjectStage.status`:

| Значение | Описание |
|---|---|
| `AWAITING_PAYMENT` | Ожидание оплаты |
| `PENDING` | Оплачен, ожидает загрузки от специалиста |
| `UPLOADED` | Файлы загружены, не сданы |
| `MOD_REVIEW` | На проверке у модератора |
| `CLIENT_REVIEW` | На проверке у клиента |
| `MOD_REVISION` | Возврат на доработку от модератора |
| `CLIENT_REVISION` | Возврат на доработку от клиента |
| `EXTRA_PAYMENT` | Доп. оплата за сверхлимитные правки |
| `APPROVED` | Этап принят |
| `BLOCKED` | Заблокирован |

### StageFile

Файл этапа.

| Поле | Тип | Описание |
|---|---|---|
| `audience` | Enum | `DESIGNER` / `CLIENT` / `SHARED` |
| `annotations` | JSON | Аннотации в формате W3C Web Annotation |

Видимость по `audience`: `DESIGNER` — специалист + admin; `CLIENT` — клиент + admin; `SHARED` — все участники. Проверка: `src/lib/client-stage-file-visibility.ts`.

### StageReview

Решение по этапу.

| Поле | Тип | Значения |
|---|---|---|
| `reviewerRole` | Enum | `MODERATOR` / `CLIENT` |
| `verdict` | Enum | `APPROVED` / `REJECTED` |

### Payment

Платёж за этап.

| Поле | Тип | Описание |
|---|---|---|
| `stageId` | String (unique) | FK → ProjectStage |
| `tBankPaymentId` | String | ID платежа в T-Bank |
| `status` | Enum | Статус платежа |

Статусы `Payment.status`:

| Значение |
|---|
| `PENDING` |
| `HELD` |
| `RELEASED` |
| `REFUNDED` |
| `FAILED` |

### ExtraPayment

Доп. оплата за сверхлимитные правки. Структура аналогична `Payment`.

### StageAct

Акт выполненных работ. Создаётся автоматически при переходе этапа в `APPROVED`.

| Поле | Тип | Описание |
|---|---|---|
| `status` | Enum | Статус акта (см. ниже) |
| `specialistActS3Key` | String? | S3-ключ акта от специалиста |
| `clientActS3Key` | String? | S3-ключ акта от клиента |

Статусы `StageAct.status`:

| Значение |
|---|
| `PENDING` |
| `SPECIALIST_UPLOADED` |
| `ADMIN_APPROVED` |
| `CLIENT_SIGNED` |
| `CONFIRMED` |
| `REJECTED` |

### Contract

Договор по заказу.

Статусы `Contract.status`:

| Значение |
|---|
| `DRAFT` |
| `SENT_TO_SPECIALIST` |
| `SPECIALIST_SIGNED` |
| `SENT_TO_CLIENT` |
| `CLIENT_SIGNED` |
| `CONFIRMED` |
| `CANCELLED` |

### OrderChatMessage / StageChatMessage

Сообщения чата.

`OrderChatMessage.channel`:

| Значение | Доступ |
|---|---|
| `COMMON` | Все участники заказа |
| `ADMIN_CLIENT` | admin ↔ клиент |
| `ADMIN_SPECIALIST` | admin ↔ специалист |

### UserFile

Файл пользователя в S3.

`UserFile.category`:

| Значение |
|---|
| `AVATAR` |
| `PORTRAIT` |
| `LANDING_WORK` |
| `PORTFOLIO` |
| `DOCUMENT` |
| `INTRO_VIDEO` |
| `BRIEF_VIDEO` |
| `BRIEF_FILE` |

### PortfolioProject / PortfolioCard / PortfolioCardAttachment

Иерархия портфолио специалиста. `PortfolioProject` → `PortfolioCard` (1:N) → `PortfolioCardAttachment` (1:N).

### LandingBundle

Заявка специалиста на размещение на лендинге.

Статусы:

| Значение |
|---|
| `DRAFT` |
| `PENDING_REVIEW` |
| `APPROVED` |
| `REJECTED` |

### Notification

In-app уведомление. Поля: `type`, `title`, `message`, `link`, `readAt`.

### AuditLog

Журнал действий. Поля: `action`, `entity`, `entityId`, `changes` (JSON diff).

### RequisiteChangeRequest

Запрос на изменение реквизитов (специалист или клиент).

Статусы: `PENDING` → `APPROVED` / `REJECTED`.

---

## Аутентификация и авторизация

### Провайдеры NextAuth

**Email (magic link) — единственный активный провайдер.**

1. Admin создаёт запись `PendingSignup` (через `/api/admin/onboarding/[id]/invite` или напрямую в БД) с нужной ролью и email.
2. NextAuth отправляет magic link через Resend на указанный email.
3. Пользователь переходит по ссылке — `PendingSignup` удаляется, создаётся `User` с заданной ролью и данными.
4. JWT-токен сессии содержит `role` из `User.role`.

**Zitadel (OIDC) — опциональный провайдер, в текущем деплое не используется.**

Подключается автоматически, если заданы все три переменные: `ZITADEL_ISSUER`, `ZITADEL_CLIENT_ID`, `ZITADEL_PROJECT_ID`. Если хотя бы одна отсутствует — провайдер не регистрируется. Код провайдера: `src/lib/auth/providers.ts`, клиент Zitadel API: `src/lib/zitadel/client.ts`.

### Middleware (`src/proxy.ts`)

Route guards по паттернам URL:

| Паттерн | Допустимые роли |
|---|---|
| `/admin/*` | `ADMIN` |
| `/work/*` | `SPECIALIST` |
| `/orders/*` | `CLIENT`, `ADMIN` |
| `/dashboard/*` | Любая авторизованная роль |

Авторизация внутри Route Handlers — дополнительная проверка через `getServerSession()` в каждом handler независимо от middleware.

### Dev Auth Bypass

Если `DEV_AUTH_BYPASS=true`, middleware не проверяет сессию в БД — роль берётся из `DEV_MOCK_ROLE`.

```bash
# .env
DEV_AUTH_BYPASS=true
DEV_MOCK_ROLE=ADMIN   # ADMIN | SPECIALIST | CLIENT
```

Создание mock-сессии:

```
GET /api/mock-auth/session?role=ADMIN   # Создать сессию
GET /api/mock-auth/reset                # Сбросить сессию
```

### Создание первого администратора

Так как Zitadel не используется, первый admin-пользователь создаётся вручную:

1. Создать запись в таблице `User` напрямую через psql или Prisma Studio с `role = 'ADMIN'` и нужным `email`.
2. Войти через magic link на странице `/login`.

Либо: задать `DEV_AUTH_BYPASS=true` + `DEV_MOCK_ROLE=ADMIN`, вызвать `/api/mock-auth/session?role=ADMIN`, проверить кабинет, затем отключить bypass.

---

## Стейт-машина этапов

Файл: `src/lib/stage-machine.ts`

Все изменения статуса `ProjectStage` проходят через функцию `transition(stageId, event, actorRole)`. Прямое обновление `status` в обход `transition()` недопустимо.

### Граф переходов

```
AWAITING_PAYMENT --[stagePaymentConfirmed / ADMIN]----> PENDING
PENDING          --[upload / SPECIALIST]--------------> UPLOADED
UPLOADED         --[submit / SPECIALIST]--------------> MOD_REVIEW
MOD_REVIEW       --[modApprove / ADMIN]--------------+-> CLIENT_REVIEW
                                                     +-> APPROVED (если клиент уже одобрил)
MOD_REVIEW       --[modRevision / ADMIN]-------------+-> MOD_REVISION   (если modRound = 0)
                                                     +-> EXTRA_PAYMENT  (если modRound ≥ 1)
MOD_REVISION     --[resubmitMod / SPECIALIST]---------> MOD_REVIEW
CLIENT_REVIEW    --[clientApprove / CLIENT]-----------> MOD_REVIEW (admin проверяет решение)
CLIENT_REVIEW    --[clientRevision / CLIENT]---------+-> MOD_REVIEW     (если clientRound < 3)
                                                     +-> EXTRA_PAYMENT  (если clientRound ≥ 3)
CLIENT_REVISION  --[resubmitClient / SPECIALIST|ADMIN]-> MOD_REVIEW
EXTRA_PAYMENT    --[paymentConfirmed / ADMIN]---------> CLIENT_REVISION
```

### Переход в APPROVED

При переходе этапа в `APPROVED` в рамках одной транзакции выполняются:

1. Создание `StageAct` (статус `PENDING`).
2. Вызов `billing-svc` для разморозки платежа (release) — если `SKIP_STAGE_PAYMENTS=false`.
3. Вызов `activateNextStage()`:
   - Если есть следующий этап — переводит его в `AWAITING_PAYMENT` (или `PENDING` если оплата отключена).
   - Если все этапы `APPROVED` — `Order.status = DONE`.
4. Отправка уведомлений всем участникам заказа.

### Лимиты бесплатных правок

| Инициатор | Бесплатных раундов | Поведение при превышении |
|---|---|---|
| Клиент | 2 | 3-й запрос → `EXTRA_PAYMENT` |
| Модератор | 1 | 2-й запрос → `EXTRA_PAYMENT` |

Если `SKIP_STAGE_PAYMENTS=true` — переход в `EXTRA_PAYMENT` никогда не происходит, правки не ограничиваются.

---

## Платёжная интеграция

### Архитектура

```
Next.js ──HTTP POST──> billing-svc (Go, :8090) ──> T-Bank API
```

`billing-svc` — отдельный Go-сервис в `services/tbank/`. В `docker-compose.yml` закомментирован. Для production раскомментировать сервис `billing-svc`.

Клиент в Next.js: `src/lib/billing.ts`.

### API billing-svc

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/payments` | Создать платёж. Возвращает `{ paymentId, paymentUrl }` — клиент редиректируется на `paymentUrl` |
| `POST` | `/payments/:id/release` | Разморозить удержанные средства (вызывается при `APPROVED`) |
| `POST` | `/payments/extra` | Создать доп. платёж за сверхлимитные правки |

### Webhook от T-Bank

Маршрут: `POST /api/payments/webhook`

1. Проверка подписи запроса (`TBANK_WEBHOOK_SECRET`).
2. Обновление `Payment.status` → `HELD`.
3. Вызов `transition(stageId, 'stagePaymentConfirmed', 'ADMIN')` через stage-machine.

### Флаг отключения биллинга

Два env-флага должны быть синхронны:

```bash
SKIP_STAGE_PAYMENTS=true
NEXT_PUBLIC_SKIP_STAGE_PAYMENTS=true
```

При `true`: этапы не блокируются на оплату, `EXTRA_PAYMENT` не выставляется.

---

## Файловое хранилище S3

### Загрузка (presigned PUT URL)

Клиент не загружает файлы через Next.js-сервер напрямую.

1. `POST /api/stages/:id/upload/presign` — сервер генерирует presigned PUT URL, возвращает его клиенту.
2. Клиент загружает файл прямым PUT-запросом в S3.
3. `POST /api/stages/:id/upload/confirm` — клиент уведомляет сервер о завершении загрузки, сервер создаёт `StageFile`.

### Скачивание (presigned GET URL)

- `GET /api/files/:id/url`
- `GET /api/stages/:id/files/:fid/download`

Оба маршрута возвращают временную presigned GET URL. Файлы не проксируются через Next.js.

### CORS для S3-бакета

Конфигурация в `s3-cors.xml`. Применить один раз при создании бакета:

```bash
aws s3api put-bucket-cors \
  --bucket <bucket-name> \
  --cors-configuration file://s3-cors.xml
```

---

## API маршруты

Все маршруты — Next.js Route Handlers (`route.ts`).

### Admin (`/api/admin/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `GET`, `PATCH` | `/admin/onboarding/[id]` | Управление шагом онбординга |
| `POST` | `/admin/onboarding/[id]/invite` | Инвайт специалиста в Zitadel |
| `POST` | `/admin/orders/[id]/assign` | Назначение специалиста на заказ |
| `PATCH` | `/admin/orders/[id]/status` | Ручная смена статуса заказа |
| `POST` | `/admin/orders/[id]/contract/generate` | Генерация договора |
| `POST` | `/admin/stages/[id]/review` | Одобрение / возврат этапа (вызывает stage-machine) |
| `PATCH` | `/admin/specialists/[id]/profile` | Обновление профиля специалиста (рейтинг, featuredOnLanding) |
| `GET` | `/admin/payments` | Список платежей |
| `POST` | `/admin/payments/[id]/release` | Ручной релиз платежа |

### Специалист (`/api/work/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `GET` | `/work/orders` | Список заказов специалиста |
| `POST` | `/work/stages/[id]/submit` | Сдача этапа |

### Этапы (`/api/stages/[id]/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `POST` | `/stages/[id]/upload/presign` | Получить presigned upload URL |
| `POST` | `/stages/[id]/upload/confirm` | Подтвердить загрузку файла |
| `POST` | `/stages/[id]/submit` | Сдать этап |
| `POST` | `/stages/[id]/client-review` | Решение клиента (approve / revision) |
| `GET`, `POST` | `/stages/[id]/act` | Получить / создать акт |
| `POST` | `/stages/[id]/act/upload` | Специалист загружает акт |
| `POST` | `/stages/[id]/act/approve` | Admin одобряет акт |
| `POST` | `/stages/[id]/act/client-sign` | Клиент подписывает акт |
| `POST` | `/stages/[id]/act/confirm` | Admin финально подтверждает акт |
| `GET` | `/stages/[id]/act/download` | Скачать акт (presigned URL) |

### Заказы (`/api/orders/[id]/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `GET`, `PATCH` | `/orders/[id]/brief` | Получить / сохранить бриф (автосохранение) |
| `GET`, `POST` | `/orders/[id]/chat` | Чат по заказу |
| `POST` | `/orders/[id]/contract/client/sign` | Подписание договора клиентом |

### Платежи (`/api/payments/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `POST` | `/payments/init` | Инициация платежа за этап (`stageId`, `amount`, `returnUrl`) |
| `POST` | `/payments/webhook` | Webhook от T-Bank |

### AI (`/api/ai/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `POST` | `/ai/brief-suggest` | AI-подсказки для заполнения брифа |
| `POST` | `/ai/revision-feedback` | AI-помощник для формулировки замечаний |
| `POST` | `/ai/portfolio-describe` | Генерация описания портфолио |
| `POST` | `/ai/stage-chat-suggest` | Подсказки в чате этапа |

### Онбординг (`/api/onboarding/*`)

| Метод | Маршрут | Описание |
|---|---|---|
| `POST` | `/onboarding/apply` | Отправка анкеты специалиста |
| `GET`, `POST` | `/onboarding/quiz` | Квалификационный тест |
| `POST` | `/onboarding/regulations-read` | Подтверждение прочтения регламентов |

### Прочие маршруты

| Метод | Маршрут | Описание |
|---|---|---|
| `GET` | `/api/health` | Healthcheck для Docker |
| `GET` | `/api/landing/specialists` | Специалисты для лендинга (`featuredOnLanding=true`, статус `ACTIVE`) |
| `GET`, `POST` | `/api/notifications` | In-app уведомления |
| `GET` | `/api/notifications/stream` | SSE-стрим для real-time уведомлений |
| `POST` | `/api/dadata/bank` | Подсказки банковских реквизитов (DaData) |
| `POST` | `/api/dadata/party` | Подсказки реквизитов организации (DaData) |

---

## Уведомления

### In-app

```typescript
notify(userId, type, title, message, link)
```

Создаёт запись в таблице `Notification`. Реализация: `src/lib/notifications.ts`.

### SSE-стрим

`GET /api/notifications/stream` — клиент держит открытое HTTP-соединение. Сервер отправляет SSE-события при создании новых `Notification`.

### Email

Отправка через Resend (основной) или Nodemailer (fallback). Шаблоны: `src/lib/email-template.ts`. Логика выбора провайдера: `src/lib/email.ts`.

---

## Docker и деплой

### Dockerfile

Multistage build:

| Стадия | Действие |
|---|---|
| `deps` | `npm ci` — установка зависимостей |
| `builder` | `prisma generate` + `next build` |
| `runner` | Next.js standalone output + Prisma client |

Запускается от пользователя `nextjs` (non-root, uid 1001).

### docker-compose.yml

| Сервис | Описание | Примечание |
|---|---|---|
| `app` | Next.js (порт 3000, mem_limit 2g) | |
| `migrate` | `prisma migrate deploy` | Запускается до `app`, одноразовый |
| `postgres` | PostgreSQL 15 | healthcheck: `pg_isready` |
| `redis` | Redis 7 alpine | |
| `minio` | Локальное S3 | Только dev / staging |
| `minio-init` | Инициализация бакетов MinIO | Только dev / staging |
| `zitadel` | Локальный IAM | Только dev |
| `billing-svc` | Go-сервис T-Bank | **Закомментирован** — раскомментировать для production |

### GitLab CI (`.gitlab-ci.yml`)

Стадии: `lint` → `test` → `build` (Docker image + push в registry) → `deploy`.

---

## Локальная разработка

### Требования

- Node.js 22+
- Docker + Docker Compose

### Первый запуск

```bash
# 1. Установить зависимости
npm install

# 2. Поднять инфраструктуру
docker compose up postgres redis minio minio-init zitadel -d

# 3. Применить миграции
npm run db:migrate

# 4. Запустить приложение
npm run dev
```

### Dev Auth Bypass

Обход Zitadel без реального OIDC-провайдера:

```bash
# .env
DEV_AUTH_BYPASS=true
DEV_MOCK_ROLE=ADMIN   # ADMIN | SPECIALIST | CLIENT
```

```
GET /api/mock-auth/session?role=ADMIN   # Создать mock-сессию
GET /api/mock-auth/reset                # Сбросить сессию
```

### Seed данных

```bash
npm run db:reset:demo   # Сброс БД + seed с демо-данными
npm run db:seed         # Только seed (без сброса)
```

### Тесты

```bash
npm run test
```

Jest + React Testing Library. Тесты находятся в `__tests__/`. Покрыты: логика `stage-machine`, утилиты.

### Ключевые переменные окружения

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NEXTAUTH_SECRET` | Секрет для NextAuth JWT |
| `NEXTAUTH_URL` | Публичный URL приложения |
| `RESEND_API_KEY` | API ключ Resend (magic link + уведомления) |
| `EMAIL_FROM` | Адрес отправителя |
| `ZITADEL_ISSUER` | _(опционально)_ URL Zitadel issuer — только если OIDC включён |
| `ZITADEL_CLIENT_ID` | _(опционально)_ Client ID в Zitadel |
| `ZITADEL_SERVICE_ACCOUNT_KEY` | _(опционально)_ JSON ключ сервисного аккаунта Zitadel |
| `S3_ENDPOINT` | Endpoint S3-хранилища |
| `S3_BUCKET` | Имя бакета |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `BILLING_SVC_URL` | URL billing-svc (http://billing-svc:8090) |
| `TBANK_WEBHOOK_SECRET` | Секрет для верификации webhook T-Bank |
| `SKIP_STAGE_PAYMENTS` | `true` — отключить платёжный блокинг этапов |
| `NEXT_PUBLIC_SKIP_STAGE_PAYMENTS` | Должен совпадать с `SKIP_STAGE_PAYMENTS` |
| `RESEND_API_KEY` | API ключ Resend |
| `SMTP_*` | SMTP настройки для Nodemailer fallback |
| `SENTRY_DSN` | DSN проекта Sentry |
| `DADATA_API_KEY` | API ключ DaData |
| `DEMO_ACCESS_KEY` | Ключ для демо-режима (`/demo/login`), в production можно оставить пустым |
| `DEV_AUTH_BYPASS` | `true` — включить dev auth bypass |
| `DEV_MOCK_ROLE` | Роль для dev auth bypass (`ADMIN` / `SPECIALIST` / `CLIENT`) |

---

## Известные задачи

| Задача | Приоритет | Подробности |
|---|---|---|
| Раскомментировать `billing-svc` в docker-compose | Критично для production | Сервис находится в `services/tbank/`, в docker-compose.yml закомментирован |
| Перевести загрузку файлов в dev на presigned URL | Средний | `/api/work/stages/[id]/upload` в dev режиме временно использует локальный диск |
| Карусель лендинга | Средний | Захардкожена, нужно подключить к `/api/landing/specialists` |
| Обновить Sentry DSN при смене проекта | При смене проекта | DSN задан статически в `next.config.ts` |
