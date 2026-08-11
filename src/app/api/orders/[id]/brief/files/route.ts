import {NextRequest, NextResponse} from "next/server"
import {prisma} from "@/lib/db/prisma"
import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {deleteObject, uploadToS3, validateFile} from "@/lib/s3"

type BriefFileDTO = {
    id: string
    s3Key: string
    filename: string
    mimeType: string | null
    size: number | null
    createdAt: string
}

function asBriefFileDTO(file: {
    id: string
    s3Key: string
    filename: string
    mimeType: string | null
    size: number | null
    createdAt: Date
}): BriefFileDTO {
    return {
        id: file.id,
        s3Key: file.s3Key,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt.toISOString(),
    }
}

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {id: orderId} = await params
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const order = await prisma.order.findUnique({
        where: {id: orderId},
        select: {clientId: true, specialistId: true},
    })
    if (!order) return NextResponse.json({error: "Not found"}, {status: 404})

    const allowed =
        user.role === "ADMIN" ||
        (user.role === "CLIENT" && order.clientId === dbUser.id) ||
        (user.role === "SPECIALIST" && order.specialistId === dbUser.id)
    if (!allowed) return NextResponse.json({error: "Forbidden"}, {status: 403})

    // Do not rely on generated Prisma delegate for OrderBriefAttachment (may be stale in runtime).
    const rows = await prisma.$queryRaw<Array<{
        id: string
        s3Key: string
        filename: string
        mimeType: string | null
        size: number | null
        createdAt: Date
    }>>`
    SELECT uf."id", uf."s3Key", uf."filename", uf."mimeType", uf."size", uf."createdAt"
    FROM "OrderBriefAttachment" oba
    JOIN "UserFile" uf ON uf."id" = oba."fileId"
    WHERE oba."orderId" = ${orderId}
    ORDER BY oba."createdAt" DESC
  `

    const files = rows.map(asBriefFileDTO)

    return NextResponse.json({files})
}

export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: orderId} = await params
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const order = await prisma.order.findUnique({
        where: {id: orderId},
        select: {id: true, clientId: true, status: true, deletedAt: true},
    })
    if (!order || order.deletedAt || order.clientId !== dbUser.id) return NextResponse.json({error: "Not found"}, {status: 404})
    if (order.status !== "DRAFT") return NextResponse.json({error: "Brief is locked"}, {status: 409})

    const ct = (req.headers.get("content-type") ?? "").toLowerCase()
    if (!ct.includes("multipart/form-data")) {
        return NextResponse.json({error: "multipart/form-data required"}, {status: 400})
    }

    const fd = await req.formData()
    const filesRaw = fd.getAll("files").filter((x): x is File => x instanceof File)
    if (filesRaw.length === 0) return NextResponse.json({error: "files[] is required"}, {status: 400})
    if (filesRaw.length > 30) return NextResponse.json({error: "Too many files (max 30 per upload)"}, {status: 400})

    const created = await prisma.$transaction(async (tx) => {
        const out: Array<{
            id: string;
            s3Key: string;
            filename: string;
            mimeType: string | null;
            size: number | null;
            createdAt: Date
        }> = []

        for (const file of filesRaw) {
            try {
                validateFile(file.name, file.size)
            } catch (e) {
                throw new Error((e as Error).message)
            }

            const fileId = crypto.randomUUID()
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
            const s3Key = `orders/${orderId}/brief/files/${fileId}/${safeName}`
            const buffer = Buffer.from(await file.arrayBuffer())

            await uploadToS3(s3Key, buffer, file.type || "application/octet-stream")

            const createdFile = await tx.userFile.create({
                data: {
                    userId: dbUser.id,
                    // NOTE: Prisma Client in some runtimes may be stale and not include the new enum value yet.
                    // We keep brief attachments linked via OrderBriefAttachment, so category isn't required for correctness.
                    category: "DOCUMENT",
                    s3Key,
                    filename: file.name,
                    mimeType: file.type || null,
                    size: file.size,
                    title: "Документ к брифу",
                    description: `Заказ #${orderId.slice(-6).toUpperCase()}`,
                },
                select: {id: true, s3Key: true, filename: true, mimeType: true, size: true, createdAt: true},
            })

            // Do not rely on tx.orderBriefAttachment (delegate may not exist in stale prisma client).
            await tx.$executeRaw`
        INSERT INTO "OrderBriefAttachment" ("id", "orderId", "fileId")
        VALUES (${crypto.randomUUID()}, ${orderId}, ${createdFile.id})
        ON CONFLICT ("orderId", "fileId") DO NOTHING
      `

            out.push(createdFile)
        }

        return out
    }).catch((e) => {
        return Promise.reject(e instanceof Error ? e : new Error("Failed to upload files"))
    })

    return NextResponse.json({files: created.map(asBriefFileDTO)})
}

export async function DELETE(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})
    if (user.role !== "CLIENT") return NextResponse.json({error: "Forbidden"}, {status: 403})

    const {id: orderId} = await params
    const dbUser = await getSessionDbUser(user)
    if (!dbUser) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const fileId = req.nextUrl.searchParams.get("fileId")?.trim() ?? ""
    if (!fileId) return NextResponse.json({error: "fileId required"}, {status: 400})

    const order = await prisma.order.findUnique({
        where: {id: orderId},
        select: {id: true, clientId: true, status: true, deletedAt: true},
    })
    if (!order || order.deletedAt || order.clientId !== dbUser.id) return NextResponse.json({error: "Not found"}, {status: 404})
    if (order.status !== "DRAFT") return NextResponse.json({error: "Brief is locked"}, {status: 409})

    const rows = await prisma.$queryRaw<Array<{ fileId: string; userId: string; s3Key: string }>>`
    SELECT uf."id" as "fileId", uf."userId", uf."s3Key"
    FROM "OrderBriefAttachment" oba
    JOIN "UserFile" uf ON uf."id" = oba."fileId"
    WHERE oba."orderId" = ${orderId} AND oba."fileId" = ${fileId}
    LIMIT 1
  `
    const row = rows[0] ?? null
    if (!row) return NextResponse.json({error: "Not found"}, {status: 404})
    if (row.userId !== dbUser.id) return NextResponse.json({error: "Forbidden"}, {status: 403})

    await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
      DELETE FROM "OrderBriefAttachment"
      WHERE "orderId" = ${orderId} AND "fileId" = ${fileId}
    `
        await tx.userFile.delete({where: {id: fileId}})
    })

    try {
        await deleteObject(row.s3Key)
    } catch {
        // ignore: db is source of truth; object may already be deleted
    }

    return NextResponse.json({ok: true})
}

