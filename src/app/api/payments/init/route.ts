import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionWithDevBypass } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { createPayment } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { stageLabelRu } from "@/lib/stage-labels";
import { isStagePaymentsDisabled } from "@/lib/payments/flags";
import { syncStageSequentialLocks } from "@/lib/stage-sequencing";
import { parseJsonBody } from "@/lib/validate";

const initSchema = z.object({
  stageId: z.string().min(1),
  amount: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSessionWithDevBypass();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, id: userId } = session.user as { role: string; id: string };
  if (role !== "ADMIN" && role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = await parseJsonBody(req, initSchema);
  if (!parsed.ok) return parsed.response;
  const { stageId, amount: bodyAmount } = parsed.data;

  const stage = await prisma.projectStage.findUnique({
    where: role === "ADMIN" ? { id: stageId } : { id: stageId, order: { clientId: userId } },
    include: { order: { include: { client: true } } },
  });
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (stage.status !== "AWAITING_PAYMENT" && stage.status !== "EXTRA_PAYMENT")
    return NextResponse.json({ error: "Stage is not awaiting payment" }, { status: 409 });

  // Billing disabled → do not block workflow on payments.
  if (isStagePaymentsDisabled()) {
    if (stage.status === "AWAITING_PAYMENT") {
      await prisma.projectStage.update({ where: { id: stage.id }, data: { status: "PENDING" } })
      await syncStageSequentialLocks(stage.orderId)
      return NextResponse.json({ ok: true, paymentUrl: null, skipped: true, status: "PENDING" })
    }
    // EXTRA_PAYMENT: allow continuing without payment.
    await prisma.projectStage.update({ where: { id: stage.id }, data: { status: "CLIENT_REVISION" } })
    await syncStageSequentialLocks(stage.orderId)
    return NextResponse.json({ ok: true, paymentUrl: null, skipped: true, status: "CLIENT_REVISION" })
  }

  let amount = bodyAmount ?? stage.price;

  if (stage.status === "EXTRA_PAYMENT") {
    const extra = await prisma.extraPayment.findFirst({
      where: { stageId, status: "PENDING" },
      orderBy: { id: "desc" }
    });
    if (!extra) return NextResponse.json({ error: "No pending extra payment found" }, { status: 404 });
    amount = extra.amount;
  }

  if (!amount) return NextResponse.json({ error: "Amount is required" }, { status: 400 });

  let billing;
  let paymentId: string | undefined;

  if (stage.status === "EXTRA_PAYMENT") {
    const extra = await prisma.extraPayment.findFirst({
      where: { stageId, status: "PENDING" },
      orderBy: { id: "desc" }
    });
    if (!extra) return NextResponse.json({ error: "No pending extra payment found" }, { status: 404 });
    paymentId = extra.id;
    billing = await createPayment({
      orderId: stage.orderId,
      amount,
      description: `Доплата за правки: ${stageLabelRu(stage.type)} заказа #${stage.orderId}`,
      returnUrl: `${process.env.NEXTAUTH_URL}/orders/${stage.orderId}/payment/result`,
    });
  } else {
    const payment = await prisma.payment.upsert({
      where: { stageId },
      create: { orderId: stage.orderId, stageId, amount },
      update: { amount }
    });
    paymentId = payment.id;

    billing = await createPayment({
      orderId: stage.orderId,
      amount,
      description: `Оплата этапа ${stageLabelRu(stage.type)} заказа #${stage.orderId}`,
      returnUrl: `${process.env.NEXTAUTH_URL}/orders/${stage.orderId}/payment/result`,
    });

    await prisma.payment.update({ where: { id: payment.id }, data: { tBankPaymentId: billing.paymentId } });
  }

  if (stage.order.client.email) {
    void sendEmail("extra_payment_required", stage.order.client.email, {
      orderId: stage.orderId,
      amount,
      paymentUrl: billing.paymentUrl,
    });
  }

  return NextResponse.json({ paymentId, paymentUrl: billing.paymentUrl });
}
