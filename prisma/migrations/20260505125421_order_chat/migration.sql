-- DropForeignKey
ALTER TABLE "RequisiteChangeRequest" DROP CONSTRAINT "RequisiteChangeRequest_specialistId_fkey";

-- DropIndex
DROP INDEX "OnboardingStep_profileId_idx";

-- CreateTable
CREATE TABLE "OrderChatMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderChatMessage_orderId_createdAt_idx" ON "OrderChatMessage"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChatMessage" ADD CONSTRAINT "OrderChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequisiteChangeRequest" ADD CONSTRAINT "RequisiteChangeRequest_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
