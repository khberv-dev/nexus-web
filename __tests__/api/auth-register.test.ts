/**
 * POST /api/auth/register — регистрация с раздельными именем и фамилией.
 */

import {makeReq} from "../helpers/api"

jest.mock("@/lib/db/prisma", () => ({
    prisma: {
        user: {findUnique: jest.fn(), create: jest.fn()},
    },
}))
jest.mock("@/lib/auth/password", () => ({hashPassword: jest.fn().mockResolvedValue("hashed")}))

import {prisma} from "@/lib/db/prisma"
import {POST} from "@/app/api/auth/register/route"

const findUnique = prisma.user.findUnique as jest.Mock
const create = prisma.user.create as jest.Mock

const valid = {
    email: "Anna@Example.com",
    password: "secret123",
    role: "CLIENT",
    firstName: " Анна ",
    lastName: "Смирнова",
    phone: "+79990001122",
    formData: {email: "anna@example.com"},
}

describe("POST /api/auth/register", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        findUnique.mockResolvedValue(null)
        create.mockResolvedValue({id: "u1"})
    })

    it("сохраняет имя и фамилию в User, а не в анкете", async () => {
        const res = await POST(makeReq("/api/auth/register", "POST", {
            ...valid,
            formData: {email: "anna@example.com", fullName: "Лишнее", firstName: "x", lastName: "y"},
        }))
        expect(res.status).toBe(200)
        const data = create.mock.calls[0][0].data
        expect(data).toMatchObject({email: "anna@example.com", firstName: "Анна", lastName: "Смирнова", role: "CLIENT"})
        expect(data).not.toHaveProperty("name")
        expect(data.clientProfile.create.formData).toEqual({email: "anna@example.com"})
    })

    it("требует имя и фамилию", async () => {
        const noFirst = await POST(makeReq("/api/auth/register", "POST", {...valid, firstName: "  "}))
        expect(noFirst.status).toBe(400)
        expect((await noFirst.json()).error).toBe("Введите имя")

        const noLast = await POST(makeReq("/api/auth/register", "POST", {...valid, lastName: undefined}))
        expect(noLast.status).toBe(400)
        expect((await noLast.json()).error).toBe("Введите фамилию")
        expect(create).not.toHaveBeenCalled()
    })

    it("требует телефон", async () => {
        const empty = await POST(makeReq("/api/auth/register", "POST", {...valid, phone: ""}))
        expect(empty.status).toBe(400)
        expect((await empty.json()).error).toBe("Введите корректный номер телефона")

        const invalid = await POST(makeReq("/api/auth/register", "POST", {...valid, phone: "12345"}))
        expect(invalid.status).toBe(400)
        expect(create).not.toHaveBeenCalled()
    })

    it("анкета специалиста тоже без имени", async () => {
        const res = await POST(makeReq("/api/auth/register", "POST", {
            ...valid,
            role: "SPECIALIST",
            formData: {phone: "+79990001122", fullName: "Анна Смирнова"},
        }))
        expect(res.status).toBe(200)
        const data = create.mock.calls[0][0].data
        expect(data.specialistProfile.create.formData).toEqual({phone: "+79990001122"})
    })

    it("не регистрирует администратора и повторный email", async () => {
        expect((await POST(makeReq("/api/auth/register", "POST", {...valid, role: "ADMIN"}))).status).toBe(400)

        findUnique.mockResolvedValue({id: "existing"})
        const dup = await POST(makeReq("/api/auth/register", "POST", valid))
        expect(dup.status).toBe(409)
        expect((await dup.json()).code).toBe("ALREADY_REGISTERED")
        expect(create).not.toHaveBeenCalled()
    })
})
