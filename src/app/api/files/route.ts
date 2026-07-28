import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { getUploadUrl, validateFile } from "@/lib/s3"
import { FileCategory } from "@prisma/client"

const CATEGORY_LIMITS: Partial<Record<FileCategory, number>> = {
  PORTRAIT: 10,
  LANDING_WORK: 10,
  INTRO_VIDEO: 5,
}

// GET /api/files?category=PORTFOLIO
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)

  const category = req.nextUrl.searchParams.get("category") as FileCategory | null

  const files = await prisma.userFile.findMany({
    where: { userId: dbUser.id, ...(category ? { category } : {}) },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(files)
}

// POST /api/files — получить presigned URL для загрузки
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)

  const { filename, mimeType, size, category, title, description } = await req.json()

  if (!filename || !category) return NextResponse.json({ error: "filename and category required" }, { status: 400 })

  try { validateFile(filename, size) } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const limit = CATEGORY_LIMITS[category as FileCategory]
  if (limit) {
    const count = await prisma.userFile.count({ where: { userId: dbUser.id, category } })
    if (count >= limit) {
      return NextResponse.json({ error: `Максимум ${limit} файлов в этой категории` }, { status: 400 })
    }
  }

  const fileId = crypto.randomUUID()
  // Sanitize the client filename before putting it in the S3 key (strips '/' and
  // '..' etc.) — defense-in-depth, matching the stage upload presign route. The
  // original filename is still stored on the record for display.
  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_")
  const s3Key = `users/${dbUser.id}/${category.toLowerCase()}/${fileId}/${safeName}`

  const { url, expiresAt } = await getUploadUrl(s3Key)

  const file = await prisma.userFile.create({
    data: { userId: dbUser.id, category, s3Key, filename, mimeType, size, title, description },
  })

  return NextResponse.json({ uploadUrl: url, expiresAt, file })
}
