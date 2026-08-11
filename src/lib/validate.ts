import {NextResponse} from "next/server";
import type {z} from "zod";

/**
 * Parse & validate a request JSON body against a zod schema.
 *
 * On success returns { ok: true, data } (typed). On invalid JSON or a schema
 * mismatch returns { ok: false, response } — a ready-to-return 400 NextResponse.
 * This keeps route handlers from writing raw, unvalidated `await req.json()`
 * straight into the database.
 *
 *   const parsed = await parseJsonBody(req, BodySchema);
 *   if (!parsed.ok) return parsed.response;
 *   const { field } = parsed.data;
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
    req: Request,
    schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return {ok: false, response: NextResponse.json({error: "Invalid JSON"}, {status: 400})};
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            response: NextResponse.json(
                {error: "Invalid request", details: parsed.error.flatten().fieldErrors},
                {status: 400},
            ),
        };
    }
    return {ok: true, data: parsed.data};
}
