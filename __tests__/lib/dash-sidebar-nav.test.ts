/**
 * @jest-environment jsdom
 */

import {createElement} from "react";
import {cleanup, render, screen} from "@testing-library/react";

// next/link без роутера в тестах не нужен — достаточно обычной ссылки.
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({children, href, ...rest}: { children: React.ReactNode; href: string }) =>
        createElement("a", {href, ...rest}, children),
}));

import {DashSidebarNav} from "@/components/dashboard-ui/DashSidebarNav";

const TABS = [
    {id: "orders", icon: "bx-folder", label: "Проекты"},
    {id: "settings", icon: "bx-cog", label: "Настройки"},
];

describe("DashSidebarNav", () => {
    afterEach(cleanup);

    test("renders a logout button at the bottom by default", () => {
        render(createElement(DashSidebarNav, {tabs: TABS, activeTab: "orders", onChange: jest.fn()}));

        const logout = screen.getByText("Выйти").closest("button");
        expect(logout).not.toBeNull();
        expect(logout!.getAttribute("type")).toBe("button");
        expect(logout!.className).toContain("dash-sidebar__icon--logout");
    });

    test("logout is the last item in the sidebar", () => {
        const {container} = render(
            createElement(DashSidebarNav, {tabs: TABS, activeTab: "orders", onChange: jest.fn()}),
        );

        const items = container.querySelectorAll(".dash-sidebar > *");
        expect(items).toHaveLength(TABS.length + 1);
        expect(items[items.length - 1].textContent).toContain("Выйти");
    });

    test("can be turned off", () => {
        render(createElement(DashSidebarNav, {
            tabs: TABS,
            activeTab: "orders",
            onChange: jest.fn(),
            showLogout: false,
        }));

        expect(screen.queryByText("Выйти")).toBeNull();
    });

    test("still renders the tabs themselves", () => {
        render(createElement(DashSidebarNav, {tabs: TABS, activeTab: "orders", onChange: jest.fn()}));

        expect(screen.getByText("Проекты")).toBeTruthy();
        expect(screen.getByText("Настройки")).toBeTruthy();
    });
});
