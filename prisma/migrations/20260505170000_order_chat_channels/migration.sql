-- Add per-order chat channels: admin<->client and admin<->specialist.

DO $$ BEGIN
  CREATE TYPE "OrderChatChannel" AS ENUM ('ADMIN_CLIENT', 'ADMIN_SPECIALIST');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "OrderChatMessage"
  ADD COLUMN IF NOT EXISTS "channel" "OrderChatChannel" NOT NULL DEFAULT 'ADMIN_CLIENT';

-- Keep existing data; default channel is ADMIN_CLIENT.

DROP INDEX IF EXISTS "OrderChatMessage_orderId_createdAt_idx";
CREATE INDEX IF NOT EXISTS "OrderChatMessage_orderId_channel_createdAt_idx"
  ON "OrderChatMessage"("orderId", "channel", "createdAt");

ALTER TABLE "OrderChatReadState"
  ADD COLUMN IF NOT EXISTS "channel" "OrderChatChannel" NOT NULL DEFAULT 'ADMIN_CLIENT';

-- Replace unique constraint (orderId,userId) -> (orderId,userId,channel)
DO $$ BEGIN
  ALTER TABLE "OrderChatReadState" DROP CONSTRAINT IF EXISTS "OrderChatReadState_orderId_userId_key";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "OrderChatReadState_orderId_userId_channel_key"
  ON "OrderChatReadState"("orderId", "userId", "channel");

