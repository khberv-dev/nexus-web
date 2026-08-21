/**
 * Шаги экскурсии ссылаются на реальные якоря data-tour в разметке.
 * Селекторы написаны руками, опечатку в них видно только в браузере — этот тест ловит её раньше.
 */

import {readdirSync, readFileSync, statSync} from "node:fs";
import {join} from "node:path";
import {buildClientHintSteps, buildSpecialistHintSteps} from "@/components/app/hint-tour-steps";

function collectAnchors(dir: string, found = new Set<string>()): Set<string> {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectAnchors(full, found);
            continue;
        }
        // Только разметка: если сканировать и .ts, файл со списком шагов подтвердит сам себя
        // своими же селекторами, и тест перестанет ловить опечатки.
        if (!entry.endsWith(".tsx")) continue;
        const src = readFileSync(full, "utf8");
        // data-tour="x" и data-tour={`sidebar-${tab.id}`}
        for (const m of src.matchAll(/data-tour=\{?["`]([^"`$]+)/g)) found.add(m[1]);
    }
    return found;
}

const anchors = collectAnchors(join(process.cwd(), "src"));
const SIDEBAR_TAB_IDS = ["orders", "portfolio", "landing", "payments", "settings", "logout"];

/** sidebar-* якоря строятся динамически из id вкладки — раскрываем их вручную. */
function anchorExists(name: string): boolean {
    if (anchors.has(name)) return true;
    if (name.startsWith("sidebar-")) {
        return anchors.has("sidebar-") && SIDEBAR_TAB_IDS.includes(name.slice("sidebar-".length));
    }
    return false;
}

const noop = () => {
};

describe("hint tour steps", () => {
    const suites = [
        ["specialist", buildSpecialistHintSteps(noop)],
        ["client", buildClientHintSteps(noop)],
    ] as const;

    test.each(suites)("%s steps point at existing anchors", (_role, steps) => {
        for (const step of steps) {
            const m = /^\[data-tour="([^"]+)"\]$/.exec(step.target);
            expect(m).not.toBeNull();
            expect({step: step.title, anchor: m![1], exists: anchorExists(m![1])})
                .toEqual({step: step.title, anchor: m![1], exists: true});
        }
    });

    test.each(suites)("%s steps carry short, non-empty copy", (_role, steps) => {
        for (const step of steps) {
            expect(step.title.trim().length).toBeGreaterThan(0);
            expect(step.text.trim().length).toBeGreaterThan(0);
            // Подсветка объясняет «где», текст — «зачем»: длинные простыни возвращают нас к панели-инструкции.
            expect(step.text.length).toBeLessThanOrEqual(180);
        }
    });

    test("every cabinet section is covered", () => {
        const specialist = buildSpecialistHintSteps(noop).map(s => s.target);
        for (const tab of ["orders", "portfolio", "landing", "payments", "settings"]) {
            expect(specialist).toContain(`[data-tour="sidebar-${tab}"]`);
        }

        const client = buildClientHintSteps(noop).map(s => s.target);
        for (const tab of ["orders", "payments", "settings"]) {
            expect(client).toContain(`[data-tour="sidebar-${tab}"]`);
        }
    });

    test("steps do not repeat the same anchor twice in a row", () => {
        for (const [, steps] of suites) {
            const targets = steps.map(s => s.target);
            for (let i = 1; i < targets.length; i++) {
                expect(targets[i]).not.toBe(targets[i - 1]);
            }
        }
    });
});
