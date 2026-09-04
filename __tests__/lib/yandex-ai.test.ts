import {yandexGenerateImage} from "@/lib/yandex-ai"

describe("YandexART", () => {
    const originalKey = process.env.YANDEX_GPT_API_KEY
    const originalFolder = process.env.YANDEX_CLOUD_FOLDER_ID

    afterEach(() => {
        jest.restoreAllMocks()
        if (originalKey === undefined) delete process.env.YANDEX_GPT_API_KEY
        else process.env.YANDEX_GPT_API_KEY = originalKey
        if (originalFolder === undefined) delete process.env.YANDEX_CLOUD_FOLDER_ID
        else process.env.YANDEX_CLOUD_FOLDER_ID = originalFolder
    })

    it("compacts and limits image prompts to 500 characters", async () => {
        process.env.YANDEX_GPT_API_KEY = "test-key"
        process.env.YANDEX_CLOUD_FOLDER_ID = "test-folder"
        const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
            id: "operation-id",
            done: true,
            response: {image: "aW1hZ2U="},
        }), {status: 200}))

        await yandexGenerateImage(`  ${"я".repeat(300)}\n\n${"ю".repeat(300)}  `)

        const request = fetchMock.mock.calls[0][1] as RequestInit
        const body = JSON.parse(String(request.body)) as {messages: Array<{text: string}>}
        expect(Array.from(body.messages[0].text)).toHaveLength(500)
        expect(body.messages[0].text).not.toContain("\n")
    })
})
