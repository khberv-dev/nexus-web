import {NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {getDownloadUrl} from "@/lib/s3"

function shouldRedirectToFile(req: Request): boolean {
    // For normal browser navigation we want a direct download/open (redirect).
    // For programmatic calls (fetch/XHR) we keep JSON contract.
    const mode = req.headers.get("sec-fetch-mode") ?? ""
    if (mode === "navigate") return true
    const accept = req.headers.get("accept") ?? ""
    if (accept.includes("text/html")) return true
    return false
}

export async function GET(req: Request, {params}: { params: Promise<{ id: string }> }) {
    const {id} = await params
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const contract = await prisma.contract.findUnique({
        where: {id},
        include: {order: {select: {specialistId: true, clientId: true}}},
    })
    if (!contract) return NextResponse.json({error: "Не найден"}, {status: 404})

    const isOwner = user.role === "ADMIN" || contract.order.specialistId === user.id || contract.order.clientId === user.id
    if (!isOwner) return NextResponse.json({error: "Нет доступа"}, {status: 403})
    if (!contract.s3Key) return NextResponse.json({error: "Файл не загружен"}, {status: 404})

    const {url} = await getDownloadUrl(contract.s3Key)
    if (shouldRedirectToFile(req)) {
        return NextResponse.redirect(url, {status: 302})
    }
    return NextResponse.json({url})
}
