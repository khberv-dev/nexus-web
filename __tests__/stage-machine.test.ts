import { StageStatus, Role } from "@prisma/client";
import { canTransition, getNextStatus, getAllowedActions, TransitionError, ForbiddenError } from "../src/lib/stage-machine";

// Mock prisma so we can test pure functions without DB
jest.mock("../src/lib/db/prisma", () => ({ prisma: {} }));

describe("stage-machine pure functions", () => {
  describe("valid transitions", () => {
    test("SPECIALIST: PENDING → UPLOADED via upload", () => {
      expect(getNextStatus(StageStatus.PENDING, "upload", Role.SPECIALIST)).toBe(StageStatus.UPLOADED);
    });
    test("SPECIALIST: UPLOADED → MOD_REVIEW via submit", () => {
      expect(getNextStatus(StageStatus.UPLOADED, "submit", Role.SPECIALIST)).toBe(StageStatus.MOD_REVIEW);
    });
    test("ADMIN: MOD_REVIEW → CLIENT_REVIEW via modApprove", () => {
      expect(getNextStatus(StageStatus.MOD_REVIEW, "modApprove", Role.ADMIN)).toBe(StageStatus.CLIENT_REVIEW);
    });
    test("ADMIN: MOD_REVIEW → MOD_REVISION via modRevision", () => {
      expect(getNextStatus(StageStatus.MOD_REVIEW, "modRevision", Role.ADMIN)).toBe(StageStatus.MOD_REVISION);
    });
    test("SPECIALIST: MOD_REVISION → MOD_REVIEW via resubmitMod", () => {
      expect(getNextStatus(StageStatus.MOD_REVISION, "resubmitMod", Role.SPECIALIST)).toBe(StageStatus.MOD_REVIEW);
    });
    test("CLIENT: CLIENT_REVIEW → APPROVED via clientApprove", () => {
      expect(getNextStatus(StageStatus.CLIENT_REVIEW, "clientApprove", Role.CLIENT)).toBe(StageStatus.APPROVED);
    });
    test("CLIENT: CLIENT_REVIEW → CLIENT_REVISION when clientRound < MAX_FREE (0,1,2)", () => {
      expect(getNextStatus(StageStatus.CLIENT_REVIEW, "clientRevision", Role.CLIENT, 0)).toBe(StageStatus.CLIENT_REVISION);
      expect(getNextStatus(StageStatus.CLIENT_REVIEW, "clientRevision", Role.CLIENT, 1)).toBe(StageStatus.CLIENT_REVISION);
      expect(getNextStatus(StageStatus.CLIENT_REVIEW, "clientRevision", Role.CLIENT, 2)).toBe(StageStatus.CLIENT_REVISION);
    });
    test("CLIENT: CLIENT_REVIEW → EXTRA_PAYMENT when clientRound >= MAX_FREE (3)", () => {
      expect(getNextStatus(StageStatus.CLIENT_REVIEW, "clientRevision", Role.CLIENT, 3)).toBe(StageStatus.EXTRA_PAYMENT);
    });
    test("SPECIALIST: CLIENT_REVISION → CLIENT_REVIEW via resubmitClient", () => {
      expect(getNextStatus(StageStatus.CLIENT_REVISION, "resubmitClient", Role.SPECIALIST)).toBe(StageStatus.CLIENT_REVIEW);
    });
    test("ADMIN: EXTRA_PAYMENT → CLIENT_REVISION via paymentConfirmed", () => {
      expect(getNextStatus(StageStatus.EXTRA_PAYMENT, "paymentConfirmed", Role.ADMIN)).toBe(StageStatus.CLIENT_REVISION);
    });
  });

  describe("invalid transitions", () => {
    test("throws TransitionError from APPROVED (final state)", () => {
      expect(() => getNextStatus(StageStatus.APPROVED, "upload", Role.SPECIALIST)).toThrow(TransitionError);
    });
    test("throws TransitionError for unknown action", () => {
      expect(() => getNextStatus(StageStatus.PENDING, "modApprove" as never, Role.ADMIN)).toThrow(TransitionError);
    });
  });

  describe("role isolation", () => {
    test("CLIENT cannot trigger upload", () => {
      expect(() => getNextStatus(StageStatus.PENDING, "upload", Role.CLIENT)).toThrow(ForbiddenError);
    });
    test("ADMIN cannot trigger upload", () => {
      expect(() => getNextStatus(StageStatus.PENDING, "upload", Role.ADMIN)).toThrow(ForbiddenError);
    });
    test("SPECIALIST cannot trigger modApprove", () => {
      expect(() => getNextStatus(StageStatus.MOD_REVIEW, "modApprove", Role.SPECIALIST)).toThrow(ForbiddenError);
    });
    test("ADMIN cannot trigger clientApprove", () => {
      expect(() => getNextStatus(StageStatus.CLIENT_REVIEW, "clientApprove", Role.ADMIN)).toThrow(ForbiddenError);
    });
    test("SPECIALIST cannot trigger clientRevision", () => {
      expect(() => getNextStatus(StageStatus.CLIENT_REVIEW, "clientRevision", Role.SPECIALIST)).toThrow(ForbiddenError);
    });
  });

  describe("canTransition", () => {
    test("returns true for valid transition", () => {
      expect(canTransition(StageStatus.PENDING, "upload", Role.SPECIALIST)).toBe(true);
    });
    test("returns false for invalid role", () => {
      expect(canTransition(StageStatus.PENDING, "upload", Role.CLIENT)).toBe(false);
    });
    test("returns false from final state", () => {
      expect(canTransition(StageStatus.APPROVED, "upload", Role.SPECIALIST)).toBe(false);
      expect(canTransition(StageStatus.BLOCKED, "upload", Role.SPECIALIST)).toBe(false);
    });
  });

  describe("getAllowedActions", () => {
    test("SPECIALIST sees upload from PENDING", () => {
      expect(getAllowedActions(StageStatus.PENDING, Role.SPECIALIST)).toContain("upload");
    });
    test("CLIENT sees nothing from PENDING", () => {
      expect(getAllowedActions(StageStatus.PENDING, Role.CLIENT)).toHaveLength(0);
    });
    test("ADMIN sees modApprove and modRevision from MOD_REVIEW", () => {
      const actions = getAllowedActions(StageStatus.MOD_REVIEW, Role.ADMIN);
      expect(actions).toContain("modApprove");
      expect(actions).toContain("modRevision");
    });
  });
});
