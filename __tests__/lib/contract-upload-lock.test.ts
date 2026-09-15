import {canAdminUploadClientContract, canAdminUploadSpecialistContract} from "@/lib/contract-upload-lock"

describe("загрузка договора администратором", () => {
    it("открыта, пока договора нет", () => {
        expect(canAdminUploadSpecialistContract("NONE", false)).toBe(true)
        expect(canAdminUploadSpecialistContract(undefined, false)).toBe(true)
        expect(canAdminUploadClientContract("NONE", false)).toBe(true)
        // Файла нет, а статус «застрял» — всё равно можно загрузить.
        expect(canAdminUploadClientContract("AWAITING_SIGNATURE", false)).toBe(true)
    })

    it.each(["AWAITING_SIGNATURE", "SIGNED_BY_SPECIALIST", "SIGNED_BY_ADMIN"])(
        "закрыта для специалиста после отправки (%s)",
        (status) => expect(canAdminUploadSpecialistContract(status, true)).toBe(false),
    )

    it.each(["AWAITING_SIGNATURE", "SIGNED_BY_CLIENT", "SIGNED_BY_ADMIN"])(
        "закрыта для заказчика после отправки (%s)",
        (status) => expect(canAdminUploadClientContract(status, true)).toBe(false),
    )

    it("снова открывается после отказа второй стороны", () => {
        expect(canAdminUploadSpecialistContract("DECLINED_BY_SPECIALIST", true)).toBe(true)
        expect(canAdminUploadClientContract("DECLINED_BY_CLIENT", true)).toBe(true)
        // Отказ другой роли не открывает чужую форму.
        expect(canAdminUploadSpecialistContract("DECLINED_BY_CLIENT", true)).toBe(false)
    })
})
