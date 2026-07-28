-- New enum label only (cannot use 'BLOCKED' in updates in the same transaction).
-- IF NOT EXISTS: safe on Postgres 15+ if the label was added manually or deploy retried.
ALTER TYPE "StageStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
