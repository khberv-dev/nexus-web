-- Make specialistId optional and add clientId to RequisiteChangeRequest
ALTER TABLE "RequisiteChangeRequest" ALTER COLUMN "specialistId" DROP NOT NULL;
ALTER TABLE "RequisiteChangeRequest" ADD COLUMN "clientId" TEXT;
ALTER TABLE "RequisiteChangeRequest" ADD CONSTRAINT "RequisiteChangeRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RequisiteChangeRequest_clientId_status_idx" ON "RequisiteChangeRequest"("clientId", "status");
