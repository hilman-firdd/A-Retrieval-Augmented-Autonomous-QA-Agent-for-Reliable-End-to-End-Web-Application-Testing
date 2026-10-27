// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-HOME-06 A visitor expands an FAQ question.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Bagaimana syarat masuk PPI 27\\?[\\s\\uE000-\\uF8FF]*$") })).toBeVisible();
});
