import {NextRequest, NextResponse} from "next/server";
import {guessMimeType, localGetObjectStream, verifyStorageToken} from "@/lib/storage-local";

/** Локальный эквивалент presigned GET URL у S3 — авторизация через подписанный токен, без сессии. */
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get("token");
    const verified = token ? verifyStorageToken(token) : null;
    if (!verified) return NextResponse.json({error: "Invalid or expired download URL"}, {status: 403});

    try {
        const {stream, contentLength} = await localGetObjectStream(verified.key);
        return new NextResponse(stream, {
            headers: {
                "Content-Type": guessMimeType(verified.key),
                ...(contentLength ? {"Content-Length": String(contentLength)} : {}),
            },
        });
    } catch {
        return NextResponse.json({error: "Not found"}, {status: 404});
    }
}
