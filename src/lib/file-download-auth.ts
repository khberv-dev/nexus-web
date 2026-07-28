import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/session";

/** True if the user is the client or the assigned specialist on the order. */
function isOrderParty(
  order: { clientId: string; specialistId: string | null } | null | undefined,
  userId: string,
): boolean {
  if (!order) return false;
  return order.clientId === userId || order.specialistId === userId;
}

/**
 * Authorize a raw S3 key download for a session user.
 *
 * Fixes the IDOR in /api/files/download where any authenticated user could fetch
 * ANY key. We resolve the key to its owning record and only allow the caller if
 * they own it or are a party to the related order. ADMIN may access everything.
 *
 * S3 keys embed UUIDs, so a key maps to at most one record per model.
 * Returns true only if a record matches AND the user is authorized for it.
 */
export async function canAccessS3Key(key: string, user: SessionUser): Promise<boolean> {
  if (user.role === "ADMIN") return true;

  const orderParty = { select: { clientId: true, specialistId: true } } as const;

  // 1. UserFile — brief files, avatars, work uploads, portfolio, etc.
  const userFile = await prisma.userFile.findFirst({
    where: { s3Key: key },
    select: {
      userId: true,
      briefVideoForOrder: orderParty,
      briefAttachments: { select: { order: orderParty } },
    },
  });
  if (userFile) {
    if (userFile.userId === user.id) return true;
    // Shared with the other party of an order via the brief.
    if (isOrderParty(userFile.briefVideoForOrder, user.id)) return true;
    if (userFile.briefAttachments.some((a) => isOrderParty(a.order, user.id))) return true;
    return false;
  }

  // 2. StageFile — stage deliverables.
  const stageFile = await prisma.stageFile.findFirst({
    where: { s3Key: key },
    select: { stage: { select: { order: orderParty } } },
  });
  if (stageFile) return isOrderParty(stageFile.stage?.order, user.id);

  // 3. Invoice.
  const invoice = await prisma.invoice.findFirst({
    where: { s3Key: key },
    select: { order: orderParty },
  });
  if (invoice) return isOrderParty(invoice.order, user.id);

  // 4. Contract — original + signed copies.
  const contract = await prisma.contract.findFirst({
    where: { OR: [{ s3Key: key }, { specialistSignedS3Key: key }, { clientSignedS3Key: key }] },
    select: { order: orderParty },
  });
  if (contract) return isOrderParty(contract.order, user.id);

  // Unknown key → deny (no record owns it).
  return false;
}
