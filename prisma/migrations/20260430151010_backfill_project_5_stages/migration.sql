-- Backfill missing stages after StageType enum extension.
-- IMPORTANT: This MUST be a separate migration from ALTER TYPE ... ADD VALUE,
-- because Postgres does not allow using new enum values until after commit.

-- Backfill missing CONCEPT stage for existing orders that already have stages.
-- We mark CONCEPT as APPROVED to avoid breaking in-progress projects created under old 3-stage workflow.
INSERT INTO "ProjectStage" ("orderId", "type", "status")
SELECT ps."orderId", 'CONCEPT'::"StageType", 'APPROVED'::"StageStatus"
FROM (
  SELECT DISTINCT "orderId" FROM "ProjectStage"
) ps
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectStage" s
  WHERE s."orderId" = ps."orderId" AND s."type" = 'CONCEPT'::"StageType"
);

-- Backfill missing SPECIFICATION stage.
-- For DONE orders mark it APPROVED, for others keep it PENDING.
INSERT INTO "ProjectStage" ("orderId", "type", "status")
SELECT o."id", 'SPECIFICATION'::"StageType",
       CASE WHEN o."status" = 'DONE'::"OrderStatus"
            THEN 'APPROVED'::"StageStatus"
            ELSE 'PENDING'::"StageStatus"
       END
FROM "Order" o
WHERE EXISTS (SELECT 1 FROM "ProjectStage" s WHERE s."orderId" = o."id")
  AND NOT EXISTS (
    SELECT 1 FROM "ProjectStage" s
    WHERE s."orderId" = o."id" AND s."type" = 'SPECIFICATION'::"StageType"
  );

