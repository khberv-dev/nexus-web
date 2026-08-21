import {validateFile} from "../../src/lib/s3";

jest.mock("../../src/lib/db/prisma", () => ({prisma: {}}));

describe("validateFile", () => {
    describe("allowAnyImage (загрузки лендинга и портфолио)", () => {
        const images = ["photo.webp", "shot.avif", "render.heic", "scan.tiff", "old.bmp", "anim.gif", "photo.HEIF"];

        test("любой растровый формат проходит", () => {
            for (const name of images) {
                expect(() => validateFile(name, 1024, {allowAnyImage: true})).not.toThrow();
            }
        });

        test("те же форматы без флага отклоняются", () => {
            for (const name of images) {
                expect(() => validateFile(name, 1024)).toThrow(/not allowed/);
            }
        });

        test("jpg и png работают в обоих режимах", () => {
            for (const name of ["a.jpg", "b.jpeg", "c.png"]) {
                expect(() => validateFile(name, 1024)).not.toThrow();
                expect(() => validateFile(name, 1024, {allowAnyImage: true})).not.toThrow();
            }
        });

        test("svg остаётся запрещённым — это исполняемый документ", () => {
            expect(() => validateFile("logo.svg", 1024, {allowAnyImage: true})).toThrow(/not allowed/);
        });

        test("исполняемые файлы не проходят и с флагом", () => {
            for (const name of ["payload.exe", "script.sh", "app.js", "doc.html"]) {
                expect(() => validateFile(name, 1024, {allowAnyImage: true})).toThrow(/not allowed/);
            }
        });

        test("ограничение по размеру файла остаётся", () => {
            const tooBig = 501 * 1024 * 1024;
            expect(() => validateFile("huge.webp", tooBig, {allowAnyImage: true})).toThrow(/500 MB/);
            expect(() => validateFile("fine.webp", 400 * 1024 * 1024, {allowAnyImage: true})).not.toThrow();
        });
    });
});
