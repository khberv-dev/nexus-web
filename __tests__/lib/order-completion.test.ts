/**
 * FUN6 — single canonical order-completion rule: all stages APPROVED.
 */
jest.mock("@/lib/db/prisma", () => ({ prisma: { projectStage: { count: jest.fn() } } }));

import { isOrderComplete } from "@/lib/order-completion";
import { prisma } from "@/lib/db/prisma";

const mockCount = prisma.projectStage.count as jest.Mock;

describe("isOrderComplete", () => {
  beforeEach(() => jest.clearAllMocks());

  test("true when zero stages are un-approved", async () => {
    mockCount.mockResolvedValue(0);
    expect(await isOrderComplete("ord-1")).toBe(true);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orderId: "ord-1", status: { not: "APPROVED" } }) }),
    );
  });

  test("false when at least one stage is not approved", async () => {
    mockCount.mockResolvedValue(3);
    expect(await isOrderComplete("ord-1")).toBe(false);
  });
});
