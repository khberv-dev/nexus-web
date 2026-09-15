/**
 * @jest-environment jsdom
 */

import {createElement} from "react";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";

jest.mock("next/navigation", () => ({usePathname: () => "/work/orders"}));
jest.mock("next-auth/react", () => ({signOut: jest.fn()}));

import {DashProfileMenu} from "@/components/dashboard-ui/DashProfileMenu";
import {buildSpecialistCabinetNavItems, SPECIALIST_ROUTE_TABS} from "@/components/Community/specialist-route-tabs";
import {buildClientCabinetNavItems} from "@/components/Client/client-cabinet/constants";
import {SPECIALIST_CABINET_HOME_HREF} from "@/lib/cabinet-shell";

describe("DashProfileMenu", () => {
    afterEach(cleanup);

    const menu = () => screen.getByRole("menu", {hidden: true});
    const toggle = () => screen.getByRole("button", {name: "Меню профиля"});

    test("закрыто по умолчанию и открывается кликом по иконке", () => {
        render(createElement(DashProfileMenu, {name: "Анна Петрова", email: "anna@example.com"}));

        expect(menu().hidden).toBe(true);
        expect(toggle().getAttribute("aria-expanded")).toBe("false");

        fireEvent.click(toggle());

        expect(menu().hidden).toBe(false);
        expect(toggle().getAttribute("aria-expanded")).toBe("true");
    });

    test("показывает имя и почту, а выход — внутри меню", () => {
        render(createElement(DashProfileMenu, {name: "Анна Петрова", email: "anna@example.com"}));

        expect(screen.getByText("Анна Петрова")).toBeTruthy();
        expect(screen.getByText("anna@example.com")).toBeTruthy();
        const logout = screen.getByText("Выйти").closest("button");
        expect(menu().contains(logout)).toBe(true);
    });

    test("без имени показывает почту один раз", () => {
        render(createElement(DashProfileMenu, {name: null, email: "anna@example.com"}));

        expect(screen.getAllByText("anna@example.com")).toHaveLength(1);
    });

    test("закрывается по Esc и кликом снаружи", () => {
        render(createElement(DashProfileMenu, {name: "Анна", email: "anna@example.com"}));

        fireEvent.click(toggle());
        act(() => {
            document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
        });
        expect(menu().hidden).toBe(true);

        fireEvent.click(toggle());
        act(() => {
            document.body.dispatchEvent(new Event("pointerdown", {bubbles: true}));
        });
        expect(menu().hidden).toBe(true);
    });

    test("клик по «Выйти» закрывает меню", () => {
        render(createElement(DashProfileMenu, {name: "Анна", email: "anna@example.com"}));

        fireEvent.click(toggle());
        fireEvent.click(screen.getByText("Выйти"));

        expect(menu().hidden).toBe(true);
    });
});

describe("навигация специалиста", () => {
    test("«Главная» — первый пункт и ведёт на стартовый экран", () => {
        expect(SPECIALIST_ROUTE_TABS[0]).toMatchObject({
            id: "home",
            label: "Главная",
            href: SPECIALIST_CABINET_HOME_HREF,
        });
        expect(SPECIALIST_CABINET_HOME_HREF).toBe("/work");
    });

    test("остальные разделы идут после «Главной» в прежнем порядке", () => {
        expect(SPECIALIST_ROUTE_TABS.map(t => t.id)).toEqual([
            "home", "orders", "portfolio", "landing", "payments", "settings",
        ]);
    });

    test("вкладки несут id для экскурсии и счётчик раздела", () => {
        const items = buildSpecialistCabinetNavItems("orders", {orders: 2});

        expect(items.map(i => i.id)).toEqual(SPECIALIST_ROUTE_TABS.map(t => t.id));
        expect(items.find(i => i.id === "orders")).toMatchObject({active: true, badgeCount: 2});
        expect(items.find(i => i.id === "payments")?.badgeCount).toBeUndefined();
    });
});

describe("навигация заказчика", () => {
    test("вкладки несут id и счётчик проектов", () => {
        const items = buildClientCabinetNavItems("payments", {orders: 1});

        expect(items.map(i => i.id)).toEqual(["orders", "payments", "settings"]);
        expect(items.find(i => i.id === "orders")).toMatchObject({active: false, badgeCount: 1});
        expect(items.find(i => i.id === "payments")?.active).toBe(true);
    });
});
