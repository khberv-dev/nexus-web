import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"

// POST /api/files/[id]/set-avatar — сделать фото из портфолио аватаром
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await getOrCreateDbUser(user)
  const { id } = await params

  const file = await prisma.userFile.findUnique({ where: { id } })
  if (!file || file.userId !== dbUser.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Удаляем старые аватары
  await prisma.userFile.deleteMany({ where: { userId: dbUser.id, category: "AVATAR" } })

  // Создаем новую запись аватара, ссылающуюся на тот же s3Key
  const avatar = await prisma.userFile.create({
    data: {
      userId: dbUser.id,
      category: "AVATAR",
      s3Key: file.s3Key,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      title: file.title,
    },
  })

  return NextResponse.json(avatar)
}
