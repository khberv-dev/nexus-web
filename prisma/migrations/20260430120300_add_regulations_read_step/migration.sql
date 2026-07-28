-- Add a new onboarding step before the regulations quiz.
-- NOTE: Postgres enum values are append-only.
ALTER TYPE "StepType" ADD VALUE 'REGULATIONS_READ';

