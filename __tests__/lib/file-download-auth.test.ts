/**
 * SEC1 — canAccessS3Key closes the /api/files/download IDOR.
 * A key must resolve to a record the user owns or is a party to; ADMIN sees all.
 */
jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    userFile: { findFirst: jest.fn() },
    stageFile: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    contract: { findFirst: jest.fn() },
  },
}));

import { canAccessS3Key } from "@/lib/file-download-auth";
import { prisma } from "@/lib/db/prisma";

const mp = prisma as jest.Mocked<typeof prisma>;
const CLIENT = { id: "c1", email: "c@t", name: null, role: "CLIENT" };
const SPEC = { id: "s1", email: "s@t", name: null, role: "SPECIALIST" };
const ADMIN = { id: "a1", email: "a@t", name: null, role: "ADMIN" };
const OUTSIDER = { id: "x9", email: "x@t", name: null, role: "CLIENT" };

describe("canAccessS3Key (SEC1 IDOR guard)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mp.userFile.findFirst as jest.Mock).mockResolvedValue(null);
    (mp.stageFile.findFirst as jest.Mock).mockResolvedValue(null);
    (mp.invoice.findFirst as jest.Mock).mockResolvedValue(null);
    (mp.contract.findFirst as jest.Mock).mockResolvedValue(null);
  });

  test("ADMIN can access any key without a lookup", async () => {
    expect(await canAccessS3Key("anything", ADMIN)).toBe(true);
    expect(mp.userFile.findFirst).not.toHaveBeenCalled();
  });

  test("owner of a UserFile → allowed", async () => {
    (mp.userFile.findFirst as jest.Mock).mockResolvedValue({ userId: "c1", briefVideoForOrder: null, briefAttachments: [] });
    expect(await canAccessS3Key("users/c1/x", CLIENT)).toBe(true);
  });

  test("non-owner UserFile not shared via an order → DENIED (IDOR blocked)", async () => {
    (mp.userFile.findFirst as jest.Mock).mockResolvedValue({ userId: "someone", briefVideoForOrder: null, briefAttachments: [] });
    expect(await canAccessS3Key("users/someone/x", CLIENT)).toBe(false);
  });

  test("specialist on the order can access the client's brief attachment → allowed", async () => {
    (mp.userFile.findFirst as jest.Mock).mockResolvedValue({
      userId: "c1",
      briefVideoForOrder: null,
      briefAttachments: [{ order: { clientId: "c1", specialistId: "s1" } }],
    });
    expect(await canAccessS3Key("users/c1/brief", SPEC)).toBe(true);
  });

  test("StageFile: order party allowed, outsider denied", async () => {
    (mp.stageFile.findFirst as jest.Mock).mockResolvedValue({ stage: { order: { clientId: "c1", specialistId: "s1" } } });
    expect(await canAccessS3Key("orders/o/stage", CLIENT)).toBe(true);
    expect(await canAccessS3Key("orders/o/stage", OUTSIDER)).toBe(false);
  });

  test("Invoice: order client allowed", async () => {
    (mp.invoice.findFirst as jest.Mock).mockResolvedValue({ order: { clientId: "c1", specialistId: "s1" } });
    expect(await canAccessS3Key("inv/x", CLIENT)).toBe(true);
    expect(await canAccessS3Key("inv/x", OUTSIDER)).toBe(false);
  });

  test("Contract (signed copy) : order party allowed", async () => {
    (mp.contract.findFirst as jest.Mock).mockResolvedValue({ order: { clientId: "c1", specialistId: "s1" } });
    expect(await canAccessS3Key("contract/signed", SPEC)).toBe(true);
  });

  test("unknown key (matches no record) → DENIED", async () => {
    expect(await canAccessS3Key("nonexistent/key", CLIENT)).toBe(false);
  });
});
