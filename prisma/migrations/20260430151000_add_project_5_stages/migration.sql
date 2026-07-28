-- Add 5-stage project workflow: CONCEPT + SPECIFICATION
-- NOTE: Postgres enum values are append-only.
ALTER TYPE "StageType" ADD VALUE IF NOT EXISTS 'CONCEPT';
ALTER TYPE "StageType" ADD VALUE IF NOT EXISTS 'SPECIFICATION';
