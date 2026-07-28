import { NextRequest, NextResponse } from "next/server"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { getDownloadUrl, getUploadUrl } from "@/lib/s3"
import { ClientFrameworkContractStatus } from "@prisma/client"

/** Статус и ссылка на скачивание договора оказания услуг (только свой профиль) */
export async function GET() {
  const user = await getSessionUser()
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const profile = await prisma.clientProfile.findUnique({ where: { userId: dbUser.id } })
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 })

  const key = profile.frameworkContractS3Key
  let downloadUrl: string | null = null
  if (key) {
    try {
      const { url } = await getDownloadUrl(key)
      downloadUrl = url
    } catch {
      downloadUrl = null
    }
  }

  return NextResponse.json({
    status: profile.frameworkContractStatus,
    number: profile.frameworkContractNumber,
    hasFile: Boolean(key),
    downloadUrl,
    uploadedAt: profile.frameworkContractUploadedAt?.toISOString() ?? null,
    hasSignedFile: Boolean(profile.signedContractS3Key),
  })
}

/** Подписать или отказаться от договора оказания услуг */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = (await req.json()) as { action?: string }
  const action = body.action
  if (action !== "sign" && action !== "decline") {
    return NextResponse.json({ error: "action must be sign or decline" }, { status: 400 })
  }

  const profile = await prisma.clientProfile.findUnique({ where: { userId: dbUser.id } })
  if (!profile?.frameworkContractS3Key) {
    return NextResponse.json({ error: "Нет файла договора" }, { status: 409 })
  }
  if (profile.frameworkContractStatus !== ClientFrameworkContractStatus.AWAITING_SIGNATURE) {
    return NextResponse.json({ error: "Договор не ожидает ответа" }, { status: 409 })
  }

  await prisma.clientProfile.update({
    where: { id: profile.id },
    data: {
      frameworkContractStatus:
        action === "sign"
          ? ClientFrameworkContractStatus.SIGNED_BY_CLIENT
          : ClientFrameworkContractStatus.DECLINED_BY_CLIENT,
    },
  })

  return NextResponse.json({ ok: true, status: action === "sign" ? "SIGNED_BY_CLIENT" : "DECLINED_BY_CLIENT" })
}

/** Получить presigned URL для загрузки подписанного скана договора */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  if (!user || user.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { filename } = (await req.json()) as { filename: string }
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 })

  const profile = await prisma.clientProfile.findUnique({ where: { userId: dbUser.id } })
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 404 })

  const s3Key = `client-contracts/${dbUser.id}/${Date.now()}-${filename}`
  const { url: uploadUrl } = await getUploadUrl(s3Key)

  await prisma.clientProfile.update({
    where: { id: profile.id },
    data: { signedContractS3Key: s3Key, signedContractUploadedAt: new Date() },
  })

  return NextResponse.json({ uploadUrl, s3Key })
}
