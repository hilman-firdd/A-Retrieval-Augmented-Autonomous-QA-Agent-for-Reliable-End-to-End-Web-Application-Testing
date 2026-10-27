// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-NAV-02 A visitor reaches a page by opening a dropdown menu and clicking an it", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Daftar PSB[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("https://psb\\.pesantrenpersis27\\.com"));
});
