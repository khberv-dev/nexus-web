-- AlterEnum
ALTER TYPE "OrderChatChannel" ADD VALUE 'COMMON';

-- DropIndex
DROP INDEX "OrderChatReadState_orderId_userId_key";

-- AlterTable
ALTER TABLE "OrderChatMessage" ALTER COLUMN "channel" SET DEFAULT 'COMMON';

-- AlterTable
ALTER TABLE "OrderChatReadState" ALTER COLUMN "channel" SET DEFAULT 'COMMON';

