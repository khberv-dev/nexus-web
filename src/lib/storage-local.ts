import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/** Файловое хранилище "на своём сервере" — используется вместо S3, когда STORAGE_DRIVER=local. */

const LOCAL_ROOT = path.join(process.cwd(), "uploads");
const SIGNING_SECRET = process.env.STORAGE_URL_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
const TTL_MS = 15 * 60 * 1000; // 15 минут — как presigned URL у S3

function resolveLocalPath(key: string): string {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (resolved !== LOCAL_ROOT && !resolved.startsWith(LOCAL_ROOT + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

function sign(payload: string): string {
  return createHmac("sha256", SIGNING_SECRET).update(payload).digest("base64url");
}

export function signStorageToken(key: string): { token: string; expiresAt: Date } {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${key}:${expiresAt}`;
  const token = `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(payload)}`;
  return { token, expiresAt: new Date(expiresAt) };
}

/** Проверяет подпись и срок годности токена из /api/storage/{put,get}. Возвращает ключ файла или null. */
export function verifyStorageToken(token: string): { key: string } | null {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const idx = payload.lastIndexOf(":");
  if (idx === -1) return null;
  const key = payload.slice(0, idx);
  const expiresAt = Number(payload.slice(idx + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  return { key };
}

export function buildLocalSignedUrl(kind: "put" | "get", key: string): { url: string; expiresAt: Date } {
  const { token, expiresAt } = signStorageToken(key);
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { url: `${base}/api/storage/${kind}?token=${encodeURIComponent(token)}`, expiresAt };
}

export async function localPutObject(key: string, body: Buffer | Uint8Array | string): Promise<void> {
  const filePath = resolveLocalPath(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

export async function localGetObjectBuffer(key: string): Promise<Buffer> {
  return readFile(resolveLocalPath(key));
}

export async function localGetObjectStream(
  key: string,
): Promise<{ stream: ReadableStream<Uint8Array>; contentLength?: number }> {
  const filePath = resolveLocalPath(key);
  const st = await stat(filePath);
  const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream<Uint8Array>;
  return { stream, contentLength: st.size };
}

export async function localDeleteObject(key: string): Promise<void> {
  try {
    await unlink(resolveLocalPath(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".dwg": "application/octet-stream",
  ".dxf": "application/octet-stream",
  ".zip": "application/zip",
  ".rar": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function guessMimeType(key: string): string {
  return MIME_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}
