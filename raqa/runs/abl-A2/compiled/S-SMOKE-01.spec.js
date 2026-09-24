// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-SMOKE-01 A visitor opens the portal home page.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Daftar PSB[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("https://psb\\.pesantrenpersis27\\.com"));
});
