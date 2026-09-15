/**
 * Админ не может заменить договор, отправленный на подпись: только до отправки или после отказа.
 */

import {NextRequest} from "next/server"

jest.mock("@/lib/session", () => ({getSessionUser: jest.fn()}))
jest.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: {findFirst: jest.fn()},
        specialistProfile: {update: jest.fn()},
        clientProfile: {update: jest.fn()},
    },
}))
jest.mock("@/lib/s3", () => ({
    isStorageConfigured: jest.fn(() => true),
    putObject: jest.fn(),
    validateFile: jest.fn(),
    getDownloadUrl: jest.fn(),
}))
jest.mock("@/lib/onboarding/notify-step", () => ({notifySpecialistStep: jest.fn()}))
jest.mock("@/lib/notifications", () => ({notify: jest.fn()}))
jest.mock("@/lib/email", () => ({sendEmail: jest.fn()}))

import {getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {POST as specialistUpload} from "@/app/api/admin/specialists/[id]/framework-contract/route"
import {POST as clientUpload} from "@/app/api/admin/clients/[id]/framework-contract/route"

const findUser = prisma.user.findFirst as jest.Mock

function uploadReq() {
    const fd = new FormData()
    fd.set("file", new File([new Uint8Array([37, 80, 68, 70])], "contract.pdf", {type: "application/pdf"}))
    return new NextRequest("http://localhost/x", {method: "POST", body: fd})
}

const params = {params: Promise.resolve({id: "u1"})}

describe("загрузка договора администратором", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getSessionUser as jest.Mock).mockResolvedValue({id: "a1", email: "a@x", role: "ADMIN"})
    })

    describe("специалист", () => {
        const withProfile = (status: string, key: string | null) => findUser.mockResolvedValue({
            id: "u1", email: "s@x",
            specialistProfile: {id: "sp1", specialistContractStatus: status, specialistContractS3Key: key},
        })

        it.each(["AWAITING_SIGNATURE", "SIGNED_BY_SPECIALIST", "SIGNED_BY_ADMIN"])("409 после отправки (%s)", async (status) => {
            withProfile(status, "contracts/old.pdf")
            const res = await specialistUpload(uploadReq(), params)
            expect(res.status).toBe(409)
            expect(prisma.specialistProfile.update).not.toHaveBeenCalled()
        })

        it("принимает первый договор и новую версию после отказа", async () => {
            withProfile("NONE", null)
            expect((await specialistUpload(uploadReq(), params)).status).toBe(200)
            withProfile("DECLINED_BY_SPECIALIST", "contracts/old.pdf")
            expect((await specialistUpload(uploadReq(), params)).status).toBe(200)
            expect(prisma.specialistProfile.update).toHaveBeenCalledTimes(2)
        })
    })

    describe("заказчик", () => {
        const withProfile = (status: string, key: string | null) => findUser.mockResolvedValue({
            id: "u1", email: "c@x",
            clientProfile: {id: "cp1", frameworkContractStatus: status, frameworkContractS3Key: key},
        })

        it.each(["AWAITING_SIGNATURE", "SIGNED_BY_CLIENT", "SIGNED_BY_ADMIN"])("409 после отправки (%s)", async (status) => {
            withProfile(status, "clients/old.pdf")
            const res = await clientUpload(uploadReq(), params)
            expect(res.status).toBe(409)
            expect(prisma.clientProfile.update).not.toHaveBeenCalled()
        })

        it("принимает новую версию после отказа заказчика", async () => {
            withProfile("DECLINED_BY_CLIENT", "clients/old.pdf")
            expect((await clientUpload(uploadReq(), params)).status).toBe(200)
            expect(prisma.clientProfile.update).toHaveBeenCalledTimes(1)
        })
    })
})
