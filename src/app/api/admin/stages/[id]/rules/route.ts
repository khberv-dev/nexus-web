import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { getSessionUser } from "@/lib/session"
import { uploadToS3, getDownloadUrl } from "@/lib/s3"
import path from "path"
import { readFile } from "fs/promises"

/** POST — upload rules (PDF/DOCX); GET — download rules */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const stage = await prisma.projectStage.findUnique({ where: { id } })
  if (!stage) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const replacedS3Key = stage.rulesS3Key ?? null

  const useTemplate = req.nextUrl.searchParams.get("template") === "1"
  const templateIdRaw = req.nextUrl.searchParams.get("templateId")

  let buffer: Buffer
  let ext: "pdf" | "docx"
  let mime: string

  if (useTemplate) {
    const templateFilenameByType: Record<string, string> = {
      CONCEPT: "Правила разработки концепции.docx",
      PLANNING: "Правила_план. решение.docx",
      VISUALIZATION: "Правила_визуализация.docx",
      SPECIFICATION: "Правила_спецификация.docx",
      // DOCUMENTATION: (пока нет файла в списке)
    }
    const templateId = templateIdRaw ? String(templateIdRaw).toUpperCase() : null
    const fromParam = templateId ? templateFilenameByType[templateId] : null
    const fromStageType = templateFilenameByType[String(stage.type)]
    const filename = fromParam ?? fromStageType
    if (!filename) {
      return NextResponse.json({ error: `Нет шаблона для этапа ${stage.type}` }, { status: 400 })
    }
    const abs = path.join(process.cwd(), "uploads", "rules-templates", filename)
    try {
      buffer = await readFile(abs)
    } catch {
      return NextResponse.json(
        { error: "Шаблон не найден на сервере", hint: `Положите файл в uploads/rules-templates/${filename}` },
        { status: 404 },
      )
    }
    ext = "docx"
    mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  } else {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const name = file?.name?.toLowerCase() ?? ""
    const isPdf = name.endsWith(".pdf")
    const isDocx = name.endsWith(".docx")
    if (!file || (!isPdf && !isDocx)) return NextResponse.json({ error: "PDF or DOCX file required" }, { status: 400 })

    buffer = Buffer.from(await file.arrayBuffer())
    ext = isDocx ? "docx" : "pdf"
    mime = isDocx
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf"
  }

  const s3Key = `orders/${stage.orderId}/stages/${id}/rules-${Date.now()}.${ext}`
  await uploadToS3(s3Key, buffer, mime)

  await prisma.projectStage.update({ where: { id }, data: { rulesS3Key: s3Key } })
  return NextResponse.json({ ok: true, s3Key, replacedS3Key })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const stage = await prisma.projectStage.findUnique({ where: { id }, include: { order: true } })
  if (!stage?.rulesS3Key) return NextResponse.json({ error: "No rules" }, { status: 404 })

  const hasAccess = user.role === "ADMIN" || user.id === stage.order.specialistId
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { url } = await getDownloadUrl(stage.rulesS3Key)
  return NextResponse.redirect(url)
}
