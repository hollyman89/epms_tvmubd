# EPMS UBD & TVM — Full Repository, System Integrity & Release Readiness Audit

Tanggal pemeriksaan: **21 Oktober 2026 (Asia/Jakarta)**. Mode: **STRICT AUDIT ONLY**. Nama file bertanggal 16 Oktober dipertahankan sesuai izin satu artefak; isi ini adalah audit penuh atas snapshot 21 Oktober, bukan rekonstruksi hasil lama.

Dokumen ini menggabungkan tujuh deliverable. Tidak ada rekomendasi yang diimplementasikan. Ruang lingkup sumber: repository lokal; runtime/database: service dan koneksi lokal yang tersedia, **bukan verifikasi lingkungan production**.

## REPORT 1 — Executive audit summary

**DEV: CONDITIONAL GO untuk pengembangan/remediasi terisolasi. STAGING: NO-GO untuk promotion/deployment berdasarkan konfigurasi sekarang. PRODUCTION: NO-GO.**

Backend dan frontend dapat dikompilasi dan dibangun dengan dependency lokal yang sudah tersedia. Frontend Jest: 75 suite/1.161 tes lulus. Backend terpilih: 14 dari15 suite lulus,335 dari336 tes lulus,1 gagal. Hasil ini tidak membuktikan integrasi bisnis, Edge live, reproducible clean install atau deployment aman.

Ada **31 temuan:6 P0,21 P1,4 P2**. Angka tersebut mencakup gap bukti dan risiko yang diberi NOT VERIFIED; bukan31 exploit/insiden terbukti. Penghambat utama: serialization User sensitif, scope akses objek, session revocation, generic workflow yang melewati otoritas domain, konfigurasi container tidak konsisten, serta dependency dengan advisory kritis. Masalah fungsional lain mencakup mock queues, consumer tidak terdaftar, schema drift, acknowledgment outbox yang terlalu dini, dan indikator/riwayat sintetis.

### Baseline dan metode

- Root: C:/Users/UBDOPS3/Herd/epms_tvmubd.
- Branch main; HEAD **789cf677a1e50daba3d894ff640ecd960597aea7**.
- Audit menguji **working tree**, termasuk perubahan awal pengguna; bukan commit bersih semata.
- Initial status: dua modified file governance dan dua untracked entries di bawah. Status awal adalah baseline yang dipertahankan.
- Fingerprint824 file tracked + untracked nonignored,0 tracked missing: **cce4be73ab851b825f35c74b2f3cad665b0c24293d93d94f0bc601d018dc3896**.
- SHA256 dari git diff --binary: **6e07057c818d534e741b03fa99951b5f9f316ec82c5e0eb62d20f65eec38ed14**.
- Fingerprint mengurutkan unique paths dari git ls-files -co --exclude-standard -z lalu hash path + NUL + file bytes. Bukan hash node_modules, .git, atau seluruh ignored files.
- Tidak ada file awal yang sengaja ditulis, dipindah, dihapus, dipulihkan atau dinormalisasi. .env dibaca privat hanya untuk koneksi; nilainya tidak dicetak.
- Build/test/cache/output dibuat di workspace eksternal: C:/Users/UBDOPS3/.codex/visualizations/2026/10/16/01a14581-faa6-7d62-a057-e58caedd0004/epms-audit-20261021. node_modules merujuk dependency yang sudah ada melalui junction. Tidak ada install/upgrade.
- Tidak bootstrap aplikasi baru, restart service, login browser, klik notification, migration, seed, deployment, git branch/commit/tag atau business mutation.

Initial status:

```text
 M frontend/src/components/governance/ProjectGovernanceTaskCenter.module.css
 M frontend/src/components/governance/ProjectGovernanceTaskCenter.tsx
?? frontend/src/components/governance/__tests__/projectGovernanceMobileResponsive.test.ts
?? scratch/
```

### Arsitektur yang benar-benar ditemukan

| Aspek | Kondisi diperiksa |
|---|---|
| Repository | Satu repository, backend dan frontend package terpisah; tidak ada root package.json |
| Backend | NestJS core10.4.22, TypeScript5.9.3, TypeORM0.3.30, mysql2 3.22.6, BullMQ5.80.9; event emitter dan outbox |
| Frontend | Next.js14.2.35 App Router, React18.3.1, AntD5.29.3, React Query5, Socket.IO; bukan asumsi SWR |
| Package management | npm; dua package-lock v3; manifest dependency root cocok lock root; clean npm ci belum dijalankan |
| Test runtime | Backend Jest29.7/ts-jest29.4.11; frontend Jest30.5.2/ts-jest29.4.12; host Node24.18.1 |
| Data | Live configured database MySQL9.7.1,61 tabel InnoDB; compose menyebut mysql:8. Bukan bukti compatibility lintas versi |
| Schema | synchronize:false;37 migration files dan37 ledger rows; baseline SQL lokal ignored; tabel pdf_templates hilang |
| Async | Transactional outbox pada sejumlah domain; emit langsung pada lainnya; queue email/PDF masih mock |
| Delivery | Notification persistence, Inbox aggregation, BusinessSync dan WebSocket ada; multi-node Redis adapter tidak locked |
| Ops | Dockerfiles, docker-compose, GitLab CI, GitHub E2E; real staging/prod infrastructure tidak diakses |

### Cakupan A1–A12 dan batas kesimpulan

| Audit | Hasil |
|---|---|
| A1 Repository | Baseline dirty dipertahankan; type resolution/build PASS. Listener orphan terbukti. Diff dari a8f5967 ke HEAD berisi27 penghapusan test,0 penghapusan source pada rentang itu. Angka historis146 tidak diterima sebagai fakta snapshot ini. Tidak menyarankan restore massal. |
| A2 Build | Backend typecheck/build PASS; frontend typecheck/build PASS termasuk33 static pages. Full Nest DI boot exact working tree NOT VERIFIED karena boot dapat menjalankan scheduler/relay. |
| A3 Database |11 tabel cocok nama/jumlah kolom;17 nullable differences;1 entity table missing. FK/index/ledger diperiksa selektif. Full type/default/collation compatibility dan clean bootstrap NOT VERIFIED. |
| A4 Security | JWT signature/expiry guard ada; object scope/session/serialization FAIL pada jalur yang dicatat. Tenant isolation dan perimeter eksternal NOT VERIFIED. |
| A5 Workflow |7 definition keys/9 versions dibaca dari DB; task locks/transitions/outbox ada. Domain authorization dan admin stubs FAIL; crash/concurrency NOT VERIFIED. |
| A6 Lifecycle | Urutan graph canonical ditemukan; Director completion dipisah dari kickoff. Return paths ada. Seluruh lifecycle live actor-by-actor NOT VERIFIED. |
| A7 Operations | Domain WBS/RAB/schedule/progress, procurement material/service, finance dan closure ada. Read scope, integration consumers, fake metrics/document verify menghambat rilis. |
| A8 Event/inbox | History endpoint ada;168 outbox PUBLISHED; task/domain projections ada. PUBLISHED tidak membuktikan consumer sukses. Service claim Bell writer incompatibility terbukti. |
| A9 UI | Route build/implementation/Jest diperiksa; role/read/deep-link/error gaps ada. Visual mobile dan live cache integration NOT VERIFIED. |
| A10 Tests | Inventory91 backend Jest files,75 frontend Jest files,31 browser specs;15 backend+75frontend suite dieksekusi. Lihat Report4. |
| A11 Operations | Container/queue/readiness/CI/dependency controls FAIL. Restore, load, failover dan resource isolation NOT VERIFIED. |
| A12 Decision | DEV CONDITIONAL GO; STAGING NO-GO; PRODUCTION NO-GO, dengan batas keputusan di Report7. |

Circular imports/DI graph menyeluruh, exact duplicate route collision scan, dan seluruh obsolete implementation reachability **NOT VERIFIED**. Build membuktikan import resolution, tidak membuktikan semua provider benar-benar dipasang. Alias PATCH/POST yang ditemukan tidak otomatis dianggap duplicate defect. Credential review terbatas pada konfigurasi/track status; full Git-history secret scanning tidak dilakukan, sehingga tidak ada klaim repository bebas secrets.

### Bukti positif yang tidak boleh dihapus oleh temuan

1. calculateProjectOverallProgress ada di ProjectService:1266; closure call dapat dikompilasi. PurchaseOrderType MATERIAL/SERVICE/LEGACY_MIXED dan scope-reconciliation fields ada; isu compile historis tidak terulang dalam build audit.
2. GET /api/v1/inbox/history ada pada current Swagger dan ditolak401 saat unauthenticated. Tidak boleh menyebut history endpoint masih hilang.
3. Live graph management review: HOO→Procurement→Finance→Director→Ready for Kickoff. Proyek4 masih PLANNING setelah workflow COMPLETED dan review READY_FOR_KICKOFF, konsisten dengan formal kickoff terpisah.
4. Payment execution memiliki pessimistic locks, status approved, invoice verification, amount checks dan checker-versus-payer guard. Audit tidak menemukan bukti pembayaran ganda pada snapshot.
5. Outbox zero-listener tetap PENDING. Snapshot sekarang tidak memiliki pending/failed event; temuan pending historis tidak digeneralisasi.
6. Orphan checks untuk task→instance, transition→instance, payment-request→invoice dan claim→PO masing-masing0. Active workflow duplicates0 dan notification non-null dedupe duplicates0.
7. Link finance historis /finance/payments/:id dan /projects/pos/:id tidak ditemukan pada notification snapshot; source finance sudah memakai route workspace baru.

## REPORT 2 — Detailed technical findings

Definisi: VERIFIED FACT adalah hasil inspeksi/kinerja yang benar-benar diamati; INFERRED RISK adalah konsekuensi yang masuk akal tetapi belum direproduksi; NOT VERIFIED berarti bukti belum tersedia; HISTORICAL ISSUE tidak dihitung sebagai cacat aktif tanpa bukti sekarang. Status FAIL dapat merujuk kontrak source/config yang salah walaupun exploit runtime tidak dijalankan. Semua langkah reproduksi bisnis di bawah adalah rekomendasi untuk lingkungan disposable, bukan aksi yang dilakukan pada data aktif.

### AUD-A4-001 — Sensitive User fields ikut response entity

| Field | Evidence |
|---|---|
|Module / Severity|Workflow/Auth serialization / **P0**|
|Status / classification|**FAIL** / VERIFIED FACT (source); HTTP disclosure NOT VERIFIED|
|Location|[backend/src/entities/user.entity.ts:12](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/user.entity.ts:12>); [backend/src/modules/workflow-engine/workflow-engine.service.ts:1389](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:1389>); [backend/src/modules/workflow-engine/workflow-engine.service.ts:1464](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:1464>); [backend/src/modules/auth/auth.service.ts:286](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/auth.service.ts:286>)|
|Expected|Response harus memakai DTO allowlist tanpa password hash/token store.|
|Actual / supporting evidence|User.passwordHash dan refreshToken selectable default. getInstance memuat tasks.decidedByUser; getTransitions memuat actor dan mengembalikan entity. updateProfile mengembalikan hasil save User. Transform interceptor hanya membungkus data; tidak ditemukan sanitasi field ini pada jalur tersebut.|
|Safe reproduction / audit action|Telusuri relasi User ke return controller; jangan mengambil nilai hash untuk membuktikan. Pemeriksaan HTTP dengan akun/fixture disposable masih diperlukan.|
|Business/technical impact|Kredensial ter-hash dan metadata akun berpotensi terpapar kepada pemanggil sah; endpoint workflow juga tidak membatasi objek berdasarkan caller.|
|Recommended remediation|Gunakan response DTO allowlist dan select:false untuk rahasia; review seluruh nested relations. Tambahkan pengujian serialization tanpa mencetak rahasia.|

### AUD-A4-002 — PM tidak dibatasi ke proyek sendiri pada sejumlah read API

| Field | Evidence |
|---|---|
|Module / Severity|Finance/Procurement/Workflow object scope / **P0**|
|Status / classification|**FAIL** / VERIFIED FACT (source); cross-user HTTP NOT VERIFIED|
|Location|[backend/src/modules/finance/finance.controller.ts:221](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.controller.ts:221>); [backend/src/modules/finance/finance.service.ts:2298](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts:2298>); [backend/src/modules/procurement/procurement.controller.ts:411](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement.controller.ts:411>); [backend/src/modules/procurement/service-claim.service.ts:1607](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/service-claim.service.ts:1607>); [backend/src/modules/workflow-engine/workflow.controller.ts:56](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.controller.ts:56>)|
|Expected|PM hanya membaca entity proyek yang menjadi tanggung jawabnya.|
|Actual / supporting evidence|Invoice/payment reads menerima role PROJECT_MANAGER tetapi service tidak menerima actor/project scope. Service-claim list/detail menerima filter opsional atau ID tanpa caller. Workflow get-by-id/transitions juga tidak membawa caller. Pengamanan ProjectService tidak otomatis berlaku pada controller lain.|
|Safe reproduction / audit action|Bandingkan signature controller/service dan WHERE query. Reproduksi dua PM berbeda dengan fixture isolated; belum dilakukan pada data bisnis.|
|Business/technical impact|Paparan nilai invoice, pembayaran, klaim jasa, dan workflow proyek lain.|
|Recommended remediation|Terapkan policy object-level di service/query bersama; wajibkan scope untuk semua list/detail, bukan hanya UI. Uji PM pemilik, PM lain, dan role gabungan.|

### AUD-A4-003 — Revokasi session dan akun nonaktif tidak ditegakkan oleh autentikasi

| Field | Evidence |
|---|---|
|Module / Severity|Auth/session / **P0**|
|Status / classification|**FAIL** / VERIFIED FACT (source); token replay NOT VERIFIED|
|Location|[backend/src/modules/auth/jwt.strategy.ts:15](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/jwt.strategy.ts:15>); [backend/src/modules/auth/auth.service.ts:51](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/auth.service.ts:51>); [backend/src/modules/auth/auth.service.ts:154](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/auth.service.ts:154>); [backend/src/modules/auth/user-session.service.ts:72](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/user-session.service.ts:72>); [backend/src/modules/auth/user-session.service.ts:126](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/user-session.service.ts:126>)|
|Expected|Akun nonaktif dan session yang direvoke tidak boleh login/refresh atau tetap mendapat otoritas bisnis.|
|Actual / supporting evidence|JwtStrategy mengembalikan claim tanpa lookup status akun/session. validateUser dan refreshToken tidak memeriksa isActive. revokeSession/forceLogoutAllSessions mengubah user_sessions.is_active, sedangkan refresh memeriksa token store users.refreshToken, tidak status session.|
|Safe reproduction / audit action|Baca seluruh jalur login, refresh, strategy, dan revoke. Tidak melakukan login/logout/revoke pada lingkungan aktif.|
|Business/technical impact|Offboarding/force logout tidak menghilangkan akses sesuai harapan; role dalam token dapat bertahan sampai expiry.|
|Recommended remediation|Satukan session identity dan revocation/version check, cek active user pada login/refresh, serta kebijakan invalidasi access token. Uji revoked token, disabled user, role change, multi-device.|

### AUD-A5-001 — Generic workflow API melewati batas otoritas bisnis

| Field | Evidence |
|---|---|
|Module / Severity|Workflow authorization/domain gates / **P0**|
|Status / classification|**FAIL** / VERIFIED FACT (source + DB assignment); business mutation NOT EXECUTED|
|Location|[backend/src/modules/workflow-engine/workflow.controller.ts:44](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.controller.ts:44>); [backend/src/modules/workflow-engine/workflow.controller.ts:92](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.controller.ts:92>); [backend/src/modules/workflow-engine/workflow-engine.service.ts:108](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:108>); [backend/src/modules/workflow-engine/workflow-engine.service.ts:1218](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:1218>); [backend/src/modules/project/project.service.ts:4192](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.ts:4192>)|
|Expected|Start/complete wajib memenuhi domain authorization, ownership, readiness, dan SoD; SUPER_ADMIN bukan pemberi approval bisnis universal.|
|Actual / supporting evidence|Start menerima workflowKey/entity/context tanpa domain-role check. Complete mengabaikan instance ID pada URL dan memakai taskId. validateActorAuthorization langsung menerima SUPER_ADMIN, menerima role walau assignee user berbeda, dan fail-open bila assignment kosong. Generic RESUBMIT tidak menjalankan gate persisted revision milik ProjectService. Live task51 instance20 proyek5 adalah PM revision dengan assignee_user_id NULL; owner proyek user2. Graph PM revision hanya role.|
|Safe reproduction / audit action|Trace controller→engine→actor guard dan bandingkan domain submit/closure guards. SELECT task assignment membuktikan kondisi konkret. Tidak mengeksekusi complete/start.|
|Business/technical impact|PM lain dapat memenuhi guard role tugas revisi; admin dapat melangkahi pemisahan tugas. Kebenaran approval/readiness tidak dijamin pada seluruh entry point.|
|Recommended remediation|Batasi public generic mutations; delegasikan ke domain policy yang sama. Ikat task ke instance/entity/owner, deny assignment kosong, dan hapus super-admin business bypass. Uji negative authorization setiap endpoint.|

### AUD-A11-001 — Konfigurasi container bawaan tidak konsisten

| Field | Evidence |
|---|---|
|Module / Severity|Deployment/container / **P0**|
|Status / classification|**FAIL** / VERIFIED FACT (configuration); container launch NOT VERIFIED|
|Location|[frontend/Dockerfile:9](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/Dockerfile:9>); [docker-compose.yml:42](<C:/Users/UBDOPS3/Herd/epms_tvmubd/docker-compose.yml:42>); [docker-compose.yml:73](<C:/Users/UBDOPS3/Herd/epms_tvmubd/docker-compose.yml:73>); [backend/src/modules/auth/auth.module.ts:15](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/auth.module.ts:15>); [frontend/next.config.js:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/next.config.js:1>)|
|Expected|Image dan compose harus sepakat port, secrets, API routing dan build-time public env.|
|Actual / supporting evidence|Frontend final image memakai PORT80 tetapi compose memetakan3000:3000 tanpa override. Backend compose tidak memasok JWT_SECRET; image backend tidak membawa backend/.env. Public API di compose mengarah localhost4000, diberikan saat runtime, sementara NEXT_PUBLIC config dibundel saat build. Final frontend tidak menyalin next.config.js. Local successful build tidak menguji container wiring.|
|Safe reproduction / audit action|Bandingkan Dockerfile, compose, AuthModule, Next config; jangan menjalankan container pada database aktif.|
|Business/technical impact|Deploy bawaan dapat gagal boot/auth atau frontend tidak dapat dijangkau/berkomunikasi dengan API.|
|Recommended remediation|Definisikan kontrak env yang tervalidasi, port tunggal, server-side proxy service-name dan public URL build-time; gunakan immutable image dan uji isolated deployment.|

### AUD-A11-002 — Dependency production terkena advisory kritis

| Field | Evidence |
|---|---|
|Module / Severity|Dependency security / **P0**|
|Status / classification|**FAIL** / VERIFIED FACT (registry + installed version); exploitation NOT VERIFIED|
|Location|[frontend/package-lock.json:9027](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/package-lock.json:9027>); [backend/package-lock.json:9367](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/package-lock.json:9367>); [frontend/package.json:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/package.json:1>); [backend/package.json:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/package.json:1>)|
|Expected|Dependency rilis bebas advisory kritis yang relevan, atau memiliki mitigasi terdokumentasi dan tervalidasi.|
|Actual / supporting evidence|npm audit --omit=dev: backend24 paket terdampak (1critical/12high/9moderate/2low), frontend6 (1critical/5high). Next terpasang14.2.35 masuk GHSA-p293-qw3h-jr36 untuk Windows-hosted App/Pages Router; host audit Windows. proxy-addr juga critical tetapi exploit tergantung trust subnet tertentu yang belum dibuktikan terpakai.|
|Safe reproduction / audit action|Audit registry read-only dijalankan setelah DNS sandbox gagal lalu retry berizin. Advisory Next dan proxy-addr diverifikasi dari maintainer. Tidak menjalankan exploit atau npm audit fix.|
|Business/technical impact|Exposure kritis pada deployment Windows yang memenuhi kondisi advisory; jumlah audit adalah paket terdampak, bukan jumlah exploit terbukti.|
|Recommended remediation|Triage reachability dan upgrade terencana ke versi patched/supported; verifikasi proxy trust, upload/socket dependencies dan Next regressions. Jangan memakai npm audit fix --force secara buta.|

### AUD-A1-001 — Listener rekonsiliasi procurement tidak terdaftar

| Field | Evidence |
|---|---|
|Module / Severity|Nest module registration/Procurement / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source); persisted stale package NOT VERIFIED|
|Location|[backend/src/modules/procurement/procurement-event.listener.ts:6](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement-event.listener.ts:6>); [backend/src/modules/procurement/procurement.module.ts:68](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement.module.ts:68>); [backend/src/modules/procurement/procurement-package.service.ts:1070](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement-package.service.ts:1070>); [backend/src/modules/procurement/procurement-package.service.ts:1471](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement-package.service.ts:1471>)|
|Expected|Listener yang menghubungkan GR/payment/PR rejection dengan package harus terinstansiasi.|
|Actual / supporting evidence|ProcurementEventListener hanya ditemukan dalam file definisinya, tidak menjadi provider. Satu-satunya caller closeCompletedPackageForPo dan handlePrRejection di production source ada di listener tersebut.|
|Safe reproduction / audit action|Cari nama class dan kedua method di seluruh production source, inspeksi providers. Tidak memicu event bisnis.|
|Business/technical impact|Paket bisa tetap terbuka atau tidak mencerminkan PR rejection; kode ada namun tidak aktif.|
|Recommended remediation|Daftarkan consumer dengan dependency benar setelah menentukan canonical events; uji module bootstrap dan transaksi real isolated, bukan listener yang diinstansiasi manual saja.|

### AUD-A3-001 — Tabel pdf_templates tidak ada

| Field | Evidence |
|---|---|
|Module / Severity|Schema/Contract PDF templates / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (DB metadata + entity)|
|Location|[backend/src/entities/pdf-template.entity.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/pdf-template.entity.ts:1>); [backend/src/modules/contract/pdf-template.service.ts:13](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/pdf-template.service.ts:13>); [backend/src/modules/contract/contract.module.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract.module.ts:1>)|
|Expected|Entity yang digunakan service terdaftar harus memiliki schema kompatibel.|
|Actual / supporting evidence|Metadata entity memuat pdf_templates; information_schema pada DB terhubung tidak memuatnya. Schema sync dimatikan. Sebelas tabel prioritas lain cocok pada nama/jumlah kolom; itu tidak menutupi tabel yang hilang.|
|Safe reproduction / audit action|SELECT information_schema.tables, bandingkan offline TypeORM metadata. Endpoint tidak dipanggil untuk menghindari side effect.|
|Business/technical impact|Operasi template dapat gagal table-not-found; bootstrap/migration completeness belum terbukti.|
|Recommended remediation|Susun migration dan bootstrap plan ter-review pada fase implementasi, uji clean install dan upgrade snapshot isolated. Jangan synchronize pada database bisnis.|

### AUD-A5-002 — Rollback/override mengklaim sukses tanpa perubahan workflow

| Field | Evidence |
|---|---|
|Module / Severity|Workflow admin intervention / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/workflow-engine/workflow.service.ts:136](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.service.ts:136>); [backend/src/modules/workflow-engine/workflow.service.ts:256](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.service.ts:256>); [backend/src/modules/workflow-engine/workflow.controller.ts:136](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.controller.ts:136>)|
|Expected|Aksi admin harus atomik dan benar-benar mengubah state yang dilaporkan, atau dinonaktifkan secara eksplisit.|
|Actual / supporting evidence|rollbackWorkflow dan adminOverrideApprove mengirim event/log/socket lalu sukses tanpa persistence instance/task/transition. reassign mempunyai transaksi nyata, sehingga tidak disamakan dengan kedua stub ini.|
|Safe reproduction / audit action|Baca implementasi penuh kedua method dan return. Tidak memanggil endpoint karena audit.log/socket dapat bermutasi.|
|Business/technical impact|Operator percaya recovery/approval berhasil padahal state bisnis tidak berubah.|
|Recommended remediation|Disable exposed stubs sampai ada desain recovery berotoritas, alasan wajib, snapshot, transaksi, audit dan regression checks.|

### AUD-A5-003 — Visualizer mengembalikan workflow dan riwayat contoh

| Field | Evidence |
|---|---|
|Module / Severity|Workflow visualization/history / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/workflow-engine/workflow.service.ts:286](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.service.ts:286>); [backend/src/modules/workflow-engine/workflow.controller.ts:125](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.controller.ts:125>)|
|Expected|Diagram dan riwayat harus berasal dari instance/version/transition yang diminta.|
|Actual / supporting evidence|getWorkflowVisualizerData memakai generateSampleBpmnXml, node tetap, nama approver/history contoh dan waktu relatif; tidak mengambil instance dari DB.|
|Safe reproduction / audit action|Telusuri method GET visualizer dan sample generator; tidak menganggap riwayat Inbox yang terpisah ikut palsu.|
|Business/technical impact|Audit pengguna/keputusan pada layar visualizer bisa menyesatkan.|
|Recommended remediation|Bangun projection dari version snapshot, task dan transitions; tampilkan unavailable bila data tidak ada. Uji dua instance dengan sejarah berbeda.|

### AUD-A5-004 — Pembuatan instance aktif berpotensi race

| Field | Evidence |
|---|---|
|Module / Severity|Workflow idempotency / **P1**|
|Status / classification|**NOT VERIFIED** / INFERRED RISK|
|Location|[backend/src/modules/workflow-engine/workflow-engine.service.ts:153](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:153>); [backend/src/entities/workflow-instance.entity.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/workflow-instance.entity.ts:1>)|
|Expected|Permintaan start bersamaan untuk entity yang sama hanya menghasilkan satu active instance.|
|Actual / supporting evidence|Pemeriksaan existing active instance terjadi sebelum pembuatan transaksi; index entity_type/entity_id/status di DB nonunique. Snapshot active duplicates0. Interleaving concurrent belum dijalankan.|
|Safe reproduction / audit action|Inspeksi check-before-create dan index metadata. Reproduksi hanya pada DB isolated dengan dua start bersamaan.|
|Business/technical impact|Potensi approval/task ganda dan state bisnis bercabang.|
|Recommended remediation|Gunakan lock entity/unique active identity/idempotency key yang cocok dengan MySQL dan lifecycle terminal; uji retry/concurrency.|

### AUD-A5-005 — Sinkronisasi workflow dan management review tidak durable satu transaksi

| Field | Evidence |
|---|---|
|Module / Severity|Workflow→Project projection / **P1**|
|Status / classification|**NOT VERIFIED** / INFERRED RISK based on VERIFIED source|
|Location|[backend/src/modules/workflow-engine/workflow-engine.service.ts:460](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:460>); [backend/src/modules/project/project-event.listener.ts:24](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-event.listener.ts:24>); [backend/src/modules/project/project.service.ts:4245](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.ts:4245>); [backend/src/modules/project/project.service.ts:4261](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.ts:4261>)|
|Expected|Commit workflow dan projection bisnis tidak boleh divergen tanpa durable retry.|
|Actual / supporting evidence|Engine memancarkan internal.workflow.task.completed dengan emit; listener async menangkap/log error. Saat memakai external manager, emit dapat mendahului commit luar. Submit membuat instance lalu transaksi review terpisah. Tidak ada bukti kegagalan parsial aktual dalam snapshot.|
|Safe reproduction / audit action|Trace transaction owner dan listener; lakukan fault injection hanya pada isolated DB.|
|Business/technical impact|Task, gate dan status review dapat berbeda saat crash/rollback, menyebabkan tugas hilang/terkunci.|
|Recommended remediation|Persist domain projection bersama perubahan authoritative atau durable outbox consumer dengan retry/idempotency. Uji rollback outer transaction dan crash boundaries.|

### AUD-A5-006 — RESUBMIT/ASSIGN_PM tercatat dengan status tugas RETURNED

| Field | Evidence |
|---|---|
|Module / Severity|Workflow history semantics / **P2**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/workflow-engine/workflow-engine.service.ts:350](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:350>); [backend/src/modules/workflow-engine/workflow-engine.service.ts:411](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-engine.service.ts:411>)|
|Expected|Task history harus membedakan selesai, dikembalikan, ditolak dan resubmit.|
|Actual / supporting evidence|Assignment status hanya membedakan APPROVE/REJECT; tindakan lain mengikuti RETURNED. Event task.returned juga dipakai untuk RESUBMIT. Transition action menyimpan detail yang dapat dipakai membedakan.|
|Safe reproduction / audit action|Baca mapping status/event dan bandingkan actions graph. Tidak menyimpulkan instance gagal bergerak.|
|Business/technical impact|Riwayat/metric returned dapat salah ditafsirkan walau transisi instance berhasil.|
|Recommended remediation|Pisahkan terminal task completion dari outcome/action; migrasi projection historis dengan menjaga raw transition.|

### AUD-A6-001 — Fingerprint revisi memakai freshness timestamp, bukan perubahan isi

| Field | Evidence |
|---|---|
|Module / Severity|Operational plan revision / **P2**|
|Status / classification|**NOT VERIFIED** / INFERRED RISK / requirement gap|
|Location|[backend/src/modules/project/operational-readiness.validator.ts:508](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/operational-readiness.validator.ts:508>); [backend/src/modules/project/project.service.ts:4192](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.ts:4192>)|
|Expected|Jika fingerprint dimaksudkan membuktikan revisi substantif, no-op save tidak cukup; setiap return cycle harus jelas.|
|Actual / supporting evidence|evaluateRevisionPersistence membandingkan waktu persist komponen terhadap return. Tidak ditemukan content hash di jalur ini. Guard penyimpanan revisi memang ada, tetapi bukti isi berubah lebih kuat belum ada. Runtime memakai node_pm_revision_*; legacy literal PM_REVISION belum dibuktikan kompatibel end-to-end.|
|Safe reproduction / audit action|Inspeksi validator dan fixtures; tidak menyimpan no-op pada DB aktif.|
|Business/technical impact|Revisi dapat memenuhi freshness tanpa menyelesaikan catatan reviewer; kompatibilitas legacy bisa menahan resubmit.|
|Recommended remediation|Konfirmasi kontrak fingerprint; bila wajib, gunakan canonical persisted snapshot/version/hash dan return-cycle identity. Uji no-op, partial save, legacy state dan stale reviewer.|

### AUD-A7-001 — Keputusan stale dapat mengenai siklus resubmit baru

| Field | Evidence |
|---|---|
|Module / Severity|Payment request concurrency / **P1**|
|Status / classification|**NOT VERIFIED** / INFERRED RISK|
|Location|[backend/src/modules/finance/finance.service.ts:2647](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts:2647>); [backend/src/modules/finance/finance.service.ts:2772](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.ts:2772>); [backend/src/modules/finance/finance.controller.ts:130](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.controller.ts:130>); [backend/src/modules/finance/dto/decide-payment-request.dto.ts:16](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/dto/decide-payment-request.dto.ts:16>)|
|Expected|Director harus menyetujui versi request/amount/snapshot yang ia lihat.|
|Actual / supporting evidence|Decision mengunci row dan memeriksa PENDING_DIRECTOR_APPROVAL tetapi tidak menerima expected version/cycle. Return→resubmit mengembalikan ID yang sama ke status pending. Lock mencegah simultaneous update, tidak membedakan stale screen dari revisi baru.|
|Safe reproduction / audit action|Static trace DTO/service; reproduksi dua actor dan interleaving hanya di disposable DB. Payment tidak dilakukan.|
|Business/technical impact|Approval dapat berlaku pada isi yang belum direview. Bukan bukti pembayaran ganda aktual.|
|Recommended remediation|Wajibkan optimistic revision/cycle token dan snapshot equality pada approve/return; revalidate nominal. Pertahankan invoice/request locks dan checker-versus-payer guard yang sudah ada.|

### AUD-A7-002 — Endpoint tren memakai angka acak

| Field | Evidence |
|---|---|
|Module / Severity|Dashboard metrics / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/dashboard/dashboard.service.ts:404](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/dashboard/dashboard.service.ts:404>); [backend/src/modules/dashboard/dashboard.controller.ts:60](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/dashboard/dashboard.controller.ts:60>)|
|Expected|Tren bisnis bersumber data aktual tervalidasi atau explicit unavailable.|
|Actual / supporting evidence|Series completed/onHold dibuat dengan Math.random dan formula hari. Temuan dibatasi endpoint ini; executive-summary dan seluruh halaman dashboard tidak otomatis dinyatakan palsu.|
|Safe reproduction / audit action|Inspeksi get trend implementation dan controller pemanggil; tidak mengutip angka random sebagai data bisnis.|
|Business/technical impact|Konsumen API dapat mengambil keputusan dari metric sintetis.|
|Recommended remediation|Ganti dengan query/projection berbasis tanggal aktual dan definisi KPI; missing data harus unavailable. Uji determinisme dan reconciliation ke DB.|

### AUD-A7-003 — Verifikasi integritas tidak membaca PDF sebenarnya

| Field | Evidence |
|---|---|
|Module / Severity|Contract document integrity / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/contract/contract.service.ts:325](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract.service.ts:325>); [backend/src/modules/contract/contract.controller.ts:200](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract.controller.ts:200>)|
|Expected|Verify harus menghitung hash file versi persisted dan membandingkan dengan trusted stored hash.|
|Actual / supporting evidence|Method membuat Buffer dari string PDF_BINARY_CONTENT_CONTRACT..., lalu fallback storedHash ke computedHash bila tidak ada. Menghasilkan VERIFIED/INTACT dan audit event tanpa membaca binary dokumen.|
|Safe reproduction / audit action|Inspeksi method, bukan GET verify karena GET ini sendiri emit audit.log. Tidak dijalankan.|
|Business/technical impact|Dokumen berubah/hilang dapat dinyatakan intact; audit trail memberi keyakinan palsu.|
|Recommended remediation|Verifikasi exact persisted version/file bytes, fail closed bila hash/file hilang, pisahkan read verification dari audit side effect dan uji tamper/missing file.|

### AUD-A8-001 — PUBLISHED berarti ada listener, bukan consumer selesai

| Field | Evidence |
|---|---|
|Module / Severity|Outbox delivery / **P1**|
|Status / classification|**NOT VERIFIED** / VERIFIED mechanism; INFERRED loss risk|
|Location|[backend/src/modules/system/outbox-relay.service.ts:68](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/outbox-relay.service.ts:68>); [backend/src/modules/notification/canonical-notification.consumer.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification.consumer.ts:1>); [backend/src/modules/notification/business-sync.consumer.ts:62](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/business-sync.consumer.ts:62>)|
|Expected|Durable acknowledgement harus mengikuti keberhasilan consumer wajib, dan retry harus bisa mengulang kegagalan.|
|Actual / supporting evidence|Relay memakai Boolean(eventEmitter.emit(...)), lalu PUBLISHED dan commit. Promise listener async tidak ditunggu; satu listener refresh cukup membuat delivered true. Zero listener tetap PENDING (benar). Live168/168 PUBLISHED tidak membuktikan semua notification/project side effects selesai.|
|Safe reproduction / audit action|Trace emit versus async consumers. Snapshot SELECT hanya status producer. Fault injection tidak dilakukan.|
|Business/technical impact|Event berstatus sukses walau projection/notifikasi gagal sesudahnya; retry relay tidak menjemput PUBLISHED lagi.|
|Recommended remediation|Definisikan required consumers, durable delivery/consumer receipt, retry dan idempotency per event. Hindari menyamakan emitAsync saja dengan exactly-once transaction.|

### AUD-A8-002 — Producer service claim melanggar kontrak Bell writer

| Field | Evidence |
|---|---|
|Module / Severity|Service claim notification / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/procurement/service-claim.service.ts:947](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/service-claim.service.ts:947>); [backend/src/modules/notification/canonical-notification.writer.ts:169](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification.writer.ts:169>); [backend/src/modules/inbox/inbox.service.ts:457](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/inbox/inbox.service.ts:457>)|
|Expected|To-Do tetap actionable; Bell bila diperlukan memakai tipe informasional yang valid.|
|Actual / supporting evidence|Submit claim mengirim type TASK ke writer yang melempar ACTIONABLE_TASK_NOT_ALLOWED; exception ditangkap dan hanya log. Inbox sudah memproyeksikan task service claim dari domain, jadi ini bukan bukti semua task hilang. BusinessSync service-claim listeners ada tetapi refresh bukan Bell persistence.|
|Safe reproduction / audit action|Bandingkan literal type dan validator writer. Klaim tidak disubmit selama audit.|
|Business/technical impact|Notifikasi PM yang dimaksud producer tidak tersimpan melalui jalur itu; pengguna dapat terlambat mengetahui tugas.|
|Recommended remediation|Pertahankan pemisahan task/Bell, ubah kontrak producer terencana dan pastikan notification policy setiap technical/commercial transition. Uji persisted notification + correct recipient, bukan hanya socket.|

### AUD-A8-003 — PO/GR memakai emit setelah transaksi tanpa outbox pada jalur yang diperiksa

| Field | Evidence |
|---|---|
|Module / Severity|Procurement event durability / **P1**|
|Status / classification|**NOT VERIFIED** / INFERRED RISK based on VERIFIED source|
|Location|[backend/src/modules/procurement/procurement.service.ts:829](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement.service.ts:829>); [backend/src/modules/procurement/procurement.service.ts:1026](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement.service.ts:1026>)|
|Expected|Perubahan bisnis dan event wajib tersimpan atomik agar crash tidak menghilangkan delivery.|
|Actual / supporting evidence|Canonical procurement.po.issued dan procurement.gr.received ada dan nama consumer cocok; producer melakukan emit sesudah commit tanpa record OutboxEvent di jalur ini. GR juga emit legacy gr.created.|
|Safe reproduction / audit action|Baca batas transaksi dan producer; jangan menyebut mismatch nama historis sebagai defect kini.|
|Business/technical impact|Crash setelah commit sebelum emit meninggalkan UI/consumer stale tanpa replay.|
|Recommended remediation|Persist canonical event dalam transaksi bisnis dan konsolidasikan legacy bridge; uji crash sesudah commit dan duplicate delivery.|

### AUD-A8-004 — Redis adapter tidak dideklarasikan/terkunci

| Field | Evidence |
|---|---|
|Module / Severity|WebSocket horizontal scale / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (dependency/config); multi-node behavior NOT VERIFIED|
|Location|[backend/src/modules/notification/redis-io.adapter.ts:20](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/redis-io.adapter.ts:20>); [backend/package.json:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/package.json:1>); [backend/package-lock.json:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/package-lock.json:1>)|
|Expected|Socket room delivery multi-instance memakai dependency reproducible dan gagal readiness bila wajib tidak tersedia.|
|Actual / supporting evidence|Adapter dynamic require @socket.io/redis-adapter; package tidak ada di manifest/lock. Catch fallback lokal memungkinkan app tetap berjalan tanpa cross-node fanout.|
|Safe reproduction / audit action|Bandingkan require dengan package manifest/lock; tidak menginstal package atau menjalankan cluster.|
|Business/technical impact|Notifikasi realtime antar pod tidak terjamin; single-process local success menutupi masalah.|
|Recommended remediation|Declare adapter kompatibel, validasi Redis isolation/auth dan fail explicit pada multi-node mode; uji dua instance, reconnect dan room scope.|

### AUD-A9-001 — Ketepatan entity/action pada sebagian tautan belum terbukti

| Field | Evidence |
|---|---|
|Module / Severity|Notification/deep links / **P2**|
|Status / classification|**NOT VERIFIED** / VERIFIED link shape (source + sampled persisted routes); INFERRED navigation gap; UI click NOT VERIFIED|
|Location|[backend/src/modules/notification/management-notification.consumer.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/management-notification.consumer.ts:1>); [backend/src/modules/procurement/service-claim.service.ts:1157](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/service-claim.service.ts:1157>); [frontend/src/components/governance/ProjectGovernanceTaskCenter.tsx:1046](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/ProjectGovernanceTaskCenter.tsx:1046>)|
|Expected|To-Do harus membuka entity/action tepat; informational Bell minimal mengarah entity relevan.|
|Actual / supporting evidence|DB memuat7 link governance/tasks?projectId=2 tanpa taskId; auto-open governance mensyaratkan taskId. Service-claim return link /procurement?claimId belum terbukti dikonsumsi untuk membuka claim. /project pada submit producer bukan route build; jalur itu juga gagal writer. Link finance lama /finance/payments/:id tidak ditemukan pada snapshot kini.|
|Safe reproduction / audit action|Bandingkan persisted route/query dengan route build dan handler auto-open. Jangan click Bell karena dapat mark-as-read.|
|Business/technical impact|Pengguna harus mencari entity manual atau memperoleh route salah; historical finance link bug tidak dinyatakan masih aktif.|
|Recommended remediation|Gunakan typed deep-link contract dengan project/entity/action IDs; pisahkan route valid dari modal benar-benar terbuka. Uji Edge read-only navigation pada fixture.|

### AUD-A9-002 — Kegagalan sumber Inbox dapat tampil sebagai daftar kosong/parsial

| Field | Evidence |
|---|---|
|Module / Severity|Inbox error/empty states / **P2**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/inbox/inbox.service.ts:729](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/inbox/inbox.service.ts:729>); [backend/src/modules/inbox/inbox.service.ts:872](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/inbox/inbox.service.ts:872>); [backend/src/modules/inbox/inbox.service.ts:925](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/inbox/inbox.service.ts:925>); [frontend/src/app/(dashboard)/inbox/page.tsx:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/app/(dashboard)/inbox/page.tsx:1>)|
|Expected|Pengguna dapat membedakan tidak ada pekerjaan dengan data gagal dimuat.|
|Actual / supporting evidence|Aggregator menangkap error sumber, log, lalu return history terkumpul tanpa completeness status. Frontend fallback list kosong tidak membuktikan tidak ada tugas/riwayat.|
|Safe reproduction / audit action|Trace catch→return dan rendering empty/error; jangan memutus DB service aktif.|
|Business/technical impact|Tugas yang perlu tindakan dapat tidak terlihat tanpa indikator kegagalan.|
|Recommended remediation|Kirim partial/error metadata per source, tampilkan retry/error banner dan freshness timestamp; uji source failure independen.|

### AUD-A10-001 — Selected backend suite masih merah

| Field | Evidence |
|---|---|
|Module / Severity|Backend regression / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (executed test); business defect NOT VERIFIED|
|Location|[backend/src/modules/project/project-ownership-boundary.spec.ts:268](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-ownership-boundary.spec.ts:268>); [backend/src/modules/project/project-ownership-boundary.spec.ts:128](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-ownership-boundary.spec.ts:128>); [backend/src/modules/project/project-ownership-boundary.spec.ts:164](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-ownership-boundary.spec.ts:164>); [backend/src/modules/project/project.service.ts:4319](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.ts:4319>)|
|Expected|Suite ownership submit harus lulus dengan fixture representatif atau mengungkap regression nyata.|
|Actual / supporting evidence|15suite/336tests:14suite335test PASS;1test FAIL expected REVIEW_PENDING received NOT_SUBMITTED. Mock save tidak mengubah mock findOne yang selalu null; service return membaca ulang getManagementReview. Ini petunjuk kuat fixture persistence gap, bukan pembuktian submit live gagal.|
|Safe reproduction / audit action|Perintah lengkap di Report4. Tidak mengubah test untuk membuat hasil hijau.|
|Business/technical impact|Gate regresi tidak dapat dipercaya penuh; keberhasilan owner submit belum dibuktikan oleh suite tersebut.|
|Recommended remediation|Perbaiki stateful fixture dan tambahkan isolated DB integration untuk submit→readback; terima hasil hanya setelah expected behavior terbukti.|

### AUD-A10-002 — Canonical lifecycle belum divalidasi Edge live CDP

| Field | Evidence |
|---|---|
|Module / Severity|Live E2E/negative integration / **P1**|
|Status / classification|**NOT VERIFIED** / NOT VERIFIED|
|Location|[frontend/playwright.config.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/playwright.config.ts:1>); [frontend/tests/canonical-pure-browser-lifecycle.spec.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/canonical-pure-browser-lifecycle.spec.ts:1>); [frontend/tests/auth-session-lifecycle.spec.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/auth-session-lifecycle.spec.ts:1>)|
|Expected|Acceptance memakai Edge live, headless=false, attach CDP, actor/DB isolated.|
|Actual / supporting evidence|Tidak ada browser/session yang diubah. Konfigurasi default memiliki chromium/chromium-live/chrome; itu bukan bukti pemenuhan Edge CDP.31 browser spec diinventarisasi,0 dieksekusi. Passing Jest sebagian memakai source-string assertions/mocks.|
|Safe reproduction / audit action|Audit konfigurasi dan daftar file saja; tidak mengganti Edge dengan Chromium.|
|Business/technical impact|Role flow, modal/deep link, responsive UI dan cache/socket nyata belum terbukti.|
|Recommended remediation|Siapkan isolated environment dan akun fixture; jalankan lifecycle lengkap, negative PM/admin, return/resubmit dan payment melalui actual Edge CDP.|

### AUD-A11-003 — Email/PDF queue aktif berupa mock

| Field | Evidence |
|---|---|
|Module / Severity|Queue/worker / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/queue/queue.module.ts:9](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/queue/queue.module.ts:9>); [backend/src/modules/contract/contract.controller.ts:81](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract.controller.ts:81>); [backend/src/modules/workflow-engine/workflow.service.ts:47](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow.service.ts:47>)|
|Expected|Job acknowledgement harus berarti job durable dengan worker, retry, DLQ dan status nyata.|
|Actual / supporting evidence|Queue providers email-send,email-dlq,pdf-generation mengembalikan mock-job-id. Processor/controller imports dikomentari, providers tidak memuat worker. PDF endpoint masih mendeskripsikan dispatch async; email fallback bisa log enqueued.|
|Safe reproduction / audit action|Inspect module wiring dan endpoint caller; tidak memanggil GET PDF karena menciptakan job.|
|Business/technical impact|Email/PDF tidak diproses melalui antrean ini walau caller menganggap berhasil.|
|Recommended remediation|Ganti stub melalui fase implementasi terpisah, Redis isolated, workers nyata, observability/DLQ. Uji enqueue→worker→artifact/delivery→retry.|

### AUD-A11-004 — Pipeline belum menjadi release gate yang dapat dipercaya

| Field | Evidence |
|---|---|
|Module / Severity|CI/CD/release control / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (configuration); pipeline run NOT VERIFIED|
|Location|[.gitlab-ci.yml:14](<C:/Users/UBDOPS3/Herd/epms_tvmubd/.gitlab-ci.yml:14>); [.gitlab-ci.yml:75](<C:/Users/UBDOPS3/Herd/epms_tvmubd/.gitlab-ci.yml:75>); [.github/workflows/e2e.yml:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/.github/workflows/e2e.yml:1>); [frontend/playwright.config.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/playwright.config.ts:1>)|
|Expected|Release harus promote artifact teruji dari staging, approval, health/rollout check, schema strategy dan rollback.|
|Actual / supporting evidence|GitLab menggunakan npm install dan deploy kubectl ke epms-prod pada main tanpa explicit manual approval/rollout verification. GitHub E2E memakai konfigurasi browser noncanonical dan DB setup belum membuktikan schema/fixtures/Redis siap. HostNode24, DockerNode20, GitHubNode18 berbeda.|
|Safe reproduction / audit action|Read config; tidak menjalankan pipeline/deploy. Protected environments eksternal belum diinspeksi.|
|Business/technical impact|Green pipeline berpotensi tidak mewakili acceptance; kegagalan rollout tidak otomatis terdeteksi.|
|Recommended remediation|Pin runtime, npm ci, staged immutable promotion, explicit approval, migration compatibility check, rollout/rollback verification dan Edge acceptance artifact.|

### AUD-A11-005 — Readiness mengklaim siap produksi tanpa pemeriksaan memadai

| Field | Evidence |
|---|---|
|Module / Severity|Health/readiness / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (source)|
|Location|[backend/src/modules/system/observability.controller.ts:37](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/observability.controller.ts:37>); [backend/src/modules/system/observability.service.ts:85](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/observability.service.ts:85>); [backend/src/modules/notification/notification.controller.ts:92](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/notification.controller.ts:92>)|
|Expected|Health/readiness merepresentasikan dependency dan kemampuan melayani traffic, bukan klaim bisnis tetap.|
|Actual / supporting evidence|readinessStatus literal 100% PRODUCTION READY. Probe file storage fixed UP; DEGRADED dianggap healthy; controller tidak mengimplementasikan respons503 yang dijanjikan. Notification health menyatakan CONNECTED tanpa membuktikan Redis/worker delivery.|
|Safe reproduction / audit action|Inspect return/probes dan HTTP semantics; tidak membuat gangguan dependency.|
|Business/technical impact|Operator/load balancer dapat menerima instance yang belum siap; dashboard memberi keyakinan palsu.|
|Recommended remediation|Pisahkan liveness/readiness/business readiness; ukur dependency wajib dan status HTTP; uji DB/Redis/disk/queue failure terisolasi.|

### AUD-A11-006 — Staging isolation dan pemulihan produksi belum terbukti

| Field | Evidence |
|---|---|
|Module / Severity|Recovery/environment isolation / **P1**|
|Status / classification|**NOT VERIFIED** / NOT VERIFIED|
|Location|[docker-compose.yml:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/docker-compose.yml:1>); [.gitlab-ci.yml:75](<C:/Users/UBDOPS3/Herd/epms_tvmubd/.gitlab-ci.yml:75>)|
|Expected|Staging memiliki DB/Redis/bucket/secrets sendiri dan recovery memiliki RPO/RTO teruji.|
|Actual / supporting evidence|Audit hanya mengakses local configured DB dan source. Tidak ada restore drill, backup integrity, production topology, protected-environment settings atau rollback rehearsal yang diverifikasi. Dokumen prosedur tidak setara bukti eksekusi.|
|Safe reproduction / audit action|Read-only configuration review; tidak backup/restore/deploy karena di luar audit.|
|Business/technical impact|Tidak dapat menjamin data bisnis pulih atau SIT tidak menyentuh produksi.|
|Recommended remediation|Sediakan bukti env boundaries, restore ke disposable target, backup encryption/access, migration rollback/forward plan dan rehearsal dengan RPO/RTO.|

### AUD-A4-004 — Kontrol perimeter dan isolasi perusahaan belum lengkap terbukti

| Field | Evidence |
|---|---|
|Module / Severity|Auth hardening/organization scope / **P1**|
|Status / classification|**NOT VERIFIED** / VERIFIED source gaps; INFERRED exposure; tenant boundary NOT VERIFIED|
|Location|[backend/src/main.ts:68](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/main.ts:68>); [backend/src/modules/auth/jwt.strategy.ts:24](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/jwt.strategy.ts:24>); [backend/src/entities/user.entity.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/user.entity.ts:1>); [backend/src/app.module.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/app.module.ts:1>)|
|Expected|Allowed origins, abuse controls dan company/project boundary harus eksplisit sesuai model UBD/TVM.|
|Actual / supporting evidence|CORS fallback origin=true jika FRONTEND_URL tidak ada, credentials enabled. Tidak ditemukan global rate limiter di bootstrap/AppModule yang diperiksa. JWT companyId/branchId/tenantId memakai default; User tidak memiliki ownership company dan scoped service yang diperiksa tidak menerapkannya. Belum jelas apakah UBD/TVM wajib tenant terpisah atau unit dalam satu tenant.|
|Safe reproduction / audit action|Read source/env-presence only; tidak brute-force atau cross-tenant request. Reverse-proxy controls belum diverifikasi.|
|Business/technical impact|Risiko credential abuse dan company isolation belum ditutup; tidak diklaim sudah terjadi kebocoran antar perusahaan.|
|Recommended remediation|Tetapkan model tenancy, enforce query scope serta explicit CORS dan login/refresh throttling; uji di perimeter yang sama dengan production.|

### AUD-A3-002 — Nama kolom cocok tetapi nullability drift tetap ada

| Field | Evidence |
|---|---|
|Module / Severity|Schema constraints/bootstrap / **P1**|
|Status / classification|**FAIL** / VERIFIED FACT (entity + live metadata)|
|Location|[backend/src/entities/outbox-event.entity.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/outbox-event.entity.ts:1>); [backend/src/entities/workflow-instance.entity.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/workflow-instance.entity.ts:1>); [backend/src/entities/workflow-definition.entity.ts:1](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/entities/workflow-definition.entity.ts:1>); [.gitignore:28](<C:/Users/UBDOPS3/Herd/epms_tvmubd/.gitignore:28>); [docs/database/12_DATABASE_BASELINE_STRATEGY.md:18](<C:/Users/UBDOPS3/Herd/epms_tvmubd/docs/database/12_DATABASE_BASELINE_STRATEGY.md:18>)|
|Expected|DB menegakkan mandatory fields yang diasumsikan entity; baseline resmi dapat direproduksi dari versioned release.|
|Actual / supporting evidence|Dari201 kolom pada11 tabel prioritas,17 nullability berbeda. Outbox status/payload/event_version/retry_count/created_at nullable di DB tetapi tidak di entity; workflow_instances.workflow_version_id juga nullable di DB. workflow_definitions.name sebaliknya. Dokumen menunjuk database/epms_tvmubd_db.sql sebagai baseline; file lokal ada tetapi di-ignore *.sql dan tidak tracked. SELECT tambahan menunjukkan0 outbox dengan required field null dan0 workflow instance dengan workflow_version_id null pada snapshot.|
|Safe reproduction / audit action|Bandingkan nullable offline metadata dengan information_schema.columns; git ls-files/check-ignore untuk baseline, tanpa membuka business dump.|
|Business/technical impact|DB menerima state yang service tidak harapkan atau menolak nullable yang diizinkan entity; clean clone belum memiliki baseline resmi yang disebut dokumen.|
|Recommended remediation|Reconcile constraints dengan preflight data scan dan reviewed migration; version baseline schema-only atau bootstrap migrations lengkap tanpa meng-commit data/credentials. Uji clean install serta upgrade snapshot.|


## REPORT 3 — Canonical flow traceability

### Canonical lifecycle: sumber dan koneksi

Endpoint di bawah memakai prefix /api/v1. UI route yang disebut merupakan route source/build; keterbukaan modal dan request nyata melalui Edge **NOT VERIFIED**. Tabel menunjukkan wiring yang ditemukan, bukan pernyataan seluruh tahap lulus UAT. Required documents/guards adalah kontrol yang ditemukan, bukan menambahkan aturan bisnis baru. Actor yang sama dalam beberapa role tetap harus tunduk pada ownership/SoD.

| Tahap / owner | UI → API / controller → service | Workflow / DB / status dan transisi | Validasi/dokumen | Outbox → Inbox/notification / audit / gap |
|---|---|---|---|---|
|1 Marketing creates tender | /sales, /sales/tenders/[id] → POST marketing/tenders; MarketingController:188 → MarketingService.createTender | Tender/proposal/customer persistence; lifecycle commercial sebelum legal | DTO dan PIC identity; proposal attachment sesuai tindakan | Activity/audit paths ada; complete delivery untuk semua variasi tender NOT VERIFIED |
|2 Commercial budget/negotiation | Tender detail → PATCH marketing/tenders/:id/negotiate:223 → negotiatePrice | Proposal/negotiation/discount state | Budget/negotiation DTO; commercial approval boundaries | Discount workflow terpisah; live nominal/document reconciliation NOT VERIFIED |
|3 GO/NO-GO | Tender/Director workspace → POST marketing/tenders/:id/submit-go-no-go:404; go-no-go:417 | TENDER_GO_NOGO_WORKFLOW; node Director→end atau RETURN→Marketing revision→RESUBMIT | Submission context/PIC; graph candidateRoles Director/GENERAL_MANAGER | marketing.gonogo.submitted/approved + workflow tasks; DB masing-masing5 published. Role tambahan GENERAL_MANAGER membutuhkan business acceptance |
|3b Discount approval | Tender workspace → PATCH marketing/tenders/:id/approve-discount:232 | DISCOUNT_APPROVAL_WORKFLOW; APPROVE/REJECT→end | Discount decision DTO; candidate Director/GENERAL_MANAGER | Task assignment dan canonical consumers; keseluruhan approval negative tests NOT VERIFIED |
|4 SPK/contract to Legal | Tender upload → POST marketing/tenders/:id/upload-spk:244; send-to-legal:206 | Contract/tender PENDING_LEGAL_REVIEW; LEGAL_REVIEW_WORKFLOW | File/document validation; bukan PDF generation GET selama audit | marketing.spk.uploaded5, marketing.tender.won5 published; Bell/legal queue tersedia |
|5 Legal review/approve/return | /legal/review → POST legal/contracts/review:36 (alias legal/review) → LegalService.reviewContract | Legal task APPROVE/REJECT end; RETURN→Marketing revision→RESUBMIT Legal | Entry legal state; notes; contract/proposal documents | Legal transaction menyimpan outbox dan audit; legal.contract.approved5 published. Return assigned marketing_pic_id fallback created_by |
|6 Contract approved reaches PMO | /project-delivery operational board → GET project/operational-board:101; legal/start-project:102 | Approved contract/project initialization; PROJECT_INITIATION_WORKFLOW PMO task | Contract approved/active, explicit PM assignment needed | PMO queue projection dan initialization event paths; no live create performed |
|7 PMO assigns PM | Delivery board → POST project/:projectId/assign-pm:137 → assignProjectManager:1453 | Project.manager_id; PMO task ASSIGN_PM→end; PLANNING | Eligible PM/authority/project gate | project.pm.assigned5 published; project audit and recipient resolution. Generic engine bypass AUD-A5-001 tetap berlaku |
|8 PM receives assigned project | /project-delivery workspace → project/master and operational-board | Project owner manager_id; assigned project projection | ProjectService ownership checks exist | Assigned PM notifications/board; finance/workflow read APIs memiliki scope gap terpisah |
|9 Planning starts | PM workspace operational-plan panels | Project PLANNING; review NOT_SUBMITTED before submit | Freeze/ownership rules; approved contract | Readiness projection; belum kickoff/execution |
|10a WBS | PM planning → PUT project/:projectId/wbs-tree:178 → saveWbsTree:432 | WorkBreakdownStructure persisted IDs | Numeric leaf identity, hierarchy/weights; frontend temporary IDs require persisted reconciliation | Tests source/unit; live tree save not performed |
|10b Cost/RAB | PM planning → PUT project/:projectId/cost-estimate:202 → saveCostEstimate:2760 | ProjectCostEstimate/CostItem | Quantity/unit cost/assignmentScope/project/WBS validation | Selected cost validator suite PASS; no live save |
|10c Schedule/Gantt | PM planning → PUT project/:projectId/schedule:378 → saveProjectSchedule:3171 | Task/schedule linked WBS, dates | Reconciliation, canonical IDs, planning freeze; routine progress cannot alter planning after kickoff | Schedule validator suite PASS; live persistence NOT VERIFIED |
|10d Initial condition | PM planning → PUT project/:projectId/initial-condition:526 → saveInitialCondition:3942 | ProjectInitialCondition | Status/location/constraints/risks DTO | Four-pillar readiness used; attachment completeness end-to-end NOT VERIFIED |
|11 Readiness | PM planning → GET project/:projectId/operational-readiness:399 → getOperationalReadiness | Evaluates persisted WBS/cost/schedule/initial/baseline inputs and gate | overallStatus READY, completenessCount4; revision persistence freshness | Source and selected readiness tests PASS; fingerprint limitations AUD-A6-001 |
|12 PM submit/resubmit | PM workspace → POST project/:projectId/management-review/submit:555 → submitManagementReview:4141 | New PROJECT_PLAN_REVIEW_WORKFLOW or RESUBMIT existing PM revision; ProjectManagementReview REVIEW_PENDING | Owner,4 pillars, hasPersistedRevisionAfterReturn; no submit completed review | Workflow task/outbox, separate review transaction/audit; AUD-A5-005 atomicity; backend ownership test red |
|13 HOO review | /governance/tasks → project/:id/management-review/decide:574 or generic workflow complete | node_hops_review→Procurement; RETURN→node_pm_revision_hops | Role/action/reason; plan snapshot | Task/transition/outbox; generic guard bypass. Revision resubmits to HOO |
|14 Procurement pre-kickoff review | Governance/finance-review redirect routes → management-review/decide | node_procurement_review→Finance; RETURN→PM procurement revision | Review plan/supply readiness; no PO execution implied | Task/outbox/history; resubmit back to Procurement |
|15 Finance pre-kickoff review | Governance → management-review/decide | node_finance_review→Director; RETURN→PM finance revision | Plan financial review; not invoice/payment execution | Task/outbox/history; resubmit back to Finance |
|16 Director review | Governance → management-review/decide / workflow complete | node_director_approval→node_end; RETURN→PM director revision | Approval of plan; task concurrency guard | Live instance20 at PM director revision. Task51 has role-only assignment, AUD-A5-001 |
|17 Ready for Kickoff | Delivery/PM workspace → readiness/review read | Workflow COMPLETED; review READY_FOR_KICKOFF; project remains PLANNING | Completion is separate from project execution | DB project4 proves reachable snapshot combination; audit does not infer actor path from status alone |
|18 Formal kickoff returns to PM | Delivery board/workspace kickoff entry | Owner PM sees kickoff-ready project | Owner and canonical workflow/readiness gate | PM recipient/task projection; exact click to form NOT VERIFIED |
|19 PM executes kickoff | POST project/:projectId/kickoff:419 → executeFormalKickoff:1956 | Transaction locks project, checks PLANNING/review, persists baseline and execution state | Approved active contract, assigned PM, readiness; baseline snapshot | project.kickoff.executed3 published, audit persistence; no kickoff performed by audit |
|20 Execution | /project-delivery workspace → project task/progress endpoints:249–357 | Tasks/progress logs/evidence/baseline; IN_PROGRESS | WBS scope, progress validation, verification paths | Monitoring actual-data queries; complete DB→UI reconciliation NOT VERIFIED |

File locations in table are relative to repository root stated above. Legal and PMO are lifecycle roles; no separate pmo module/controller was assumed. PMO functions live in ProjectController/ProjectService.

### Workflow definitions actually stored

| Definition (active version) | Observed edges | Return/resubmit / release assessment |
|---|---|---|
|DISCOUNT_APPROVAL_WORKFLOW v1 | Start Marketing→Director task→APPROVE or REJECT end | No universal RETURN/RELEASE claimed |
|TENDER_GO_NOGO_WORKFLOW v1 (v2 DRAFT) | Start→Director→APPROVE end; RETURN→Marketing revision→RESUBMIT Director | Revision scoped by marketing PIC context; candidate GENERAL_MANAGER present |
|LEGAL_REVIEW_WORKFLOW v1 | Legal APPROVE/REJECT end; RETURN Marketing revision; RESUBMIT Legal | Resubmit exists, not terminal return |
|PROJECT_INITIATION_WORKFLOW v1 | PMO task→ASSIGN_PM end | Does not kickoff project |
|PROJECT_PLAN_REVIEW_WORKFLOW v1 | HOO→Procurement→Finance→Director→end | Four separate PM revision nodes resubmit to respective reviewer. No literal RELEASE action; end means Ready for Kickoff |
|PURCHASE_REQUEST_WORKFLOW v2 (v1 also published) | Procurement start→Finance→Director→end | Both reviewer RETURN paths reach Procurement revision; RESUBMIT returns to Finance |
|PROJECT_CLOSURE v1 | PM start→HOO→Director→approved end | RETURN from either reviewer reaches returned end. New submission cycle belongs to domain service, not universal graph RESUBMIT |

Graph presence is VERIFIED; every edge executed live in this audit is **0**. Domain start/complete APIs, transaction ordering and authorization must be verified together. Versions are pinned on instances, but start-race and generic API gaps remain. Legacy PM_REVISION compatibility is NOT VERIFIED; runtime graph uses node_pm_revision_* and domain fallback also considers NEEDS_REVISION.

### Operational modules and payment trace

| Module/action | UI → API → service / database | Controls and observed evidence | Readiness / gap |
|---|---|---|---|
|Progress/baseline/evidence | Project delivery→project baseline/progress-logs/task-board/progress-monitoring/Gantt; ProjectService and progress entities | Baseline persists on kickoff; progress submission/verification code exists; calculateProjectOverallProgress available | Source available; real evidence upload, critical claim approval, S-curve reconciliation NOT VERIFIED |
|PM procurement package | Delivery procurement section→procurement/packages create/submit/resubmit/return/create-pr; ProcurementPackageService | Project ownership/allocation validation; package submission4 published | Automated closure/rejection listener not registered, AUD-A1-001 |
|PR→Finance→Director | /procurement→procurement/pr; ProcurementService + PURCHASE_REQUEST workflow | Version2 graph and RETURN loop verified | Live approval/cancellation/concurrency NOT VERIFIED |
|Material PO→GR | /procurement PO/GR workspace→purchase-orders/goods-receipts | PurchaseOrderType.MATERIAL; item/GR relation and quantity validation present | Postcommit emit durability and inactive listener gaps |
|Service PO→Service Order | /procurement→service-orders create/issue; ServiceClaimService | SERVICE/LEGACY_MIXED handling, multiple service orders per PO, scope fields present; DB3 service_orders | Column names match; lifecycle and item scope reconciliation live NOT VERIFIED |
|Service Claim | Procurement claim modal→service-claims submit→verify-technical by owner PM→verify-commercial | DB1 APPROVED_FOR_INVOICE; submitted/pm_verified/approved_for_invoice events1 each published; Inbox domain task projection exists | Scope on reads and invalid Bell type; negative/return loops live NOT VERIFIED |
|Invoice create/match/verify | /finance/invoices→finance/invoices, matching, verify; FinanceService | Three-way/service matching code; invoice maker-checker tests selected PASS; invoice outbox create2/verify2 | Unassigned PM read scope FAIL; invoice flow real mutation not run |
|Finance request | /finance/payments→POST finance/payment-requests→submitPaymentRequest:2398 | Invoice pessimistic lock; active duplicate request check; snapshot; PENDING_DIRECTOR_APPROVAL | Live2 requests only; race stress NOT VERIFIED |
|Director return | Same workspace approvals→POST payment-requests/:id/decide or /return→decidePaymentRequest:2647 | Pending status lock; revision notes mandatory; NEEDS_REVISION | Does not execute payment. Stale cycle token absent |
|Finance resubmit | Payment workspace→POST payment-requests/:id/resubmit→resubmitPaymentRequest:2772 | NEEDS_REVISION required; refreshed data/snapshot→PENDING_DIRECTOR_APPROVAL | Exact actor ownership/dual-role scenarios need isolated integration |
|Director approve | /finance/payments approvals→/decide or /approve | PENDING_DIRECTOR_APPROVAL→APPROVED_FOR_PAYMENT; approvedAmount/by/at | No expected revision, AUD-A7-001; no assumption that ADMIN can approve |
|Finance pay/record | Ready-to-pay→POST finance/payments→createPayment:789 | Invoice/request locks; approved request, verified invoice, cap checks, prevents checker=payment actor; request→PAID | DB1 PAID,1 APPROVED_FOR_PAYMENT. Does not prove bank settlement, duplicate retry or full ledger reconciliation |
|Project closure | Delivery closure section→project/:id/closure-readiness,current/history,submit,HOO/Director approve/return | Closure readiness checks, supporting documents, cycle unique/project FK; DB1 APPROVED,project2 CLOSED | Selected source inspection; financial/document readiness live destructive-free only; generic workflow bypass risk remains |
|Reporting/dashboard | /dashboard,/reports and progress-monitoring queries | Several queries use persisted actuals; trend endpoint random; document verify uses synthetic bytes | Entire reporting layer cannot be declared validated. Reconcile sampled KPI/S-curve to approved ledger before GO |

Payment authoritative status path exists:
**PENDING_DIRECTOR_APPROVAL → NEEDS_REVISION → PENDING_DIRECTOR_APPROVAL → APPROVED_FOR_PAYMENT → PAID**.
REJECTED is an additional enum state, not substitutes for the canonical path. API aliases approve/return/reject call the same decision service. Record locking is a positive control, but not proof of stale-screen protection or exactly-once external payment.

### Event chain and task/notification boundary

Actual architecture is mixed: domain services sometimes create WorkflowTask inside workflow transactions; Inbox also derives actionable items from domain rows (payment requests, service claims, closure). Outbox drives notification and refresh consumers. Therefore it is inaccurate to require every task to be created only after the relay.

| Hop | Verified condition | Limitation |
|---|---|---|
|Business transaction→outbox | Canonical workflow, legal, marketing, kickoff, invoice/payment, package/service-claim/closure examples found | Not all producers: PO/GR examples emit after commit |
|Outbox relay | Row lock, pending scan, sync failure retry_count, zero listeners retained pending | emit Boolean only establishes listener presence; consumer outcome not durable |
|Recipient resolution | Specific users and role candidates; context-based Marketing PIC; room/user delivery | PM plan revision role-only assignment; SUPER_ADMIN and role guard too broad |
|To-Do | WorkflowTask + domain aggregation; pending status filtering; completion history exists | No single consistent business policy across generic engine and domains |
|Bell | Persisted Notification, canonical writer rejects TASK, dedupe support | Service claim producer still sends TASK; aggregate0 duplicate doesn't prove concurrent dedupe |
|UI refresh | BusinessSync mapped to frontend cache refresh; socket auth exists | Redis adapter dependency absent; live reconnect/freshness not tested |
|History | Backend getHistory aggregates workflow/domain completed records | Partial failures hidden; raw actions/status mapping can mislabel resubmit |

Completed To-Do and unread Bell are separate states. A completed action does not automatically require deleting an informational notification. Snapshot unread46 is not, by itself, a defect or proof of stale actionable tasks.

### Authorization matrix: observed and required boundaries

| Role | Canonical responsibility | Source controls / exceptions |
|---|---|---|
|MARKETING | Tender, proposal, commercial input and own revision | PIC assignment exists in legal/GO-NOGO graph; generic workflow reads/start remain too open |
|LEGAL | Contract review, return/approve | Dedicated review entry-state checks/outbox; document verify endpoint is synthetic |
|PMO | Approved project intake and PM assignment | Project assignment service; not a separate PMO module |
|PROJECT_MANAGER | Own project plan, resubmit, kickoff, execution, technical service-claim verification | Dedicated ownership gates exist; workflow role-only revision and finance/claim reads break consistency |
|HEAD_OF_OPERATIONS | Plan and closure review | Business role distinct from admin; rollback endpoint is a no-op success |
|PROCUREMENT | Pre-kickoff plan review; post-kickoff procurement execution | Explicitly separate activities; package reconciliation listener inactive |
|FINANCE | Plan financial review; invoice/request/payment work after kickoff | Maker-checker/payment locks exist; stale decision cycle and broad reads unresolved |
|DIRECTOR | Plan/closure/payment approvals and returns | Formal kickoff remains PM action; generic workflow can bypass restrictions |
|ADMIN | Administrative support only where authorized | Controller read privileges present; not blanket approval authority |
|SUPER_ADMIN | System administration, not automatic business checker | Generic engine unconditional bypass conflicts with this boundary |
|GENERAL_MANAGER/MANAGER/PURCHASING aliases | Present in some actual guards/graphs | Business equivalence requires confirmation; role existence is not blanket permission |

### Entity–Migration–Database compatibility matrix

37 migration ledger entries were read in timestamp order and37 migration files inventoried. Count equality does not prove identical DDL/checksum or safe replay. Older migration IDs/timestamps do not by themselves prove broken order. Maintenance scripts that reconcile ledgers exist but were not executed.

| Table | Entity/DB column count | Name coverage | Constraint/schema observation |
|---|---:|---|---|
|purchase_orders |21/21|PASS|MATERIAL/SERVICE/LEGACY_MIXED source type; created_at/updated_at nullable drift |
|service_orders |20/20|PASS|Multiple per PO intentionally supported by migration1791500000000; no false uniqueness defect |
|service_claims |30/30|PASS|PO/project/invoice traceability present; subset orphan check0 |
|project_closures |23/23|PASS|Project+cycle unique; FK relations present |
|workflow_definitions |16/16|PASS|name nullability differs; created_at/updated_at differ |
|workflow_versions |10/10|PASS|Definition/version relationship; timestamp nullability differs |
|workflow_instances |17/17|PASS|Nonunique entity/status index; workflow_version_id/timestamps nullable drift |
|workflow_tasks |19/19|PASS|Task assignment columns present; timestamps nullable drift |
|workflow_transitions |11/11|PASS|Instance/actor relation; transition_instance orphan0 |
|outbox_events |14/14|PASS|Only PRIMARY index observed;5 nullable differences; no event_id unique or pending-scan index |
|payment_requests |20/20|PASS|Number unique and invoice link; pessimistic invoice lock used for active-request duplicate prevention |
|pdf_templates |entity present/DB absent|FAIL|Service registered; AUD-A3-001 |

Total201 scoped columns;17 nullability differences listed in Appendix B. Required-null count checks for outbox payload/status/version/retry and workflow instance version link both returned0. This rules out those current null rows only; it does not eliminate schema drift. Full enum/default/precision/collation/FK action equivalence and migration replay remain NOT VERIFIED.

Database snapshot:

| Object | Counts/state |
|---|---|
|workflow_tasks |51:39 COMPLETED,11 RETURNED,1 PENDING |
|workflow_instances |20:19 COMPLETED,1 IN_PROGRESS |
|workflow_transitions / audit_logs |89 /308 |
|outbox_events |168 PUBLISHED,0 pending/failed |
|notifications |64:18 read,46 unread |
|purchase_orders / service_orders |4 /3 |
|service_claims / project_closures |1 APPROVED_FOR_INVOICE /1 APPROVED |
|payment_requests |1 APPROVED_FOR_PAYMENT,1 PAID |

These are small local snapshots, not load/performance evidence. Four orphan relationships tested0; other relationships not automatically declared clean. Backup/prod data and company partitioning were not queried.


## REPORT 4 — Test evidence and reproducibility limits

### Environment and isolation

Execution date21 October2026; Windows PowerShell; Node v24.18.1. Snapshot HEAD789cf677a1e50daba3d894ff640ecd960597aea7 **plus initial dirty files**. Backend/frontend source and configurations copied into external audit workspace. Existing dependency installations reused through junctions; neither installation nor upgrade performed. No .env copied to build/test workspace. Build/Jest caches and JSON results were written outside repository. Node command below resolves to C:/Program Files/nodejs/node.exe.

Unit tests selected for backend use mocks/pure validators. Full backend default test run was avoided because several suites initialize database access. Passing typecheck uses actual TypeScript diagnostics; frontend Jest config disables ts-jest diagnostics, so Jest alone would not be sufficient. Build and separate tsc therefore provide independent compile evidence.

| Check | Executed / pass / fail / skipped | Exit | Evidence |
|---|---|---:|---|
|Backend tsc |Not a test count|0|No TypeScript error |
|Frontend tsc |Not a test count|0|No TypeScript error |
|Backend Nest build |Not a test count|0|Build completed |
|Frontend Next build, initial |0 tests|1|Sandbox EPERM creating .next/static/chunks/app; not treated as source failure |
|Frontend Next build, authorized retry |33 static pages generated; build routes reported|0|Compiled, type/lint validation, page generation, build traces complete |
|Frontend Jest |1,161 executed /1,161 pass /0 fail /0 skipped;75/75 suites pass|0|129.836s from Jest summary |
|Backend selected Jest, initial sandbox |0 executed|1|ts-jest cache rename EPERM; no business assertion reached |
|Backend selected Jest, authorized retry |336 executed /335 pass /1 fail /0 skipped;14/15 suites pass|1|56.72s; ownership submit expected REVIEW_PENDING, received NOT_SUBMITTED |
|Jest discovery backend |91 files, cases not executed by discovery|0|--listTests |
|Jest discovery frontend |75 files|0|--listTests |
|npm audit backend, first attempt |No dependency evaluation completed|1|ENOTFOUND registry.npmjs.org in sandbox |
|npm audit frontend, first attempt |No dependency evaluation completed|1|Same DNS limitation |
|npm audit backend, authorized retry |24 affected production dependency packages|1|1critical,12high,9moderate,2low |
|npm audit frontend, authorized retry |6 affected production dependency packages|1|1critical,5high |
|Compact audit capture wrapper |Same registry findings|0 wrapper|Wrapper successfully parsed underlying npm audit exit1; this is not an audit PASS |
|Read-only DB metadata/data checks |SELECT counts/metadata only|0 successful authorized runs|transaction_read_only=1; no mutation |
|3 unauthenticated HTTP GET probes |docs-json200;history401;operational-board401|0 command|244 Swagger paths; history path present |
|Live Edge CDP browser |0|N/A|NOT VERIFIED; no browser/session changed |
|Clean npm ci, full backend suite, live DB integration, performance, container startup, restore/deploy |0|N/A|NOT VERIFIED; not authorized/safe within audit constraints |

Counts of test declarations from text scanning are not executable test counts: backend lexical calls1,568 and frontend1,170 were inventory hints only. Parameterized/conditional tests and source comments make those unsuitable as a PASS denominator.

### Exact executed build/test commands

CWD external audit workspace /backend:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit --incremental false
& 'C:\Program Files\nodejs\node.exe' node_modules/@nestjs/cli/bin/nest.js build
& 'C:\Program Files\nodejs\node.exe' node_modules/jest/bin/jest.js --listTests --runInBand --no-cache --json
```

CWD external audit workspace /frontend:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false
& 'C:\Program Files\nodejs\node.exe' node_modules/jest/bin/jest.js --listTests --runInBand --no-cache --json
& 'C:\Program Files\nodejs\node.exe' node_modules/jest/bin/jest.js --runInBand --no-cache --json --outputFile=audit-unit-results.json
& 'C:\Program Files\nodejs\node.exe' -e "const cp=require('child_process');const p=cp.spawn(process.execPath,['node_modules/next/dist/bin/next','build'],{stdio:'inherit',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});p.on('exit',c=>process.exit(c||0))"
```

Backend selected retry command below is one logical command; line breaks below use PowerShell continuation solely for readability:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules/jest/bin/jest.js --runInBand --no-cache --cacheDirectory=./audit-jest-cache --runTestsByPath `
src/modules/project/cost-estimate-validation.spec.ts `
src/modules/project/schedule-validation.spec.ts `
src/modules/project/operational-readiness.spec.ts `
src/modules/project/pm-revision-resubmit-gate.spec.ts `
src/modules/project/project-workflow-projection.service.spec.ts `
src/modules/project/management-review-sync.service.spec.ts `
src/modules/project/project-ownership-boundary.spec.ts `
src/modules/finance/finance-maker-checker-authority.spec.ts `
src/modules/finance/three-way-match-hardening.spec.ts `
src/modules/finance/service-invoice-matching.spec.ts `
src/modules/procurement/service-claim.spec.ts `
src/modules/inbox/inbox.service.spec.ts `
src/modules/inbox/inbox.controller.spec.ts `
src/modules/system/outbox-relay.service.spec.ts `
src/modules/notification/canonical-notification.spec.ts `
--json --outputFile=audit-unit-results-authorized.json
```

Initial backend attempt used the same15 file list without custom cacheDirectory and outputFile=audit-unit-results.json. Its sandbox failure is distinct from the later real assertion failure.

In each isolated package directory:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' audit --omit=dev --json --ignore-scripts --cache=./audit-npm-cache
```

No npm audit fix, npm install, npx installation, lint --fix, migration or seed was run. Advisory checks contacted npm registry only for dependency metadata. Initial sandbox failures were retried through explicit tool approval; no repository file was created as a workaround.

### What passing tests actually cover

| Family | Existing evidence | Limits / unrun evidence |
|---|---|---|
|Planning validators/ownership | Selected WBS-linked cost/schedule/readiness/revision/projection suites; ownership failure separately documented | Mostly repository mocks; canonical saved IDs and readback across actual DB not proven |
|Finance/security | Selected maker-checker, three-way match and service invoice matching suites PASS | Not every API guard/object scope, dual-role, race, stale request or bank settlement |
|Procurement service claim | Selected service-claim suite PASS | Does not prove module listener registration, Bell persistence or actual UI |
|Inbox/outbox/notification | Selected service/controller/relay/writer tests PASS | Event emitter/repositories mocked; emit true does not prove asynchronous consumer commit |
|Frontend unit/regression | All75 discovered test files passed including initial untracked responsive test | Many source-string inspections or pure mappings; node testEnvironment, no real DOM/browser lifecycle guarantee |
|Security/source assertions | Existing authSessionHardProof, adminAuthority, inboxAccessControl etc. | Names containing hard-proof/security do not convert mocks into live authorization proof |
|Integration/API tests | Files with integration/consumer names inventoried; runtime3 unauth GETs only | Not a full authenticated API smoke; exact running service commit not established |
|DB schema/live acceptance | operational-plan-schema, task-schema, project-20-live-acceptance and closure-readiness-related files exist | Full execution withheld to avoid accidental writes/shared DB use |
|Browser |31 specs including canonical lifecycle, payment approval, auth session, procurement/closure/mobile |0 run. Some are Chrome/CDP-specific, but this is not the required Edge live result |
|Performance/recovery | No audit performance/load/failover/restore execution |No latency, throughput, RPO/RTO or capacity claim |

### Runtime probes and database safety

Only unauthenticated, non-mutating runtime endpoints were requested:
- GET http://localhost:4000/api/docs-json →200,244 path entries.
- GET http://localhost:4000/api/v1/inbox/history →401.
- GET http://localhost:4000/api/v1/project/operational-board →401.

These prove an API responds and authentication is enforced for unauthenticated requests. They do not prove authorized payloads, full DI compatibility with the current dirty tree, or production deployment. Potentially mutating GETs such as PDF job creation and document verification were not called.

Database connection used mysql2 directly, avoiding application bootstrap and TypeORM synchronization. Credentials loaded privately from backend/.env; values never printed. Before SELECT, each connection executed:

```sql
SET SESSION TRANSACTION READ ONLY;
START TRANSACTION READ ONLY;
SELECT NOW() db_time, VERSION() mysql_version, @@session.transaction_read_only read_only;
-- SELECT-only evidence queries
ROLLBACK;
```

The SET changes only transaction access mode and is explicitly permitted by the user's database rules. Snapshot returned read_only=1, MySQL9.7.1. Client-rendered timestamp was2026-10-21T01:37:02.000Z; database timezone equivalence was not independently established. Queries performed no FOR UPDATE, stored procedure, business DDL or DML.

**DATABASE ACCESS: READ ONLY**  
**BUSINESS DATA MUTATED: NO**

Read-only database checks required tool-approved local network access after EACCES sandbox failures. No helper file was written into the repository. Existing application processes may continue their own work; this audit's NO mutation statement concerns the auditor's actions, not a freeze of all external actors.

### Dependency advisory evidence

The npm report counts packages, including transitive propagation; do not sum advisory entries as unique exploitable defects. Reachability is NOT VERIFIED for most entries. Examples:
- Next14.2.35 matches the maintainer's Windows-hosted App/Pages Router RCE range >=13.4 <15.5.24. Advisory specifies no known workaround for affected Windows hosts. This audit host is Windows; production OS and internet exposure remain unverified. [Next.js maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36).
- proxy-addr critical entry requires particular incorrectly specified IPv6 trust subnets. Its package match alone is not proof this app is exploitable. [proxy-addr maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
- Other affected packages include Nest platform/Socket.IO dependencies, multer, ws, nodemailer, axios, postcss and source-map-js. TypeORM advisory concerns migration generation; that path was not executed.

Upgrade/version selection is a separate implementation task; no claim that every npm suggested major upgrade is automatically safe.


## REPORT 5 — Release blocker register

P0 adalah release blocker berdasarkan impact/ketiadaan kontrol kritis; bukan klaim exploit sudah dijalankan. P1 berstatus NOT VERIFIED tetap gate terbuka ketika menyangkut integritas atau acceptance inti.

### P0 — urutan penanganan

| Urutan | ID | Gate / dependency |
|---:|---|---|
|1|AUD-A11-002|Triage exposure dependency kritis sebelum membuka environment ke pengguna/Internet; upgrade harus melalui regression |
|2|AUD-A4-001|Eliminasi sensitive response fields sebelum authenticated API/UAT berbagi akun/data |
|3|AUD-A4-003|Session revocation dan active-account enforcement sebelum access-control acceptance |
|4|AUD-A4-002|Object/project scope konsisten pada seluruh read APIs |
|5|AUD-A5-001|Domain-authorized start/complete, owner task dan admin SoD; prerequisite lifecycle/UAT |
|6|AUD-A11-001|Reproducible deployment config; prerequisite isolated staging |

### P1 — urutan dependensi

| Kelompok | IDs | Kriteria keluar |
|---|---|---|
|Schema/bootstrap|AUD-A3-001,AUD-A3-002|Missing table dan constraints direkonsiliasi; clean clone/bootstrap + upgrade snapshot lulus |
|Module/workflow state|AUD-A1-001,AUD-A5-002,AUD-A5-003,AUD-A5-004,AUD-A5-005|Consumer benar-benar terpasang, admin commands truthful, actual history, concurrency/atomicity tests lulus |
|Finance/report integrity|AUD-A7-001,AUD-A7-002,AUD-A7-003|Stale cycle rejected, metrics reconcile actuals, PDF bytes/hash verified fail-closed |
|Delivery reliability|AUD-A8-001,AUD-A8-002,AUD-A8-003,AUD-A8-004,AUD-A11-003|Durable event/worker receipts, valid recipients, retry/idempotency, real queue and cross-node delivery |
|Security boundary clarification|AUD-A4-004|Company model/perimeter controls explicit dan negative tests |
|Regression/acceptance|AUD-A10-001,AUD-A10-002|Backend suite diperbaiki berdasar actual behavior; Edge live canonical paths + forbidden paths pass |
|Release/operations|AUD-A11-004,AUD-A11-005,AUD-A11-006|CI promotion/approval, truthful readiness, restore/rollback dan isolation evidence |

P2 follow-ups: AUD-A5-006 action/history semantics; AUD-A6-001 fingerprint contract; AUD-A9-001 deep links; AUD-A9-002 error completeness. Walaupun P2, deep-link correctness dan task UX tetap acceptance requirement Inbox yang disepakati pengguna.

## REPORT 6 — Remediation roadmap (proposal only)

Tidak ada fase di bawah dijalankan dalam audit ini. Urutan tetap: **repository/system health → Inbox To-Do versus Notifications → Telegram**. “Clean baseline” nanti berarti perubahan pengguna direview dan diselesaikan secara sah; bukan memindahkan/menghapus dirty files untuk mempercantik status.

### Phase0 — Evidence custody dan release baseline

- Objective: release candidate dapat direproduksi tanpa kehilangan pekerjaan awal.
- Root cause: working tree dirty, runtime provenance tidak dipin, baseline database lokal ignored, beberapa klaim dokumen tidak cocok bukti.
- Components: git worktree/release manifest, docs/database, package locks, test inventory.
- Required changes: pemilik perubahan menilai dua modified governance files, untracked test dan scratch; tentukan commit kandidat. Version schema-only bootstrap yang aman dan pin toolchain. Jangan restore27 deleted tests secara massal tanpa mapping coverage.
- Regression risk: menghilangkan perubahan UI atau data bootstrap yang masih diperlukan; jangan memasukkan dump bisnis/secrets ke Git.
- Acceptance: setiap file awal tetap terlacak asalnya, release SHA/artifact/dependency lock jelas, clean clone dapat menghasilkan schema disposable sesuai design.
- Verification: manifest hash, deterministic npm ci/build dalam environment baru, migration dry review + isolated bootstrap, no secret leakage.
- Dependencies: persetujuan implementasi terpisah; audit ini hanya memberi bukti.

### Phase1 — Security dan business authorization

- Objective: data/proses hanya dapat dibaca/diubah actor yang berhak.
- Root cause: guard role tersebar, DTO serialization tidak eksplisit, session record terpisah dari token enforcement.
- Components: auth/session/JWT, User DTOs, generic workflow controller/engine, finance/procurement query scope, frontend actions.
- Required changes: close P0 security; remove engine fail-open/admin bypass, bind user/instance/entity, enforce owner and company policy; harden origins/rate controls; triage dependency advisories.
- Regression risk: legit delegated reviewer/PM dapat terkunci; alias role tidak boleh diam-diam diperlakukan ekuivalen.
- Acceptance: PM lain mendapat403/filtered list, secrets absent recursively, revoked/disabled users rejected, SUPER_ADMIN tidak otomatis dapat business approve, stale roles handled.
- Verification: table-driven negative tests + authenticated isolated API integration untuk setiap entry point dan kombinasi role; no exploit against real users.
- Dependencies: Phase0 release fixture dan defined role/company policy.

### Phase2 — Schema, workflow, finance and document correctness

- Objective: satu transisi bisnis memiliki state/audit yang benar dan recoverable.
- Root cause: constraint drift, orphan listener, multiple transaction ownership, stale-cycle ambiguity, placeholder history/integrity verification.
- Components: migrations/entities, workflow domain adapters, ProjectManagementReview, ProcurementPackage, PaymentRequest, Contract version files.
- Required changes: reconcile17 nullability differences/pdf_templates; bind module listeners; durable domain sync; idempotent start; explicit request revision token; real visualizer/document hashes; clarify fingerprint/legacy PM_REVISION.
- Regression risk: migration fails on existing data, legacy records rejected, deadlocks/new duplicate task semantics.
- Acceptance: preflight data clean; upgrade/clean bootstrap work; concurrent start yields1 active workflow; stale approval409; rollback leaves no orphan projection/outbox; real PDF tamper/missing file fails.
- Verification: transactional integration with disposable restored dataset; fault injection, parallel requests, repeated actions, full return/resubmit per actual graph.
- Dependencies: Phase1 authorization + Phase0 schema baseline.

### Phase3 — Worker, events and operational health

- Objective: acknowledgement means delivery work completed or safely pending with retry.
- Root cause: mock queues, emit Boolean acknowledgment, direct postcommit events, undeclared adapter, static readiness.
- Components: outbox/consumers, BullMQ workers, Redis/socket adapter, email/PDF, probes/logging.
- Required changes: real durable jobs; consumer receipts/idempotency, canonical outbox for PO/GR, retry/DLQ with alerts, explicit cross-node mode and accurate health.
- Regression risk: duplicate emails/events, long DB locks, backlog starvation, retry storms.
- Acceptance: simulated process death/dependency outage causes retry without duplicate business action; zero listeners alert; failed consumer not reported fully delivered; readiness503 when mandatory dependency unavailable.
- Verification: two-instance integration, reconnect, duplicate event, delayed listener/rejection, crash before/after commit, pending query EXPLAIN and bounded-volume tests.
- Dependencies: Phase2 atomic domain boundaries and approved queue/environment design.

### Phase4 — Inbox To-Do versus Notifications and frontend integration

- Objective: To-Do hanya action/approval dengan tepat owner/entity/action; Bell hanya pemberitahuan.
- Root cause: mixed task projections, invalid TASK producer, coarse URLs, hidden partial failures, UI/back-end guard divergence.
- Components: InboxService, notification writers/consumers, todoActionResolver, governance/payment/service claim views, React Query/cache.
- Required changes: typed action link, consistent actor policies, explicit partial errors, completion/history semantics, service claim informational notification, precise focus/open context.
- Regression risk: duplicate/missing task cards, opening wrong entity, stale cards after return/resubmit; mobile navigation regression.
- Acceptance: one eligible actionable task per expected step, unrelated PM sees none, Bell has no task buttons, deep link opens exact entity/action, completed task moves to correct history, refresh/reconnect converges.
- Verification: live Edge headless=false via CDP, multi-role fixture matrix, direct URL/back navigation, mobile viewport, network failure and stale cache tests.
- Dependencies: Phase1–3 health and business integrity; no Telegram yet.

### Phase5 — Staging release qualification dan recovery

- Objective: staging credible representasi production dan release dapat dibatalkan dengan aman.
- Root cause: env/port inconsistencies, incomplete pipeline gates, no audited restore evidence.
- Components: Docker/CI/CD/env/secrets/schema deploy/monitoring/backup.
- Required changes: lockfile install, pinned runtime images, isolated DB/Redis/storage/email targets, protected promotion/approval, rollout checks, backup/restore and compatible schema rollout.
- Regression risk: schema/application skew, accidentally sharing production resources, incorrect NEXT_PUBLIC env at build.
- Acceptance: cold deployment works; same tested immutable artifact promoted; staging isolation proven; RPO/RTO target documented and met by restore drill; rollback rehearsal recorded.
- Verification: complete backend regression + API integration + Edge canonical lifecycle including all four review returns, PM kickoff separation, service/material procurement, payment return/resubmit/pay and closure.
- Dependencies: all P0 resolved; P1 fixed or formally assessed with evidence. No automatic risk acceptance inferred.

### Phase6 — Telegram notification channel

- Objective: tambah kanal pemberitahuan ke user EPMS yang tepat setelah baseline sehat.
- Root cause: extension belum menjadi prioritas sampai recipient/event policy konsisten.
- Components: future Telegram adapter, verified user↔chat mapping, delivery outbox, channel preferences.
- Required changes: verified opt-in/linking, informational templates, scoped recipient resolver, idempotent delivery/retry/rate handling dan secret management.
- Regression risk: notification salah penerima, data sensitif terkirim, channel failure menghambat transaksi.
- Acceptance: Telegram tidak menjadi bypass approval; task deep-link tetap ke EPMS authenticated authorized workspace; channel failure tidak rollback business action.
- Verification: sandbox bot/users, wrong recipient negative test, duplicate/retry/unlink/revocation and audit delivery history.
- Dependencies: Phase4 task/Bell separation serta Phase5 release qualification. Tidak diimplementasikan atau dikonfigurasi selama audit.

## REPORT 7 — Final GO / NO-GO

| Environment | Decision | Supporting evidence | Missing/failed gates |
|---|---|---|---|
|Development|**CONDITIONAL GO**|Existing dependencies allow both typechecks/builds; frontend1,161 tests pass; backend335 selected tests pass; source architecture navigable|Scope hanya pengembangan/remediasi isolated. Fresh install/clean bootstrap and full DI boot not proven;1 regression failure; dependency/security controls must be fixed before shared/exposed use. Bukan izin memakai data produksi |
|Staging|**NO-GO**|Local runtime answers, schema/workflow snapshots available, code builds|Container env/port mismatch, missing schema/constraints, mock queues, authorization flaws, Edge E2E absent, isolation/recovery not proven. Keputusan terhadap candidate/config saat ini; tidak mengklaim sudah mencoba deployment staging |
|Production|**NO-GO**|Positive build/guard/domain controls documented honestly|6 P0 unresolved, critical dependency range, security/business authorization gaps, unreliable delivery/readiness, core integration and recovery not proven. Historical PASS/staging claims cannot substitute current gates |

Audit ini menghasilkan baseline pengetahuan dan daftar pekerjaan, bukan perbaikan. Semua keputusan dapat dievaluasi ulang setelah acceptance Phase0–5 memberikan evidence current pada SHA dan environment tertentu. Tidak ada “100% production ready” yang didukung pemeriksaan ini.


## Appendix A — Exact test file inventory and executed assertions

Each row names an actual discovered file. NOT RUN means no assertion count was inferred. Source/Jest discovery counts are file counts. Default backend suite discovery does not authorize DB integration execution.

### backend Jest

| File | Result | Pass | Fail | Skip |
|---|---|---:|---:|---:|
|[backend/src/modules/audit/audit.controller.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/audit/audit.controller.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/audit/audit.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/audit/audit.service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/auth/auth.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/auth/auth.service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/contract/contract-authorization.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract-authorization.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/contract/contract-pm-scoping.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract-pm-scoping.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/contract/contract-spk-delivery.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/contract/contract-spk-delivery.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/document/document-access.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/document/document-access.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/document/document.controller.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/document/document.controller.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/finance-audit-coverage.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance-audit-coverage.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/finance-entity-relation.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance-entity-relation.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/finance-maker-checker-authority.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance-maker-checker-authority.spec.ts>)|PASSED|13|0|0|
|[backend/src/modules/finance/finance.controller.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.controller.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/finance.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/finance.service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/invoice-integrity-hardening.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/invoice-integrity-hardening.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/p77-financial-closure-hardening.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/p77-financial-closure-hardening.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/finance/service-invoice-matching.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/service-invoice-matching.spec.ts>)|PASSED|14|0|0|
|[backend/src/modules/finance/three-way-match-hardening.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/finance/three-way-match-hardening.spec.ts>)|PASSED|15|0|0|
|[backend/src/modules/inbox/inbox.controller.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/inbox/inbox.controller.spec.ts>)|PASSED|3|0|0|
|[backend/src/modules/inbox/inbox.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/inbox/inbox.service.spec.ts>)|PASSED|37|0|0|
|[backend/src/modules/legal/legal-canonical-outbox.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/legal/legal-canonical-outbox.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/legal/legal.controller.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/legal/legal.controller.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/legal/legal.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/legal/legal.service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/marketing/marketing-canonical-outbox.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/marketing-canonical-outbox.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/marketing/marketing-gonogo-coordination.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/marketing-gonogo-coordination.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/marketing/marketing-identity.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/marketing-identity.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/marketing/marketing-spk-legal-workflow.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/marketing-spk-legal-workflow.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/marketing/sales.gateway.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/sales.gateway.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/marketing/tender-won-spk-flow.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/tender-won-spk-flow.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/business-sync.consumer.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/business-sync.consumer.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/business-sync.integration.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/business-sync.integration.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification-finance.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification-finance.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification-legal.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification-legal.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification-marketing.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification-marketing.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification-project.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification-project.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification-residual.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification-residual.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification-system-sla.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification-system-sla.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/notification/canonical-notification.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/canonical-notification.spec.ts>)|PASSED|28|0|0|
|[backend/src/modules/notification/management-notification.consumer.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/notification/management-notification.consumer.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/procurement/po-payment-terms.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/po-payment-terms.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/procurement/procurement-package-allocation-integrity.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement-package-allocation-integrity.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/procurement/procurement-summary-gr.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/procurement-summary-gr.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/procurement/service-claim.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/service-claim.spec.ts>)|PASSED|60|0|0|
|[backend/src/modules/procurement/service-procurement-upstream-recovery.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/service-procurement-upstream-recovery.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/procurement/transactional-hard-delete-prevention.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/procurement/transactional-hard-delete-prevention.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/baseline-and-progress-submission.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/baseline-and-progress-submission.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/charter-authorization.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/charter-authorization.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/cost-estimate-service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/cost-estimate-service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/cost-estimate-validation.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/cost-estimate-validation.spec.ts>)|PASSED|18|0|0|
|[backend/src/modules/project/cost-planning-persistence.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/cost-planning-persistence.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/critical-progress-claim.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/critical-progress-claim.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/handover-governance.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/handover-governance.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/kickoff-gate.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/kickoff-gate.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/management-review-service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/management-review-service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/management-review-sync.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/management-review-sync.service.spec.ts>)|PASSED|14|0|0|
|[backend/src/modules/project/operational-board-authorization.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/operational-board-authorization.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/operational-plan-schema.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/operational-plan-schema.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/operational-readiness.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/operational-readiness.spec.ts>)|PASSED|28|0|0|
|[backend/src/modules/project/phase-2b-authority-direction.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/phase-2b-authority-direction.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/pm-revision-resubmit-gate.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/pm-revision-resubmit-gate.spec.ts>)|PASSED|16|0|0|
|[backend/src/modules/project/pmo-pm-assignment.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/pmo-pm-assignment.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/progress-logs-query.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/progress-logs-query.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/progress-monitoring.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/progress-monitoring.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-20-live-acceptance.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-20-live-acceptance.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-baseline-query.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-baseline-query.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-closure-domain-documents.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-closure-domain-documents.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-closure-readiness.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-closure-readiness.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-closure-workflow.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-closure-workflow.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-identity.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-identity.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-location.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-location.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-overall-progress.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-overall-progress.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-ownership-boundary.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-ownership-boundary.spec.ts>)|FAILED|39|1|0|
|[backend/src/modules/project/project-planning-identity.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-planning-identity.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/project-workflow-projection.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project-workflow-projection.service.spec.ts>)|PASSED|10|0|0|
|[backend/src/modules/project/project.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/project.service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/schedule-planning-persistence.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/schedule-planning-persistence.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/schedule-service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/schedule-service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/schedule-validation.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/schedule-validation.spec.ts>)|PASSED|24|0|0|
|[backend/src/modules/project/task-board.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/task-board.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/task-schema.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/task-schema.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/wbs-planning-persistence.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/wbs-planning-persistence.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/wbs-tree.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/wbs-tree.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/project/wbs-validation.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/project/wbs-validation.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/queue/pdf.processor.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/queue/pdf.processor.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/queue/queue-monitoring.controller.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/queue/queue-monitoring.controller.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/system/enterprise-integration.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/enterprise-integration.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/system/event-namespace-collision.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/event-namespace-collision.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/system/observability-security.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/observability-security.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/system/observability.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/observability.service.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/system/outbox-relay.service.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/outbox-relay.service.spec.ts>)|PASSED|16|0|0|
|[backend/src/modules/system/static-exposure-security.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/system/static-exposure-security.spec.ts>)|NOT RUN|—|—|—|
|[backend/src/modules/workflow-engine/workflow-legal-return-revision.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/workflow-engine/workflow-legal-return-revision.spec.ts>)|NOT RUN|—|—|—|
### frontend Jest

| File | Result | Pass | Fail | Skip |
|---|---|---:|---:|---:|
|[frontend/src/components/common/__tests__/UserIdentityDisplay.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/common/__tests__/UserIdentityDisplay.test.ts>)|PASSED|13|0|0|
|[frontend/src/components/common/__tests__/columnIdentityMapping.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/common/__tests__/columnIdentityMapping.test.ts>)|PASSED|6|0|0|
|[frontend/src/components/finance/__tests__/directorApprovalModalActionability.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/__tests__/directorApprovalModalActionability.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/finance/__tests__/invoiceItemMapping.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/__tests__/invoiceItemMapping.test.ts>)|PASSED|5|0|0|
|[frontend/src/components/finance/__tests__/paymentRequestActionability.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/__tests__/paymentRequestActionability.test.ts>)|PASSED|21|0|0|
|[frontend/src/components/finance/__tests__/serviceInvoiceReconciliationUi.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/finance/__tests__/serviceInvoiceReconciliationUi.test.ts>)|PASSED|14|0|0|
|[frontend/src/components/governance/__tests__/managementReviewFinancialSummary.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/__tests__/managementReviewFinancialSummary.test.ts>)|PASSED|16|0|0|
|[frontend/src/components/governance/__tests__/managementReviewInteractionHardening.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/__tests__/managementReviewInteractionHardening.test.ts>)|PASSED|28|0|0|
|[frontend/src/components/governance/__tests__/projectClosureModalReadiness.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/__tests__/projectClosureModalReadiness.test.ts>)|PASSED|14|0|0|
|[frontend/src/components/governance/__tests__/projectGovernanceActionContext.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/__tests__/projectGovernanceActionContext.test.ts>)|PASSED|9|0|0|
|[frontend/src/components/governance/__tests__/projectGovernanceClosureTasks.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/__tests__/projectGovernanceClosureTasks.test.ts>)|PASSED|27|0|0|
|[frontend/src/components/governance/__tests__/projectGovernanceMobileResponsive.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/governance/__tests__/projectGovernanceMobileResponsive.test.ts>)|PASSED|18|0|0|
|[frontend/src/components/procurement/__tests__/goodsReceiptModalProjection.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/goodsReceiptModalProjection.test.ts>)|PASSED|7|0|0|
|[frontend/src/components/procurement/__tests__/goodsReceiptViewModeMapping.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/goodsReceiptViewModeMapping.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/procurement/__tests__/prWorkspaceCleanup.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/prWorkspaceCleanup.test.ts>)|PASSED|27|0|0|
|[frontend/src/components/procurement/__tests__/procurementDashboardSummary.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/procurementDashboardSummary.test.ts>)|PASSED|11|0|0|
|[frontend/src/components/procurement/__tests__/procurementSummaryCount.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/procurementSummaryCount.test.ts>)|PASSED|11|0|0|
|[frontend/src/components/procurement/__tests__/rfqCancellationUi.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/rfqCancellationUi.test.ts>)|PASSED|21|0|0|
|[frontend/src/components/procurement/__tests__/serviceClaimArchC1.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/serviceClaimArchC1.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/procurement/__tests__/serviceProcurementArchC2.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/serviceProcurementArchC2.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/procurement/__tests__/serviceProcurementPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/procurement/__tests__/serviceProcurementPresentation.test.ts>)|PASSED|18|0|0|
|[frontend/src/components/project/__tests__/canonicalWorkflowProjection.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/canonicalWorkflowProjection.test.ts>)|PASSED|13|0|0|
|[frontend/src/components/project/__tests__/ganttPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/ganttPresentation.test.ts>)|PASSED|22|0|0|
|[frontend/src/components/project/__tests__/kickoffQueuePresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/kickoffQueuePresentation.test.ts>)|PASSED|19|0|0|
|[frontend/src/components/project/__tests__/operationalControlPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/operationalControlPresentation.test.ts>)|PASSED|21|0|0|
|[frontend/src/components/project/__tests__/pmCostEstimateIntegrity.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/pmCostEstimateIntegrity.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/project/__tests__/pmOperationalPlanModalReadiness.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/pmOperationalPlanModalReadiness.test.ts>)|PASSED|25|0|0|
|[frontend/src/components/project/__tests__/pmProcurementPackageAllocationIntegrity.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/pmProcurementPackageAllocationIntegrity.test.ts>)|PASSED|4|0|0|
|[frontend/src/components/project/__tests__/pmServiceClaimVerificationEntry.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/pmServiceClaimVerificationEntry.test.ts>)|PASSED|17|0|0|
|[frontend/src/components/project/__tests__/pmServiceProcurementEntryR1B.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/pmServiceProcurementEntryR1B.test.ts>)|PASSED|13|0|0|
|[frontend/src/components/project/__tests__/progressClaimDeepLinkIsolation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/progressClaimDeepLinkIsolation.test.ts>)|PASSED|9|0|0|
|[frontend/src/components/project/__tests__/progressMonitoringPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/progressMonitoringPresentation.test.ts>)|PASSED|12|0|0|
|[frontend/src/components/project/__tests__/projectClosureWorkspace.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/projectClosureWorkspace.test.ts>)|PASSED|27|0|0|
|[frontend/src/components/project/__tests__/projectDeliveryTabsCompleted.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/projectDeliveryTabsCompleted.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/project/__tests__/projectExecutionF1.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/projectExecutionF1.test.ts>)|PASSED|12|0|0|
|[frontend/src/components/project/__tests__/projectIssueRiskPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/projectIssueRiskPresentation.test.ts>)|PASSED|28|0|0|
|[frontend/src/components/project/__tests__/projectWorkspacePresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/projectWorkspacePresentation.test.ts>)|PASSED|24|0|0|
|[frontend/src/components/project/__tests__/scheduleReconciliationIntegrity.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/scheduleReconciliationIntegrity.test.ts>)|PASSED|13|0|0|
|[frontend/src/components/project/__tests__/taskBoardPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/taskBoardPresentation.test.ts>)|PASSED|20|0|0|
|[frontend/src/components/project/__tests__/wbsDraftAndGateSeparation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/wbsDraftAndGateSeparation.test.ts>)|PASSED|5|0|0|
|[frontend/src/components/project/__tests__/workflowUiHelpers.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/project/__tests__/workflowUiHelpers.test.ts>)|PASSED|10|0|0|
|[frontend/src/components/workflow-designer/__tests__/workflowDesignerMarketing.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/components/workflow-designer/__tests__/workflowDesignerMarketing.test.ts>)|PASSED|5|0|0|
|[frontend/src/lib/__tests__/adminAuthority.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/adminAuthority.test.ts>)|PASSED|4|0|0|
|[frontend/src/lib/__tests__/authSessionHardProof.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/authSessionHardProof.test.ts>)|PASSED|12|0|0|
|[frontend/src/lib/__tests__/canonicalDashboardRoute.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/canonicalDashboardRoute.test.ts>)|PASSED|19|0|0|
|[frontend/src/lib/__tests__/cleanSalesUrlDrawer.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/cleanSalesUrlDrawer.test.ts>)|PASSED|19|0|0|
|[frontend/src/lib/__tests__/eventDedup.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/eventDedup.test.ts>)|PASSED|14|0|0|
|[frontend/src/lib/__tests__/executiveDashboardRd1.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/executiveDashboardRd1.test.ts>)|PASSED|34|0|0|
|[frontend/src/lib/__tests__/executiveGoNoGoReview.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/executiveGoNoGoReview.test.ts>)|PASSED|29|0|0|
|[frontend/src/lib/__tests__/formatters.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/formatters.test.ts>)|PASSED|13|0|0|
|[frontend/src/lib/__tests__/goNoGoSubmissionModal.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/goNoGoSubmissionModal.test.ts>)|PASSED|11|0|0|
|[frontend/src/lib/__tests__/goNoGoTodoCardPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/goNoGoTodoCardPresentation.test.ts>)|PASSED|17|0|0|
|[frontend/src/lib/__tests__/inboxAccessControl.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/inboxAccessControl.test.ts>)|PASSED|7|0|0|
|[frontend/src/lib/__tests__/inboxPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/inboxPresentation.test.ts>)|PASSED|44|0|0|
|[frontend/src/lib/__tests__/kanbanGoNoGoSubmission.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/kanbanGoNoGoSubmission.test.ts>)|PASSED|5|0|0|
|[frontend/src/lib/__tests__/kanbanWaitingGoNoGoLock.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/kanbanWaitingGoNoGoLock.test.ts>)|PASSED|5|0|0|
|[frontend/src/lib/__tests__/legalSync.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/legalSync.test.ts>)|PASSED|13|0|0|
|[frontend/src/lib/__tests__/marketingActionItemPredicate.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/marketingActionItemPredicate.test.ts>)|PASSED|5|0|0|
|[frontend/src/lib/__tests__/mobileUxBenchmark.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/mobileUxBenchmark.test.ts>)|PASSED|20|0|0|
|[frontend/src/lib/__tests__/notifDr1DeepLink.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notifDr1DeepLink.test.ts>)|PASSED|26|0|0|
|[frontend/src/lib/__tests__/notificationBellBehavior.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notificationBellBehavior.test.ts>)|PASSED|25|0|0|
|[frontend/src/lib/__tests__/notificationCount.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notificationCount.test.ts>)|PASSED|7|0|0|
|[frontend/src/lib/__tests__/notificationSync.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notificationSync.test.ts>)|PASSED|5|0|0|
|[frontend/src/lib/__tests__/statusPresentation.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/statusPresentation.test.ts>)|PASSED|13|0|0|
|[frontend/src/lib/__tests__/systemNavigationAlignment.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/systemNavigationAlignment.test.ts>)|PASSED|15|0|0|
|[frontend/src/lib/__tests__/systemSettings.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/systemSettings.test.ts>)|PASSED|13|0|0|
|[frontend/src/lib/__tests__/todoActionResolver.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/todoActionResolver.test.ts>)|PASSED|8|0|0|
|[frontend/src/lib/__tests__/todoSync.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/todoSync.test.ts>)|PASSED|5|0|0|
|[frontend/src/lib/__tests__/uiuxVaF2TypographyKpi.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/uiuxVaF2TypographyKpi.test.ts>)|PASSED|6|0|0|
|[frontend/src/lib/__tests__/w9SecR1TargetedFrontend.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/w9SecR1TargetedFrontend.test.ts>)|PASSED|10|0|0|
|[frontend/src/lib/__tests__/wf2DeepLinkAndActionability.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/wf2DeepLinkAndActionability.test.ts>)|PASSED|58|0|0|
|[frontend/src/lib/__tests__/workflowSync.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/workflowSync.test.ts>)|PASSED|16|0|0|
|[frontend/src/services/__tests__/inbox.service.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/services/__tests__/inbox.service.test.ts>)|PASSED|12|0|0|
|[frontend/src/services/__tests__/procurement.phase4.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/services/__tests__/procurement.phase4.test.ts>)|PASSED|33|0|0|
|[frontend/src/services/__tests__/project.document-closure.test.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/services/__tests__/project.document-closure.test.ts>)|PASSED|13|0|0|

### Browser inventory — all NOT RUN

- [frontend/tests/auth-session-lifecycle.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/auth-session-lifecycle.spec.ts>)
- [frontend/tests/canonical-pure-browser-lifecycle.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/canonical-pure-browser-lifecycle.spec.ts>)
- [frontend/tests/executive-dashboard-mobile-f1.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/executive-dashboard-mobile-f1.spec.ts>)
- [frontend/tests/legal-workflow-migration.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/legal-workflow-migration.spec.ts>)
- [frontend/tests/live-acceptance.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/live-acceptance.spec.ts>)
- [frontend/tests/notif-mgmt-review-live-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/notif-mgmt-review-live-chrome.spec.ts>)
- [frontend/tests/pmo-assignment-workflow.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/pmo-assignment-workflow.spec.ts>)
- [frontend/tests/project-closure-c5-browser-validation.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-closure-c5-browser-validation.spec.ts>)
- [frontend/tests/project-control-r1.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-control-r1.spec.ts>)
- [frontend/tests/project-core-r1-c1-live-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-core-r1-c1-live-chrome.spec.ts>)
- [frontend/tests/project-core-r2-live-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-core-r2-live-chrome.spec.ts>)
- [frontend/tests/project-delivery-kickoff-ui-r1.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-delivery-kickoff-ui-r1.spec.ts>)
- [frontend/tests/project-e2e-v1-c1.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-e2e-v1-c1.spec.ts>)
- [frontend/tests/project-exec-f2-f3v.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-exec-f2-f3v.spec.ts>)
- [frontend/tests/project-exec-f4-live-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-exec-f4-live-chrome.spec.ts>)
- [frontend/tests/project-execution-f1-live-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-execution-f1-live-chrome.spec.ts>)
- [frontend/tests/project-issue-risk-r1-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-issue-risk-r1-chrome.spec.ts>)
- [frontend/tests/project-pm-workspace-r1-c1.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-pm-workspace-r1-c1.spec.ts>)
- [frontend/tests/project-service-claim-r1-c1-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-claim-r1-c1-chrome.spec.ts>)
- [frontend/tests/project-service-claim-r1-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-claim-r1-chrome.spec.ts>)
- [frontend/tests/project-service-procurement-r1-arch-c2-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-procurement-r1-arch-c2-chrome.spec.ts>)
- [frontend/tests/project-service-procurement-r1-c1-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-procurement-r1-c1-chrome.spec.ts>)
- [frontend/tests/project-service-procurement-r1-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-procurement-r1-chrome.spec.ts>)
- [frontend/tests/project-service-procurement-r1-ui-c1-chrome.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-procurement-r1-ui-c1-chrome.spec.ts>)
- [frontend/tests/project-service-procurement-r1b-cdp.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/project-service-procurement-r1b-cdp.spec.ts>)
- [frontend/tests/targeted-login-transition-harness.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/targeted-login-transition-harness.spec.ts>)
- [frontend/tests/targeted-payment-approval-flow.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/targeted-payment-approval-flow.spec.ts>)
- [frontend/tests/targeted-payment-approval-todo.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/targeted-payment-approval-todo.spec.ts>)
- [frontend/tests/targeted-project-delivery-n1-elimination.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/targeted-project-delivery-n1-elimination.spec.ts>)
- [frontend/tests/targeted-rfq-matcher-contract.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/targeted-rfq-matcher-contract.spec.ts>)
- [frontend/tests/wbs-persistent-id.spec.ts](<C:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/tests/wbs-persistent-id.spec.ts>)

## Appendix B — Observed nullable differences

Scope:201 columns,11 named tables. This compares nullability only; TypeORM metadata was built offline, without initialize/synchronize.

| Table.column | Entity nullable | DB nullable |
|---|---|---|
|outbox_events.event_version|false|YES|
|outbox_events.payload|false|YES|
|outbox_events.status|false|YES|
|outbox_events.retry_count|false|YES|
|outbox_events.created_at|false|YES|
|purchase_orders.created_at|false|YES|
|purchase_orders.updated_at|false|YES|
|workflow_definitions.name|true|NO|
|workflow_definitions.created_at|false|YES|
|workflow_definitions.updated_at|false|YES|
|workflow_instances.created_at|false|YES|
|workflow_instances.updated_at|false|YES|
|workflow_instances.workflow_version_id|false|YES|
|workflow_tasks.created_at|false|YES|
|workflow_tasks.updated_at|false|YES|
|workflow_versions.created_at|false|YES|
|workflow_versions.updated_at|false|YES|

### Migration ledger names (SELECT-only; not executed)

- 1721180000000: UpdateTenderStatusEnum1721180000000
- 1721182000000: EvolveContractsModule1721182000000
- 1721387600000: AddRefreshTokenToUsers1721387600000
- 1721500000000: AddOptimisticLockVersionColumns1721500000000
- 1785484532784: AddRevisionRequestedEnum1785484532784
- 1785500000000: CleanupOrphanedContracts1785500000000
- 1785600000000: AddGoNoGoGateToTenders1785600000000
- 1785700000000: AddRevisionStatusToTenders1785700000000
- 1785800000000: AddGraceColumnsToContracts1785800000000
- 1786632000000: ChangeRefreshTokenToText1786632000000
- 1786700000000: DropDashboardKpisTable1786700000000
- 1787800000000: AddProjectLocationColumns1787800000000
- 1787900000000: AddWbsPlanningColumns1787900000000
- 1788000000000: CreateProjectCostEstimateAndItems1788000000000
- 1788100000000: EvolveTasksTableForGanttPlanning1788100000000
- 1788200000000: CreateOperationalPlanManagementTables1788200000000
- 1788300000000: WorkflowEngineCoreTables1788300000000
- 1788400000000: CreateQuotationFoundationAndRfqClosingDate1788400000000
- 1788500000000: CreatePoPaymentTermsAndMetadata1788500000000
- 1788600000000: AlignFinanceInvoicesAndItems1788600000000
- 1788700000000: CreateGoodsReceiptItemsAndAlignGoodsReceipts1788700000000
- 1789100000000: AddAuditLogsQueryIndexes1789100000000
- 1789200000000: CreateProjectBaselinesAndItems1789200000000
- 1789300000000: CreateProjectProgressLedgerAndEvidence1789300000000
- 1789400000000: EnforceTaskActiveWbsCardinality1789400000000
- 1789965000000: AddDedupeKeyToNotifications1789965000000
- 1790000000000: CreateProcurementPackagesAndTraceability1790000000000
- 1791000000000: CreateProcurementReconciliationsAndPoTraceability1791000000000
- 1791100000000: CreatePaymentRequestsTable1791100000000
- 1791200000000: EvolveBaselineScheduleSnapshot1791200000000
- 1791300000000: AddTaskActualExecutionDates1791300000000
- 1791400000000: AddProcurementOrderTypeAndServiceOrders1791400000000
- 1791500000000: SupportMultipleServiceOrdersPerPo1791500000000
- 1791600000000: CreateServiceClaimsAndTraceability1791600000000
- 1791700000000: CreateProjectIssuesAndRisksTables1791700000000
- 1791800000000: CreateProjectClosuresAndCompletionFields1791800000000
- 1791900000000: AddServicePoScopeReconciliationFields1791900000000

## Appendix C — Reusable SELECT evidence queries

The following queries were used in the read-only session. They expose only schema/count/status data; credentials are intentionally omitted. No business payload, password hash or token value was retrieved.

### snapshot

```sql
SELECT NOW() db_time,VERSION() mysql_version,@@session.transaction_read_only read_only;
```

### tables

```sql
SELECT table_name,engine FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name;
```

### migration_history

```sql
SELECT id,timestamp,name FROM migrations ORDER BY timestamp;
```

### counts

```sql
SELECT 'workflow_tasks' tbl,status,COUNT(*) n FROM workflow_tasks GROUP BY status UNION ALL SELECT 'workflow_instances',status,COUNT(*) FROM workflow_instances GROUP BY status UNION ALL SELECT 'outbox_events',status,COUNT(*) FROM outbox_events GROUP BY status UNION ALL SELECT 'notifications',IF(is_read=0,'UNREAD','READ'),COUNT(*) FROM notifications GROUP BY is_read UNION ALL SELECT 'service_claims',status,COUNT(*) FROM service_claims GROUP BY status UNION ALL SELECT 'project_closures',status,COUNT(*) FROM project_closures GROUP BY status UNION ALL SELECT 'payment_requests',status,COUNT(*) FROM payment_requests GROUP BY status;
```

### columns

```sql
SELECT table_name,column_name,column_type,is_nullable,column_key,column_default FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name IN ('purchase_orders','service_orders','service_claims','project_closures','workflow_definitions','workflow_versions','workflow_instances','workflow_tasks','workflow_transitions','outbox_events','payment_requests') ORDER BY table_name,ordinal_position;
```

### indexes

```sql
SELECT table_name,index_name,non_unique,GROUP_CONCAT(column_name ORDER BY seq_in_index) cols FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name IN ('purchase_orders','service_orders','service_claims','project_closures','workflow_definitions','workflow_versions','workflow_instances','workflow_tasks','workflow_transitions','outbox_events','payment_requests') GROUP BY table_name,index_name,non_unique;
```

### pending

```sql
SELECT id,event_name,aggregate_type,aggregate_id,status,retry_count FROM outbox_events WHERE status<>'PUBLISHED';
```

### orphans

```sql
SELECT 'task_instance' relation_name,COUNT(*) n FROM workflow_tasks t LEFT JOIN workflow_instances i ON i.id=t.workflow_instance_id WHERE i.id IS NULL UNION ALL SELECT 'transition_instance',COUNT(*) FROM workflow_transitions t LEFT JOIN workflow_instances i ON i.id=t.instance_id WHERE i.id IS NULL UNION ALL SELECT 'payment_request_invoice',COUNT(*) FROM payment_requests p LEFT JOIN invoices i ON i.id=p.invoice_id WHERE i.id IS NULL UNION ALL SELECT 'service_claim_po',COUNT(*) FROM service_claims c LEFT JOIN purchase_orders p ON p.id=c.po_id WHERE p.id IS NULL;
```

### fk

```sql
SELECT table_name,column_name,referenced_table_name,referenced_column_name FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND referenced_table_name IS NOT NULL AND table_name IN ('purchase_orders','service_orders','service_claims','project_closures','workflow_definitions','workflow_versions','workflow_instances','workflow_tasks','workflow_transitions','outbox_events','payment_requests');
```


Additional SELECTs inspected workflow graph JSON, current task assignment/role, grouped canonical event names, notification action_link counts, project/review/workflow states, active duplicate groups, notification dedupe groups and null required-field counts. No business action was replayed to produce these snapshots.

## Appendix D — Worktree preservation verification

Before report creation, the824-file fingerprint and git diff binary hash were recalculated and exactly matched the initial values in Report1. The sole intended new repository artifact is this file:

`docs/audit/EPMS_WORK_TASK_HISTORY_NOTIFICATION_CROSS_AUDIT_2026-10-16.md`

Final post-write verification is recorded below after execution. This does not claim ignored vendor files are fully hashed; it confirms the tracked/nonignored baseline covered by the explicit fingerprint and that no audit commands targeted pre-existing files for mutation.

Post-write verification: **PASS untuk baseline824 file yang dihitung**. Excluding this new report, the final count is824 with0 missing files; content fingerprint remains cce4be73ab851b825f35c74b2f3cad665b0c24293d93d94f0bc601d018dc3896. The tracked binary diff hash remains6e07057c818d534e741b03fa99951b5f9f316ec82c5e0eb62d20f65eec38ed14.

Final git status contains exactly the four initial entries plus this new untracked report. No source/config file change is attributable to this audit. Initial dirty/untracked content was preserved in place; no cleanup was performed.

DATABASE ACCESS: READ ONLY

BUSINESS DATA MUTATED: NO

