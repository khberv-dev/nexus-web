/**
 * parseJsonBody — the helper underpinning all T2 input validation.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validate";

function mkReq(rawBody: string): NextRequest {
  return new NextRequest("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody,
  });
}

const schema = z.object({ name: z.string(), n: z.number().int().optional() });

describe("parseJsonBody", () => {
  test("valid body → ok:true with typed data", async () => {
    const r = await parseJsonBody(mkReq(JSON.stringify({ name: "a", n: 2 })), schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ name: "a", n: 2 });
  });

  test("optional field omitted still validates", async () => {
    const r = await parseJsonBody(mkReq(JSON.stringify({ name: "a" })), schema);
    expect(r.ok).toBe(true);
  });

  test("schema mismatch → ok:false, 400 response", async () => {
    const r = await parseJsonBody(mkReq(JSON.stringify({ n: 5 })), schema); // missing name
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  test("wrong field type → ok:false, 400 response", async () => {
    const r = await parseJsonBody(mkReq(JSON.stringify({ name: "a", n: "x" })), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  test("invalid JSON → ok:false, 400 response", async () => {
    const r = await parseJsonBody(mkReq("{ not valid json"), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  test("z.record preserves all keys (free-form blob)", async () => {
    const rec = z.record(z.string(), z.unknown());
    const r = await parseJsonBody(mkReq(JSON.stringify({ a: "1", b: 2, extra: { x: 1 } })), rec);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ a: "1", b: 2, extra: { x: 1 } });
  });
});
