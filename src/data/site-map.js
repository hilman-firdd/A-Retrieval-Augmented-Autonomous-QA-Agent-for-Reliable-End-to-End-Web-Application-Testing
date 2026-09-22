// @ts-check
/**
 * Peta menu dan halaman yang DIHARAPKAN (spesifikasi uji), disusun dari navigasi situs
 * pada saat framework ini dibuat. Jika menu diubah dengan sengaja, perbarui file ini;
 * jika berubah tanpa sengaja, test akan mendeteksinya.
 *
 * Catatan: file ini juga berfungsi sebagai salah satu artefak "requirements" untuk
 * korpus pengetahuan RAQA.
 */
const MENU = [
  { parent: 'IFTITAH', items: [
    ['IFTITAH', '/portal/halaman/iftitah'],
    ['NIZHAM', '/portal/halaman/nizham'],
    ['TASYKIL', '/portal/halaman/tasykil'],
    ['WAJAH WIJHAH', '/portal/halaman/wajah-wijhah'],
    ['ULA', '/portal/halaman/ula'],
    ['TSANAWIYYAH', '/portal/halaman/tsanawiyyah'],
    ["MU'ALLIMIN", '/portal/halaman/muallimin'],
    ['STRUKTUR KURIKULUM SELURUH JENJANG', '/portal/halaman/struktur-kurikulum'],
    ['PROGRAM PEMBELAJARAN SELURUH JENJANG', '/portal/halaman/program-pembelajaran'],
    ['JADWAL PELAJARAN', '/portal/halaman/jadwal-pelajaran'],
    ['ASATIDZAH', '/portal/halaman/asatidzah'],
    ['SANTRI', '/portal/halaman/santri'],
    ['BAHASA INGGRIS', '/portal/halaman/kbm-bahasa-inggris'],
    ['HIWAR', '/portal/halaman/kbm-hiwar'],
    ['FATHUL-BARI', '/portal/halaman/kbm-fathul-bari'],
    ['SYARAH AN-NAWAWI SHAHIH MUSLIM', '/portal/halaman/kbm-syarah-nawawi'],
    ["KITABUL 'ILMI SYAIKH AL-UTSAIMIN", '/portal/halaman/kbm-kitabul-ilmi'],
    ['MICROSOFT OFFICE', '/portal/halaman/kbm-microsoft-office'],
    ['WEB DESIGN', '/portal/halaman/kbm-web-design'],
    ['DESIGN GRAFIS', '/portal/halaman/kbm-design-grafis'],
    ["IHTIFAL USBU'I", '/portal/halaman/ekskul-ihtifal-usbui'],
    ['KULIAH UMUM', '/portal/halaman/ekskul-kuliah-umum'],
    ['MUBAHATSAH SANTRI', '/portal/halaman/ekskul-mubahatsah'],
    ["TA'LIM MADRASAH DINIYYAH", '/portal/halaman/ekskul-talim-diniyyah'],
    ['CERAMAH PENGAJIAN UMUM', '/portal/halaman/ekskul-ceramah-pengajian'],
    ['OLAHRAGA: FUTSAL, MEMANAH, BADMINTON DLL', '/portal/halaman/ekskul-olahraga'],
    ['DIKLAT MENULIS DAN JURNALISTIK', '/portal/halaman/ekskul-diklat-menulis'],
    ['PELATIHAN LIFE SKILL DAN ENTERPRENEURSHIP', '/portal/halaman/ekskul-life-skill'],
    ['MABIT DAN TAHAJUD BERJAMAAH', '/portal/halaman/ekskul-mabit-tahajud'],
    ["SUPER CAMP AL-QUR'AN", '/portal/halaman/ekskul-super-camp-quran'],
    ['PARTISIPASI PERLOMBAAN', '/portal/halaman/ekskul-perlombaan'],
    ['RIHLAH ILMIAH', '/portal/halaman/ekskul-rihlah-ilmiah'],
  ] },
  { parent: 'MANHAJ', items: [
    ['MANHAJ', '/portal/halaman/manhaj'],
    ['PENDIDIKAN ADAB', '/portal/halaman/pendidikan-adab'],
    ["TAHFIZH AL-QUR'AN", '/portal/halaman/tahfizh-quran'],
    ['TAHFIZH HADITS', '/portal/halaman/tahfizh-hadits'],
    ['BAHTSUL-KUTUB', '/portal/halaman/bahtsul-kutub'],
    ['BAHASA ARAB', '/portal/halaman/bahasa-arab'],
  ] },
  { parent: 'NASYATH', items: [
    ['BERITA TERBARU', '/portal/berita'],
    ['BERITA KUTTAB', '/portal/berita?kategori=berita-kuttab'],
    ['ARTIKEL SANTRI', '/portal/artikel'],
    ['MUBAHATSAH', '/portal/halaman/mubahatsah'],
  ] },
  { parent: 'PESANTREN UMUM', items: [
    ['BROSUR PESANTREN UMUM', '/portal/halaman/brosur-pesantren-umum'],
    ['PENDAFTARAN PESANTREN KHUSUS', '/portal/halaman/pendaftaran-pesantren-khusus'],
  ] },
  { parent: 'INFO PSB', items: [
    ['BROSUR PSB PESANTREN PERSIS 27', '/portal/halaman/brosur-psb-persis-27'],
    ['BROSUR PSB KUTTAB AT-TAUBAH', '/portal/halaman/brosur-psb-kuttab'],
    ['KETENTUAN SELEKSI SANTRI', '/portal/halaman/ketentuan-seleksi'],
  ] },
  { parent: 'SIMASIS', items: [
    ['LOGIN', '/login'],
    ['TENTANG', '/portal/halaman/tentang-simasis'],
    ['PANDUAN', '/portal/halaman/panduan-simasis'],
    ['FAQ', '/portal/halaman/faq-simasis'],
  ] },
];

/** Semua halaman statis (/portal/halaman/...) yang harus dapat diakses. */
const STATIC_PAGES = MENU.flatMap((g) => g.items)
  .map(([name, path]) => ({ name, path }))
  .filter((p) => p.path.startsWith('/portal/halaman/'))
  .concat([{ name: 'ALUMNI (tautan statistik beranda)', path: '/portal/halaman/alumni' }]);

/** Program unggulan di beranda, berurutan sesuai tampilan. */
const PROGRAMS = ['Pendidikan Adab', "Tahfizh Al-Qur'an", 'Tahfizh Hadits', 'Bahtsul-Kutub', 'Bahasa Arab'];

/** Subdomain milik pesantren yang harus ditautkan lewat HTTPS. */
const OWN_DOMAIN = /(^|\.)pesantrenpersis27\.com$/;

module.exports = { MENU, STATIC_PAGES, PROGRAMS, OWN_DOMAIN };
