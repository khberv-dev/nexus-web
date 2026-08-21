import {createHmac, timingSafeEqual} from "node:crypto";
import {createReadStream} from "node:fs";
import {mkdir, readFile, stat, unlink, writeFile} from "node:fs/promises";
import path from "node:path";
import {Readable} from "node:stream";

/** Файловое хранилище "на своём сервере" — используется вместо S3, когда STORAGE_DRIVER=local. */

const TTL_MS = 15 * 60 * 1000; // 15 минут — как presigned URL у S3

/**
 * Куда складывать файлы. По умолчанию `uploads/` рядом с приложением, но каталог внутри
 * деплоя переживает не всякий деплой: пересоздание контейнера или выкладка новой копии
 * стирает его, а строки UserFile в базе остаются, и ссылки начинают отдавать 404.
 * STORAGE_LOCAL_ROOT позволяет вынести хранилище наружу (например, /var/lib/nexus/uploads).
 */
function localRoot(): string {
    const configured = process.env.STORAGE_LOCAL_ROOT?.trim();
    return configured ? path.resolve(configured) : path.join(process.cwd(), "uploads");
}

/**
 * Ключ подписи ссылок. Важно: `??` не спасает от пустой строки — при STORAGE_URL_SECRET=""
 * подпись считалась HMAC с пустым ключом, то есть валидную ссылку на ЛЮБОЙ файл мог
 * собрать кто угодно. Пустое значение считаем незаданным и падаем, а не выдаём
 * подделываемые ссылки.
 */
function signingSecret(): string {
    const secret = process.env.STORAGE_URL_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim() || "";
    if (!secret) {
        throw new Error(
            "STORAGE_URL_SECRET (или NEXTAUTH_SECRET) не задан — подписывать ссылки на файлы нечем",
        );
    }
    return secret;
}

function resolveLocalPath(key: string): string {
    const root = localRoot();
    const resolved = path.resolve(root, key);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new Error("Invalid storage key");
    }
    return resolved;
}

function sign(payload: string): string {
    return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function signStorageToken(key: string): { token: string; expiresAt: Date } {
    const expiresAt = Date.now() + TTL_MS;
    const payload = `${key}:${expiresAt}`;
    const token = `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(payload)}`;
    return {token, expiresAt: new Date(expiresAt)};
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

    let expectedSig: string;
    try {
        expectedSig = sign(payload);
    } catch {
        // Нечем проверять подпись — считаем ссылку недействительной.
        return null;
    }
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const idx = payload.lastIndexOf(":");
    if (idx === -1) return null;
    const key = payload.slice(0, idx);
    const expiresAt = Number(payload.slice(idx + 1));
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

    return {key};
}

export function buildLocalSignedUrl(kind: "put" | "get", key: string): { url: string; expiresAt: Date } {
    const {token, expiresAt} = signStorageToken(key);
    const base = appBaseUrl();
    return {url: `${base}/api/storage/${kind}?token=${encodeURIComponent(token)}`, expiresAt};
}

function appBaseUrl(): string {
    return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Прямая ссылка на файл без подписи: /uploads/<ключ>.
 *
 * Файл отдаётся как статика — токена и срока жизни нет, значит доступ есть у любого,
 * кто знает или подберёт путь. Приватность держится только на случайном UUID внутри
 * ключа; ограничения StageFile.audience на этом уровне не действуют.
 *
 * Тот же путь потом можно отдать nginx-ом напрямую:
 *   location /uploads/ { alias /var/lib/nexus/uploads/; }
 */
export function buildLocalPublicUrl(key: string): { url: string; expiresAt: Date } {
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    return {
        url: `${appBaseUrl()}/uploads/${encoded}`,
        // Ссылка бессрочная; поле оставлено ради общей сигнатуры с S3-веткой.
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };
}

export async function localPutObject(key: string, body: Buffer | Uint8Array | string): Promise<void> {
    const filePath = resolveLocalPath(key);
    await mkdir(path.dirname(filePath), {recursive: true});
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
    return {stream, contentLength: st.size};
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
