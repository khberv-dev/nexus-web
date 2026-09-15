import {
    formatUserName,
    MAX_NAME_PART_LENGTH,
    parseNameParts,
    splitFullName,
    userDisplayName,
    userInitial,
} from "@/lib/user-name"

describe("formatUserName", () => {
    it("склеивает имя и фамилию", () => {
        expect(formatUserName({firstName: "Иван", lastName: "Петров"})).toBe("Иван Петров")
    })

    it("пропускает пустые части и лишние пробелы", () => {
        expect(formatUserName({firstName: "  Иван ", lastName: null})).toBe("Иван")
        expect(formatUserName({firstName: "", lastName: "Петров"})).toBe("Петров")
        expect(formatUserName({firstName: null, lastName: undefined})).toBe("")
        expect(formatUserName(null)).toBe("")
    })
})

describe("userDisplayName / userInitial", () => {
    it("без имени показывает почту, без почты — запасную подпись", () => {
        expect(userDisplayName({firstName: "Анна", lastName: "Смирнова", email: "a@x.ru"})).toBe("Анна Смирнова")
        expect(userDisplayName({firstName: null, lastName: null, email: "a@x.ru"})).toBe("a@x.ru")
        expect(userDisplayName({email: null}, "Специалист")).toBe("Специалист")
    })

    it("берёт первую букву отображаемого имени", () => {
        expect(userInitial({firstName: "анна", email: "z@x.ru"})).toBe("А")
        expect(userInitial({email: "zoe@x.ru"})).toBe("Z")
        expect(userInitial(null)).toBe("?")
    })
})

describe("splitFullName", () => {
    it("первое слово — имя, остаток — фамилия", () => {
        expect(splitFullName("Иван Петров")).toEqual({firstName: "Иван", lastName: "Петров"})
        expect(splitFullName("Anna Maria  von Trapp")).toEqual({firstName: "Anna", lastName: "Maria von Trapp"})
    })

    it("одно слово и пустая строка", () => {
        expect(splitFullName("Иван")).toEqual({firstName: "Иван", lastName: null})
        expect(splitFullName("   ")).toEqual({firstName: null, lastName: null})
        expect(splitFullName(null)).toEqual({firstName: null, lastName: null})
    })
})

describe("parseNameParts", () => {
    it("при регистрации требует обе части", () => {
        expect(parseNameParts({firstName: "", lastName: "Петров"}, {required: true})).toEqual({error: "Введите имя"})
        expect(parseNameParts({firstName: "Иван"}, {required: true})).toEqual({error: "Введите фамилию"})
        expect(parseNameParts({firstName: " Иван ", lastName: "Петров"}, {required: true}))
            .toEqual({firstName: "Иван", lastName: "Петров"})
    })

    it("в редактировании пустые значения становятся null", () => {
        expect(parseNameParts({firstName: "", lastName: undefined})).toEqual({firstName: null, lastName: null})
    })

    it("отклоняет не-строки и слишком длинные значения", () => {
        expect(parseNameParts({firstName: 42})).toEqual({error: "Имя имеет неверный формат"})
        expect(parseNameParts({lastName: ["x"]})).toEqual({error: "Фамилия имеет неверный формат"})
        expect(parseNameParts({firstName: "a".repeat(MAX_NAME_PART_LENGTH + 1), lastName: "b"}))
            .toHaveProperty("error")
    })
})
