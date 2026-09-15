/**
 * Каждая экскурсия подсвечивает только те элементы, которые есть на её собственной странице.
 *
 * Якоря собираются не по всему src, а по графу импортов конкретного роута: иначе шаг,
 * указывающий на элемент соседней страницы (например, дашбордный `dash-hero` в экскурсии
 * по кабинету /work/<section>), тихо проходил бы проверку — селектор в src существует, но на этой
 * странице его нет, и HintTour молча пропустит шаг.
 */

import {existsSync, readFileSync, statSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {
    buildClientHintSteps,
    buildSpecialistDashboardHintSteps,
    buildSpecialistHintSteps,
} from "@/components/app/hint-tour-steps";

/** `@/x` → src/x, `./x` — от файла. Внешние пакеты пропускаем. */
function resolveImport(spec: string, fromFile: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = join(process.cwd(), "src", spec.slice(2));
    else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
    else return null;

    for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
}

/**
 * Якоря data-tour во всех модулях, достижимых по импортам из точек входа роута.
 * Кабинет — это layout плюс страницы разделов: экскурсия переходит между ними,
 * поэтому точек входа несколько.
 */
function pageAnchors(...entries: string[]): Set<string> {
    const anchors = new Set<string>();
    const seen = new Set<string>();
    const stack = [...entries];

    while (stack.length > 0) {
        const file = stack.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);

        const src = readFileSync(file, "utf8");
        // data-tour="x", data-tour={`nav-${id}`} и проброс через проп dataTour="x".
        for (const m of src.matchAll(/data-?[tT]our=\{?["`]([^"`$]+)/g)) anchors.add(m[1]);
        for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
            const next = resolveImport(m[1], file);
            if (next) stack.push(next);
        }
    }
    return anchors;
}

const page = (p: string) => join(process.cwd(), p);

const NAV_TAB_IDS = ["home", "orders", "portfolio", "landing", "payments", "settings"];

/** `data-tour={`nav-${item.id}`}` на вкладке шапки собирается в рантайме — раскрываем префикс вручную. */
function anchorExists(anchors: Set<string>, name: string): boolean {
    if (anchors.has(name)) return true;
    if (name.startsWith("nav-") && anchors.has("nav-")) {
        return NAV_TAB_IDS.includes(name.slice("nav-".length));
    }
    return false;
}

const noop = () => {
};

const suites = [
    [
        "specialist cabinet (/work/<section>)",
        buildSpecialistHintSteps(noop),
        pageAnchors(
            page("src/app/(dashboard)/work/(cabinet)/layout.tsx"),
            ...["orders", "portfolio", "landing", "payments", "settings"]
                .map(section => page(`src/app/(dashboard)/work/(cabinet)/${section}/page.tsx`)),
        ),
    ],
    [
        "specialist dashboard (/work)",
        buildSpecialistDashboardHintSteps(),
        pageAnchors(page("src/app/(dashboard)/work/page.tsx")),
    ],
    [
        "client cabinet (/orders[/<section>])",
        buildClientHintSteps(noop),
        pageAnchors(
            page("src/app/orders/(cabinet)/layout.tsx"),
            page("src/app/orders/(cabinet)/page.tsx"),
            page("src/app/orders/(cabinet)/payments/page.tsx"),
            page("src/app/orders/(cabinet)/settings/page.tsx"),
        ),
    ],
] as const;

describe("hint tour steps", () => {
    test.each(suites)("%s — every step points at an anchor rendered on that page", (_name, steps, anchors) => {
        for (const step of steps) {
            const m = /^\[data-tour="([^"]+)"\]$/.exec(step.target);
            expect(m).not.toBeNull();
            expect({step: step.title, anchor: m![1], onThisPage: anchorExists(anchors, m![1])})
                .toEqual({step: step.title, anchor: m![1], onThisPage: true});
        }
    });

    test.each(suites)("%s — steps carry short, non-empty copy", (_name, steps) => {
        for (const step of steps) {
            expect(step.title.trim().length).toBeGreaterThan(0);
            expect(step.text.trim().length).toBeGreaterThan(0);
            // Подсветка объясняет «где», текст — «зачем»: длинные простыни возвращают нас к панели-инструкции.
            expect(step.text.length).toBeLessThanOrEqual(180);
        }
    });

    test.each(suites)("%s — steps do not repeat the same anchor twice in a row", (_name, steps) => {
        const targets = steps.map(s => s.target);
        for (let i = 1; i < targets.length; i++) {
            expect(targets[i]).not.toBe(targets[i - 1]);
        }
    });

    test("экскурсия по /work не тянет якоря кабинета и наоборот", () => {
        const dashboard = buildSpecialistDashboardHintSteps().map(s => s.target);
        const cabinet = buildSpecialistHintSteps(noop).map(s => s.target);

        // Пересекаться могут только элементы общей оболочки (шапка, кнопка «?»).
        const shared = dashboard.filter(t => cabinet.includes(t));
        expect(shared).toEqual(['[data-tour="header-bell"]', '[data-tour="btn-hints"]']);
    });

    test("every cabinet section is covered", () => {
        const specialist = buildSpecialistHintSteps(noop).map(s => s.target);
        for (const tab of ["orders", "portfolio", "landing", "payments", "settings"]) {
            expect(specialist).toContain(`[data-tour="nav-${tab}"]`);
        }

        const client = buildClientHintSteps(noop).map(s => s.target);
        for (const tab of ["orders", "payments", "settings"]) {
            expect(client).toContain(`[data-tour="nav-${tab}"]`);
        }
    });
});

describe("экскурсия по стартовому экрану /work", () => {
    const steps = buildSpecialistDashboardHintSteps();

    test("остаётся короткой: разделы и навигация, а не каждая кнопка", () => {
        expect(steps.length).toBeLessThanOrEqual(10);
    });

    test("покрывает разделы страницы, вкладки шапки и уведомления", () => {
        const targets = steps.map(s => s.target);
        for (const anchor of [
            "dash-hero",
            "dash-stats",
            "dash-urgent",
            "dash-orders",
            "dash-quick-links",
            "header-nav",
            "header-bell",
        ]) {
            expect(targets).toContain(`[data-tour="${anchor}"]`);
        }
    });

    test("не переключает разделы: на /work их нет, в отличие от кабинета /work/<section>", () => {
        expect(steps.filter(s => s.before !== undefined)).toEqual([]);
    });
});
