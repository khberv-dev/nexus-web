/**
 * Сколько раз заказчик может отправить этап «на доработку» без доплаты
 * (счетчик clientRound после каждого такого перехода).
 * В отдельном модуле без Prisma/pg — безопасно импортировать в Client Components.
 */
export const MAX_FREE_CLIENT_REVISIONS = 3;

/** Порядок этапов проекта (совпадает с Prisma `StageType`). */
export const STAGE_ORDER = ["CONCEPT", "PLANNING", "VISUALIZATION", "DOCUMENTATION", "SPECIFICATION"] as const;
