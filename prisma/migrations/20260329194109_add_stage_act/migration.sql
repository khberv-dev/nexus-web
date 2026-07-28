-- CreateTable
CREATE TABLE "StageAct" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "signedById" TEXT,

    CONSTRAINT "StageAct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageAct_stageId_key" ON "StageAct"("stageId");

-- AddForeignKey
ALTER TABLE "StageAct" ADD CONSTRAINT "StageAct_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProjectStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAct" ADD CONSTRAINT "StageAct_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
