"use client"
import { useState } from "react"
import "./AcademyPage.css"

const COURSES = [
  { id: 1, title: "Основы дизайна интерьера", description: "Вводный курс по основам дизайна интерьера: стили, пространство, цвет.", category: "Дизайн", categoryColor: "#7367f0", rating: 4.4, reviews: "1.23k", duration: "30 минут", progress: 65, completed: false, image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&q=80" },
  { id: 2, title: "Figma для дизайнеров", description: "Вводный курс по Figma: компоненты, прототипирование, автолейаут.", category: "UI/UX", categoryColor: "#ea5455", rating: 4.2, reviews: "424", duration: "16 часов", progress: 30, completed: false, image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80" },
  { id: 3, title: "Работа с клиентами", description: "Как вести переговоры, составлять бриф и управлять ожиданиями заказчика.", category: "Бизнес", categoryColor: "#28c76f", rating: 5.0, reviews: "12", duration: "7 часов", progress: 80, completed: false, image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?w=600&q=80" },
  { id: 4, title: "3D-визуализация", description: "Создание фотореалистичных визуализаций интерьера в 3ds Max и Corona.", category: "3D", categoryColor: "#00cfe8", rating: 3.8, reviews: "634", duration: "30 минут", progress: 45, completed: false, image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=600&q=80" },
  { id: 5, title: "Цвет и свет в интерьере", description: "Теория цвета, световые сценарии и подбор материалов для проекта.", category: "Дизайн", categoryColor: "#7367f0", rating: 4.7, reviews: "34", duration: undefined, progress: 100, completed: true, image: "https://images.unsplash.com/photo-1544717297-fa95b6ee9643?w=600&q=80" },
  { id: 6, title: "Рабочая документация", description: "Как правильно оформлять чертежи, спецификации и альбомы для строителей.", category: "Документация", categoryColor: "#ff9f43", rating: 3.6, reviews: "2.5k", duration: "16 часов", progress: 55, completed: false, image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80" },
]

const CATEGORIES = ["Все курсы", "Дизайн", "UI/UX", "Бизнес", "3D", "Документация"]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="course-rating">
      {[1, 2, 3, 4, 5].map(s => <span key={s} className={`star${s <= Math.round(rating) ? " filled" : ""}`}>★</span>)}
    </div>
  )
}

function CourseCard({ course }: { course: typeof COURSES[0] }) {
  return (
    <div className="course-card">
      <div className="course-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={course.image} alt={course.title} className="course-img" />
      </div>
      <div className="course-body">
        <div className="course-meta">
          <span className="course-tag" style={{ backgroundColor: course.categoryColor + "22", color: course.categoryColor }}>{course.category}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <StarRating rating={course.rating} />
            <span className="rating-number">{course.rating}</span>
            <span className="rating-reviews">({course.reviews})</span>
          </div>
        </div>
        <h3 className="course-title">{course.title}</h3>
        <p className="course-desc">{course.description}</p>
        <div className="course-footer">
          {course.completed
            ? <div className="course-completed-label">✓ Завершен</div>
            : <div className="course-duration">⏱ {course.duration}</div>
          }
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${course.progress}%` }} />
          </div>
          <div className="course-actions">
            <button className="btn-outline">↺ Начать заново</button>
            {!course.completed && <button className="btn-primary-acad">Продолжить ›</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AcademyPage() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Все курсы")
  const [hideCompleted, setHideCompleted] = useState(false)
  const [page, setPage] = useState(1)
  const PER_PAGE = 6

  const filtered = COURSES.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === "Все курсы" || c.category === category
    const matchCompleted = hideCompleted ? !c.completed : true
    return matchSearch && matchCat && matchCompleted
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="academy-page">
      {/* Hero */}
      <div className="academy-hero">
        <div className="hero-left">💡</div>
        <div className="hero-center">
          <h1>Образование, навыки и карьерные возможности. <span className="hero-accent">Все в одном месте.</span></h1>
          <p>Развивайте навыки с надежными онлайн-курсами по дизайну интерьера, визуализации, работе с клиентами и документации.</p>
          <div className="hero-search">
            <input type="text" placeholder="Найти курс" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            <button>🔍</button>
          </div>
        </div>
        <div className="hero-right">🚀</div>
      </div>

      {/* Courses */}
      <div className="academy-courses-section">
        <div className="courses-header">
          <div>
            <h2>Мои курсы</h2>
            <p>Всего {filtered.length} {filtered.length === 1 ? "курс" : filtered.length < 5 ? "курса" : "курсов"}</p>
          </div>
          <div className="courses-controls">
            <select value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <label className="toggle-label">
              <span>Скрыть завершенные</span>
              <div className={`toggle${hideCompleted ? " on" : ""}`} role="switch" aria-checked={hideCompleted} tabIndex={0} onClick={() => setHideCompleted(v => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHideCompleted(v => !v) } }}>
                <div className="toggle-knob" />
              </div>
            </label>
          </div>
        </div>

        <div className="courses-grid">
          {paginated.length > 0
            ? paginated.map(course => <CourseCard key={course.id} course={course} />)
            : <p className="no-courses">Курсы не найдены.</p>
          }
        </div>

        {totalPages > 1 && (
          <div className="acad-pagination">
            <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={page === p ? "active" : ""} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
          </div>
        )}
      </div>

      {/* Banners */}
      <div className="academy-banners">
        <div className="banner banner-purple">
          <div className="banner-text">
            <h3>Получите сертификат</h3>
            <p>Выберите подходящую программу сертификации для специалиста.</p>
            <button className="btn-primary-acad" style={{ flex: "none", padding: "10px 20px" }}>Смотреть программы</button>
          </div>
          <div className="banner-emoji">👩‍💻</div>
        </div>
        <div className="banner banner-pink">
          <div className="banner-text">
            <h3>Лучшие курсы</h3>
            <p>Запишитесь на самые популярные и высокооцененные курсы.</p>
            <button className="btn-danger-acad">Смотреть курсы</button>
          </div>
          <div className="banner-emoji">👩‍🎓</div>
        </div>
      </div>
    </div>
  )
}
