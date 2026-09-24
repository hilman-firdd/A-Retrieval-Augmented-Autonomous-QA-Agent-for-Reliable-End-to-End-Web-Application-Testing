// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-HOME-02 The 'Info Terbaru' call-to-action opens the news list.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Info Terbaru[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("http://127\\.0\\.0\\.1:8000/portal/berita"));
});
