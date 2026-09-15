-- Имя пользователя хранится раздельно: firstName + lastName вместо одного name.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

ALTER TABLE "PendingSignup" ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT;

-- Источник для переноса: User.name, а если он пуст — ФИО из анкеты профиля.
-- Первое слово становится именем, остаток — фамилией (формы регистрации просили «Иван Иванов»).
WITH source AS (
    SELECT u."id",
           NULLIF(regexp_replace(btrim(COALESCE(
               NULLIF(btrim(u."name"), ''),
               sp."formData"->>'fullName',
               cp."formData"->>'fullName',
               ''
           )), '\s+', ' ', 'g'), '') AS full_name
    FROM "User" u
    LEFT JOIN "SpecialistProfile" sp ON sp."userId" = u."id"
    LEFT JOIN "ClientProfile" cp ON cp."userId" = u."id"
)
UPDATE "User" u
SET "firstName" = split_part(s.full_name, ' ', 1),
    "lastName"  = NULLIF(substr(s.full_name, length(split_part(s.full_name, ' ', 1)) + 2), '')
FROM source s
WHERE s."id" = u."id" AND s.full_name IS NOT NULL;

UPDATE "PendingSignup"
SET "firstName" = split_part(regexp_replace(btrim("name"), '\s+', ' ', 'g'), ' ', 1),
    "lastName"  = NULLIF(substr(regexp_replace(btrim("name"), '\s+', ' ', 'g'),
                                length(split_part(regexp_replace(btrim("name"), '\s+', ' ', 'g'), ' ', 1)) + 2), '')
WHERE NULLIF(btrim("name"), '') IS NOT NULL;

-- ФИО больше не дублируется в анкетах: источник истины — поля пользователя.
UPDATE "SpecialistProfile" SET "formData" = "formData" - 'fullName'
WHERE "formData" IS NOT NULL AND jsonb_typeof("formData") = 'object' AND "formData" ? 'fullName';

UPDATE "ClientProfile" SET "formData" = "formData" - 'fullName'
WHERE "formData" IS NOT NULL AND jsonb_typeof("formData") = 'object' AND "formData" ? 'fullName';

UPDATE "PendingSignup" SET "formData" = "formData" - 'fullName'
WHERE "formData" IS NOT NULL AND jsonb_typeof("formData") = 'object' AND "formData" ? 'fullName';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name";
ALTER TABLE "PendingSignup" DROP COLUMN "name";
