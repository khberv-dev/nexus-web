export const ROLES = [
    {role: "SPECIALIST", label: "Дизайнер", desc: "Портфолио и заказы"},
    {role: "CLIENT", label: "Заказчик", desc: "Разместить проект"},
    {role: "ADMIN", label: "Администратор", desc: "Панель управления"},
] as const

export type LoginRole = (typeof ROLES)[number]["role"]

export const AUTH_CALLBACK = "/auth/continue"

/** Согласие на обработку ПДн (единая страница; `/legal/personal-data` редиректит сюда) */
export const LEGAL_PERSONAL_DATA_HREF = "/privacy"

export const ROLE_H = 72
export const ROLE_GAP = 10
/** Ширина боковых кнопок = ширина карточек ролей (десктоп) */
export const PANEL_W = 260

/** Модалка «Регистрация заказчика» на /login — остальное в кабинете / онбординге */
export const CLIENT_MODAL_FIELDS = [
    {name: "email", label: "Email", type: "email", placeholder: "you@company.com", required: true},
    {name: "fullName", label: "ФИО", type: "text", placeholder: "Иван Иванов", required: true},
] as const

export const SPECIALIST_REGISTER_FIELDS = [
    {name: "email", label: "Email", type: "email", ph: "you@mail.com", req: true},
    {name: "fullName", label: "ФИО", type: "text", ph: "Иван Иванов", req: true},
] as const

export const MOBILE_MQ = "(max-width: 640px)"

export const GLASS_CARD = {
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 18,
    boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
} as const

export const AUTH_FONT = "'PP Neue Montreal', 'Inter', Arial, sans-serif"
