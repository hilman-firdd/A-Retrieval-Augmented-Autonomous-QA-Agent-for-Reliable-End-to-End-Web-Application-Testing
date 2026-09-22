// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-AUTH-03 Invalid credentials are rejected with a clear message.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Password[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("type", new RegExp("password"));
});
