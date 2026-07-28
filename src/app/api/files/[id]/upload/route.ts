import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, getOrCreateDbUser } from "@/lib/session"
import { prisma } from "@/lib/db/prisma"
import { putObject } from "@/lib/s3"
import { validateImageBuffer } from "@/lib/image-validation"

// PUT /api/files/[id]/upload — server-side upload to S3 (no browser CORS dependency)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const dbUser = await getOrCreateDbUser(user)
  const file = await prisma.userFile.findUnique({ where: { id } })
  if (!file || file.userId !== dbUser.id) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = Buffer.from(await req.arrayBuffer())
  if (!body.length) return NextResponse.json({ error: "Empty file body" }, { status: 400 })

  if (file.mimeType?.startsWith("image/")) {
    try {
      await validateImageBuffer(body, file.category)
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }
  }

  const contentType = req.headers.get("content-type") ?? file.mimeType ?? "application/octet-stream"
  await putObject(file.s3Key, body, contentType)

  return NextResponse.json({ ok: true })
}
