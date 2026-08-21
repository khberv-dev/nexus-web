/**
 * Раздача файлов статикой: GET /uploads/<ключ> без токена.
 */

import {NextRequest} from "next/server";
import {mkdtempSync, mkdirSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";

const ROOT = mkdtempSync(path.join(tmpdir(), "uploads-test-"));
const KEY = "users/u1/portfolio/abc/office.jpeg";

beforeAll(() => {
    process.env.STORAGE_DRIVER = "local";
    process.env.STORAGE_LOCAL_ROOT = ROOT;
    mkdirSync(path.join(ROOT, path.dirname(KEY)), {recursive: true});
    writeFileSync(path.join(ROOT, KEY), Buffer.from("jpeg-bytes"));
});

function req(url: string) {
    return new NextRequest(`http://localhost${url}`);
}

async function callGet(segments: string[]) {
    const {GET} = await import("@/app/uploads/[...path]/route");
    return GET(req(`/uploads/${segments.join("/")}`), {params: Promise.resolve({path: segments})});
}

describe("GET /uploads/[...path]", () => {
    test("отдаёт файл без токена", async () => {
        const res = await callGet(KEY.split("/"));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/jpeg");
        expect(await res.text()).toBe("jpeg-bytes");
    });

    test("несуществующий файл — 404, а не 500", async () => {
        const res = await callGet(["users", "u1", "portfolio", "nope", "missing.jpeg"]);
        expect(res.status).toBe(404);
    });

    test("выход за пределы каталога невозможен", async () => {
        const res = await callGet(["..", "..", "etc", "passwd"]);
        expect(res.status).toBe(404);
    });

    test("ссылка кэшируется надолго — ключ содержит uuid и не переиспользуется", async () => {
        const res = await callGet(KEY.split("/"));
        expect(res.headers.get("cache-control")).toContain("immutable");
    });
});

describe("buildLocalPublicUrl", () => {
    test("строит /uploads/<ключ> без подписи", async () => {
        process.env.NEXTAUTH_URL = "https://nexus-demo.pointer.uz";
        const {buildLocalPublicUrl} = await import("@/lib/storage-local");
        const {url} = buildLocalPublicUrl(KEY);

        expect(url).toBe(`https://nexus-demo.pointer.uz/uploads/${KEY}`);
        expect(url).not.toContain("token=");
    });

    test("пробелы и кириллица в имени файла экранируются", async () => {
        const {buildLocalPublicUrl} = await import("@/lib/storage-local");
        const {url} = buildLocalPublicUrl("users/u1/portfolio/abc/мой файл.jpg");

        expect(url).toContain("/uploads/users/u1/portfolio/abc/");
        expect(url).not.toContain(" ");
    });
});
