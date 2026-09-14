import {
    ADMIN_ORDER_TABS,
    ADMIN_SPECIALIST_TABS,
    adminClientHref,
    adminOrderHref,
    adminSpecialistHref,
    legacyAdminClientRedirect,
    legacyAdminOrderRedirect,
    legacyAdminSpecialistRedirect,
    parseTabSegment,
    withQuery,
} from "@/lib/admin-routes"
import {
    clientSectionHref,
    CLIENT_CABINET_LOGO_HREF,
    SPECIALIST_CABINET_LOGO_HREF,
    specialistOrderHref,
    specialistSectionHref,
} from "@/lib/cabinet-shell"

describe("admin resource hrefs", () => {
    test("default tab lives on the resource itself", () => {
        expect(adminSpecialistHref("sp1")).toBe("/admin/specialists/sp1")
        expect(adminSpecialistHref("sp1", "main")).toBe("/admin/specialists/sp1")
        expect(adminSpecialistHref("sp1", "portfolio")).toBe("/admin/specialists/sp1/portfolio")
        expect(adminOrderHref("o1", "overview")).toBe("/admin/orders/o1")
        expect(adminOrderHref("o1", "stages")).toBe("/admin/orders/o1/stages")
        expect(adminClientHref("c1")).toBe("/admin/clients/c1")
    })

    test("list filters are carried in the query", () => {
        expect(adminOrderHref("o1", "manage", "?status=ACTIVE&q=loft")).toBe("/admin/orders/o1/manage?status=ACTIVE&q=loft")
        expect(adminSpecialistHref("sp1", undefined, new URLSearchParams({archived: "1"})))
            .toBe("/admin/specialists/sp1?archived=1")
        expect(withQuery("/admin/clients/c1", "")).toBe("/admin/clients/c1")
        expect(withQuery("/admin/clients/c1", "?")).toBe("/admin/clients/c1")
    })
})

describe("parseTabSegment", () => {
    test("no segment is the default tab", () => {
        expect(parseTabSegment(undefined, ADMIN_ORDER_TABS)).toBeUndefined()
        expect(parseTabSegment([], ADMIN_ORDER_TABS)).toBeUndefined()
    })

    test("known non-default tab is accepted", () => {
        expect(parseTabSegment(["stages"], ADMIN_ORDER_TABS)).toBe("stages")
        expect(parseTabSegment(["orders"], ADMIN_SPECIALIST_TABS)).toBe("orders")
    })

    test.each([
        [["unknown"]],
        [["stages", "extra"]],
        // У вкладки по умолчанию один адрес — без сегмента.
        [["overview"]],
    ])("%j is not a valid order address", (segments) => {
        expect(parseTabSegment(segments, ADMIN_ORDER_TABS)).toBeNull()
    })
})

describe("legacy admin links", () => {
    test("?highlight= on specialists and clients moves the id into the path", () => {
        expect(legacyAdminSpecialistRedirect({highlight: "sp1"})).toBe("/admin/specialists/sp1")
        expect(legacyAdminClientRedirect({highlight: "c1", q: "ivan"})).toBe("/admin/clients/c1?q=ivan")
        expect(legacyAdminSpecialistRedirect({status: "ACTIVE"})).toBeNull()
        expect(legacyAdminClientRedirect({})).toBeNull()
    })

    test("orders accept ?highlight=, ?order= and the old ?tab=", () => {
        expect(legacyAdminOrderRedirect({highlight: "o1"})).toBe("/admin/orders/o1")
        expect(legacyAdminOrderRedirect({order: "o1", tab: "stages"})).toBe("/admin/orders/o1/stages")
        expect(legacyAdminOrderRedirect({order: "o1", tab: "bogus"})).toBe("/admin/orders/o1")
    })

    test("old ?filter= becomes ?status=", () => {
        expect(legacyAdminOrderRedirect({filter: "ACTIVE", q: "loft"})).toBe("/admin/orders?q=loft&status=ACTIVE")
        expect(legacyAdminOrderRedirect({filter: "ALL"})).toBe("/admin/orders")
        expect(legacyAdminOrderRedirect({order: "o1", filter: "DONE"})).toBe("/admin/orders/o1?status=DONE")
    })

    test("current filter-only URLs are left alone", () => {
        expect(legacyAdminOrderRedirect({status: "ACTIVE", q: "loft"})).toBeNull()
    })
})

describe("cabinet sections", () => {
    test("specialist sections and orders are resource paths", () => {
        expect(specialistSectionHref("portfolio")).toBe("/work/portfolio")
        expect(SPECIALIST_CABINET_LOGO_HREF).toBe("/work/orders")
        expect(specialistOrderHref("o1")).toBe("/work/orders/o1")
        expect(specialistOrderHref("o1", "CONCEPT")).toBe("/work/orders/o1/CONCEPT")
    })

    test("client project list stays on /orders", () => {
        expect(clientSectionHref("orders")).toBe("/orders")
        expect(clientSectionHref("payments")).toBe("/orders/payments")
        expect(CLIENT_CABINET_LOGO_HREF).toBe("/orders")
    })
})
