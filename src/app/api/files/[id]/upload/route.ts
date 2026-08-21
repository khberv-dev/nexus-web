import {NextRequest, NextResponse} from "next/server"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {putObject} from "@/lib/s3"

// POST /api/files/[id]/upload — server-side upload to S3 (no browser CORS dependency)
export async function POST(req: NextRequest, {params}: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {id} = await params
    const dbUser = await getOrCreateDbUser(user)
    const file = await prisma.userFile.findUnique({where: {id}})
    if (!file || file.userId !== dbUser.id) return NextResponse.json({error: "Not found"}, {status: 404})

    const body = Buffer.from(await req.arrayBuffer())
    if (!body.length) return NextResponse.json({error: "Empty file body"}, {status: 400})

    // Требований к разрешению и ориентации у картинок нет: дизайнер грузит то, что есть,
    // кадрирование делает CSS и выбор позиции кадра.

    const contentType = req.headers.get("content-type") ?? file.mimeType ?? "application/octet-stream"
    await putObject(file.s3Key, body, contentType)

    return NextResponse.json({ok: true})
}

/** Старый метод: клиенты грузили файлы через PUT. Оставлен, чтобы уже открытые вкладки
 *  со старым бандлом не падали на 405. */
export const PUT = POST
