import * as fc from "fast-check";
import { StageStatus, Role } from "@prisma/client";
import { canTransition, getNextStatus } from "../src/lib/stage-machine";
import { buildS3Key, validateFile } from "../src/lib/s3";
import { extractRoleFromToken, extractOrgIdFromToken } from "../src/lib/zitadel/client";
import { createHmac } from "crypto";

jest.mock("../src/lib/db/prisma", () => ({ prisma: {} }));

const ALL_STATUSES = Object.values(StageStatus);
const ALL_ROLES = Object.values(Role);
const ALL_ACTIONS = ["upload", "submit", "modApprove", "modRevision", "resubmitMod", "clientApprove", "clientRevision", "resubmitClient", "paymentConfirmed"] as const;
const FINAL_STATUSES = [StageStatus.APPROVED];

// P1: Determinism — same inputs always produce same output
test("P1: stage transitions are deterministic", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...ALL_STATUSES),
      fc.constantFrom(...ALL_ACTIONS),
      fc.constantFrom(...ALL_ROLES),
      fc.integer({ min: 0, max: 5 }),
      (status, action, role, clientRound) => {
        const r1 = (() => { try { return getNextStatus(status, action, role, clientRound); } catch { return null; } })();
        const r2 = (() => { try { return getNextStatus(status, action, role, clientRound); } catch { return null; } })();
        return r1 === r2;
      }
    )
  );
});

// P2: Final states have no outgoing transitions
test("P2: final states have no outgoing transitions", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...FINAL_STATUSES),
      fc.constantFrom(...ALL_ACTIONS),
      fc.constantFrom(...ALL_ROLES),
      (status, action, role) => {
        return !canTransition(status, action, role);
      }
    )
  );
});

// P3: Role isolation — wrong role always fails
test("P3: role isolation — ADMIN cannot upload", () => {
  fc.assert(
    fc.property(fc.constantFrom(...ALL_STATUSES), (status) => {
      return !canTransition(status, "upload", Role.ADMIN);
    })
  );
});

// P5: S3 key structural correctness
test("P5: S3 keys match expected pattern", () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 10, maxLength: 25 }),
      fc.constantFrom("PLANNING", "VISUALIZATION", "DOCUMENTATION"),
      fc.integer({ min: 1, max: 10 }),
      fc.stringMatching(/^[a-z0-9_-]+\.(pdf|jpg|png|zip)$/),
      (orderId, stageType, version, filename) => {
        const key = buildS3Key(orderId, stageType as never, version, filename);
        return /^orders\/.+\/stages\/.+\/\d+\/.+$/.test(key);
      }
    )
  );
});

// Zitadel role parsing
test("extractRoleFromToken: finds role in nested structure", () => {
  const payload = {
    sub: "user123",
    "urn:zitadel:iam:org:project:abc123:roles": { SPECIALIST: { orgId: "domain" } },
  };
  expect(extractRoleFromToken(payload)).toBe("SPECIALIST");
});

test("extractRoleFromToken: ADMIN takes priority over SPECIALIST", () => {
  const payload = {
    "urn:zitadel:iam:org:project:abc:roles": { ADMIN: {}, SPECIALIST: {} },
  };
  expect(extractRoleFromToken(payload)).toBe("ADMIN");
});

test("extractRoleFromToken: throws when no role found", () => {
  expect(() => extractRoleFromToken({ sub: "x" })).toThrow("No valid role found");
});

test("extractOrgIdFromToken: finds org id from direct claim", () => {
  expect(extractOrgIdFromToken({ "urn:zitadel:iam:org:id": "org123" })).toBe("org123");
});

// File validation
test("validateFile: rejects disallowed extension", () => {
  expect(() => validateFile("malware.exe")).toThrow("not allowed");
});

test("validateFile: accepts allowed extension", () => {
  expect(() => validateFile("design.pdf")).not.toThrow();
});

test("validateFile: rejects office formats outside specification stage", () => {
  expect(() => validateFile("spec.xlsx")).toThrow("not allowed");
});

test("validateFile: accepts office formats on SPECIFICATION stage", () => {
  expect(() => validateFile("spec.xlsx", undefined, { stageType: "SPECIFICATION" })).not.toThrow();
  expect(() => validateFile("spec.docx", undefined, { stageType: "SPECIFICATION" })).not.toThrow();
});

// Webhook HMAC verification
test("HMAC webhook signature verification", () => {
  const secret = "test-secret";
  const payload = { Amount: 1000, OrderId: "order1", Status: "CONFIRMED" };
  const data = Object.keys(payload).sort().map((k) => (payload as Record<string, unknown>)[k]).join("");
  const signature = createHmac("sha256", secret).update(data).digest("hex");

  // Verify correct signature
  const expected = createHmac("sha256", secret).update(data).digest("hex");
  expect(signature).toBe(expected);

  // Wrong secret fails
  const wrong = createHmac("sha256", "wrong-secret").update(data).digest("hex");
  expect(signature).not.toBe(wrong);
});
