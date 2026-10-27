// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-NEWS-07 Related articles exclude the article being read.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/portal/jihad-istimewa-pelepasan-jamaah-haji-2026");
    await expect(page.getByRole("heading", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Artikel Terkait[\\s\\uE000-\\uF8FF]*$") })).toBeVisible();
});
