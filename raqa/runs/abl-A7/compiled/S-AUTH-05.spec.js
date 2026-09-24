// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-AUTH-05 'Kembali ke Landing Page' returns to the portal.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Kembali ke Landing Page[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("http://127\\.0\\.0\\.1:8000"));
});
