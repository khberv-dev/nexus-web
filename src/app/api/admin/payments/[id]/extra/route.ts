import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSessionWithDevBypass } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { createExtraPayment } from "@/lib/billing";
import { sendEmail } from "@/lib/email";
import { parseJsonBody } from "@/lib/validate";

const extraSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionWithDevBypass();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role } = session.user as { role: string };
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params; // stageId
  const parsed = await parseJsonBody(req, extraSchema);
  if (!parsed.ok) return parsed.response;
  const { amount, reason } = parsed.data;

  const stage = await prisma.projectStage.findUnique({ where: { id }, include: { order: { include: { client: true } } } });
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const billing = await createExtraPayment({
    orderId: stage.orderId,
    amount,
    description: reason,
    returnUrl: `${process.env.NEXTAUTH_URL}/orders/${stage.orderId}/payment/result`,
  });

  const extra = await prisma.extraPayment.create({ 
    data: { 
      stageId: id, 
      amount, 
      reason,
      tBankPaymentId: billing.paymentId 
    } 
  });

  if (stage.order.client.email) {
    void sendEmail("extra_payment_required", stage.order.client.email, {
      stageId: id,
      amount,
      reason,
      paymentUrl: billing.paymentUrl,
    });
  }

  return NextResponse.json({ extraPaymentId: extra.id, paymentUrl: billing.paymentUrl });
}
