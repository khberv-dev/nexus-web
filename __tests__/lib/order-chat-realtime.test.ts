import {canViewOrderChatChannel, orderChatRedisChannel, visibleOrderChatChannels} from "@/lib/order-chat-realtime"

jest.mock("@/lib/redis", () => ({redis: {publish: jest.fn()}}))

describe("order chat realtime access", () => {
    test("maps every role to only its visible channels", () => {
        expect(visibleOrderChatChannels("CLIENT", "ALL")).toEqual(["ADMIN_CLIENT"])
        expect(visibleOrderChatChannels("SPECIALIST", "ALL")).toEqual(["ADMIN_SPECIALIST"])
        expect(visibleOrderChatChannels("ADMIN", "ALL")).toEqual(["ADMIN_CLIENT", "ADMIN_SPECIALIST"])
        expect(visibleOrderChatChannels("ADMIN", "ADMIN_SPECIALIST")).toEqual(["ADMIN_SPECIALIST"])
    })

    test("prevents cross-role private channel delivery", () => {
        expect(canViewOrderChatChannel("CLIENT", "ADMIN_CLIENT")).toBe(true)
        expect(canViewOrderChatChannel("CLIENT", "ADMIN_SPECIALIST")).toBe(false)
        expect(canViewOrderChatChannel("SPECIALIST", "ADMIN_CLIENT")).toBe(false)
        expect(canViewOrderChatChannel("ADMIN", "ADMIN_SPECIALIST")).toBe(true)
    })

    test("uses an order-scoped Redis channel", () => {
        expect(orderChatRedisChannel("order-1")).toBe("order-chat:order-1")
    })
})
