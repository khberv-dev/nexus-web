import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { SpecialistContractStatus } from "@prisma/client"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { getDownloadUrl, isStorageConfigured, putObject, validateFile } from "@/lib/s3"
import { notify } from "@/lib/notifications"

function mergeFormDataJson(
  current: Prisma.JsonValue | null | undefined,
  patch: Record<string, string | undefined>,
): Prisma.InputJsonValue {
  const base: Record<string, unknown> =
    current && typeof current === "object" && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") delete base[k]
    else base[k] = v
  }
  return base as Prisma.InputJsonValue
}

export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const profile = await prisma.specialistProfile.findUnique({ where: { userId: dbUser.id } })
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 })
  const profileAny = profile as typeof profile & {
    specialistSignedContractS3Key?: string | null
    specialistSignedContractUploadedAt?: Date | null
  }

  let downloadUrl: string | null = null
  let signedDownloadUrl: string | null = null

  if (profile.specialistContractS3Key) {
    try {
      const { url } = await getDownloadUrl(profile.specialistContractS3Key)
      downloadUrl = url
    } catch {}
  }

  if (profileAny.specialistSignedContractS3Key) {
    try {
      const { url } = await getDownloadUrl(profileAny.specialistSignedContractS3Key)
      signedDownloadUrl = url
    } catch {}
  }

  return NextResponse.json({
    status: profile.specialistContractStatus,
    number: profile.specialistContractNumber,
    hasFile: Boolean(profile.specialistContractS3Key),
    downloadUrl,
    uploadedAt: profile.specialistContractUploadedAt?.toISOString() ?? null,
    hasSignedFile: Boolean(profileAny.specialistSignedContractS3Key),
    signedDownloadUrl,
    signedUploadedAt: profileAny.specialistSignedContractUploadedAt?.toISOString() ?? null,
  })
}

async function markContractResponse(dbUserId: string, action: "sign" | "decline", edoOperator?: string) {
  const profile = await prisma.specialistProfile.findUnique({ where: { userId: dbUserId } })
  if (!profile?.specialistContractS3Key) {
    return NextResponse.json({ error: "Договор еще не размещен администратором" }, { status: 409 })
  }
  if (profile.specialistContractStatus !== SpecialistContractStatus.AWAITING_SIGNATURE) {
    return NextResponse.json({ error: "Договор не ожидает вашего ответа" }, { status: 409 })
  }

  const edoRaw = typeof edoOperator === "string" ? edoOperator.trim().slice(0, 500) : ""
  const nextForm = mergeFormDataJson(profile.formData, { edoOperator: edoRaw || undefined })

  await prisma.specialistProfile.update({
    where: { id: profile.id },
    data: {
      specialistContractStatus:
        action === "sign"
          ? SpecialistContractStatus.SIGNED_BY_SPECIALIST
          : SpecialistContractStatus.DECLINED_BY_SPECIALIST,
      formData: nextForm,
    },
  })

  return NextResponse.json({
    ok: true,
    status: action === "sign" ? "SIGNED_BY_SPECIALIST" : "DECLINED_BY_SPECIALIST",
  })
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== "SPECIALIST") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const contentType = req.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    if (!isStorageConfigured()) return NextResponse.json({ error: "Storage not configured" }, { status: 503 })

    const profile = await prisma.specialistProfile.findUnique({ where: { userId: dbUser.id } })
    if (!profile?.specialistContractS3Key) {
      return NextResponse.json({ error: "Сначала скачайте исходный договор от администратора" }, { status: 409 })
    }
    if (profile.specialistContractStatus !== SpecialistContractStatus.AWAITING_SIGNATURE) {
      return NextResponse.json({ error: "Загрузка подписанного файла сейчас недоступна" }, { status: 409 })
    }

    const form = await req.formData()
    const file = form.get("file")
    const edoOperator = typeof form.get("edoOperator") === "string" ? String(form.get("edoOperator")) : ""
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Подписанный PDF обязателен" }, { status: 400 })
    }

    validateFile(file.name, file.size)
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
    if (ext !== "pdf") return NextResponse.json({ error: "Нужен файл PDF" }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120)
    const key = `specialists/${dbUser.id}/platform-contract/signed/${Date.now()}-${safe}`
    await putObject(key, buf, file.type || "application/pdf")

    const edoRaw = edoOperator.trim().slice(0, 500)
    const nextForm = mergeFormDataJson(profile.formData, { edoOperator: edoRaw || undefined })

    await prisma.specialistProfile.update({
      where: { id: profile.id },
      data: {
        specialistSignedContractS3Key: key,
        specialistSignedContractUploadedAt: new Date(),
        specialistContractStatus: SpecialistContractStatus.SIGNED_BY_SPECIALIST,
        formData: nextForm,
      } as never,
    })

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    const specName = dbUser.name ?? dbUser.email ?? "Специалист"
    for (const a of admins) {
      await notify(a.id, "contract_signed", "Договор подписан", `${specName} загрузил подписанный договор`, `/admin/specialists`)
    }

    return NextResponse.json({ ok: true, status: "SIGNED_BY_SPECIALIST" })
  }

  const body = (await req.json()) as { action?: string; edoOperator?: string }
  const action = body.action
  if (action !== "sign" && action !== "decline") {
    return NextResponse.json({ error: "action must be sign or decline" }, { status: 400 })
  }

  return markContractResponse(dbUser.id, action, body.edoOperator)
}
