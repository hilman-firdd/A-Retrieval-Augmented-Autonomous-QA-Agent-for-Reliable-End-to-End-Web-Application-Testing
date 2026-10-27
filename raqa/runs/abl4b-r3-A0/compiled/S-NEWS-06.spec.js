// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-NEWS-06 Breadcrumb and share links refer to the current article.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/portal/jihad-istimewa-pelepasan-jamaah-haji-2026");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*WhatsApp[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("https://wa\\.me/\\?text=JIHAD\\+ISTIMEWA\\+%26\\+PELEPASAN\\+JAMA%E2%80%99AH\\+HAJI\\+2026\\+http%3A%2F%2F127\\.0\\.0\\.1%3A8000%2Fportal%2Fjihad-istimewa-pelepasan-jamaah-haji-2026"));
});
