-- PENDING on a later pipeline stage while an earlier one is not APPROVED → BLOCKED
UPDATE "ProjectStage" AS ps
SET status = 'BLOCKED'
WHERE ps.status = 'PENDING'
AND (
  (ps.type = 'PLANNING'::"StageType" AND EXISTS (
    SELECT 1 FROM "ProjectStage" c
    WHERE c."orderId" = ps."orderId" AND c.type = 'CONCEPT'::"StageType" AND c.status <> 'APPROVED'::"StageStatus"))
  OR (ps.type = 'VISUALIZATION'::"StageType" AND EXISTS (
    SELECT 1 FROM "ProjectStage" x
    WHERE x."orderId" = ps."orderId" AND x.type IN ('CONCEPT'::"StageType", 'PLANNING'::"StageType") AND x.status <> 'APPROVED'::"StageStatus"))
  OR (ps.type = 'DOCUMENTATION'::"StageType" AND EXISTS (
    SELECT 1 FROM "ProjectStage" x
    WHERE x."orderId" = ps."orderId" AND x.type IN ('CONCEPT'::"StageType", 'PLANNING'::"StageType", 'VISUALIZATION'::"StageType") AND x.status <> 'APPROVED'::"StageStatus"))
  OR (ps.type = 'SPECIFICATION'::"StageType" AND EXISTS (
    SELECT 1 FROM "ProjectStage" x
    WHERE x."orderId" = ps."orderId" AND x.type IN ('CONCEPT'::"StageType", 'PLANNING'::"StageType", 'VISUALIZATION'::"StageType", 'DOCUMENTATION'::"StageType") AND x.status <> 'APPROVED'::"StageStatus"))
);

UPDATE "ProjectStage" AS ps
SET status = 'PENDING'
WHERE ps.status = 'BLOCKED'
AND NOT EXISTS (
  SELECT 1 FROM "ProjectStage" x
  WHERE x."orderId" = ps."orderId"
  AND (
    (ps.type = 'PLANNING'::"StageType" AND x.type = 'CONCEPT'::"StageType")
    OR (ps.type = 'VISUALIZATION'::"StageType" AND x.type IN ('CONCEPT'::"StageType", 'PLANNING'::"StageType"))
    OR (ps.type = 'DOCUMENTATION'::"StageType" AND x.type IN ('CONCEPT'::"StageType", 'PLANNING'::"StageType", 'VISUALIZATION'::"StageType"))
    OR (ps.type = 'SPECIFICATION'::"StageType" AND x.type IN ('CONCEPT'::"StageType", 'PLANNING'::"StageType", 'VISUALIZATION'::"StageType", 'DOCUMENTATION'::"StageType"))
  )
  AND x.status <> 'APPROVED'::"StageStatus"
);
