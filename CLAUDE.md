# Aturan kerja di repo ini

Repo ini adalah paket replikasi naskah JUITA "Offline Human Review Reveals Overstated Success and Confidence Signals
in an LLM Web Testing Agent". Commit yang dirujuk naskah tertulis di Acknowledgement naskah dan di tag
`juita-submission`. Peta hash lama ke hash baru (setelah riwayat ditulis ulang) ada di REPLICATION.md.

1. Angka di dokumen harus keluar dari skrip di repo (`reanalysis/`, `raqa/scripts/analyze-hitl.js`). Jangan menulis
   angka dari ingatan atau perkiraan. Daftar klaim dan sumbernya ada di `manuscript-claims-verification.md`.
2. Bagian "Temuan awal" di README.md (dari judul bagian itu sampai akhir berkas) adalah sumber retrieval agen.
   Jangan mengubahnya, jangan menambah teks di bawahnya, dan jangan menulis judul bagian yang sama di tempat lain.
3. Jangan mengubah berkas pre-registrasi: `scenarios/prereg-ablation.json`, `scenarios/ground-truth.json`,
   `raqa/EKSPERIMEN-HITL-ABLASI.md` (kecuali catatan status di bagian atasnya). Deviasi dicatat di
   `raqa/HASIL-HITL-ABLASI.md` bagian 5.
4. Jangan mengubah log run (`raqa/runs/abl-*`, `results/runs/*`) dan rating (`raqa/review/*-ratings-*.csv`).
5. Untuk gate, naskah memakai 57 langkah UNIK (κ 0,747; 4/24). Tabel H3-K di `analysis.md` memakai 112 KEMUNCULAN
   (κ 0,785; 6/59). Jangan mencampur keduanya dalam satu klaim.
6. Istilah yang dipakai: endpoint "pra-registrasi", "correct-oracle" (post hoc, endpoint utama), dan "semua kriteria
   tercakup". Status "selesai" agen berasal dari aturan pengulangan langkah, bukan dari planner. Run ulang 4B dan 8B
   (abl4b-*, abl8b-*) adalah uji ketahanan yang TIDAK dipra-registrasi; sebut begitu di setiap dokumen.
   Persentase keberhasilan pada run ulang memakai penyebut tanpa error infrastruktur; sebut pembilang/penyebutnya.
7. Klaim yang tidak boleh muncul: "Reliable"/"dapat dipercaya" untuk agen atau gate; run "deterministik"; retrieval
   "meningkatkan" keberhasilan; kolaborasi manusia–agen yang terukur; TSR terverifikasi sebagai "batas bawah";
   penilai "menyalin" (pakai kata netral: independensi tidak dapat dikonfirmasi).
8. Run baru (model lebih besar, run berulang) memakai prefix baru (misalnya q8, abl-r2) dan folder review baru
   (`review-q8`), tidak pernah menimpa `raqa/review/`. Rencananya di-commit sebagai pre-registrasi sebelum run pertama.
9. Setelah mengubah analisis, jalankan ulang semua perintah di REPLICATION.md dan pastikan angka di
   `manuscript-claims-verification.md` masih sama. Kalau berubah, laporkan ke penulis sebelum commit.
10. Jangan menulis ulang riwayat git (rebase pada commit yang sudah di-push, filter-repo, force push). Itu mengubah
    hash commit yang dirujuk naskah. Kalau benar-benar perlu, tanyakan dulu ke penulis dan catat peta hash di
    REPLICATION.md.
