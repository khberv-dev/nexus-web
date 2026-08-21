import {DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import type {StageType} from "@prisma/client";
import {Readable} from "stream";
import {
    buildLocalSignedUrl,
    localDeleteObject,
    localGetObjectBuffer,
    localGetObjectStream,
    localPutObject,
} from "./storage-local";

/** STORAGE_DRIVER=local переключает все функции ниже на диск (папка `uploads/`) вместо S3. */
export function isLocalStorageDriver(): boolean {
    return (process.env.STORAGE_DRIVER ?? "").trim().toLowerCase() === "local";
}

const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true, // cloud.ru S3-compatible requires path-style for server-side uploads
    // SDK v3 ≥ 3.654 добавляет CRC32 по умолчанию — браузер не может его отправить
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
});

const BUCKET = process.env.S3_BUCKET!;
const TTL = 15 * 60; // 15 minutes

// If S3_PUBLIC_ENDPOINT differs from S3_ENDPOINT, presigned download URLs
// must use the public host so browsers can reach them.
const S3_INTERNAL = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "")
const S3_PUBLIC = (process.env.S3_PUBLIC_ENDPOINT ?? S3_INTERNAL).replace(/\/$/, "")

function toPublicUrl(url: string): string {
    if (S3_PUBLIC === S3_INTERNAL || !S3_INTERNAL) return url
    return url.replace(S3_INTERNAL, S3_PUBLIC)
}

const ALLOWED_TYPES = new Set(["pdf", "dwg", "dxf", "jpg", "jpeg", "png", "zip", "rar", "mp4", "webm", "mov"]);
/**
 * Растровые форматы, которые браузер покажет как есть: для лендинга и портфолио формат
 * не ограничиваем — дизайнер грузит то, что отдала камера или редактор.
 * SVG намеренно не включён: это исполняемый документ, а не картинка.
 */
const IMAGE_TYPES = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "heic", "heif", "tif", "tiff"]);
/** Дополнительные типы только для этапа «Спецификация». */
const SPECIFICATION_EXTRA_TYPES = new Set(["xlsx", "xls", "doc", "docx"]);
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

export type ValidateFileOptions = {
    stageType?: StageType;
    /** Разрешить любой растровый формат (загрузки картинок лендинга и портфолио). */
    allowAnyImage?: boolean;
};

export function buildS3Key(orderId: string, stageType: StageType, version: number, filename: string): string {
    return `orders/${orderId}/stages/${stageType}/${version}/${filename}`;
}

export function validateFile(filename: string, size?: number, options?: ValidateFileOptions): void {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const allowed =
        ALLOWED_TYPES.has(ext) ||
        (options?.allowAnyImage && IMAGE_TYPES.has(ext)) ||
        (options?.stageType === "SPECIFICATION" && SPECIFICATION_EXTRA_TYPES.has(ext));
    if (!allowed) throw new Error(`File type .${ext} not allowed`);
    if (size !== undefined && size > MAX_SIZE) throw new Error("File exceeds 500 MB limit");
}

export async function getUploadUrl(key: string): Promise<{ url: string; expiresAt: Date }> {
    if (isLocalStorageDriver()) return buildLocalSignedUrl("put", key);
    const url = await getSignedUrl(s3, new PutObjectCommand({Bucket: BUCKET, Key: key}), {expiresIn: TTL});
    return {url: toPublicUrl(url), expiresAt: new Date(Date.now() + TTL * 1000)};
}

export async function putObject(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType?: string
): Promise<void> {
    if (isLocalStorageDriver()) return localPutObject(key, body);
    try {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
        }));
    } catch (err) {
        console.error("[s3] Upload failed for key:", key, err);
        throw new Error("Ошибка загрузки файла в хранилище");
    }
}

// Alias for backward compatibility
export const uploadToS3 = putObject;

export async function getDownloadUrl(key: string): Promise<{ url: string; expiresAt: Date }> {
    if (isLocalStorageDriver()) return buildLocalSignedUrl("get", key);
    const url = await getSignedUrl(s3, new GetObjectCommand({Bucket: BUCKET, Key: key}), {expiresIn: TTL});
    return {url: toPublicUrl(url), expiresAt: new Date(Date.now() + TTL * 1000)};
}

export function isS3Configured(): boolean {
    return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

/** true, если хоть один backend (S3 или локальный диск) настроен и готов принимать файлы. */
export function isStorageConfigured(): boolean {
    return isLocalStorageDriver() || isS3Configured();
}

export async function deleteObject(key: string): Promise<void> {
    if (isLocalStorageDriver()) return localDeleteObject(key);
    await s3.send(new DeleteObjectCommand({Bucket: BUCKET, Key: key}));
}

/** Скачивание объекта с сервера (для API, где нужна сессия, а не presigned URL в браузере). */
export async function getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType?: string }> {
    if (isLocalStorageDriver()) {
        const buffer = await localGetObjectBuffer(key);
        return {buffer};
    }
    const out = await s3.send(new GetObjectCommand({Bucket: BUCKET, Key: key}));
    if (!out.Body) throw new Error("Empty S3 body");
    const buffer = Buffer.from(await out.Body.transformToByteArray());
    return {buffer, contentType: out.ContentType ?? undefined};
}

/** Поток объекта (для проксирования больших медиа без буферизации в память). */
export async function getObjectStream(key: string): Promise<{
    // Тип ReadableStream отличается между DOM и node:stream/web, а Next.js ожидает web stream.
    // Здесь гарантируем "web-like" stream и приводим тип к DOM ReadableStream для typecheck.
    stream: ReadableStream<Uint8Array>
    contentType?: string
    contentLength?: number
}> {
    if (isLocalStorageDriver()) {
        const {stream, contentLength} = await localGetObjectStream(key);
        return {stream, contentLength};
    }

    const out = await s3.send(new GetObjectCommand({Bucket: BUCKET, Key: key}))
    if (!out.Body) throw new Error("Empty S3 body")

    // AWS SDK v3 in Node returns a Readable (stream) as Body.
    // NextResponse expects a Web ReadableStream.
    const bodyAny = out.Body as unknown as { transformToWebStream?: () => unknown }
    const rawStream =
        typeof bodyAny.transformToWebStream === "function"
            ? bodyAny.transformToWebStream()
            : Readable.toWeb(out.Body as unknown as Readable)
    const stream = rawStream as unknown as ReadableStream<Uint8Array>

    return {
        stream,
        contentType: out.ContentType ?? undefined,
        contentLength: typeof out.ContentLength === "number" ? out.ContentLength : undefined,
    }
}
