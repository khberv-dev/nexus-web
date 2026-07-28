/**
 * SEC5 — /api/files POST sanitizes the client filename before building the S3 key,
 * so a "../.." filename can't create path segments outside the user's prefix.
 */
import { NextRequest } from "next/server";
import { makeReq } from "../helpers/api";

jest.mock("@/lib/session", () => ({ getSessionUser: jest.fn(), getOrCreateDbUser: jest.fn() }));
jest.mock("@/lib/db/prisma", () => ({
  prisma: { userFile: { count: jest.fn(), create: jest.fn() } },
}));
jest.mock("@/lib/s3", () => ({ getUploadUrl: jest.fn(), validateFile: jest.fn() }));

import { getSessionUser, getOrCreateDbUser } from "@/lib/session";
import { prisma } from "@/lib/db/prisma";
import { getUploadUrl } from "@/lib/s3";

const mockGetSessionUser = getSessionUser as jest.Mock;
const mockGetOrCreate = getOrCreateDbUser as jest.Mock;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetUploadUrl = getUploadUrl as jest.Mock;

describe("SEC5 — file upload key sanitization", () => {
  let POST: (req: NextRequest) => Promise<Response>;
  beforeAll(async () => { ({ POST } = await import("@/app/api/files/route")); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUser.mockResolvedValue({ id: "u1", email: "u@t", name: null, role: "SPECIALIST" });
    mockGetOrCreate.mockResolvedValue({ id: "db-1" });
    (mockPrisma.userFile.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.userFile.create as jest.Mock).mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: "f1", ...(data as object) }));
    mockGetUploadUrl.mockResolvedValue({ url: "https://s3/upload", expiresAt: 123 });
  });

  test("malicious '../../' filename → S3 key has no extra path segments", async () => {
    const res = await POST(makeReq("/api/files", "POST", {
      filename: "../../../etc/passwd",
      category: "PORTFOLIO",
      size: 100,
      mimeType: "image/png",
    }));
    expect(res.status).toBe(200);
    const keyArg: string = mockGetUploadUrl.mock.calls[0][0];
    // users/<id>/<cat>/<uuid>/<safeName> = exactly 5 slash-separated segments.
    // A "/" in the filename would create MORE segments — sanitization prevents that.
    expect(keyArg.split("/")).toHaveLength(5);
    expect(keyArg.startsWith("users/db-1/portfolio/")).toBe(true);
    expect(keyArg).not.toContain("/etc/");
  });

  test("stored s3Key matches the sanitized upload key (no raw filename slashes)", async () => {
    await POST(makeReq("/api/files", "POST", { filename: "a/b/c.png", category: "PORTFOLIO", size: 10 }));
    const created = (mockPrisma.userFile.create as jest.Mock).mock.calls[0][0].data;
    expect(created.s3Key.split("/")).toHaveLength(5);
    // original filename is still preserved on the record for display
    expect(created.filename).toBe("a/b/c.png");
  });

  test("missing filename → 400", async () => {
    const res = await POST(makeReq("/api/files", "POST", { category: "PORTFOLIO" }));
    expect(res.status).toBe(400);
  });
});
