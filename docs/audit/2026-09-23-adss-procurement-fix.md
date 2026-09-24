# Perbaikan ketersediaan pengadaan Kabel ADSS

Tanggal verifikasi: 23 September 2026.

## Hasil

- Proyek SURGE JATENG, `CONT-20260922-0012`, PM `faza@epms.com`.
- Cost item 46 (Kabel ADSS): baseline 3.000 meter, PO 3.000 meter, sisa 0 meter.
- Paket `PKG-20260922-001` sekarang `CLOSED`; tepat satu audit `CLOSE_PACKAGE`.
- Invoice/payment tetap tercatat seperti sebelum verifikasi. Transaksi pengujian tidak meninggalkan paket atau item baru.

## Implementasi

1. `GET /procurement/projects/:projectId/eligible-cost-items` mengembalikan RAB APPROVED aktif dan konsumsi paket/PR/PO. Route dibatasi PROJECT_MANAGER/SUPER_ADMIN; PM harus ditugaskan pada proyek.
2. Form PM menggunakan availability tersebut. Item habis disembunyikan secara default, dapat ditampilkan sebagai nonaktif, dan tidak dipilih oleh Select all. Default/maksimum kuantitas mengikuti sisa tersedia.
3. Create/update draft serta submit memvalidasi kuota di backend. Item ganda, kuantitas tidak valid, dan pengajuan melebihi sisa ditolak. Draft tidak mereservasi kuota; submit memeriksa ulang dengan kunci cost item dan transaksi READ COMMITTED.
4. `POST /procurement/packages/create-and-submit` dan `POST /procurement/packages/:id/update-and-submit` menyimpan serta mengajukan dalam satu transaksi. Kegagalan pengajuan membatalkan penyimpanan dan audit dalam transaksi yang sama.
5. Event pembayaran dan GR memicu pemeriksaan penutupan paket. Pemeriksaan berkala setiap menit memulihkan event yang terlewat dan memproses paket historis. GET tetap hanya membaca.
6. Penutupan membutuhkan seluruh PO aktif COMPLETED, invoice aktif VERIFIED/PAID dengan total sesuai PO, pembayaran aktual mencukupi, serta tidak ada termin aktif yang belum PAID. Status paket dan audit diperbarui dalam satu transaksi dengan penguncian. Pengulangan tidak membuat audit baru.

## Verifikasi

- Backend: `procurement.service.spec.ts` dan `package-availability.spec.ts`: **116 lulus**.
- Frontend: `procurement.phase4.test.ts`: **33 lulus**.
- TypeScript frontend/backend: **lulus**, tanpa menghasilkan build.
- Pemeriksaan whitespace diff: **lulus**.
- Script `backend/scripts/verify-adss-availability.ts`: memanggil service dengan database lokal aktual untuk memeriksa kuota nol, pembatasan PM, penolakan permintaan ulang, rollback setelah draft dibuat tetapi submit gagal, serta alur submit berhasil yang sengaja di-rollback. Opsi `--close-existing` memeriksa/menutup paket ADSS yang disebutkan di atas dan memastikan idempotensi audit.
- Browser lokal: login PM, status paket CLOSED terlihat; form baru hanya menampilkan tiga item tersedia; opsi menampilkan alokasi memperlihatkan ADSS 0 meter dengan checkbox nonaktif; Select all memilih tiga item dan melewati ADSS; tombol peningkatan kuantitas nonaktif pada batas kuota.

Verifikasi browser tidak membuat pengadaan, invoice, atau pembayaran baru. Rantai pengadaan yang sudah ada digunakan untuk validasi hasil akhirnya; ini bukan pengujian ulang transaksi finansial lengkap dari awal.

## Menjalankan ulang pemeriksaan lokal

Dari direktori backend:

```powershell
node node_modules/jest/bin/jest.js procurement.service.spec.ts package-availability.spec.ts --runInBand
node -r ts-node/register scripts/verify-adss-availability.ts
```

Tambahkan `--close-existing` pada perintah terakhir untuk pemeriksaan dan penutupan idempotent paket `PKG-20260922-001`. Konfigurasi database dibaca dari `backend/.env`.
