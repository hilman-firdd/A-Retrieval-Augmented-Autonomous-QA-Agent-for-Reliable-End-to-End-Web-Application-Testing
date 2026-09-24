// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-NEWS-09 A visitor opens a student article from the list.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/portal/artikel");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Menata Amal Shalih dalam Skala Prioritas[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("http://127\\.0\\.0\\.1:8000/portal/menata-amal-shalih-dalam-skala-prioritas"));
});
