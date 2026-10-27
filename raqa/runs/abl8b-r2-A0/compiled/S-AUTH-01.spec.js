// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-AUTH-01 The SIMASIS login form is complete and accessible.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Email atau Username[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("placeholder", new RegExp("Masukkan email atau username"));
    await expect(page.getByRole("heading", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*Selamat Datang[\\s\\uE000-\\uF8FF]*$") })).toBeVisible();
});
