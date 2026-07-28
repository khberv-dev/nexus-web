/*
  Warnings:

  - You are about to drop the `acquiring_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `b2b_invoice_contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `b2b_invoice_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `b2b_invoices` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `counterparties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `financial_audit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `webhook_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "b2b_invoice_contacts" DROP CONSTRAINT "b2b_invoice_contacts_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "b2b_invoice_items" DROP CONSTRAINT "b2b_invoice_items_invoice_id_fkey";

-- AlterTable
ALTER TABLE "ExtraPayment" ADD COLUMN     "tBankPaymentId" TEXT;

-- AlterTable
ALTER TABLE "ProjectStage" ADD COLUMN     "price" INTEGER;

-- DropTable
DROP TABLE "acquiring_payments";

-- DropTable
DROP TABLE "b2b_invoice_contacts";

-- DropTable
DROP TABLE "b2b_invoice_items";

-- DropTable
DROP TABLE "b2b_invoices";

-- DropTable
DROP TABLE "counterparties";

-- DropTable
DROP TABLE "financial_audit";

-- DropTable
DROP TABLE "webhook_events";
