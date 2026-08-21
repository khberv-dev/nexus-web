import {
    LANDING_PREFERRED_LEVEL_RANK,
    levelByCode,
    levelFromTestStep,
    selectLandingCandidates,
} from "../../src/lib/landing/specialist-level";

jest.mock("../../src/lib/db/prisma", () => ({prisma: {}}));

function candidate(level: "L1" | "L2" | "L3" | "L4" | null, rating = 0, featured = false, name = "") {
    return {name, level: level ? levelByCode(level) : null, rating, featured};
}

function testStepComment(passedLevels: string[]): string {
    return JSON.stringify({
        version: 5,
        phase: "level_finished",
        currentLevel: passedLevels[passedLevels.length - 1] ?? "L1",
        answers: {},
        passedLevels,
    });
}

describe("landing specialist level", () => {
    describe("levelFromTestStep", () => {
        test("returns the highest confirmed level", () => {
            expect(levelFromTestStep(testStepComment(["L1", "L2", "L3"]))?.code).toBe("L3");
            expect(levelFromTestStep(testStepComment(["L1", "L2", "L3", "L4"]))?.title).toBe("Элита");
        });

        test("order of passedLevels does not matter", () => {
            expect(levelFromTestStep(testStepComment(["L4", "L1"]))?.code).toBe("L4");
        });

        test("no confirmed level yields null", () => {
            expect(levelFromTestStep(testStepComment([]))).toBeNull();
            expect(levelFromTestStep(null)).toBeNull();
            expect(levelFromTestStep("not json")).toBeNull();
        });

        test("rank grows with the level", () => {
            expect(levelByCode("L1").rank).toBe(1);
            expect(levelByCode("L4").rank).toBe(4);
            expect(levelByCode("L3").rank).toBeGreaterThanOrEqual(LANDING_PREFERRED_LEVEL_RANK);
            expect(levelByCode("L2").rank).toBeLessThan(LANDING_PREFERRED_LEVEL_RANK);
        });
    });

    describe("selectLandingCandidates", () => {
        test("keeps only master/elite when there are enough of them", () => {
            const picked = selectLandingCandidates([
                candidate("L1", 5, false, "junior"),
                candidate("L4", 0, false, "elite"),
                candidate("L3", 0, false, "master-a"),
                candidate("L3", 0, false, "master-b"),
            ]);
            expect(picked.map(c => c.name)).toEqual(["elite", "master-a", "master-b"]);
        });

        test("falls back to everyone rather than emptying the landing", () => {
            const picked = selectLandingCandidates([
                candidate("L1", 0, false, "junior"),
                candidate("L4", 0, false, "elite"),
            ]);
            expect(picked.map(c => c.name)).toEqual(["elite", "junior"]);
        });

        test("sorts by level, then rating", () => {
            const picked = selectLandingCandidates([
                candidate("L3", 4.2, false, "master-low"),
                candidate("L3", 4.9, false, "master-high"),
                candidate("L4", 1, false, "elite"),
            ]);
            expect(picked.map(c => c.name)).toEqual(["elite", "master-high", "master-low"]);
        });

        test("admin-featured specialist wins over a higher level", () => {
            const picked = selectLandingCandidates([
                candidate("L4", 5, false, "elite"),
                candidate("L2", 0, true, "featured"),
            ]);
            expect(picked[0].name).toBe("featured");
        });

        test("specialists without a confirmed level sort last and never pass the bar alone", () => {
            const picked = selectLandingCandidates([
                candidate(null, 5, false, "no-level"),
                candidate("L2", 0, false, "senior"),
            ]);
            expect(picked.map(c => c.name)).toEqual(["senior", "no-level"]);
        });

        test("empty input stays empty", () => {
            expect(selectLandingCandidates([])).toEqual([]);
        });
    });
});

describe("curated vs portfolio-built slides", () => {
    test("curated bundle wins only when level and rating tie", () => {
        const picked = selectLandingCandidates([
            {name: "auto", level: levelByCode("L3"), rating: 4, featured: false, curated: false},
            {name: "curated", level: levelByCode("L3"), rating: 4, featured: false, curated: true},
        ]);
        expect(picked.map(c => c.name)).toEqual(["curated", "auto"]);
    });

    test("a stronger auto-built specialist still outranks a curated weaker one", () => {
        const picked = selectLandingCandidates([
            {name: "curated-l1", level: levelByCode("L1"), rating: 5, featured: false, curated: true},
            {name: "auto-l4", level: levelByCode("L4"), rating: 0, featured: false, curated: false},
        ]);
        expect(picked.map(c => c.name)).toEqual(["auto-l4", "curated-l1"]);
    });
});
