/**
 * Единые URL «дома» кабинетов для логотипа NEXUS в шапке.
 * Новые страницы кабинета импортируют отсюда, а не дублируют строки.
 */
export const CLIENT_CABINET_LOGO_HREF = "/orders" as const
export const SPECIALIST_CABINET_LOGO_HREF = "/work/community" as const

/**
 * «Главная» специалиста: стартовый экран со сводкой, куда попадает специалист
 * сразу после входа (см. src/app/(auth)/auth/continue/page.tsx).
 * Отличается от SPECIALIST_CABINET_LOGO_HREF — тот ведёт в кабинет с вкладками.
 */
export const SPECIALIST_CABINET_HOME_HREF = "/work" as const
