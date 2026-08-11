import {NextRequest, NextResponse} from "next/server";
import {createHmac} from "crypto";
import {prisma} from "@/lib/db/prisma";
import {sendEmail} from "@/lib/email";
import {OrderStatus, PaymentStatus, Role} from "@prisma/client";
import {transition, TransitionError} from "@/lib/stage-machine";
import {notify} from "@/lib/notifications";
import {isOrderComplete} from "@/lib/order-completion";

function verifySignature(payload: Record<string, unknown>, signature: string): boolean {
    const secret = process.env.TBANK_WEBHOOK_SECRET!;
    const data = Object.keys(payload)
        .filter((k) => k !== "Token")
        .sort()
        .map((k) => payload[k])
        .join("");
    const expected = createHmac("sha256", secret).update(data).digest("hex");
    return expected === signature;
}

const STATUS_MAP: Record<string, PaymentStatus> = {
    CONFIRMED: PaymentStatus.HELD,
    AUTHORIZED: PaymentStatus.HELD,
    REVERSED: PaymentStatus.REFUNDED,
    REFUNDED: PaymentStatus.REFUNDED,
    REJECTED: PaymentStatus.FAILED,
};

export async function POST(req: NextRequest) {
    const body = await req.json() as Record<string, unknown>;
    const {Token: signature, PaymentId: tBankPaymentId, Status: tBankStatus} = body;

    if (!verifySignature(body, signature as string)) {
        console.error("[webhook] Invalid signature");
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }

    const payment = await prisma.payment.findFirst({
        where: {tBankPaymentId: tBankPaymentId as string},
        include: {order: {include: {client: true, specialist: true, stages: true}}},
    });

    const extraPayment = payment
        ? null
        : await prisma.extraPayment.findFirst({
            where: {tBankPaymentId: tBankPaymentId as string},
            include: {stage: {include: {order: {include: {client: true, specialist: true}}}}}
        });

    if (!payment && !extraPayment) {
        return NextResponse.json({error: "Not found"}, {status: 404});
    }

    const newStatus = STATUS_MAP[tBankStatus as string] ?? PaymentStatus.PENDING;

    // Idempotency: banks retry webhooks. If this payment is already at the target
    // status, treat the repeat as a no-op success — otherwise we re-send emails,
    // re-notify, and re-run an already-applied stage transition (which threw and
    // returned 500, making the bank retry forever).
    const prevStatus = payment ? payment.status : extraPayment!.status;
    if (prevStatus === newStatus) {
        return NextResponse.json({ok: true, duplicate: true});
    }

    // For a HELD (funds captured) callback, drive the stage transition BEFORE
    // committing the new payment status. If the transition fails transiently we throw
    // (→ non-200) WITHOUT having committed the status, so the bank retries and the
    // idempotency guard above (still seeing the old status) lets the retry re-run —
    // preserving self-heal. Only a benign TransitionError (stage already advanced by
    // an earlier delivery / a concurrent one) is swallowed.
    if (newStatus === PaymentStatus.HELD) {
        try {
            if (payment?.stageId) {
                await transition(payment.stageId, "stagePaymentConfirmed", Role.ADMIN, undefined, null);
            } else if (extraPayment) {
                await transition(extraPayment.stageId, "paymentConfirmed", Role.ADMIN, undefined, null);
            }
        } catch (e) {
            if (!(e instanceof TransitionError)) throw e;
            console.error("[webhook] stage already advanced, skipping transition:", e);
        }
    }

    // Commit the payment status now that the gating transition has succeeded (or was a
    // benign no-op). A later duplicate callback short-circuits at the idempotency guard.
    if (payment) {
        await prisma.payment.update({where: {id: payment.id}, data: {status: newStatus}});
    } else if (extraPayment) {
        await prisma.extraPayment.update({where: {id: extraPayment.id}, data: {status: newStatus}});
    }

    if (newStatus === PaymentStatus.HELD) {
        const order = payment ? payment.order : extraPayment!.stage.order;
        const orderId = payment ? payment.orderId : extraPayment!.stage.orderId;

        if (order.client.email) {
            void sendEmail("payment_received", order.client.email, {orderId});
        }
        if (order.specialist?.email) {
            void sendEmail("payment_received", order.specialist.email, {orderId});
        }

        const shortId = orderId.slice(-6).toUpperCase();
        void notify(order.client.id ?? order.clientId, "payment_received", "Оплата получена", `Платеж по заказу #${shortId} подтвержден`, `/orders/${orderId}`);
        if (order.specialist) {
            void notify(order.specialist.id ?? order.specialistId, "payment_received", "Оплата получена", `Платеж по заказу #${shortId} подтвержден`, `/work/${orderId}`);
        }

        if (payment) {
            if (await isOrderComplete(payment.orderId)) {
                await prisma.order.update({where: {id: payment.orderId}, data: {status: OrderStatus.DONE}});
                if (payment.order.client.email) {
                    void sendEmail("project_done", payment.order.client.email, {orderId: payment.orderId});
                }
                if (payment.order.specialist?.email) {
                    void sendEmail("project_done", payment.order.specialist.email, {orderId: payment.orderId});
                }
            }
        }
    }

    return NextResponse.json({ok: true});
}
