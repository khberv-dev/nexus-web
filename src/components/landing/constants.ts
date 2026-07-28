import type { DesignerSlide } from "./designer-profile-modal/types"

export const FALLBACK_SLIDES: DesignerSlide[] = [
  {
    portrait: "/designer-1.jpg", work: "/slider-1.jpg", workPos: "center 40%",
    name: "Анна Соколова", specialty: "Минимализм · Сканди", sqm: 1200, experience: 8, style: "Сканди", has3d: true, hasRd: true,
    bio: "Специализируюсь на скандинавском минимализме для коммерческих пространств.",
    portfolioImages: ["/slider-1.jpg", "/slider-3.jpg", "/slider-5.jpg"],
  },
  {
    portrait: "/designer-2.jpg", work: "/slider-2.jpg", workPos: "center 30%",
    name: "Дмитрий Орлов", specialty: "Лофт · Индастриал", sqm: 850, experience: 5, style: "Лофт", has3d: true, hasRd: false,
    bio: "Создаю индустриальные пространства с характером.",
    portfolioImages: ["/slider-2.jpg", "/slider-4.jpg", "/slider-1.jpg"],
  },
  {
    portrait: "/designer-3.jpg", work: "/slider-3.jpg", workPos: "center 35%",
    name: "Мария Ким", specialty: "Контемпо · Арт-деко", sqm: 2400, experience: 12, style: "Арт-деко", has3d: true, hasRd: true,
    bio: "Дизайнер с международным опытом.",
    portfolioImages: ["/slider-3.jpg", "/slider-5.jpg", "/slider-2.jpg"],
  },
  {
    portrait: "/designer-4.jpg", work: "/slider-4.jpg", workPos: "center 25%",
    name: "Игорь Петров", specialty: "Классика · Неоклассика", sqm: 600, experience: 3, style: "Неоклассика", has3d: false, hasRd: true,
    bio: "Архитектор и дизайнер интерьеров.",
    portfolioImages: ["/slider-4.jpg", "/slider-1.jpg", "/slider-3.jpg"],
  },
  {
    portrait: "/designer-5.jpg", work: "/slider-5.jpg", workPos: "center 20%",
    name: "Юлия Смирнова", specialty: "Эко · Бохо", sqm: 1800, experience: 7, style: "Эко", has3d: true, hasRd: false,
    bio: "Создаю живые пространства с использованием натуральных материалов.",
    portfolioImages: ["/slider-5.jpg", "/slider-2.jpg", "/slider-4.jpg"],
  },
]

/** Статика из анимации OsmoLoader */
export const OSMO_LOADER_IMAGES = [
  "/designer-1.jpg",
  "/designer-3.jpg",
  "/designer-5.jpg",
  "/slider-1.jpg",
] as const
