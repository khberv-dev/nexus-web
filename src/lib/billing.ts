const BILLING_URL = process.env.BILLING_SVC_URL ?? "http://billing-svc:8090";

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  description: string;
  returnUrl: string;
}

export interface BillingPayment {
  paymentId: string;
  paymentUrl: string;
}

async function billingRequest<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BILLING_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`billing-svc error: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function createPayment(params: CreatePaymentParams): Promise<BillingPayment> {
  return billingRequest("/payments", params);
}

export async function releasePayment(paymentId: string): Promise<void> {
  await billingRequest(`/payments/${paymentId}/release`, {});
}

export async function createExtraPayment(params: CreatePaymentParams): Promise<BillingPayment> {
  return billingRequest("/payments/extra", params);
}
