import { NextRequest, NextResponse } from "next/server";
import { localPutObject, verifyStorageToken } from "@/lib/storage-local";

/** Локальный эквивалент presigned PUT URL у S3 — авторизация через подписанный токен, без сессии. */
export async function PUT(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const verified = token ? verifyStorageToken(token) : null;
  if (!verified) return NextResponse.json({ error: "Invalid or expired upload URL" }, { status: 403 });

  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length) return NextResponse.json({ error: "Empty file body" }, { status: 400 });

  await localPutObject(verified.key, body);
  return NextResponse.json({ ok: true });
}
