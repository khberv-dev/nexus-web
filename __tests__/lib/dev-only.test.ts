/**
 * devOnlyGuard (SEC2/SEC4/T6) — mock/dev endpoints must 404 in production.
 */
import { devOnlyGuard } from "@/lib/dev-only";

// process.env.NODE_ENV is typed readonly; cast to a mutable view for the test.
const env = process.env as Record<string, string | undefined>;

describe("devOnlyGuard", () => {
  const original = env.NODE_ENV;
  afterEach(() => { env.NODE_ENV = original; });

  test("returns a 404 response in production", () => {
    env.NODE_ENV = "production";
    const res = devOnlyGuard();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(404);
  });

  test("returns null in development (handler proceeds)", () => {
    env.NODE_ENV = "development";
    expect(devOnlyGuard()).toBeNull();
  });

  test("returns null under test env (handler proceeds)", () => {
    env.NODE_ENV = "test";
    expect(devOnlyGuard()).toBeNull();
  });
});
