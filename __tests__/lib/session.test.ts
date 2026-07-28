/**
 * EXTRA3 — getServerSessionWithDevBypass re-checks the DB so archived accounts and
 * admin-revoked sessions (sessionVersion bump) lose access immediately.
 */
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth/config", () => ({ authConfig: {} }));
jest.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: jest.fn() } } }));
jest.mock("@/lib/dev-auth", () => ({ isDevAuthBypass: jest.fn(() => false), resolveDevMockDbUser: jest.fn() }));

import { getServerSessionWithDevBypass } from "@/lib/session";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db/prisma";

const mockGetServerSession = getServerSession as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;

describe("EXTRA3 — getServerSessionWithDevBypass enforces archival + revocation", () => {
  beforeEach(() => jest.clearAllMocks());

  test("active user with matching sessionVersion → returns session", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", sessionVersion: 3 } });
    mockFindUnique.mockResolvedValue({ archivedAt: null, sessionVersion: 3 });
    const s = await getServerSessionWithDevBypass();
    expect(s).not.toBeNull();
    expect(s!.user!.id).toBe("u1");
  });

  test("archived account → null (access revoked)", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", sessionVersion: 3 } });
    mockFindUnique.mockResolvedValue({ archivedAt: new Date(), sessionVersion: 3 });
    expect(await getServerSessionWithDevBypass()).toBeNull();
  });

  test("sessionVersion mismatch (admin revoked session) → null", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", sessionVersion: 2 } });
    mockFindUnique.mockResolvedValue({ archivedAt: null, sessionVersion: 5 });
    expect(await getServerSessionWithDevBypass()).toBeNull();
  });

  test("no session → null without a DB lookup", async () => {
    mockGetServerSession.mockResolvedValue(null);
    expect(await getServerSessionWithDevBypass()).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
