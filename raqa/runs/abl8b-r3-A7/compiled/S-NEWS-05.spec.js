// @ts-check
// DIHASILKAN OLEH RAQA dari run yang sudah diverifikasi. Jangan diedit manual; kompilasi ulang bila perlu.
const { test, expect } = require("../../../../src/fixtures");

test("S-NEWS-05 Opening an article from the list shows consistent data.", { tag: ["@raqa"] }, async ({ page }) => {
    await page.goto("/portal/berita");
    await expect(page.getByRole("link", { name: new RegExp("^[\\s\\uE000-\\uF8FF]*SILATURAHMI ORANG TUA SANTRI BARU TA\\. 2026-2027[\\s\\uE000-\\uF8FF]*$") })).toHaveAttribute("href", new RegExp("http://127\\.0\\.0\\.1:8000/portal/silaturahmi-orang-tua-santri-baru-ta-2026-2027"));
});
