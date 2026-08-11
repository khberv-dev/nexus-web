import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionUser} from "@/lib/session"
import {audit} from "@/lib/audit"
import {releasePayment} from "@/lib/billing"
import {isOrderComplete} from "@/lib/order-completion"

export async function POST(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user || user.role !== "ADMIN") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id} = await params
    const payment = await prisma.payment.findUnique({where: {id}})
    if (!payment) return NextResponse.json({error: "Not found"}, {status: 404})

    // Only funds that are actually HELD (or already RELEASED) are valid here. Reject
    // anything else (PENDING/unpaid, REFUNDED, FAILED) so we never mark an uncaptured
    // payment as settled. An already-RELEASED payment is an idempotent no-op success.
    if (payment.status !== "HELD" && payment.status !== "RELEASED") {
        return NextResponse.json({error: `Нельзя выплатить платёж в статусе «${payment.status}»`}, {status: 409})
    }

    let releasedNow = false

    if (payment.status === "HELD") {
        if (!payment.tBankPaymentId) {
            return NextResponse.json({error: "Платёж не связан с биллингом"}, {status: 409})
        }

        // Atomically claim the payment so two concurrent requests can't both call the
        // billing service (double payout). Only the request that flips HELD -> RELEASED
        // actually releases; a racing loser (count===0) falls through to reconciliation.
        const claim = await prisma.payment.updateMany({
            where: {id, status: "HELD"},
            data: {status: "RELEASED"},
        })

        if (claim.count === 1) {
            try {
                await releasePayment(payment.tBankPaymentId)
            } catch (error) {
                console.error(`[admin-billing] FAILED to release funds for payment ${id}:`, error)
                // Roll the claim back so the payment can be retried.
                await prisma.payment.update({where: {id}, data: {status: "HELD"}})
                return NextResponse.json({error: "Billing service error"}, {status: 502})
            }
            releasedNow = true

            const dbUser = await prisma.user.findUnique({where: {email: user.email}, select: {id: true}})
            await audit(dbUser?.id ?? null, "payment_released", "Payment", id, {
                status: {from: "HELD", to: "RELEASED"},
                orderId: {to: payment.orderId}
            })
        }
    }

    // Mark the order DONE only when THIS request actually confirmed the release
    // (a real HELD -> RELEASED transition + successful billing call) AND all stages
    // are approved (the canonical completion rule — FUN6). We deliberately do NOT
    // complete from a race-loser or already-RELEASED read: a concurrent request may
    // have written RELEASED optimistically and could still roll back on a billing
    // failure. (Crash-recovery self-heal + multi-payment safety need a two-phase
    // "RELEASING" payment state — deferred.)
    if (releasedNow && (await isOrderComplete(payment.orderId))) {
        await prisma.order.update({where: {id: payment.orderId}, data: {status: "DONE"}})
    }

    return NextResponse.json({ok: true, alreadyReleased: !releasedNow})
}
