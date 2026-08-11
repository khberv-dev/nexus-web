/** Публичные вопросы квиза по wire (base64 UTF-8) — в JSON не отдаем открытый текст. */

export type NexusQuizQuestionWire = {
    id: number
    /** section, UTF-8 → base64 */
    s64: string
    /** text, UTF-8 → base64 */
    t64: string
    /** варианты ответа, каждый UTF-8 → base64 */
    o64: readonly string[]
}

export function utf8FromBase64(b64: string): string {
    try {
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return new TextDecoder().decode(bytes)
    } catch {
        return ""
    }
}

export type DecodedQuizQuestion = {
    id: number
    section: string
    text: string
    options: string[]
}

export function decodeQuizQuestionWire(w: NexusQuizQuestionWire): DecodedQuizQuestion {
    return {
        id: w.id,
        section: utf8FromBase64(w.s64),
        text: utf8FromBase64(w.t64),
        options: w.o64.map((x) => utf8FromBase64(x)),
    }
}
