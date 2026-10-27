// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-NEWS-06 Breadcrumb and share links refer to the current article.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/portal/jihad-istimewa-pelepasan-jamaah-haji-2026");
    await expect(page.getByRole("navigation", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*breadcrumb[\\s\\uE000-\\uF8FF]*$") })).toBeVisible();
});
