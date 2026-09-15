/**
 * Когда администратор может загрузить исходный договор с платформой.
 *
 * Загруженный договор сразу уходит на подпись, поэтому форма загрузки закрывается,
 * как и у пользователя после отправки подписанного файла. Снова открывается только
 * если договора ещё нет или вторая сторона от него отказалась — нужна новая версия.
 */

const SPECIALIST_REUPLOAD_STATUSES = new Set(["NONE", "DECLINED_BY_SPECIALIST"])
const CLIENT_REUPLOAD_STATUSES = new Set(["NONE", "DECLINED_BY_CLIENT"])

export function canAdminUploadSpecialistContract(status: string | null | undefined, hasFile: boolean): boolean {
    return !hasFile || SPECIALIST_REUPLOAD_STATUSES.has(status ?? "NONE")
}

export function canAdminUploadClientContract(status: string | null | undefined, hasFile: boolean): boolean {
    return !hasFile || CLIENT_REUPLOAD_STATUSES.has(status ?? "NONE")
}

export const ADMIN_CONTRACT_UPLOAD_LOCKED_ERROR =
    "Договор уже отправлен на подпись — загрузить новую версию можно только после отказа"
