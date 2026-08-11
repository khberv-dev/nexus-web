"use client"
import {useState} from "react"
import {
    closestCorners,
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragOverlay,
    DragStartEvent,
    PointerSensor,
    useDroppable,
    useSensor,
    useSensors
} from "@dnd-kit/core"
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable"
import {CSS} from "@dnd-kit/utilities"
import "./KanbanBoard.css"

interface Card {
    id: string
    title: string
    tag: string
    tagColor: string
    hours: number
    avatars: string[]
    description: string
    tasks: string[]
    reuse?: string
    warning?: string
}

const initialData = {
    columns: {
        "todo": {
            id: "todo",
            title: "К выполнению",
            cardIds: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12", "c13"]
        },
        "in-progress": {id: "in-progress", title: "В работе", cardIds: []},
        "review": {id: "review", title: "На проверке", cardIds: []},
        "done": {id: "done", title: "Готово", cardIds: []},
    } as Record<string, { id: string; title: string; cardIds: string[] }>,
    columnOrder: ["todo", "in-progress", "review", "done"],
    cards: {
        "c1": {
            id: "c1", title: "Инфраструктура и DevOps", tag: "DevOps", tagColor: "#7367f0", hours: 24, avatars: ["А"],
            description: "Развертывание всех сервисов платформы и настройка окружений.",
            tasks: ["Zitadel (OIDC/IAM)", "PostgreSQL + Redis", "S3-хранилище (MinIO)", "Nginx reverse proxy", "Docker Compose для всех сервисов", "CI/CD pipeline", "Окружения: dev / staging / prod"],
            reuse: "docker-compose структура, конфиг Nginx, CI-шаблоны из AdQuest",
        },
        "c2": {
            id: "c2",
            title: "Аутентификация и роли (Zitadel)",
            tag: "Auth",
            tagColor: "#00cfe8",
            hours: 28,
            avatars: ["Б"],
            description: "Интеграция Next.js с Zitadel через OIDC. Middleware для трех ролей.",
            tasks: ["NextAuth + Zitadel OIDC", "Middleware: CLIENT / SPECIALIST / ADMIN", "Зеркальная таблица User в БД", "Приглашение пользователей через Zitadel Management API", "Назначение роли, деактивация", "UI управления пользователями в админке"],
            reuse: "JWKS/JWT flow, service account клиент, компоненты управления пользователями из AdQuest CRM",
        },
        "c3": {
            id: "c3", title: "Схема БД и миграции (Prisma)", tag: "БД", tagColor: "#28c76f", hours: 12, avatars: ["А"],
            description: "Полная Prisma-схема и миграционные скрипты.",
            tasks: ["User, SpecialistProfile, OnboardingStep", "Order, Brief, ProjectStage", "StageFile, StageReview", "Payment, ExtraPayment", "Seed-данные для тестирования", "Миграционные скрипты"],
        },
        "c4": {
            id: "c4", title: "Онбординг специалиста", tag: "Онбординг", tagColor: "#ff9f43", hours: 32, avatars: ["В"],
            description: "Форма анкеты и статусная машина онбординга специалиста.",
            tasks: ["Форма анкеты кандидата", "Статусная машина: PENDING → TEST_INVITED → INTERVIEW_INVITED → REGULATIONS → CONTRACT → ACTIVE | REJECTED", "Интерфейс администратора: просмотр анкеты, перевод по статусам", "Комментарий при отказе", "Email-уведомления при каждой смене статуса"],
            reuse: "UI-компоненты из AdQuest CRM, паттерны email-уведомлений",
            warning: "Тексты писем, поля анкеты и чек-листы предоставляет заказчик до начала блока",
        },
        "c5": {
            id: "c5",
            title: "Регистрация заказчика и бриф",
            tag: "Клиент",
            tagColor: "#ea5455",
            hours: 24,
            avatars: ["Б"],
            description: "Регистрация заказчика, заполнение брифа и назначение специалиста.",
            tasks: ["Регистрационная форма заказчика", "Форма брифа", "Модерация брифа администратором (одобрить / вернуть, 1 круг)", "Назначение специалиста администратором", "Уведомление специалиста о новом заказе"],
            reuse: "UI-компоненты форм из AdQuest CRM",
            warning: "Поля и структуру брифа предоставляет заказчик до начала блока",
        },
        "c6": {
            id: "c6",
            title: "Стейт-машина проекта (3 этапа)",
            tag: "Ядро",
            tagColor: "#ea5455",
            hours: 40,
            avatars: ["А", "Б"],
            description: "Три последовательных этапа проекта с модерацией и согласованием. Ядро продукта.",
            tasks: ["Этапы: Планировочное решение → Визуализация → Рабочая документация", "Загрузка файлов специалистом", "Модерация администратором (1 бесплатный круг, далее штраф)", "Согласование заказчиком (до 3 раундов бесплатно, далее доплата)", "Статусы: PENDING | UPLOADED | MOD_REVIEW | MOD_REVISION | CLIENT_REVIEW | CLIENT_REVISION | APPROVED | EXTRA_PAYMENT"],
            warning: "Чек-листы модерации для каждого этапа предоставляет заказчик",
        },
        "c7": {
            id: "c7",
            title: "Загрузка и хранение файлов (S3)",
            tag: "S3",
            tagColor: "#00cfe8",
            hours: 16,
            avatars: ["А"],
            description: "Интеграция с S3 для хранения тяжелых файлов дизайн-проектов.",
            tasks: ["Интеграция с S3 (MinIO self-hosted или AWS S3)", "Загрузка файлов по этапам", "Версионирование файлов внутри этапа", "Просмотр в браузере (изображения)", "Скачивание (PDF и др.)"],
        },
        "c8": {
            id: "c8", title: "Оплата (T-Bank)", tag: "Оплата", tagColor: "#28c76f", hours: 20, avatars: ["В"],
            description: "Адаптация готового Rust-модуля T-Bank под сценарий платформы.",
            tasks: ["Удержание 100% суммы при подтверждении заказа", "Выплата специалисту после подписания акта", "Webhook-обработчик статусов", "Выставление счета на дополнительные правки", "Кнопка инициации выплаты в админке"],
            reuse: "Rust-модуль T-Bank из AdQuest — адаптация под новый сценарий",
            warning: "Нужны merchant credentials T-Bank от заказчика. Автоматические сплит-выплаты — этап 2.",
        },
        "c9": {
            id: "c9", title: "Email-уведомления", tag: "Email", tagColor: "#7367f0", hours: 12, avatars: ["Б"],
            description: "Уведомления через Resend (или SMTP заказчика) по всем триггерам.",
            tasks: ["Смена статуса онбординга", "Новый заказ назначен специалисту", "Загрузка файла на этап", "Результат модерации", "Решение заказчика по этапу", "Оплата и доплата", "HTML-шаблоны писем"],
            reuse: "Паттерны из AdQuest",
            warning: "Тексты всех уведомлений предоставляет заказчик",
        },
        "c10": {
            id: "c10",
            title: "Административная панель",
            tag: "Админ",
            tagColor: "#ff9f43",
            hours: 32,
            avatars: ["А", "В"],
            description: "Полный интерфейс администратора для управления платформой.",
            tasks: ["Дашборд: сводка по активным проектам и специалистам", "Управление онбордингом специалистов", "Список заказов с текущим этапом", "Модерация файлов (просмотр, вердикт, комментарий)", "Управление платежами", "Управление пользователями через Zitadel UI"],
            reuse: "UI-шаблон администратора + компоненты AdQuest CRM",
        },
        "c11": {
            id: "c11",
            title: "Личный кабинет специалиста",
            tag: "Специалист",
            tagColor: "#7367f0",
            hours: 20,
            avatars: ["Б"],
            description: "Интерфейс специалиста для работы с назначенными проектами.",
            tasks: ["Список назначенных заказов", "Прогресс по этапам проекта", "Загрузка файлов на каждый этап", "Просмотр комментариев от модератора и заказчика", "История платежей"],
            reuse: "UI-компоненты из AdQuest CRM",
        },
        "c12": {
            id: "c12",
            title: "Личный кабинет заказчика",
            tag: "Заказчик",
            tagColor: "#00cfe8",
            hours: 16,
            avatars: ["В"],
            description: "Интерфейс заказчика для отслеживания проекта и согласования.",
            tasks: ["Статус проекта и текущий этап", "Просмотр загруженных материалов", "Согласование / отклонение с комментарием", "История оплат и актов"],
            reuse: "UI-компоненты из AdQuest CRM",
        },
        "c13": {
            id: "c13", title: "Тестирование и запуск", tag: "QA", tagColor: "#28c76f", hours: 20, avatars: ["А", "Б"],
            description: "Финальное тестирование всех сценариев и деплой на production.",
            tasks: ["Функциональное тестирование всех бизнес-сценариев", "Нагрузочное тестирование загрузки файлов", "Исправление критических багов", "Деплой на production", "Передача документации и инструкции по эксплуатации"],
        },
    } as Record<string, Card>,
}

const AVATAR_COLORS = ["#7367f0", "#28c76f", "#ea5455", "#ff9f43", "#00cfe8"]

function CardModal({card, onClose}: { card: Card; onClose: () => void }) {
    return (
        <>
            <div className="modal fade show d-block" tabIndex={-1} onClick={onClose}>
                <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <div>
                                <span className="kanban-tag me-2" style={{
                                    backgroundColor: card.tagColor + "22",
                                    color: card.tagColor
                                }}>{card.tag}</span>
                                <h5 className="modal-title d-inline">{card.title}</h5>
                            </div>
                            <button type="button" className="btn-close" onClick={onClose}/>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-3">{card.description}</p>

                            <div className="d-flex gap-4 mb-4">
                                <div>
                                    <small className="text-muted d-block">Оценка</small>
                                    <span className="fw-semibold">⏱ {card.hours} ч</span>
                                </div>
                                <div>
                                    <small className="text-muted d-block">Исполнители</small>
                                    <div className="kanban-avatars mt-1">
                                        {card.avatars.map((letter, i) => (
                                            <span key={i} className="kanban-avatar"
                                                  style={{backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length]}}>{letter}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <h6 className="fw-semibold mb-2">Задачи блока</h6>
                            <ul className="list-unstyled mb-3">
                                {card.tasks.map((t, i) => (
                                    <li key={i} className="d-flex align-items-start gap-2 mb-2">
                                        <i className="bx bx-check-circle text-success mt-1" style={{flexShrink: 0}}/>
                                        <span className="small">{t}</span>
                                    </li>
                                ))}
                            </ul>

                            {card.reuse && (
                                <div className="alert alert-primary py-2 mb-3">
                                    <i className="bx bx-recycle me-2"/>
                                    <strong>Повторное использование:</strong> {card.reuse}
                                </div>
                            )}

                            {card.warning && (
                                <div className="alert alert-warning py-2 mb-0">
                                    <i className="bx bx-error me-2"/>
                                    {card.warning}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"/>
        </>
    )
}

function KanbanCard({card, isDragging, onClick}: { card: Card; isDragging?: boolean; onClick?: () => void }) {
    const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id: card.id})

    return (
        <div
            ref={setNodeRef}
            style={{transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1}}
            className={`kanban-card${isDragging ? " dragging" : ""}`}
            {...attributes}
            {...listeners}
            onClick={onClick}
        >
            <span className="kanban-tag"
                  style={{backgroundColor: card.tagColor + "22", color: card.tagColor}}>{card.tag}</span>
            <p className="kanban-card-title">{card.title}</p>
            <div className="kanban-card-footer">
                <div className="kanban-card-meta">
                    <span>⏱ {card.hours} ч</span>
                    <span className="text-muted small">{card.tasks.length} задач</span>
                </div>
                <div className="kanban-avatars">
                    {card.avatars.map((letter, i) => (
                        <span key={i} className="kanban-avatar"
                              style={{backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length]}}>{letter}</span>
                    ))}
                </div>
            </div>
        </div>
    )
}

function KanbanColumn({column, cards, onCardClick}: {
    column: { id: string; title: string; cardIds: string[] };
    cards: Card[];
    onCardClick: (card: Card) => void
}) {
    const {setNodeRef} = useDroppable({id: column.id})
    const totalHours = cards.reduce((s, c) => s + c.hours, 0)
    return (
        <div className="kanban-column">
            <div className="kanban-column-header">
                <h3>{column.title} <span style={{fontSize: 12, color: "#999", fontWeight: 400}}>({cards.length})</span>
                </h3>
                {totalHours > 0 &&
                    <span style={{fontSize: 11, color: "#7367f0", fontWeight: 600}}>{totalHours} ч</span>}
            </div>
            <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="kanban-cards-list" ref={setNodeRef}>
                    {cards.map(card => <KanbanCard key={card.id} card={card} onClick={() => onCardClick(card)}/>)}
                </div>
            </SortableContext>
        </div>
    )
}

export default function MvpKanban() {
    const [data, setData] = useState(initialData)
    const [activeCard, setActiveCard] = useState<Card | null>(null)
    const [modalCard, setModalCard] = useState<Card | null>(null)

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 8}}))
    const findCol = (cardId: string) => Object.values(data.columns).find(col => col.cardIds.includes(cardId))?.id

    const handleDragStart = ({active}: DragStartEvent) => setActiveCard(data.cards[String(active.id)])

    const handleDragOver = ({active, over}: DragOverEvent) => {
        if (!over) return
        const fromCol = findCol(String(active.id))
        const toCol = data.columns[String(over.id)] ? String(over.id) : findCol(String(over.id))
        if (!fromCol || !toCol || fromCol === toCol) return
        setData(prev => {
            const src = [...prev.columns[fromCol].cardIds]
            const dst = [...prev.columns[toCol].cardIds]
            src.splice(src.indexOf(String(active.id)), 1)
            dst.push(String(active.id))
            return {
                ...prev,
                columns: {
                    ...prev.columns,
                    [fromCol]: {...prev.columns[fromCol], cardIds: src},
                    [toCol]: {...prev.columns[toCol], cardIds: dst}
                }
            }
        })
    }

    const handleDragEnd = ({active, over}: DragEndEvent) => {
        setActiveCard(null)
        if (!over) return
        const colId = findCol(String(active.id))
        if (!colId) return
        const cards = data.columns[colId].cardIds
        const oldIdx = cards.indexOf(String(active.id))
        const newIdx = cards.indexOf(String(over.id))
        if (oldIdx !== newIdx && newIdx !== -1)
            setData(prev => ({
                ...prev,
                columns: {...prev.columns, [colId]: {...prev.columns[colId], cardIds: arrayMove(cards, oldIdx, newIdx)}}
            }))
    }

    const totalHours = Object.values(data.cards).reduce((s, c) => s + c.hours, 0)
    const doneHours = data.columns["done"].cardIds.reduce((s, id) => s + data.cards[id].hours, 0)

    return (
        <>
            <div className="card mb-4">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold">Прогресс MVP</span>
                        <span className="text-muted small">{doneHours} / {totalHours} ч</span>
                    </div>
                    <div className="progress" style={{height: 8}}>
                        <div className="progress-bar bg-primary"
                             style={{width: `${Math.round(doneHours / totalHours * 100)}%`}}/>
                    </div>
                    <div className="d-flex gap-3 mt-2">
                        {data.columnOrder.map(colId => {
                            const col = data.columns[colId]
                            const colors: Record<string, string> = {
                                "todo": "secondary",
                                "in-progress": "warning",
                                "review": "info",
                                "done": "success"
                            }
                            return <span key={colId}
                                         className={`badge bg-label-${colors[colId]}`}>{col.title}: {col.cardIds.length}</span>
                        })}
                    </div>
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart}
                        onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
                <div className="kanban-board">
                    {data.columnOrder.map(colId => (
                        <KanbanColumn key={colId} column={data.columns[colId]}
                                      cards={data.columns[colId].cardIds.map(id => data.cards[id])}
                                      onCardClick={setModalCard}/>
                    ))}
                </div>
                <DragOverlay>{activeCard ? <KanbanCard card={activeCard} isDragging/> : null}</DragOverlay>
            </DndContext>

            {modalCard && <CardModal card={modalCard} onClose={() => setModalCard(null)}/>}
        </>
    )
}
