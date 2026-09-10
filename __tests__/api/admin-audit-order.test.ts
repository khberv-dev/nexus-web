/**
 * Журнал действий в админке читается «новое сверху».
 *
 * Одно действие администратора пишет несколько записей аудита подряд, а createdAt
 * хранится с точностью до миллисекунды — без доводчика по id такие строки приходят
 * из Postgres в произвольном порядке. Тест фиксирует обе половины требования:
 * createdAt desc и id desc.
 */

import {NextRequest} from "next/server";
import {makeReq, SESSION_ADMIN, SESSION_SPECIALIST} from "../helpers/api";

jest.mock("@/lib/session", () => ({
    getSessionUser: jest.fn(),
    getServerSessionWithDevBypass: jest.fn(),
    getSessionDbUser: jest.fn(),
}));
jest.mock("@/lib/db/prisma", () => ({
    prisma: {auditLog: {findMany: jest.fn().mockResolvedValue([])}},
}));

import {getSessionUser} from "@/lib/session";
import {prisma} from "@/lib/db/prisma";

const mockSession = getSessionUser as jest.Mock;
const db = prisma as unknown as { auditLog: { findMany: jest.Mock } };

const NEWEST_FIRST = [{createdAt: "desc"}, {id: "desc"}];
const orderByOfLastQuery = () => db.auditLog.findMany.mock.calls.at(-1)?.[0]?.orderBy;

describe("история действий в админке отсортирована от новых к старым", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSession.mockResolvedValue(SESSION_ADMIN.user);
    });

    test("история одной сущности (таймлайн в карточке)", async () => {
        const {GET} = await import("@/app/api/admin/audit/route");
        const res = await GET(makeReq("/api/admin/audit?entity=User&entityId=spec-1", "GET"));

        expect(res.status).toBe(200);
        expect(orderByOfLastQuery()).toEqual(NEWEST_FIRST);
    });

    test("общий журнал действий", async () => {
        const {GET} = await import("@/app/api/admin/audit/all/route");
        const res = await GET(makeReq("/api/admin/audit/all?limit=50", "GET"));

        expect(res.status).toBe(200);
        expect(orderByOfLastQuery()).toEqual(NEWEST_FIRST);
    });

    test("история заказа", async () => {
        const {GET} = await import("@/app/api/admin/orders/[id]/history/route");
        const res = await (GET as (
            req: NextRequest,
            ctx: { params: Promise<{ id: string }> },
        ) => Promise<Response>)(
            makeReq("/api/admin/orders/order-1/history", "GET"),
            {params: Promise.resolve({id: "order-1"})},
        );

        expect(res.status).toBe(200);
        expect(orderByOfLastQuery()).toEqual(NEWEST_FIRST);
    });

    test("не-админ журнал не читает", async () => {
        mockSession.mockResolvedValue(SESSION_SPECIALIST.user);
        const {GET} = await import("@/app/api/admin/audit/all/route");
        const res = await GET(makeReq("/api/admin/audit/all", "GET"));

        expect(res.status).toBe(403);
        expect(db.auditLog.findMany).not.toHaveBeenCalled();
    });
});
