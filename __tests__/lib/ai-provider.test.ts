jest.mock("@/lib/gemini-ai", () => ({
    geminiEditImage: jest.fn(),
    geminiGenerate: jest.fn(),
    isGeminiConfigured: jest.fn(),
}))

jest.mock("@/lib/yandex-ai", () => ({
    isYandexAiConfigured: jest.fn(),
    yandexChat: jest.fn(),
    yandexGenerateImage: jest.fn(),
}))

import {aiAsk, aiChat, aiGenerateAvatar, getAiProvider, isAiConfigured} from "@/lib/ai-provider"
import {geminiEditImage, geminiGenerate, isGeminiConfigured} from "@/lib/gemini-ai"
import {isYandexAiConfigured, yandexChat, yandexGenerateImage} from "@/lib/yandex-ai"

const mockedGeminiGenerate = jest.mocked(geminiGenerate)
const mockedGeminiEditImage = jest.mocked(geminiEditImage)
const mockedGeminiConfigured = jest.mocked(isGeminiConfigured)
const mockedYandexChat = jest.mocked(yandexChat)
const mockedYandexImage = jest.mocked(yandexGenerateImage)
const mockedYandexConfigured = jest.mocked(isYandexAiConfigured)

describe("AI provider", () => {
    const originalProvider = process.env.AI_PROVIDER

    afterEach(() => {
        jest.clearAllMocks()
        if (originalProvider === undefined) delete process.env.AI_PROVIDER
        else process.env.AI_PROVIDER = originalProvider
    })

    it("uses Gemini by default", async () => {
        delete process.env.AI_PROVIDER
        mockedGeminiConfigured.mockReturnValue(true)
        mockedGeminiGenerate.mockResolvedValue("gemini reply")

        await expect(aiAsk("system", "question", 100)).resolves.toBe("gemini reply")
        expect(getAiProvider()).toBe("gemini")
        expect(isAiConfigured()).toBe(true)
        expect(mockedGeminiGenerate).toHaveBeenCalledWith("system", "User: question", 100)
    })

    it("routes chat and images to Yandex", async () => {
        process.env.AI_PROVIDER = "yandex"
        const messages = [{role: "user" as const, content: "hello"}]
        const image = {data: "abc", mimeType: "image/png"}
        mockedYandexConfigured.mockReturnValue(true)
        mockedYandexChat.mockResolvedValue("yandex reply")
        mockedYandexImage.mockResolvedValue({dataUrl: "data:image/jpeg;base64,abc", mimeType: "image/jpeg"})

        await expect(aiChat(messages, 200)).resolves.toBe("yandex reply")
        await expect(aiGenerateAvatar("portrait", image)).resolves.toEqual({
            dataUrl: "data:image/jpeg;base64,abc",
            mimeType: "image/jpeg",
        })
        expect(isAiConfigured()).toBe(true)
        expect(mockedYandexChat).toHaveBeenCalledWith(messages, 200)
        expect(mockedYandexImage).toHaveBeenCalledWith("portrait")
        expect(mockedGeminiEditImage).not.toHaveBeenCalled()
    })

    it("rejects unknown providers", () => {
        process.env.AI_PROVIDER = "other"
        expect(() => getAiProvider()).toThrow("INVALID_AI_PROVIDER:other")
    })
})
