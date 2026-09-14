import http from "node:http"
import net, {type AddressInfo} from "node:net"

import {aiFetch, getAiProxyDispatcher} from "@/lib/ai-proxy"
import {geminiGenerate} from "@/lib/gemini-ai"

/** Минимальный SOCKS5-сервер (RFC 1928/1929): no-auth или user/pass, только CONNECT. */
function startSocks5(auth?: {username: string; password: string}) {
    const connects: string[] = []
    const server = net.createServer((client) => {
        client.once("data", (greeting) => {
            const methods = [...greeting.subarray(2, 2 + greeting[1])]
            const method = auth ? 0x02 : 0x00
            if (!methods.includes(method)) return client.end(Buffer.from([0x05, 0xff]))
            client.write(Buffer.from([0x05, method]))

            const onConnect = (req: Buffer) => {
                let host: string
                let offset: number
                if (req[3] === 0x01) {
                    host = [...req.subarray(4, 8)].join(".")
                    offset = 8
                } else if (req[3] === 0x03) {
                    host = req.subarray(5, 5 + req[4]).toString()
                    offset = 5 + req[4]
                } else {
                    return client.end(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
                }
                const port = req.readUInt16BE(offset)
                connects.push(`${host}:${port}`)
                const upstream = net.connect(port, host === "localhost" ? "127.0.0.1" : host, () => {
                    client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
                    client.pipe(upstream).pipe(client)
                })
                upstream.on("error", () => client.destroy())
            }

            if (!auth) return client.once("data", onConnect)
            client.once("data", (creds) => {
                const uLen = creds[1]
                const username = creds.subarray(2, 2 + uLen).toString()
                const password = creds.subarray(3 + uLen, 3 + uLen + creds[2 + uLen]).toString()
                const ok = username === auth.username && password === auth.password
                client.write(Buffer.from([0x01, ok ? 0x00 : 0x01]))
                if (!ok) return client.end()
                client.once("data", onConnect)
            })
        })
        client.on("error", () => {})
    })
    return new Promise<{port: number; connects: string[]; close: () => Promise<void>}>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve({
            port: (server.address() as AddressInfo).port,
            connects,
            close: () => new Promise((done) => server.close(() => done())),
        }))
    })
}

function startTarget(handler: http.RequestListener) {
    const server = http.createServer(handler)
    return new Promise<{port: number; close: () => Promise<void>}>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve({
            port: (server.address() as AddressInfo).port,
            close: () => new Promise((done) => {
                server.closeAllConnections()
                server.close(() => done())
            }),
        }))
    })
}

describe("AI proxy", () => {
    const originalProxy = process.env.AI_PROXY_URL
    const originalGeminiKey = process.env.GEMINI_API_KEY

    afterEach(() => {
        jest.restoreAllMocks()
        if (originalProxy === undefined) delete process.env.AI_PROXY_URL
        else process.env.AI_PROXY_URL = originalProxy
        if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY
        else process.env.GEMINI_API_KEY = originalGeminiKey
    })

    it("uses the global fetch when AI_PROXY_URL is not set", async () => {
        delete process.env.AI_PROXY_URL
        const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response("ok"))

        await expect((await aiFetch("https://example.test/")).text()).resolves.toBe("ok")
        expect(getAiProxyDispatcher()).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("treats an empty AI_PROXY_URL as unset", () => {
        process.env.AI_PROXY_URL = "  "
        expect(getAiProxyDispatcher()).toBeNull()
    })

    it.each(["ftp://127.0.0.1:21", "not a url"])("rejects unsupported proxy URL %s", (url) => {
        process.env.AI_PROXY_URL = url
        expect(() => getAiProxyDispatcher()).toThrow("INVALID_AI_PROXY_URL")
    })

    it.each(["socks5", "socks5h", "socks"])("routes requests through a %s:// proxy with credentials", async (scheme) => {
        const target = await startTarget((req, res) => res.end(`hello ${req.url}`))
        const proxy = await startSocks5({username: "user", password: "p@ss"})
        try {
            process.env.AI_PROXY_URL = `${scheme}://user:${encodeURIComponent("p@ss")}@127.0.0.1:${proxy.port}`
            const fetchSpy = jest.spyOn(global, "fetch")

            const res = await aiFetch(`http://localhost:${target.port}/path`)

            await expect(res.text()).resolves.toBe("hello /path")
            // Имя хоста уходит прокси как есть — DNS резолвится на его стороне.
            expect(proxy.connects).toEqual([`localhost:${target.port}`])
            expect(fetchSpy).not.toHaveBeenCalled()
        } finally {
            await getAiProxyDispatcher()?.close()
            await proxy.close()
            await target.close()
        }
    })

    it("routes requests through an http:// proxy", async () => {
        const proxied: string[] = []
        const target = await startTarget((_req, res) => res.end("direct"))
        const proxy = await startTarget((req, res) => {
            proxied.push(req.url ?? "")
            res.end("via proxy")
        })
        try {
            process.env.AI_PROXY_URL = `http://127.0.0.1:${proxy.port}`
            const res = await aiFetch(`http://localhost:${target.port}/x`)
            await expect(res.text()).resolves.toBe("via proxy")
            expect(proxied).toEqual([`http://localhost:${target.port}/x`])
        } finally {
            await getAiProxyDispatcher()?.close()
            await proxy.close()
            await target.close()
        }
    })

    it("sends Gemini requests through aiFetch", async () => {
        delete process.env.AI_PROXY_URL
        process.env.GEMINI_API_KEY = "test-key"
        const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
            candidates: [{content: {parts: [{text: "thinking", thought: true}, {text: " answer "}]}}],
        }), {status: 200}))

        await expect(geminiGenerate("system", "question", 64)).resolves.toBe("answer")

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")
        expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key")
        expect(JSON.parse(String(init.body))).toEqual({
            systemInstruction: {parts: [{text: "system"}]},
            contents: [{role: "user", parts: [{text: "question"}]}],
            generationConfig: {maxOutputTokens: 64, thinkingConfig: {thinkingBudget: 0}},
        })
    })
})
