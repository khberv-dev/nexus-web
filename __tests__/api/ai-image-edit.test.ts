/** POST /api/ai/image-edit — авторизация, валидация промта и исходника. */

jest.mock("@/lib/session", () => ({
    getSessionUser: jest.fn(),
    getOrCreateDbUser: jest.fn(),
}))

jest.mock("@/lib/ai-provider", () => ({
    aiEditImage: jest.fn(),
    aiSupportsImageEditing: jest.fn(() => true),
    getAiProvider: jest.fn(() => "gemini"),
    isAiConfigured: jest.fn(() => true),
}))

jest.mock("@/lib/s3", () => ({getObjectBuffer: jest.fn()}))

jest.mock("@/lib/db/prisma", () => ({prisma: {userFile: {findUnique: jest.fn()}}}))

jest.mock("@/lib/rate-limit", () => ({rateLimit: jest.fn(() => ({ok: true}))}))

import {POST} from "@/app/api/ai/image-edit/route"
import {getOrCreateDbUser, getSessionUser} from "@/lib/session"
import {aiEditImage, aiSupportsImageEditing, isAiConfigured} from "@/lib/ai-provider"
import {getObjectBuffer} from "@/lib/s3"
import {prisma} from "@/lib/db/prisma"
import {makeReq, SESSION_SPECIALIST} from "../helpers/api"

const mockedSessionUser = jest.mocked(getSessionUser)
const mockedDbUser = jest.mocked(getOrCreateDbUser)
const mockedEdit = jest.mocked(aiEditImage)
const mockedSupports = jest.mocked(aiSupportsImageEditing)
const mockedConfigured = jest.mocked(isAiConfigured)
const mockedObjectBuffer = jest.mocked(getObjectBuffer)
const mockedFindUnique = jest.mocked(prisma.userFile.findUnique)

// 1×1 JPEG, достаточно валидный для regexp-проверки data-url.
const TINY_IMAGE = `data:image/jpeg;base64,${"A".repeat(64)}=`

const call = (body: unknown) => POST(makeReq("/api/ai/image-edit", "POST", body))

describe("POST /api/ai/image-edit", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedSessionUser.mockResolvedValue(SESSION_SPECIALIST.user as never)
        mockedConfigured.mockReturnValue(true)
        mockedSupports.mockReturnValue(true)
        mockedEdit.mockResolvedValue({dataUrl: "data:image/jpeg;base64,ok", mimeType: "image/jpeg"})
    })

    it("отклоняет анонимов", async () => {
        mockedSessionUser.mockResolvedValue(null as never)
        expect((await call({image: TINY_IMAGE, prompt: "hi"})).status).toBe(401)
        expect(mockedEdit).not.toHaveBeenCalled()
    })

    it("требует непустой промт", async () => {
        expect((await call({image: TINY_IMAGE, prompt: "   "})).status).toBe(400)
        expect(mockedEdit).not.toHaveBeenCalled()
    })

    it("режет слишком длинный промт", async () => {
        expect((await call({image: TINY_IMAGE, prompt: "а".repeat(601)})).status).toBe(400)
        expect(mockedEdit).not.toHaveBeenCalled()
    })

    it("требует исходное изображение", async () => {
        expect((await call({prompt: "сделай фон светлее"})).status).toBe(400)
        expect(mockedEdit).not.toHaveBeenCalled()
    })

    it("503, когда провайдер не настроен", async () => {
        mockedConfigured.mockReturnValue(false)
        expect((await call({image: TINY_IMAGE, prompt: "hi"})).status).toBe(503)
    })

    it("подмешивает правила кадра и возвращает картинку", async () => {
        const res = await call({image: TINY_IMAGE, prompt: "деловой портрет", context: "avatar"})
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({
            image: {dataUrl: "data:image/jpeg;base64,ok"},
            sourceImageUsed: true,
        })
        const [prompt] = mockedEdit.mock.calls[0]
        expect(prompt).toContain("аватара профиля дизайнера")
        expect(prompt).toContain("деловой портрет")
    })

    it("сообщает, что yandex не использует исходник", async () => {
        mockedSupports.mockReturnValue(false)
        const res = await call({image: TINY_IMAGE, prompt: "деловой портрет"})
        expect(await res.json()).toMatchObject({sourceImageUsed: false})
    })

    it("читает исходник из UserFile владельца", async () => {
        mockedDbUser.mockResolvedValue({id: "db-user-1"} as never)
        mockedFindUnique.mockResolvedValue({id: "f1", userId: "db-user-1", s3Key: "k", mimeType: "image/png"} as never)
        mockedObjectBuffer.mockResolvedValue({buffer: Buffer.from("png-bytes"), contentType: "image/png"})

        const res = await call({fileId: "f1", prompt: "светлее фон", context: "avatar"})
        expect(res.status).toBe(200)
        const [, image] = mockedEdit.mock.calls[0]
        expect(image).toEqual({data: Buffer.from("png-bytes").toString("base64"), mimeType: "image/png"})
    })

    it("не отдаёт чужой файл", async () => {
        mockedDbUser.mockResolvedValue({id: "db-user-1"} as never)
        mockedFindUnique.mockResolvedValue({id: "f1", userId: "someone-else", s3Key: "k"} as never)

        expect((await call({fileId: "f1", prompt: "светлее"})).status).toBe(400)
        expect(mockedEdit).not.toHaveBeenCalled()
    })
})
