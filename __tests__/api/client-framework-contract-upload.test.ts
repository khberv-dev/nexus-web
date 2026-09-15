/**
 * PUT /api/client/framework-contract — скан с подписью принимается только пока договор ждёт подписи.
 */

import {makeReq} from "../helpers/api"

jest.mock("@/lib/session", () => ({getSessionUser: jest.fn(), getSessionDbUser: jest.fn()}))
jest.mock("@/lib/db/prisma", () => ({
    prisma: {clientProfile: {findUnique: jest.fn(), update: jest.fn()}},
}))
jest.mock("@/lib/s3", () => ({
    getUploadUrl: jest.fn().mockResolvedValue({url: "https://upload.example/put"}),
    getDownloadUrl: jest.fn(),
}))

import {getSessionDbUser, getSessionUser} from "@/lib/session"
import {prisma} from "@/lib/db/prisma"
import {PUT} from "@/app/api/client/framework-contract/route"

const findProfile = prisma.clientProfile.findUnique as jest.Mock
const updateProfile = prisma.clientProfile.update as jest.Mock

const profile = (status: string) => ({
    id: "cp1",
    frameworkContractS3Key: "contracts/c1.pdf",
    frameworkContractStatus: status,
})

describe("PUT /api/client/framework-contract", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getSessionUser as jest.Mock).mockResolvedValue({id: "c1", email: "c@x", role: "CLIENT"});
        (getSessionDbUser as jest.Mock).mockResolvedValue({id: "c1"})
    })

    it("выдаёт ссылку на загрузку, пока договор ждёт подписи", async () => {
        findProfile.mockResolvedValue(profile("AWAITING_SIGNATURE"))
        const res = await PUT(makeReq("/api/client/framework-contract", "PUT", {filename: "скан договора.pdf"}))
        expect(res.status).toBe(200)
        expect((await res.json()).uploadUrl).toBe("https://upload.example/put")
        const key = updateProfile.mock.calls[0][0].data.signedContractS3Key as string
        expect(key).toMatch(/^client-contracts\/c1\/\d+-[\w.-]+\.pdf$/)
    })

    it.each(["SIGNED_BY_CLIENT", "SIGNED_BY_ADMIN", "DECLINED_BY_CLIENT", "NONE"])(
        "закрыта после ответа или без договора (%s)",
        async (status) => {
            findProfile.mockResolvedValue(profile(status))
            const res = await PUT(makeReq("/api/client/framework-contract", "PUT", {filename: "scan.pdf"}))
            expect(res.status).toBe(409)
            expect(updateProfile).not.toHaveBeenCalled()
        },
    )

    it("принимает только PDF, JPG и PNG", async () => {
        findProfile.mockResolvedValue(profile("AWAITING_SIGNATURE"))
        const res = await PUT(makeReq("/api/client/framework-contract", "PUT", {filename: "scan.exe"}))
        expect(res.status).toBe(400)
        expect(updateProfile).not.toHaveBeenCalled()
    })
})
