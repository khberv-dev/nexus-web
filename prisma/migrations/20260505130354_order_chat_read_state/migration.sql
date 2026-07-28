-- CreateTable
CREATE TABLE "OrderChatReadState" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderChatReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderChatReadState_userId_idx" ON "OrderChatReadState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderChatReadState_orderId_userId_key" ON "OrderChatReadState"("orderId", "userId");

-- AddForeignKey
ALTER TABLE "OrderChatReadState" ADD CONSTRAINT "OrderChatReadState_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderChatReadState" ADD CONSTRAINT "OrderChatReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
