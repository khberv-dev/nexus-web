import {formatFileSize, validateDocumentFile} from "@/lib/document-file"

const file = (name: string, size = 1000, type = "") => ({name, size, type})

describe("validateDocumentFile", () => {
    it("PDF по расширению или MIME проходит", () => {
        expect(validateDocumentFile(file("Договор.PDF"))).toBeNull()
        expect(validateDocumentFile(file("scan", 1000, "application/pdf"))).toBeNull()
    })

    it("отклоняет другой формат и называет допустимые", () => {
        expect(validateDocumentFile(file("photo.jpg", 1000, "image/jpeg"))).toBe("Допустимые форматы: PDF")
        expect(validateDocumentFile(file("scan.png"), ".pdf,.jpg,.jpeg,.png")).toBeNull()
        expect(validateDocumentFile(file("scan.heic", 10, "image/heic"), "image/*")).toBeNull()
    })

    it("проверяет размер и пустой файл", () => {
        expect(validateDocumentFile(file("a.pdf", 0))).toBe("Файл пустой")
        expect(validateDocumentFile(file("a.pdf", 11 * 1024 * 1024))).toBe("Размер файла не должен превышать 10,0 МБ")
        expect(validateDocumentFile(file("a.pdf", 5 * 1024 * 1024))).toBeNull()
    })
})

describe("formatFileSize", () => {
    it("байты, килобайты, мегабайты", () => {
        expect(formatFileSize(512)).toBe("512 Б")
        expect(formatFileSize(2048)).toBe("2 КБ")
        expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1,5 МБ")
    })
})
