import {NextRequest, NextResponse} from "next/server"
import {isLocalStorageDriver} from "@/lib/s3"
import {guessMimeType, localGetObjectStream} from "@/lib/storage-local"

export const dynamic = "force-dynamic"

/**
 * Раздача файлов из uploads/ как статики: /uploads/<ключ>.
 *
 * Подписи и срока жизни нет — доступ есть у любого, кто знает путь. Тот же URL можно
 * закрыть на уровне веб-сервера, отдав каталог напрямую и не доходя до приложения:
 *   location /uploads/ { alias /var/lib/nexus/uploads/; }
 */
export async function GET(_req: NextRequest, {params}: { params: Promise<{ path: string[] }> }) {
    if (!isLocalStorageDriver()) {
        return NextResponse.json({error: "Not found"}, {status: 404})
    }

    const {path} = await params
    const key = (path ?? []).map(decodeURIComponent).join("/")
    if (!key) return NextResponse.json({error: "Not found"}, {status: 404})

    try {
        const {stream, contentLength} = await localGetObjectStream(key)
        return new NextResponse(stream, {
            headers: {
                "Content-Type": guessMimeType(key),
                ...(contentLength ? {"Content-Length": String(contentLength)} : {}),
                // Ключ содержит уникальный uuid, поэтому содержимое по пути не меняется.
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    } catch {
        return NextResponse.json({error: "Not found"}, {status: 404})
    }
}
