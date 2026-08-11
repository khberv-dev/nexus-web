import {prisma} from "@/lib/db/prisma";
import {StageStatus} from "@prisma/client";

/**
 * Canonical order-completion rule: an order is complete when every one of its
 * project stages is APPROVED.
 *
 * Use this everywhere instead of ad-hoc per-call checks so completion can't
 * diverge between the stage machine, the payment webhook, and the admin payment
 * release route (previously three different definitions — FUN6). Payment release
 * is a consequence of stage approval in the escrow model, not a separate
 * completion criterion, so completion is keyed on stage approval.
 */
export async function isOrderComplete(orderId: string): Promise<boolean> {
    const notApproved = await prisma.projectStage.count({
        where: {orderId, status: {not: StageStatus.APPROVED}},
    });
    return notApproved === 0;
}
