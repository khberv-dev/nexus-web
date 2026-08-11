import {NextRequest, NextResponse} from "next/server"
import path from "path"
import {FileAudience} from "@prisma/client"
import {prisma} from "@/lib/db/prisma"
import {getObjectBuffer, getObjectStream} from "@/lib/s3"
import {getSessionUser} from "@/lib/session"
import {isStageFileVisibleToClient} from "@/lib/client-stage-file-visibility"

export async function GET(_req: NextRequest, {params}: { params: Promise<{ id: string; fid: string }> }) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const {fid, id: stageIdParam} = await params

    const file = await prisma.stageFile.findUnique({
        where: {id: fid},
        include: {stage: {include: {order: true, files: true, reviews: true}}},
    })
    // Сегмент [id] — для маршрутизации; источник правды — файл и его заказ. Иначе при устаревшем stageId в UI получали 404 при валидном fileId.
    if (!file) {
        console.warn("[stage-file-download] StageFile not found", {fid, stageIdParam, role: user.role, userId: user.id})
        return NextResponse.json({error: "Not found", fid, stageId: stageIdParam}, {status: 404})
    }

    const {order} = file.stage
    if (user.role === "CLIENT" && order.clientId !== user.id)
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    if (user.role === "CLIENT" && file.audience === FileAudience.DESIGNER)
        return NextResponse.json({error: "Forbidden"}, {status: 403})
    if (
        user.role === "CLIENT" &&
        !isStageFileVisibleToClient(
            {status: file.stage.status, files: file.stage.files, reviews: file.stage.reviews},
            fid,
        )
    ) {
        return NextResponse.json(
            {error: "Материалы будут доступны после проверки администратором"},
            {status: 403},
        )
    }
    if (user.role === "SPECIALIST" && order.specialistId !== user.id)
        return NextResponse.json({error: "Forbidden"}, {status: 403})

    const ext = path.extname(file.filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
        ".pdf": "application/pdf",
        ".dwg": "application/octet-stream",
        ".dxf": "application/octet-stream",
        ".zip": "application/zip",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
    }
    const fallbackMime = mimeTypes[ext] ?? "application/octet-stream"
    const isInlineType = fallbackMime.startsWith("image/") || fallbackMime.startsWith("video/")

    // Fast path for large media: after auth checks, stream from storage (same-origin) to avoid
    // buffering big images/videos in memory and avoid CORS issues on redirects.
    // Works for both backends — getObjectStream picks S3 or local disk internally.
    if (isInlineType) {
        try {
            const {stream, contentType, contentLength} = await getObjectStream(file.s3Key)
            const safeName = encodeURIComponent(file.filename)
            return new NextResponse(stream, {
                headers: {
                    "Content-Type": contentType ?? fallbackMime,
                    "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
                    ...(contentLength ? {"Content-Length": String(contentLength)} : {}),
                },
            })
        } catch {
            // fallback to buffered response below
        }
    }

    let buffer: Buffer
    let contentType = fallbackMime
    try {
        const fromStorage = await getObjectBuffer(file.s3Key)
        buffer = fromStorage.buffer
        if (fromStorage.contentType) contentType = fromStorage.contentType
    } catch {
        return NextResponse.json({error: "File not found"}, {status: 404})
    }

    const safeName = encodeURIComponent(file.filename)
    const inlinePreview = contentType.startsWith("image/") || contentType.startsWith("video/")

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            "Content-Type": contentType,
            "Content-Disposition": inlinePreview
                ? `inline; filename*=UTF-8''${safeName}`
                : `attachment; filename*=UTF-8''${safeName}`,
            "Content-Length": String(buffer.length),
        },
    })
}
