/**
 * @jest-environment jsdom
 *
 * Компонент-тест слоя подсказок. Без JSX: jest.config собирает только *.test.ts,
 * поэтому используем React.createElement напрямую.
 */

import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {HintTour, hasSeenHintTour, markHintTourSeen, resetHintTour, type HintStep} from "@/components/app/HintTour";

const KEY = "test:v1:user@example.com";

function anchor(id: string): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute("data-tour", id);
    document.body.appendChild(el);
    return el;
}

function renderTour(steps: HintStep[], props: Record<string, unknown> = {}) {
    return render(createElement(HintTour, {steps, storageKey: KEY, ...props}));
}

/** Шаг измеряется через таймеры и rAF — прогоняем их. */
async function settle() {
    await act(async () => {
        jest.advanceTimersByTime(600);
    });
}

describe("HintTour", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        window.localStorage.clear();
        document.body.innerHTML = "";
        Element.prototype.scrollIntoView = jest.fn();
    });

    afterEach(() => {
        cleanup();
        jest.useRealTimers();
    });

    test("shows the first step on a first visit", async () => {
        anchor("a");
        renderTour([{target: '[data-tour="a"]', title: "Проекты", text: "Ваши заказы"}]);
        await settle();

        expect(screen.getByText("Проекты")).toBeTruthy();
        expect(screen.getByText("Ваши заказы")).toBeTruthy();
        expect(screen.getByText("1/1")).toBeTruthy();
    });

    test("stays hidden once the tour was seen", async () => {
        anchor("a");
        markHintTourSeen(KEY);
        renderTour([{target: '[data-tour="a"]', title: "Проекты", text: "Ваши заказы"}]);
        await settle();

        expect(screen.queryByText("Проекты")).toBeNull();
    });

    test("stays hidden when disabled (e.g. onboarding not finished)", async () => {
        anchor("a");
        renderTour([{target: '[data-tour="a"]', title: "Проекты", text: "Ваши заказы"}], {enabled: false});
        await settle();

        expect(screen.queryByText("Проекты")).toBeNull();
    });

    test("walks through steps and marks the tour seen at the end", async () => {
        anchor("a");
        anchor("b");
        renderTour([
            {target: '[data-tour="a"]', title: "Шаг 1", text: "Первый"},
            {target: '[data-tour="b"]', title: "Шаг 2", text: "Второй"},
        ]);
        await settle();

        expect(screen.getByText("Шаг 1")).toBeTruthy();
        expect(screen.getByText("Дальше")).toBeTruthy();

        fireEvent.click(screen.getByText("Дальше"));
        await settle();
        expect(screen.getByText("Шаг 2")).toBeTruthy();
        // На последнем шаге кнопка меняет подпись.
        expect(screen.getByText("Понятно")).toBeTruthy();
        expect(hasSeenHintTour(KEY)).toBe(false);

        fireEvent.click(screen.getByText("Понятно"));
        await settle();
        expect(screen.queryByText("Шаг 2")).toBeNull();
        expect(hasSeenHintTour(KEY)).toBe(true);
    });

    test("skips a step whose target is missing", async () => {
        anchor("b");
        renderTour([
            {target: '[data-tour="missing"]', title: "Пропущенный", text: "Нет цели"},
            {target: '[data-tour="b"]', title: "Показанный", text: "Есть цель"},
        ]);
        await settle();

        expect(screen.queryByText("Пропущенный")).toBeNull();
        expect(screen.getByText("Показанный")).toBeTruthy();
    });

    test("«Пропустить» closes the tour and remembers it", async () => {
        anchor("a");
        renderTour([{target: '[data-tour="a"]', title: "Шаг", text: "Текст"}]);
        await settle();

        fireEvent.click(screen.getByText("Пропустить"));
        await settle();

        expect(screen.queryByText("Шаг")).toBeNull();
        expect(hasSeenHintTour(KEY)).toBe(true);
    });

    test("Escape closes the tour", async () => {
        anchor("a");
        renderTour([{target: '[data-tour="a"]', title: "Шаг", text: "Текст"}]);
        await settle();

        fireEvent.keyDown(document, {key: "Escape"});
        await settle();
        expect(screen.queryByText("Шаг")).toBeNull();
    });

    test("runs before() so the step can switch tabs first", async () => {
        const before = jest.fn(() => {
            anchor("lazy");
        });
        renderTour([{target: '[data-tour="lazy"]', title: "Ленивый", text: "Появляется после before", before}]);
        await settle();

        expect(before).toHaveBeenCalled();
        expect(screen.getByText("Ленивый")).toBeTruthy();
    });

    test("open prop replays the tour even after it was seen", async () => {
        anchor("a");
        markHintTourSeen(KEY);
        renderTour([{target: '[data-tour="a"]', title: "Повтор", text: "Текст"}], {open: true});
        await settle();

        expect(screen.getByText("Повтор")).toBeTruthy();
    });

    test("resetHintTour clears the seen flag", () => {
        markHintTourSeen(KEY);
        expect(hasSeenHintTour(KEY)).toBe(true);
        resetHintTour(KEY);
        expect(hasSeenHintTour(KEY)).toBe(false);
    });
});
