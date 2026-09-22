// @ts-check
const { test, expect } = require('../../src/fixtures');
const { LoginPage } = require('../../src/pages/LoginPage');

// Mode 'default': test di file ini berjalan berurutan di satu worker (tidak paralel, agar percobaan login
// tidak menumpuk dan memicu throttle), tetapi kegagalan satu test TIDAK membuat test lain dilewati.
// Mode 'serial' sengaja tidak dipakai karena akan menyembunyikan kegagalan lanjutan saat mengukur FDR.
test.describe.configure({ mode: 'default' });

test.describe('Login SIMASIS', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).open();
  });

  test('S-AUTH-01 form login lengkap dan setiap input memiliki nama yang dapat diakses', { tag: ['@smoke', '@mobile'] }, async ({ page }) => {
    const login = new LoginPage(page);
    await expect(login.username()).toBeVisible();
    await expect(login.password()).toBeVisible();
    await expect(login.password()).toHaveAttribute('type', 'password');
    await expect(login.submit()).toBeEnabled();
    await expect(page.locator('meta[name="csrf-token"]'), 'token CSRF harus tersedia').toHaveCount(1);
  });

  test('S-AUTH-02 login dengan isian kosong ditolak', { tag: '@regression' }, async ({ page }) => {
    const login = new LoginPage(page);
    await login.submit().click();
    await expect(page).toHaveURL(/\/login/);
    const blockedByBrowser = await login.username().evaluate((el) => /** @type {HTMLInputElement} */ (el).validity.valueMissing);
    if (!blockedByBrowser) {
      await expect(login.errorMessage(), 'server harus menampilkan pesan validasi').toBeVisible();
    }
  });

  test('S-AUTH-03 login dengan kredensial salah ditolak dengan pesan yang jelas', { tag: '@regression' }, async ({ page }) => {
    const login = new LoginPage(page);
    await login.login('e2e.invalid.user@example.com', `salah-${Date.now()}`);
    await expect(page).toHaveURL(/\/login/);
    await expect(login.errorMessage()).toBeVisible();
    await expect(login.password(), 'password tidak boleh diisi ulang otomatis').toHaveValue('');
  });

  test('S-AUTH-04 login dengan akun uji yang valid berhasil', { tag: '@regression' }, async ({ page }) => {
    const user = process.env.SIMASIS_USER;
    const pass = process.env.SIMASIS_PASS;
    test.skip(!user || !pass, 'SIMASIS_USER/SIMASIS_PASS tidak diisi di .env');
    await new LoginPage(page).login(/** @type {string} */ (user), /** @type {string} */ (pass));
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('S-AUTH-05 tautan "Kembali ke Landing Page" menuju portal', { tag: '@regression' }, async ({ page, baseURL }) => {
    await new LoginPage(page).backToLanding().click();
    await expect(page).toHaveURL(new RegExp(`^${(baseURL || '').replace(/\/$/, '')}/?(portal)?$`));
  });
});
