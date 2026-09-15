import {authHref, canSignUp, DEFAULT_AUTH_ROLE, parseAuthRoleSegment} from "@/lib/auth/auth-routes"

describe("parseAuthRoleSegment", () => {
    it("без сегмента — роль по умолчанию", () => {
        expect(parseAuthRoleSegment(undefined)).toBe(DEFAULT_AUTH_ROLE)
        expect(parseAuthRoleSegment([])).toBe(DEFAULT_AUTH_ROLE)
    })

    it("принимает известные роли", () => {
        expect(parseAuthRoleSegment(["specialist"])).toBe("specialist")
        expect(parseAuthRoleSegment(["client"])).toBe("client")
        expect(parseAuthRoleSegment(["admin"])).toBe("admin")
    })

    it("неизвестная роль и лишние сегменты — 404", () => {
        expect(parseAuthRoleSegment(["ADMIN"])).toBeNull()
        expect(parseAuthRoleSegment(["designer"])).toBeNull()
        expect(parseAuthRoleSegment(["client", "extra"])).toBeNull()
    })
})

describe("authHref", () => {
    it("роль по умолчанию не пишется в путь", () => {
        expect(authHref("signin", "specialist")).toBe("/login")
        expect(authHref("signup", "specialist")).toBe("/register")
    })

    it("остальные роли — сегментом", () => {
        expect(authHref("signin", "client")).toBe("/login/client")
        expect(authHref("signup", "client")).toBe("/register/client")
        expect(authHref("signin", "admin")).toBe("/login/admin")
    })

    it("администратор не регистрируется: регистрация превращается во вход", () => {
        expect(canSignUp("admin")).toBe(false)
        expect(canSignUp("client")).toBe(true)
        expect(authHref("signup", "admin")).toBe("/login/admin")
    })

    it("сохраняет query при переключении", () => {
        expect(authHref("signup", "client", "?callbackUrl=%2Forders")).toBe("/register/client?callbackUrl=%2Forders")
        expect(authHref("signin", "specialist", "error=x")).toBe("/login?error=x")
        expect(authHref("signin", "specialist", "?")).toBe("/login")
    })
})
