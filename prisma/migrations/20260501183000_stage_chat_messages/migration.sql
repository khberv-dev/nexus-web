-- CreateTable
CREATE TABLE "StageChatMessage" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageChatMessage_stageId_createdAt_idx" ON "StageChatMessage"("stageId", "createdAt");

-- AddForeignKey
ALTER TABLE "StageChatMessage" ADD CONSTRAINT "StageChatMessage_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChatMessage" ADD CONSTRAINT "StageChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
