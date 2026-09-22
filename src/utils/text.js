// @ts-check
/** Utilitas normalisasi teks dan tanggal (situs memakai format "17 Jul 2026" dan "17 July 2026"). */

const MONTHS = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  aug: 8, agu: 8, agt: 8, agustus: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, okt: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, des: 12, desember: 12, december: 12,
};

const DATE_RE = /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/g;

/** "17 Jul 2026" / "17 July 2026" / "17 Juli 2026" -> "2026-07-17" (atau null bila tidak dikenali). */
function toIsoDate(text) {
  const m = /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/.exec(text || '');
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Semua tanggal yang dikenali di dalam sebuah teks, dalam format ISO. */
function allIsoDates(text) {
  const out = [];
  for (const m of (text || '').matchAll(DATE_RE)) {
    const iso = toIsoDate(m[0]);
    if (iso) out.push(iso);
  }
  return out;
}

/** Rapikan spasi dan tanda kutip tipografis agar perbandingan judul tidak rapuh. */
function norm(text) {
  return (text || '')
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = { toIsoDate, allIsoDates, norm };
