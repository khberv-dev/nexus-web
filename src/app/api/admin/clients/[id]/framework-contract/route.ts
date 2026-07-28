import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { putObject, validateFile, isStorageConfigured } from "@/lib/s3"
import { ClientFrameworkContractStatus } from "@prisma/client"
import { sendEmail } from "@/lib/email"
import { notify } from "@/lib/notifications"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage not configured" }, { status: 503 })

  const { id: clientUserId } = await params
  const db = await prisma.user.findFirst({
    where: { id: clientUserId, role: "CLIENT" },
    include: { clientProfile: true },
  })
  if (!db?.clientProfile) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const form = await req.formData()
  const file = form.get("file")
  const numberRaw = form.get("number")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Файл обязателен" }, { status: 400 })
  }
  validateFile(file.name, file.size)
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (ext !== "pdf") return NextResponse.json({ error: "Нужен файл PDF" }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)
  const key = `clients/${clientUserId}/framework/${Date.now()}-${safe}`
  await putObject(key, buf, file.type || "application/pdf")

  const number =
    typeof numberRaw === "string" && numberRaw.trim()
      ? numberRaw.trim().slice(0, 64)
      : `РД-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${db.clientProfile.id.slice(-4).toUpperCase()}`

  await prisma.clientProfile.update({
    where: { id: db.clientProfile.id },
    data: {
      frameworkContractS3Key: key,
      frameworkContractStatus: ClientFrameworkContractStatus.AWAITING_SIGNATURE,
      frameworkContractNumber: number,
      frameworkContractUploadedAt: new Date(),
    },
  })

  void notify(clientUserId, "framework_contract_uploaded", "Договор оказания услуг загружен", "Ознакомьтесь с договором и подпишите его в разделе «Оплата»", "/orders?tab=payments")

  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")
  const cabinetUrl = base ? `${base}/orders?tab=payments` : ""
  if (db.email?.trim()) {
    void sendEmail("framework_contract_ready", db.email.trim(), {
      contractNumber: number,
      cabinetUrl: cabinetUrl || undefined,
    })
  }

  return NextResponse.json({ ok: true, number })
}
