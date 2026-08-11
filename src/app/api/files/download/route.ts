import {NextRequest, NextResponse} from "next/server"
import {getSessionUser} from "@/lib/session"
import {getDownloadUrl} from "@/lib/s3"
import {canAccessS3Key} from "@/lib/file-download-auth"

// GET /api/files/download?key=<s3Key>
// Returns a redirect to a presigned S3 URL.
export async function GET(req: NextRequest) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({error: "Unauthorized"}, {status: 401})

    const key = req.nextUrl.searchParams.get("key")?.trim() ?? ""
    if (!key) return NextResponse.json({error: "Missing key"}, {status: 400})
    if (key.length > 1024) return NextResponse.json({error: "Invalid key"}, {status: 400})

    // Authorize: the key must resolve to a record the user owns or is a party to.
    // Without this, any logged-in user could download any other user's files (IDOR).
    if (!(await canAccessS3Key(key, user))) {
        return NextResponse.json({error: "Not found"}, {status: 404})
    }

    try {
        const {url} = await getDownloadUrl(key)
        return NextResponse.redirect(url)
    } catch {
        return NextResponse.json({error: "Failed to resolve download URL"}, {status: 404})
    }
}
