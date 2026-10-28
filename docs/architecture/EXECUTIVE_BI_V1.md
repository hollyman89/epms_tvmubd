# Executive BI v1 — implementasi dan pengoperasian

Tanggal: 25 Oktober 2026. Tidak ada data contoh yang ditanam atau ditampilkan oleh implementasi ini.

## Jalur data

`Transaksi EPMS → ExecutiveMaterializer → executive_fact_snapshots → enam engine → executive_summary_snapshots → GET /api/v1/executive/overview → dashboard`

Rute `/dashboard` menggunakan `components/executive/ExecutiveDashboard.tsx`. Komponen dashboard lama dan endpoint lama dipertahankan untuk kompatibilitas pekerjaan yang sudah ada, tetapi tidak digunakan rute ini. Mengaktifkan kembali dashboard lama bukan strategi rollback BI yang aman.

Worker melakukan rekonsiliasi snapshot penuh setiap lima menit, dengan named database lock untuk mencegah refresh paralel. Fact memiliki grain `(run_id, fact_kind, source_id)` dan nilai decimal. Source dibaca dalam transaksi repeatable-read, fact disimpan, kemudian engine membaca fact yang telah disimpan. Semua summary periode dipublikasikan dalam transaksi yang sama. Kegagalan menyebabkan rollback seluruh run, bukan publication parsial. Tidak menggunakan provider queue mock dan tidak mengubah semantik outbox yang sudah ada.

Proyeksi tindakan memakai `InboxService` kanonis di worker aplikasi, bukan saat GET dashboard. Karena service Inbox saat ini menerima kegagalan sebagian sumber, cakupannya selalu diberi status parsial; daftar kosong tidak menyatakan semua tindakan selesai. Proyeksi To-Do memiliki `asOf` sendiri karena pembaca kanonis memakai koneksi terpisah. Summary finansial tetap satu snapshot. Hak akses dan maker-checker tetap divalidasi oleh workspace saat tindakan dibuka/dijalankan.

## Data yang tersedia dan batasan

| Fungsi | Implementasi v1 |
|---|---|
| Executive KPI Service | Pipeline terbuka, nilai kontrak ACTIVE sekali per kontrak, pembayaran vendor berdasarkan payment_date; target approved dengan basis tanggal yang cocok; decimal arithmetic. |
| Business Flow Engine | Posisi Pipeline → Contract → Customer Invoice → Customer Payment. Conversion tidak ditampilkan sebelum tersedia histori cohort dan alokasi yang sah. |
| Risk Engine | Proyek melewati end_date, risiko HIGH/CRITICAL tercatat; exposure adalah nilai kontrak terkait, bukan expected loss dan tidak dijumlahkan antar-risk. Risiko AR/kas/margin belum dapat dinilai. |
| SLA Engine | Pelanggaran due_at task resmi dan task tanpa tenggat. Tidak mengklaim penghitungan jam kerja, pause, holiday, atau episode rework yang belum tersedia. |
| Executive Summary Generator | Narasi deterministik dari KPI/risiko/SLA dan bukti snapshot; tanpa LLM atau angka buatan. |
| Forecast Engine | Potensi kontrak 90 hari = nilai peluang × probabilitas yang diisi di EPMS, hanya peluang terbuka dengan expected_closing_date dan nilai/probabilitas valid. Asumsi belum dikalibrasi; bukan forecast revenue/kas. |

Pendapatan diakui, penerimaan pelanggan, serta margin tetap `UNAVAILABLE` sampai sumber authoritative diintegrasikan. Invoice/payment vendor tidak dipakai untuk mengisi KPI pelanggan. Tidak ada target dummy. Target hanya dibaca dari `executive_kpi_targets`, dengan approver, waktu approval, currency, periode, scope dan versi. Penulisan target memerlukan proses bisnis yang disahkan; halaman ini tidak menyediakan bypass approval.

Histori posisi dikumpulkan sejak analytics diaktifkan, dengan satu titik terakhir per hari Jakarta untuk 90 hari terakhir. Data sebelum activation tidak direkonstruksi dari status terbaru. Tren pembayaran hanya menampilkan bulan yang memiliki bukti pembayaran, tanpa mengisi gap historis dengan nol. Masa depan bukan actual. KPI posisi saat ini diberi label tersendiri dan tidak berpura-pura menjadi saldo akhir periode lampau.

## Aktivasi lokal

1. Jalankan pemeriksaan tipe dan tes targeted.
2. Dari folder `backend`, jalankan `node scripts/executive-analytics.cjs migrate`.
3. Jalankan `node scripts/executive-analytics.cjs refresh` untuk membuat summary awal dari data nyata.
4. Jalankan backend/frontend seperti biasa. Worker aplikasi memperbarui seluruh proyeksi termasuk To-Do saat bootstrap dan setiap lima menit.

Utility migrasi lokal hanya menjalankan `CreateExecutiveAnalyticsMart1792886400000`. Tidak menjalankan migrasi lain yang mungkin tertunda. Utility menolak production/host remote dan menolak schema parsial yang belum terdaftar, alih-alih mengubah tabel yang sudah ada. MySQL DDL tidak sepenuhnya transaksional; jika gagal di tengah migrasi, periksa schema sebelum mencoba lagi.

Utility refresh mandiri tidak mempunyai dependency Inbox, sehingga menandai proyeksi tindakan `UNAVAILABLE`. Untuk dashboard operasional lengkap, gunakan worker aplikasi dengan Inbox kanonis. Utility tidak membuat atau memodifikasi record bisnis.

## Akses dan konfigurasi

- API mengikuti akses dashboard saat ini: DIRECTOR, ADMIN, SUPER_ADMIN.
- Scope v1 adalah seluruh installation. Tidak ada filter perusahaan/unit palsu; token tenant/company di luar default/1 ditolak. Sebelum multi-tenant rollout, source dan fact wajib mendapat dimensi entitlement sebenarnya.
- Tindakan difilter dengan recipient user dan kumpulan role persis. Respons memakai `Cache-Control: private, no-store`; query frontend memasukkan identitas, role, dan periode.
- `EXECUTIVE_ANALYTICS_REFRESH_ENABLED=false` menonaktifkan worker. Production memerlukan nilai `true` secara eksplisit.
- Production mewajibkan `EXECUTIVE_ANALYTICS_READ_USER` dan `EXECUTIVE_ANALYTICS_READ_PASSWORD`. User ini harus hanya mendapat SELECT pada `executive_analytics_runs`, `executive_summary_snapshots`, dan `executive_action_snapshots`. Jangan berikan SELECT tabel transaksi. Kredensial tidak disimpan dalam source control.
- Development dapat memakai koneksi aplikasi yang sama; batas query diuji di kode, tetapi pemisahan hak database belum terbukti hanya dengan konfigurasi development tersebut.
- Data berusia lebih dari 15 menit diberi label stale. Tidak ada fallback ke transaksi ketika summary tidak tersedia atau gagal dibaca.

## Pengujian

Backend: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/modules/executive-analytics/__tests__/executive-engines.spec.ts src/modules/executive-analytics/__tests__/executive-read.spec.ts src/modules/executive-analytics/__tests__/executive-materializer.spec.ts`

Frontend: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/lib/__tests__/executivePresentation.test.ts`

Fixture uji hanya berada di proses unit test dan tidak dimasukkan ke database atau dashboard. Pemeriksaan integrasi lokal harus membandingkan KPI dengan SELECT sumber nyata dan memeriksa bahwa GET hanya melakukan SELECT tabel analytics. Browser QA menggunakan API/data nyata, bukan route fulfillment yang memasukkan data dummy.

## Pekerjaan lanjutan yang tidak boleh diklaim selesai

- Integrasi ledger revenue, customer AR/receipt, cost recognition dan opening cash; forecast kas/margin penuh.
- Historisasi transition dan bridge allocation untuk conversion cohort; retention/compaction snapshot dengan kebijakan yang ditinjau.
- SLA kalender kerja dan pause/rework; probabilitas forecast terkalibrasi dan backtest.
- Dimensi perusahaan/unit dan enforcement entitlement lintas organisasi.
- Penyelesaian seluruh repository health/cleanup, Inbox, dan Telegram merupakan pekerjaan tersendiri; perubahan dashboard ini tidak membuktikan baseline global sudah clean.
