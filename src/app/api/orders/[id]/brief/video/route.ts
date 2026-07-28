import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionDbUser, getSessionUser } from "@/lib/session"
import { getUploadUrl, uploadToS3, validateFile } from "@/lib/s3"
import type { FileCategory } from "@prisma/client"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: orderId } = await params
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, clientId: true, status: true, deletedAt: true, briefVideoFileId: true },
  })
  if (!order || order.deletedAt || order.clientId !== dbUser.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (order.status !== "DRAFT") return NextResponse.json({ error: "Brief is locked" }, { status: 409 })

  const ct = (req.headers.get("content-type") ?? "").toLowerCase()

  // Preferred: server-side upload via multipart/form-data to avoid S3 CORS issues
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData()
    const file = fd.get("file") as File | null
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 })
    if (!file.type?.startsWith("video/")) return NextResponse.json({ error: "Only video files allowed" }, { status: 400 })

    try {
      validateFile(file.name, file.size)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }

    const fileId = crypto.randomUUID()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const s3Key = `orders/${orderId}/brief/video/${fileId}/${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await uploadToS3(s3Key, buffer, file.type || "video/mp4")

    const created = await prisma.userFile.create({
      data: {
        userId: dbUser.id,
        category: "BRIEF_VIDEO" as FileCategory,
        s3Key,
        filename: file.name,
        mimeType: file.type || null,
        size: file.size,
        title: "Видео к брифу",
        description: `Заказ #${orderId.slice(-6).toUpperCase()}`,
      },
      select: { id: true, s3Key: true, filename: true, mimeType: true, createdAt: true },
    })

    await prisma.order.update({ where: { id: orderId }, data: { briefVideoFileId: created.id } })

    return NextResponse.json({ file: created })
  }

  // Fallback: presigned PUT (may require bucket CORS to work in browser)
  const { filename, mimeType, size } = await req.json() as { filename: string; mimeType?: string; size?: number }
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 })
  if (!mimeType?.startsWith("video/")) return NextResponse.json({ error: "Only video files allowed" }, { status: 400 })

  try {
    validateFile(filename, size)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const fileId = crypto.randomUUID()
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  const s3Key = `orders/${orderId}/brief/video/${fileId}/${safeName}`
  const { url, expiresAt } = await getUploadUrl(s3Key)

  const created = await prisma.userFile.create({
    data: {
      userId: dbUser.id,
      category: "BRIEF_VIDEO" as FileCategory,
      s3Key,
      filename,
      mimeType,
      size: typeof size === "number" && Number.isFinite(size) ? Math.max(0, Math.floor(size)) : null,
      title: "Видео к брифу",
      description: `Заказ #${orderId.slice(-6).toUpperCase()}`,
    },
    select: { id: true, s3Key: true, filename: true, mimeType: true, createdAt: true },
  })

  await prisma.order.update({ where: { id: orderId }, data: { briefVideoFileId: created.id } })

  return NextResponse.json({ uploadUrl: url, expiresAt, file: created })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: orderId } = await params
  const dbUser = await getSessionDbUser(user)
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientId: true, specialistId: true, briefVideoFile: { select: { id: true, s3Key: true, filename: true, mimeType: true, createdAt: true } } },
  })
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allowed =
    user.role === "ADMIN" ||
    (user.role === "CLIENT" && order.clientId === dbUser.id) ||
    (user.role === "SPECIALIST" && order.specialistId === dbUser.id)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json({ file: order.briefVideoFile ?? null })
}

