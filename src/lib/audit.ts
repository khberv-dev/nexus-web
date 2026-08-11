import {prisma} from "@/lib/db/prisma"
import type {Prisma} from "@prisma/client"

/** Shape of a single field change: before and after value. */
export type AuditFieldChange = { from?: unknown; to?: unknown }

/**
 * Typed audit changes map.
 * Keys are field names; values are before/after pairs.
 * Stored as Json in the DB — this type is the contract for reading it back.
 */
export type AuditChanges = Record<string, AuditFieldChange>

export async function audit(
    userId: string | null,
    action: string,
    entity: string,
    entityId: string,
    changes?: AuditChanges | null,
) {
    await prisma.auditLog.create({
        data: {userId, action, entity, entityId, changes: (changes ?? undefined) as Prisma.InputJsonValue | undefined},
    })
}

/** Diff two objects, return only changed keys as AuditChanges. */
export function diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
): AuditChanges | null {
    const result: AuditChanges = {}
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const k of keys) {
        if (String(before[k] ?? "") !== String(after[k] ?? "")) {
            result[k] = {from: before[k] ?? null, to: after[k] ?? null}
        }
    }
    return Object.keys(result).length ? result : null
}

/** Parse AuditChanges from raw Json stored in the DB. Returns null if invalid. */
export function parseAuditChanges(raw: unknown): AuditChanges | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
    return raw as AuditChanges
}
