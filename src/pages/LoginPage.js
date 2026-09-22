// @ts-check
const { BasePage } = require('./BasePage');

class LoginPage extends BasePage {
  async open() {
    return this.goto('/login');
  }

  username() {
    return this.page
      .getByLabel(/email atau username/i)
      .or(this.page.getByPlaceholder(/email|username/i))
      .or(this.page.locator('input[name="email"], input[name="username"], input[name="login"]'))
      .first();
  }

  password() {
    return this.page
      .getByLabel(/^password$/i)
      .or(this.page.getByPlaceholder(/password|kata sandi/i))
      .or(this.page.locator('input[type="password"]'))
      .first();
  }

  submit() {
    return this.page.getByRole('button', { name: /masuk/i }).first();
  }

  backToLanding() {
    return this.page.getByRole('link', { name: /kembali ke landing page/i });
  }

  /** Pesan kesalahan login (alert atau teks validasi server). */
  errorMessage() {
    return this.page
      .getByRole('alert')
      .or(this.page.getByText(/salah|tidak cocok|tidak sesuai|gagal|tidak ditemukan|invalid|credentials|do not match/i))
      .first();
  }

  /** @param {string} user @param {string} pass */
  async login(user, pass) {
    await this.username().fill(user);
    await this.password().fill(pass);
    await this.submit().click();
  }
}

module.exports = { LoginPage };
