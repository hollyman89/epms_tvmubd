# EPMS UBD–TVM — DOKUMEN KONSOLIDASI KESIAPAN PRA-IMPLEMENTASI
# PWA & WEB PUSH NOTIFICATION READINESS (PRE-IMPLEMENTATION CONSOLIDATION)
### STATUS OPERASIONAL: DOKUMEN KONSOLIDASI AUDIT — READ ONLY — NO IMPLEMENTATION — STAGE 3 NOT AUTHORIZED

---

## 1. EXECUTIVE SUMMARY & KEPUTUSAN KESIAPAN

### 1.1. Ringkasan Eksekutif
Dokumen ini merupakan konsolidasi resmi seluruh hasil audit arsitektur teknis Web Push backend (Stage 2R26) dan kesiapan Progressive Web App (PWA) frontend untuk Enterprise Project Management System (EPMS) UBD & TVM. Dokumen ini merekonsiliasi seluruh temuan teknis backend terdahulu (`F-01` s.d. `F-10`), mengintegrasikan temuan kesiapan PWA frontend (`PWA-F-01` s.d. `PWA-F-06`), mengoreksi klaim yang belum tepat atau melampaui bukti, mengintegrasikan kontrak integrasi frontend-backend, serta menyajikan daftar lengkap keputusan tata kelola yang wajib disahkan oleh System Owner.

### 1.2. Penilaian Kesiapan Empat Tingkat (Quad-Level Readiness Assessment)

Seluruh pernyataan kesiapan di bawah ini diklasifikasikan menggunakan standar taksonomi bukti yang ketat:
- **`VERIFIED`**: Terbukti secara langsung melalui inspeksi source code, skema basis data aktif, atau referensi resmi platform.
- **`DOCUMENTED, NOT TESTED`**: Telah didefinisikan secara konseptual pada spesifikasi arsitektur, namun belum diimplementasikan atau diuji pada runtime lingkungan eksekusi.
- **`NOT FOUND IN INSPECTED SCOPE`**: Tidak ditemukan pada ruang lingkup file, direktori, dependensi, atau tabel yang diperiksa.
- **`OPEN / UNVERIFIED`**: Celah teknis, grant database, atau dependensi runtime yang belum dapat dibuktikan pada tahap perancangan dokumen.
- **`SYSTEM OWNER DECISION — OPEN`**: Kebijakan bisnis atau arsitektur yang menjadi hak eksklusif System Owner dan belum disahkan secara formal.

| Dimensi Kesiapan | Status Bukti | Ringkasan Evaluasi Berbasis Bukti |
| :--- | :--- | :--- |
| **Kesiapan Desain & Spesifikasi** *(Specification Readiness)* | **`READY FOR REVIEW`**<br>(*DOCUMENTED, NOT TESTED*) | Spesifikasi backend Stage 2R26 (skema DDL, 7 jalur transaksi, keyset pagination, disambiguasi completion, proteksi SSRF 8-lapis, dan prinsip privilege DB) telah dirumuskan secara konseptual. Kontrak integrasi frontend-backend telah distandardisasi. Namun, **seluruh rancangan ini berstatus desain tertulis dan belum diuji pada runtime repositori**. |
| **Kesiapan Implementasi Kode** *(Implementation Readiness)* | **`NOT FOUND IN INSPECTED SCOPE`**<br>(*NO CODE IMPLEMENTED*) | Berdasarkan pemeriksaan langsung pada `frontend/src`, `frontend/public`, `backend/src`, `backend/package.json`, serta kueri tabel `push%` dan `auth%` pada MySQL live (`epms_tvmubd_db`), **belum ditemukan kode implementasi PWA maupun Web Push**. File `manifest.json`, Service Worker `sw.js`, inisialisasi `PushManager`, pustaka `web-push`, skema database (`push_subscriptions`, `push_dispatches`), dan antrean BullMQ push **tidak ada** pada cakupan yang diperiksa. |
| **Kesiapan Pengujian** *(Testing Readiness)* | **`NOT FOUND IN INSPECTED SCOPE`**<br>(*NO PWA/PUSH TESTS*) | Pengujian unit Jest dan Playwright yang ada hanya mencakup fitur in-app UI dan WebSocket pada Desktop Chromium. **Belum ditemukan pengujian Service Worker, Push API, emulasi perangkat seluler, maupun pengujian pada perangkat fisik Android dan iPhone** pada cakupan repositori yang diperiksa (denominator suite pengujian PWA/Web Push: 0 suite / 0 tests). |
| **Kesiapan Operasional & Infra** *(Operational Readiness)* | **OPEN / UNVERIFIED**<br>(*PENDING INFRASTRUCTURE*) | Kredensial server Redis aktif berstatus [NOT_YET_PROVISIONED] (antrean masih mockQueueProvider), kunci VAPID resmi berstatus [NOT_YET_GENERATED], domain staging HTTPS beserta sertifikat SSL untuk pengujian ponsel fisik belum diprovisioning, dan akun MySQL runtime epms_app_runtime belum dibuat di server database (Sumber: Audit repositori epms_tvmubd dan MySQL live lokal per 28 Oktober 2026; tidak ada kredensial rahasia yang tercantum). |

### 1.3. Batas Otorisasi
> [!CAUTION]
> **STATUS TAHAP 3: STRICTLY NOT AUTHORIZED**
> Implementasi teknis (pembuatan file manifest, service worker, penambahan dependensi `web-push`, migrasi skema database, atau provisioning Redis) **DILARANG DIMULAI** sebelum System Owner memberikan persetujuan tertulis eksplisit atas seluruh keputusan tata kelola (`D-1`, `D-1b`, `D-2` s.d. `D-6` dan `D-PWA-1` s.d. `D-PWA-3`).

---

## 2. BASELINE ARSITEKTUR NOTIFIKASI EPMS SAAT INI

Berdasarkan pemeriksaan langsung pada repositori aktif, arsitektur notifikasi EPMS saat ini beroperasi dengan karakteristik sebagai berikut:

```mermaid
flowchart TD
    subgraph Frontend_Browser["Frontend Client (Next.js 14.2.15 App Router)"]
        UI["Halaman Web EPMS (Active Tab Only)"]
        Bell["NotificationBell.tsx (Popover / Drawer)"]
        SocketClient["SocketProvider.tsx (Socket.IO Client)"]
        Resolver["notificationSync.ts (resolveNotificationTarget)"]
        Auth["AuthContext.tsx (Single Refresh Token JSON)"]
    end

    subgraph Backend_Server["Backend Server (NestJS 10 / Node.js)"]
        NotifController["notification.controller.ts (REST API)"]
        SocketGateway["notification.gateway.ts (Socket.IO /notifications)"]
        Consumer["canonical-notification.consumer.ts"]
        QueueMod["queue.module.ts (mockQueueProvider)"]
    end

    subgraph Database_Layer["Database (MySQL 9.7.1)"]
        UsersTable["users (Tanpa user_auth_epoch)"]
        NotifTable["notifications (Authoritative Store)"]
        PushTables["push_* (TIDAK ADA / 0 Tabel)"]
        AuthTables["auth_* (TIDAK ADA / 0 Tabel)"]
    end

    UI --> Bell
    Bell --> SocketClient
    SocketClient <-->|TCP WebSocket (Hanya Saat Tab Aktif)| SocketGateway
    Bell -->|REST Fetch| NotifController
    NotifController --> NotifTable
    Consumer --> NotifTable
    Consumer -.->|Emit Realtime| SocketGateway
    Bell --> Resolver
    Auth --> UsersTable
```

1. **Komunikasi Real-time Hanya In-App WebSocket (`VERIFIED`):**
   Pengiriman notifikasi saat ini mengandalkan koneksi Socket.IO ke namespace `/sales` dan `/notifications` via `SocketProvider.tsx`.
2. **Karakteristik Pengiriman In-App WebSocket (`VERIFIED`):**
   Notifikasi real-time in-app (`SocketProvider.tsx`) bergantung pada eksekusi event loop JavaScript dan koneksi TCP aktif di browser. Pada desktop, koneksi dapat bertahan selama timer tidak ditangguhkan secara total. Namun pada perangkat seluler, sistem manajemen daya OS (Android Doze, iOS background app suspension) akan menangguhkan proses browser ketika layar mati atau aplikasi berada di background (lihat analisis mendalam di §5.3). Akibatnya, notifikasi in-app tidak dapat diandalkan untuk skenario background out-of-app alerting.
3. **Penyimpanan Notifikasi Authoritative (`VERIFIED`):**
   Seluruh riwayat notifikasi tersimpan di tabel `notifications` pada basis data MySQL `epms_tvmubd_db`, diakses melalui REST endpoint `GET /notifications` dan `GET /notifications/count/unread`.
4. **Pemetaan Rute Navigasi Canonical yang Solid (`VERIFIED`):**
   Fungsi `resolveNotificationTarget` pada `frontend/src/lib/notificationSync.ts` telah memetakan entitas bisnis (Tender, Kontrak, Project Closure, Claim, PO, PR, Invoice, Payment) ke URL target yang valid. Logika ini siap digunakan sebagai basis penentuan deep-link Web Push.

---

## 3. STATUS TEMUAN BACKEND STAGE 2R26 (`F-01` s.d. `F-10`)

Seluruh 10 temuan arsitektur backend dari Stage 2R26 telah dirumuskan solusinya secara konseptual pada spesifikasi desain:

| ID Temuan | Topik & Akar Masalah | Solusi Spesifikasi Desain Stage 2R26 | Status Desain | Sisa Blocker / Dependensi |
| :--- | :--- | :--- | :--- | :--- |
| **`F-01`** | Semantik Audit & Klasifikasi Sweeper | Ganti nama kolom ke `db_send_window_overlapped_revocation` & `send_window_revocation_event_id`. Transaksi `T-SWEEP-EXPIRE` mencatat `lease_expired_user_auth_epoch`. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Otorisasi Stage 3 & migrasi DDL. |
| **`F-02`** | Urutan Lock & Isolation Level `T-COMPLETE` | Memecah `T-COMPLETE` menjadi $L_1 (\text{S-Lock}) \to L_6 (\text{X-Lock})$ dalam isolasi `READ COMMITTED`. Menghapus `JOIN` pemicu deadlock. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Otorisasi Stage 3 & implementasi TypeORM. |
| **`F-03`** | Kelengkapan Lock Graph & Secondary Index | Hierarki global $L_1 \dots L_7$ mencakup 7 jalur transaksi. Mitigasi gap lock secondary index dengan pengurutan PK clustered (`ORDER BY id ASC`). | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Uji stres konkurensi di runtime Stage 3. |
| **`F-04`** | Bounded Deadlock Retry Lifecycle & Clean Runner | Fungsi `executeWithDeadlockRetry` membuat instance `QueryRunner` bersih, rollback otomatis, dan melepaskan koneksi per iterasi (maks 3x pada MySQL Error 1213). Berbeda dari retry jaringan `D-2`. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Otorisasi Stage 3. |
| **`F-05`** | Disambiguasi 5 Hasil `Phase B3` | 5 hasil diskrit (`INVALID_EVENT`, `EVENT_CONFLICT`, `NO_CANDIDATE`, `IDEMPOTENT_REPLAY`, `UPDATED`) dengan guard anti-overwrite. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Otorisasi Stage 3. |
| **`F-06`** | Imutabilitas `auth_revocation_events` | Pertahanan 4 lapis: Composite Unique Key, Triggers `BEFORE UPDATE/DELETE` (`SQLSTATE 45000`), Composite FK, dan User DB least-privilege. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Keputusan Owner `D-6` & provisioning MySQL user. |
| **`F-07`** | Batch Starvation pada Pagination Kandidat | Keyset Cursor Pagination Monotonik (`id > :cursorId ORDER BY id ASC LIMIT 500`) dipadukan dengan Strict State-Exclusion Draining Loop. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Otorisasi Stage 3. |
| **`F-08`** | Kontradiksi Predicate Idempotensi `T-COMPLETE` | Kolom audit `completed_by_worker` dan `completed_lease_version`. Disambiguasi memeriksa fence dan worker ID secara konsisten paska `lease_owner = NULL`. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Otorisasi Stage 3. |
| **`F-09`** | Semantik Batas Observabilitas Database | Status diubah menjadi `CANCELLED_PRIOR_TO_DB_SEND_AUTHORIZATION`. Memisahkan fakta database terbukti dari jaminan transmisi fisik jaringan. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Telemetri jaringan pada uji runtime Stage 3. |
| **`F-10`** | Pemisahan Taksonomi Bukti & Status Keputusan | Seluruh klaim dipisahkan ke 5 kategori bukti. Seluruh keputusan `D-1`, `D-1b`, `D-2` s.d. `D-6` ditegaskan `OPEN`. | **`CLOSED IN SPEC`**<br>(*DOCUMENTED, NOT TESTED*) | Keputusan tertulis resmi System Owner. |

---

## 4. TEMUAN PWA FRONTEND DAN EVIDENCE AKTUAL

Pemeriksaan mendalam terhadap pohon kerja frontend menghasilkan temuan faktual berikut:

1. **Struktur File Frontend (`frontend/public/` dan `frontend/src/`) (`VERIFIED`):**
   - File `frontend/public/manifest.json`: **TIDAK DITEMUKAN PADA CAKUPAN YANG DIPERIKSA**.
   - File `frontend/src/app/manifest.ts`: **TIDAK DITEMUKAN PADA CAKUPAN YANG DIPERIKSA**.
   - File `frontend/public/sw.js` atau Service Worker script: **TIDAK DITEMUKAN PADA CAKUPAN YANG DIPERIKSA**.
   - Pendaftaran `navigator.serviceWorker.register`: **TIDAK DITEMUKAN** di seluruh file `.tsx` / `.ts`.
2. **Metadata Root Layout (`frontend/src/app/layout.tsx`) (`VERIFIED`):**
   - File hanya mendefinisikan metadata dasar (title, description, viewport).
   - **Ketiadaan Tag Kritis PWA:** Tidak ada deklarasi `manifest`, `themeColor`, `appleWebApp: { capable: true }`, atau `icons.apple`.
3. **Konfigurasi Build Next.js (`frontend/next.config.js`) (`VERIFIED`):**
   - Konfigurasi saat ini hanya berisi `transpilePackages`, `modularizeImports`, dan `rewrites` ke backend port 4000.
   - Tidak ada wrapper plugin PWA (`next-pwa` atau `@ducanh2912/next-pwa`) dan tidak ada header khusus untuk Service Worker (`Service-Worker-Allowed`).
4. **Logika Autentikasi Frontend (`frontend/src/context/AuthContext.tsx`) (`VERIFIED`):**
   - Fungsi `logout` (baris 180–190) dan `terminateSession` (baris 61–77) hanya membersihkan cache lokal dan memanggil `POST /auth/logout`.
   - Tidak ada interaksi dengan `PushManager` atau pencabutan `pushSubscription`.

---

## 5. TEMUAN KESIAPAN PWA FRONTEND & ANALISIS LINTAS PERANGKAT (`PWA-F-01` s.d. `PWA-F-06`)

Untuk membedakan temuan arsitektur backend (`F-01` s.d. `F-10`) dari temuan integrasi frontend/PWA, seluruh temuan PWA dikelompokkan dalam namespace `PWA-F-01` s.d. `PWA-F-06`:

### 5.1. PWA-F-01 — Kompatibilitas Platform iOS/iPadOS, Evolusi Safari 26.0, & Web Push Home Screen

> [!NOTE]
> **Koreksi Berdasarkan Dokumentasi Resmi Apple & WebKit:**
> *Referensi Primer Resmi Terverifikasi:*
> 1. WebKit Blog: *"Web Push for Web Apps on iOS and iPadOS"* oleh Brady Eidson & Jen Simmons (16 Februari 2023): `https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/`
> 2. WebKit Blog: *"WebKit Features in Safari 26.0"* oleh Jen Simmons (15 September 2025): `https://webkit.org/blog/17333/webkit-features-in-safari-26-0/`
> 3. WebKit Blog: *"Meet Web Push"* (Juni 2022): `https://webkit.org/blog/12945/meet-web-push/`
> 4. Apple Developer Documentation: *"Configuring Web Applications"* dan *"Sending Web Push Notifications in Web Apps and Browsers"*.

1. **Baseline Resmi iOS/iPadOS 16.4 hingga iOS 18+ (`VERIFIED FACT`):**
   - Sejak iOS 16.4 dan iPadOS 16.4 (Maret 2023), Apple menambahkan dukungan W3C Push API dan Notifications API untuk web applications.
   - **Batasan Kritis (Home Screen Standalone Web App Only):** Web Push pada iOS/iPadOS **HANYA BERFUNGSI** jika pengguna telah menambahkan situs web ke Layar Utama (*Add to Home Screen*) dan membukanya sebagai aplikasi mandiri (*standalone web app*). Browser tab biasa (baik di Safari iOS, Chrome iOS, maupun browser pihak ketiga lainnya di iOS) **TIDAK MENDUKUNG** Web Push.
   - **Kewajiban User Gesture Fisik:** Pemanggilan `Notification.requestPermission()` **WAJIB** dipicu oleh interaksi fisik langsung pengguna (seperti *click* atau *tap* pada tombol UI). Pemanggilan otomatis saat halaman dimuat (*on-mount / onload*) akan otomatis ditolak oleh browser engine WebKit.
   - **Persyaratan Web App Manifest Formal:** File `manifest.json` dengan `"display": "standalone"`, nama aplikasi (`name` dan `short_name`), `start_url`, serta aset icon (`apple-touch-icon`) wajib didefinisikan agar aplikasi dibuka dalam jendela mandiri tanpa address bar Safari.
2. **Pembaruan Safari 26.0 pada iOS & iPadOS 26 (`VERIFIED FACT` vs `UNVERIFIED REAL-DEVICE BEHAVIOR`):**
   - **Perubahan Installability Terverifikasi (`VERIFIED FACT`):** Dokumentasi resmi WebKit untuk Safari 26.0 (15 September 2025: `https://webkit.org/blog/17333/webkit-features-in-safari-26-0/`) mendokumentasikan bahwa pada iOS 26 dan iPadOS 26, setiap situs yang ditambahkan ke Layar Utama (*Home Screen*) kini dibuka sebagai *web app* secara default (serupa dengan fitur "Add to Dock" di macOS), dengan kontrol pengguna untuk tetap memilih bookmark biasa jika diinginkan. Format ikon SVG juga didukung secara native.
   - **Persyaratan Web Push yang Tetap Berlaku Mutlak (`VERIFIED FACT`):** Dokumentasi Safari 26.0 **tidak mengubah persyaratan Web Push**. Web Push pada iOS 26 / iPadOS 26 **tetap mewajibkan aplikasi berjalan sebagai Home Screen web app** dan **tetap mewajibkan User Gesture fisik**. Browser tab Safari biasa pada iOS/iPadOS 26 **tetap TIDAK mendukung Web Push in-tab**.
   - **Perilaku Runtime yang Belum Terverifikasi (`UNVERIFIED / REQUIRES REAL-DEVICE TESTING`):** Dokumentasi publik Apple/WebKit menjelaskan kapabilitas API dan perilaku default UI, namun **tidak mendokumentasikan toleransi latensi pengiriman latar belakang di bawah variasi manajemen daya perangkat keras fisik, low power mode, atau kebijakan suspend proses saat layar mati pada lingkungan jaringan seluler riil**. Aspek operasional ini belum terverifikasi dan **wajib diuji secara empiris pada perangkat fisik iPhone/iPad aktual**.
3. **Faktor Pembatas Tampilan Notifikasi di Perangkat (`VERIFIED`):**
   Pengiriman Web Push ke push service Apple (APNs) dan Google (FCM) tidak menjamin perangkat pasti menyala atau berbunyi seketika. Tampilan banner, nada dering, dan getaran tunduk pada:
   - Pengaturan izin notifikasi sistem operasi per-aplikasi.
   - Mode Fokus (*Focus Modes*) / *Do Not Disturb* (DND) pada iOS dan Android.
   - Kebijakan optimasi daya (Android Doze Mode, iOS Low Power Mode).
   - Tombol fisik *silent/mute* dan volume sistem pada perangkat fisik.
4. **Klasifikasi Bukti & Status:**
   - **VERIFIED FACT:** WebKit iOS 16.4+ dan Safari 26.0 mendukung Web Push hanya untuk Home Screen standalone web apps dengan user gesture; tab Safari biasa tidak mendukung Push API. Safari 26.0 menjadikan peluncuran web app sebagai default untuk item Home Screen, namun tidak mengizinkan push in-tab.
   - **RECOMMENDATION:** Menyediakan UI tombol izin eksplisit di halaman profil/lonceng notifikasi dan menyediakan Web App Manifest lengkap.
   - **SYSTEM OWNER DECISION — OPEN:** Menyetujui panduan UX edukatif khusus pengguna iOS (`D-PWA-1`).
   - **STATUS:** **`DOCUMENTED, NOT TESTED`** (Desain terdokumentasi, menunggu pengujian perangkat fisik paska-otorisasi).

---

### 5.2. PWA-F-02 — Pemisahan Dimensi: Installability, Kelengkapan PWA, dan Kesiapan Web Push

Tiga dimensi evaluasi ini dinilai secara independen dan transparan:

```mermaid
graph LR
    subgraph D1["1. Status Installability"]
        I1["Desktop: Dapat di-install via omnibox/menu"]
        I2["Android: Heuristik Chrome WebAPK / ambient badge"]
        I3["iOS: 'Add to Home Screen' via Safari Share Sheet"]
    end

    subgraph D2["2. Kelengkapan PWA"]
        P1["Manifest JSON (Belum Ada di Repo)"]
        P2["Ikon 192/512/Maskable (Belum Ada di Repo)"]
        P3["Service Worker Offline Cache (Belum Ada di Repo)"]
        P4["Secure Context HTTPS (Baru localhost dev)"]
    end

    subgraph D3["3. Kesiapan Web Push"]
        W1["PushManager Client (Belum Ada di Repo)"]
        W2["SW Push & Click Handler (Belum Ada di Repo)"]
        W3["Backend VAPID & Dispatch (Belum Ada di Repo)"]
        W4["Database push_* (Belum Ada di MySQL)"]
    end
```

1. **Status Installability (Kemampuan Pemasangan) (`VERIFIED`):**
   - **Desktop (Windows/macOS Chrome & Edge):** Pengguna dapat memasang pintasan aplikasi (*Install app*), namun indikator otomatis (*in-browser install promotion*) tidak muncul tanpa manifest dan service worker.
   - **Android (Chrome/Edge):** Pemasangan otomatis melalui banner native WebAPK dipengaruhi oleh heuristik browser yang mengevaluasi manifest dan service worker. Pengguna dapat menambahkan pintasan secara manual melalui menu browser.
   - **iOS / iPadOS:** Pemasangan dilakukan secara manual oleh pengguna melalui tombol *Share $\to$ Add to Home Screen* pada Safari.
2. **Kelengkapan PWA (PWA Completeness) (`VERIFIED`):**
   - Repositori saat ini **BELUM MEMILIKI ASSET PWA DASAR** (tidak ada manifest, tidak ada service worker, ikon yang ada di `frontend/public/` belum berukuran standar PWA 192x192 atau 512x512).
3. **Kesiapan Web Push (Web Push Readiness) (`VERIFIED`):**
   - Sisi Frontend: **Belum ditemukan kode implementasi** (belum ada kode subscription PushManager, VAPID key handshake, dan dialog permission).
   - Sisi Backend: **Desain spesifikasi selesai dirumuskan (Stage 2R26)**, namun **implementasi kode fisik belum dilakukan** (Stage 3 belum diotorisasi).

---

### 5.3. PWA-F-03 — Perilaku WebSocket di Background, Koordinasi Delivery & Kontrak Deduplikasi Lintas Kanal

1. **Dinamika Koneksi WebSocket pada Perangkat Klien (`VERIFIED`):**
   WebSocket adalah koneksi TCP persisten. Saat browser diminimalkan atau layar ponsel dimatikan:
   - **Desktop:** Browser modern (Chrome/Edge) membatasi frekuensi timer JavaScript (*timer throttling*), namun koneksi soket TCP seringkali tetap bertahan selama server mengirimkan heartbeat ping/pong secara berkala.
   - **Mobile (Android / iOS):** Manajemen daya sistem operasi seluler (Android Doze Mode, iOS Background Execution limits) akan menangguhkan (*suspend*) proses browser setelah durasi tertentu (beberapa detik hingga beberapa menit). Penangguhan ini menghentikan pemrosesan event loop JavaScript, yang pada akhirnya memicu *ping timeout* atau pemutusan soket oleh server/gateway.
2. **Perbedaan Mendasar Fungsi Sistem (`VERIFIED`):**
   - **WebSocket In-App (`SocketProvider.tsx`):** Dirancang untuk sinkronisasi data real-time saat pengguna aktif berinteraksi di layar (*in-app experience*). Ini adalah kanal real-time selama koneksi tersedia, bukan jaminan pengiriman saat aplikasi berada di background.
   - **Web Push via Service Worker:** Dirancang khusus untuk notifikasi asinkron lintas sistem operasi **saat aplikasi tidak sedang dibuka, layar ponsel terkunci, atau browser ditutup** via push gateway resmi OS (FCM / APNs / WNS).
3. **Kontrak Deduplikasi Lintas Kanal & Batas Penjaminan Sistem (`DOCUMENTED, NOT TESTED`):**
   - **Sumber Kebenaran & Identitas Stabil:** Setiap event bisnis yang memicu notifikasi wajib memiliki identitas stabil yang dihasilkan sejak pembuatan: `canonical_notification_id` (UUID) atau `event_id`.
   - **Tiga Jalur Pengiriman:**
     1. *Jalur 1: In-App WebSocket* (`notification.gateway.ts` $\to$ `SocketProvider.tsx`).
     2. *Jalur 2: OS System Notification via Service Worker* (`self.registration.showNotification()`).
     3. *Jalur 3: Sinkronisasi Service Worker ke Tab Aktif* via `BroadcastChannel('epms-notifications')` atau `client.postMessage()`.
   - **Aturan Supresi vs Penerusan Web Push di Backend:**
     - *Pemisahan Konsep: Telemetri Keberadaan (Presence) vs Konfirmasi Penerimaan (Delivery Acknowledgment/ACK):*
       Status tab `document.visibilityState === 'visible'`, `document.hasFocus() === true`, dan heartbeat ping $\le 15$ detik HANYA merupakan telemetri keberadaan (*presence telemetry*), **BUKAN BUKTI BAHWA NOTIFIKASI TERTENTU TELAH DITERIMA ATAU DIRENDER DI PERANGKAT KLIEN**.
     - *Risiko Supresi Murni Berbasis Presence (Best-Effort):* Menekan Web Push semata-mata karena tab terlihat membawa risiko kehilangan notifikasi (*notification loss*) jika koneksi WebSocket terputus tiba-tiba atau paket TCP hilang saat transit. Supresi tanpa ACK wajib diklasifikasikan sebagai **mitigasi best-effort**, bukan jaminan pengantaran.
     - *Kebutuhan Delivery Acknowledgment (ACK) & Strategi Fallback Timeout:*
       Untuk memastikan keandalan, arsitektur yang dirancang memerlukan konfirmasi pengantaran per-pesan:
       1. Backend memancarkan event notifikasi via WebSocket dan memulai pewaktu toleransi fallback (*fallback timer*, default 3 s.d. 5 detik).
       2. Klien menerima event dan segera membalas dengan `notification:ack` berisi `canonical_notification_id`.
       3. *Kapan Push Ditekan:* Jika ACK diterima backend sebelum batas waktu berakhir, pengiriman Web Push ke endpoint perangkat tersebut ditekan.
       4. *Kapan Push WAJIB Diteruskan (Fallback):* Jika ACK TIDAK diterima dalam batas waktu, atau jika tab berstatus tersembunyi (`document.visibilityState === 'hidden'`), tidak fokus, heartbeat kedaluwarsa (> 15 detik), atau soket terputus, backend **DILARANG MENEKAN PUSH** dan **WAJIB MENERUSKAN PUSH** ke antrean Web Push (`push_dispatches`) sebagai fallback otomatis.
   - **Batas Efektivitas `tag` dan `renotify: false` (Peringatan Penting):**
     > [!WARNING]
     > Opsi `tag` dan `renotify: false` pada Service Worker **HANYA BERPENGARUH DI TINGKAT NOTIFICATION CENTER SISTEM OPERASI** (menggantikan notifikasi lama dengan tag yang sama di notification tray tanpa membunyikan audio ulang).
     > Opsi ini **TIDAK MENCEGAH DUPLIKASI IN-APP TOAST/DRAWER DI REACT**.
     > **Batas Jaminan Deduplikasi:** Seluruh mekanisme yang dirancang (opsi `tag` Service Worker, koordinasi `BroadcastChannel` antar-tab, dan cache deduplikasi lokal React dengan TTL 24 jam) merupakan **lapisan mitigasi bertingkat (defense-in-depth best-effort mitigations)** pada domain terbatas masing-masing, **BUKAN JAMINAN DEDUPLIKASI LINTAS PERANGKAT ATAU LINTAS KANAL SECARA MUTLAK**.
     > - Opsi `tag` hanya bekerja lokal pada Notification Tray sistem operasi di satu perangkat fisik.
     > - `BroadcastChannel` hanya bekerja antar-tab pada origin dan profil browser yang sama di satu perangkat.
     > - Cache lokal React hanya melindungi sesi aktif browser yang sedang terbuka (tidak melindungi jika storage dibersihkan atau dibuka pada mode incognito).
     > - Pada skenario multi-device (pengguna memiliki ponsel dan laptop aktif), kedua perangkat akan tetap memunculkan notifikasi OS secara independen. Penyelarasan status keterbacaan (*read state*) di tingkat data bisnis terjadi saat pengguna membuka aplikasi dan memicu sinkronisasi backend (`is_read = true`). Kriteria `AC-PWA-06` dipertahankan berstatus **`NOT VERIFIED (DOCUMENTED, NOT TESTED)`** hingga terdapat bukti implementasi kode dan suite pengujian yang berjalan.
   - **Kepatuhan Mutlak `userVisibleOnly: true` (Safari WebKit & Chrome):**
     Jika push eksternal tetap sampai ke Service Worker, Service Worker **WAJIB** memanggil `self.registration.showNotification()`. Browser melarang *silent push*; jika Service Worker menerima push tanpa menampilkan UI notifikasi, browser engine akan mencabut izin notifikasi situs web tersebut. Untuk meminimalkan gangguan saat pengguna sedang membuka tab, Service Worker menggunakan `tag: canonical_notification_id`, `renotify: false`, dan `silent: true` (pada platform yang mendukung).
4. **Batasan Bukti Repositori (`DOCUMENTED, NOT TESTED`):**
   Perilaku spesifik degradasi koneksi WebSocket EPMS pada jaringan seluler atau kondisi layar terkunci **belum pernah diuji secara empiris pada repositori ini**. Kebutuhan Web Push didasarkan pada arsitektur standar industri untuk background notification.

---

### 5.4. PWA-F-04 — Semantik `user_auth_epoch` untuk Logout, Batas Transaksi T-SEND, Fencing Lease & Race Condition

> [!WARNING]
> **Koreksi Arsitektural Penting:**
> Kenaikan nilai skalar `users.user_auth_epoch` pada basis data **TIDAK SECARA OTOMATIS MEMUTUS SELURUH SUBSISTEM SECARA INSTAN**. Pemutusan sesi yang efektif memerlukan validasi aktif pada empat lapisan terpisah di backend:

```mermaid
flowchart TD
    LogoutAction{"Tindakan Logout Pengguna"} -->|Pilihan: Logout Sesi Ini Saja| SingleDev["Skenario 1: Single-Device / Single-Session Logout"]
    LogoutAction -->|Pilihan: Logout Semua Perangkat / Security Revocation| GlobalLogout["Skenario 2: Global / All-Devices Logout (Force Revoke)"]

    SingleDev --> S1["1. Cari auth_sessions via sid (Session ID)"]
    S1 --> S2["2. UPDATE auth_sessions SET status = 'REVOKED', revoked_at = NOW() WHERE id = :sid"]
    S2 --> S3["3. UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = :deviceEndpoint"]
    S3 --> S4["4. users.user_auth_epoch TIDAK BERUBAH"]
    S4 --> S5["Hasil: Perangkat lain (Laptop/Tablet) TETAP AKTIF"]

    GlobalLogout --> G1["1. UPDATE users SET user_auth_epoch = user_auth_epoch + 1 (Phase A)"]
    G1 --> G2["2. UPDATE auth_sessions SET status = 'REVOKED' WHERE user_id = :userId"]
    G2 --> G3["3. UPDATE push_subscriptions SET is_active = FALSE WHERE user_id = :userId"]
    G3 --> G4["4. Eksekusi Phase B: Pembatalan antrean dispatch pending milik user"]
    G4 --> G5["5. Validasi Backend Aktif Memutus Akses Bertahap"]
```

#### Rincian Empat Lapisan Pemutusan Sesi pada Global Logout:
1. **Validasi JWT Access Token (Backend Middleware / Guard):**
   JWT adalah token *stateless*. Perubahan nilai epoch di database tidak akan menolak token yang sedang aktif **kecuali** `JwtAuthGuard` backend melakukan verifikasi nilai klaim `user_auth_epoch` pada token terhadap nilai aktual di database atau cache Redis pada setiap request (sebagaimana dirumuskan pada Keputusan `D-1b`). Jika `D-1b` tidak diaktifkan, token akses tetap valid hingga kedaluwarsa secara alami (hingga 15 menit).
2. **Koneksi Real-Time Socket.IO (Gateway Layer):**
   Koneksi soket TCP Socket.IO yang sedang terbuka tidak otomatis tertutup oleh database; backend wajib mendengarkan event pencabutan sesi (misal via Redis Pub/Sub) dan memanggil `socket.disconnect(true)` untuk memutuskan soket klien yang terdampak secara eksplisit.
3. **Sesi Basis Data (`auth_sessions`):**
   Pembaruan `status = 'REVOKED'` memblokir penggunaan refresh token untuk meminta token akses baru saat sesi diperbarui.
4. **Spesifikasi Formal Transaksi `T-SEND` (Batas Transaksi, Locking, dan Fencing Lease Lengkap):**
   Worker BullMQ wajib memvalidasi nilai `send_user_auth_epoch`, status kepemilikan subscription, dan lease worker di dalam transaksi `T-SEND`.

   **Konsistensi Transaksi, Fencing Token, dan Penanganan Status Terminal (`DOCUMENTED, NOT TESTED`):**
   > [!IMPORTANT]
   > **Prinsip Transaksional ACID:** Jika transaksi di-`ROLLBACK`, seluruh perubahan data di dalamnya dibatalkan. Oleh karena itu, pencatatan status terminal dispatch (`REVOKED_BEFORE_SEND` atau `CANCELLED_INACTIVE_SUBSCRIPTION`) **HANYA TERSIMPAN JIKA DI-COMMIT**.
   > **Aturan Fencing Mutlak:** Setiap operasi `UPDATE` pada `push_dispatches` oleh worker **DILARANG MENGGUNAKAN HANYA `WHERE id = :dispatchId`**. Update **WAJIB MENYERTAKAN SELURUH FENCING TOKEN**:
   > `WHERE id = :dispatchId AND status = 'CLAIMED_AWAITING_SEND' AND lease_owner = :workerId AND lease_version = :expectedLeaseVersion AND lease_expires_at > NOW(3)`.
   > Jika `affectedRows === 0`, artinya worker telah **KEHILANGAN HAK LEASE** (lease expired atau direbut sweeper/worker lain). Worker **WAJIB SEGERA ROLLBACK, MENGHENTIKAN PEMROSESAN, DAN TIDAK BOLEH MENGUBAH STATUS DISPATCH**.

   **Alur SQL Transaksi `T-SEND` dengan Fencing Lengkap:**
   ```sql
   -- Batas Awal Transaksi T-SEND
   SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
   START TRANSACTION;

   -- Langkah 1: S-Lock pada tabel users (Hierarki L1)
   SELECT id, is_active, user_auth_epoch
   FROM users
   WHERE id = :recipientUserId
   LOCK IN SHARE MODE;

   -- Evaluasi Logika Aplikasi Langkah 1:
   -- Kasus 1A: Baris user tidak ditemukan -> failure_reason = 'USER_NOT_FOUND'
   -- Kasus 1B: users.is_active = FALSE     -> failure_reason = 'USER_INACTIVE'
   -- Kasus 1C: users.user_auth_epoch <> :sendUserAuthEpoch -> failure_reason = 'USER_AUTH_EPOCH_MISMATCH'
   -- Jika 1A, 1B, atau 1C terjadi, worker mengeksekusi transisi terminal berpagar fence:
   --   UPDATE push_dispatches
   --   SET status = 'REVOKED_BEFORE_SEND',
   --       failed_at = NOW(3),
   --       failure_reason = :specificUserFailureCode,
   --       lease_owner = NULL,
   --       lease_expires_at = NULL,
   --       lease_version = lease_version + 1
   --   WHERE id = :dispatchId
   --     AND status = 'CLAIMED_AWAITING_SEND'
   --     AND lease_owner = :workerId
   --     AND lease_version = :expectedLeaseVersion
   --     AND lease_expires_at > NOW(3);
   --   Jika affectedRows === 1: COMMIT; worker berhenti tanpa kirim HTTP.
   --   Jika affectedRows === 0: Worker kehilangan lease! ROLLBACK; worker berhenti seketika.

   -- Langkah 2: S-Lock pada tabel push_subscriptions dengan Validasi Kepemilikan (Hierarki L2)
   -- Query WAJIB memvalidasi relasi kepemilikan ganda: id = :subscriptionId DAN user_id = :recipientUserId.
   SELECT id, user_id, is_active, status, endpoint, p256dh_key, auth_token
   FROM push_subscriptions
   WHERE id = :subscriptionId
     AND user_id = :recipientUserId
   LOCK IN SHARE MODE;

   -- Evaluasi Logika Aplikasi Langkah 2:
   -- Kasus 2A: Record tidak ditemukan (ID salah / milik user lain) -> failure_reason = 'SUBSCRIPTION_NOT_FOUND_OR_UNAUTHORIZED'
   -- Kasus 2B: push_subscriptions.is_active = FALSE               -> failure_reason = 'SUBSCRIPTION_INACTIVE'
   -- Kasus 2C: push_subscriptions.status <> 'ACTIVE'              -> failure_reason = 'SUBSCRIPTION_STATUS_INVALID'
   -- Jika 2A, 2B, atau 2C terjadi, worker mengeksekusi transisi terminal berpagar fence:
   --   UPDATE push_dispatches
   --   SET status = 'CANCELLED_INACTIVE_SUBSCRIPTION',
   --       failed_at = NOW(3),
   --       failure_reason = :specificSubFailureCode,
   --       lease_owner = NULL,
   --       lease_expires_at = NULL,
   --       lease_version = lease_version + 1
   --   WHERE id = :dispatchId
   --     AND status = 'CLAIMED_AWAITING_SEND'
   --     AND lease_owner = :workerId
   --     AND lease_version = :expectedLeaseVersion
   --     AND lease_expires_at > NOW(3);
   --   Jika affectedRows === 1: COMMIT; worker berhenti tanpa kirim HTTP.
   --   Jika affectedRows === 0: Worker kehilangan lease! ROLLBACK; worker berhenti seketika.

   -- Langkah 3: X-Lock pada tabel push_dispatches untuk Transisi ke SENDING (Hierarki L3)
   UPDATE push_dispatches
   SET status = 'SENDING',
       send_started_at = NOW(3),
       lease_expires_at = NOW(3) + INTERVAL 15 SECOND,
       lease_version = lease_version + 1
   WHERE id = :dispatchId
     AND status = 'CLAIMED_AWAITING_SEND'
     AND lease_owner = :workerId
     AND lease_version = :expectedLeaseVersion
     AND lease_expires_at > NOW(3)
     AND send_user_auth_epoch = :sendUserAuthEpoch;

   -- Evaluasi Logika Aplikasi Langkah 3:
   -- Jika affectedRows === 0: Fencing gagal (lease kedaluwarsa, dicuri sweeper, atau epoch berubah).
   --   Transaksi melakukan ROLLBACK. Worker membatalkan pengiriman dan berhenti.
   -- Jika affectedRows === 1: Otorisasi database sah. COMMIT.
   COMMIT;

   ```

   **Analisis Hierarki Penguncian (Lock Graph) & Status Verifikasi Deadlock:**
   - **Urutan Lock Global Monotonik:** Seluruh transaksi sistem dirancang mematuhi urutan penguncian menaik:
     $$L_1 (\text{users}) \longrightarrow L_2 (\text{push\_subscriptions}) \longrightarrow L_3 (\text{push\_dispatches})$$
   - Transaksi `T-SEND` mengakuisisi $L_1 (\text{S-Lock}) \to L_2 (\text{S-Lock}) \to L_3 (\text{X-Lock})$.
   - Transaksi `Global Logout (Phase A)` mengakuisisi $L_1 (\text{X-Lock}) \to L_2 (\text{X-Lock}) \to L_3 (\text{X-Lock via Phase B})$.
   - Transaksi `T-SWEEP-EXPIRE` dan `T-CLAIM` hanya mengakses $L_3 (\text{X-Lock})$.
   - Transaksi `T-COMPLETE` mengakuisisi $L_1 (\text{S-Lock}) \to L_3 (\text{X-Lock})$.
   - **Batas Bukti Lock Graph:** Meskipun rancangan menetapkan urutan penguncian monotonik $L_1 \to L_2 \to L_3$, **klaim bahwa deadlock telah tereliminasi secara matematis DIBATALKAN**. Cakupan transaksi lain di luar modul push (seperti background job, pembersihan sesi, audit logging, atau kueri TypeORM bersarang) belum diperiksa secara lengkap. Potensi deadlock pada gap lock secondary index atau multi-table cascade tetap ada. Oleh karena itu, ketahanan bebas deadlock ditandai sebagai **`OPEN / UNVERIFIED (DOCUMENTED, NOT TESTED)`** dan wajib divalidasi melalui pengujian beban konkurensi di Stage 3 dengan perlindungan retry harness `executeWithDeadlockRetry` (`F-04`).

---

### 5.5. Analisis Mendalam Dua Skenario Race Condition Logout vs T-SEND

#### Skenario 1: Single-Device Logout vs T-SEND
1. **Urutan Lock & Batas Transaksi:**
   - Single-Device Logout mengeksekusi: `UPDATE auth_sessions SET status = 'REVOKED' WHERE id = :sid` dan `UPDATE push_subscriptions SET is_active = FALSE WHERE endpoint = :endpoint` ($L_2$). Transaksi ini **TIDAK MENYENTUH** tabel `users` ($L_1$).
2. **Kondisi Persimpangan dengan T-SEND:**
   - *Kasus 1A (Logout Commit SEBELUM T-SEND Langkah 2):* T-SEND Langkah 2 membaca `is_active = FALSE`. T-SEND mentransisikan dispatch ke `CANCELLED_INACTIVE_SUBSCRIPTION`, commit, dan tidak mengirim HTTP.
   - *Kasus 1B (T-SEND Memegang S-Lock L2 saat Logout Datang):* Pada MySQL InnoDB `READ COMMITTED`, `UPDATE push_subscriptions` milik logout terblokir oleh S-Lock T-SEND. T-SEND commit `SENDING`, melepas lock. Logout unblock dan mengupdate `is_active = FALSE`. Dispatch saat ini terkirim; dispatch berikutnya ke endpoint tersebut akan ditolak.
   - *Kasus 1C (Logout Terjadi Saat HTTP Request Sedang Transit / Gateway):* Paket HTTP telah dikirim keluar NIC. Notifikasi mungkin tiba di perangkat. Namun, session `sid` pada backend telah berstatus `REVOKED`. Saat pengguna mengetuk notifikasi dan browser membuka aplikasi, request API berikutnya ditolak dengan HTTP 401 Unauthorized.

#### Skenario 2: Global Logout vs T-SEND
1. **Urutan Lock & Batas Transaksi:**
   - Global Logout mengeksekusi Phase A: `UPDATE users SET user_auth_epoch = user_auth_epoch + 1 WHERE id = :userId` ($L_1$ X-Lock), lalu mencabut seluruh sesi dan subskripsi ($L_2$ X-Lock), diikuti pembatalan outbox ($L_3$ Phase B).
2. **Empat Jendela Waktu Persimpangan:**
   - *Jendela 1 (Global Logout Commit SEBELUM T-SEND Langkah 1):* T-SEND membaca `users.user_auth_epoch` baru yang tidak cocok dengan `send_user_auth_epoch`. T-SEND mengeksekusi update `REVOKED_BEFORE_SEND` dengan fencing, commit, dan berhenti sebelum membuka soket HTTP.
   - *Jendela 2 (T-SEND Memperoleh S-Lock L1 SEBELUM Global Logout):* Global Logout yang membutuhkan X-Lock pada `users` **TERBLOKIR** oleh S-Lock T-SEND hingga T-SEND commit. Begitu T-SEND commit `SENDING` dan melepas lock, Global Logout unblock dan menaikkan epoch.
   - *Jendela 3 (Jeda Mikrodetik antara Commit T-SEND dan Emisi Paket HTTP Jaringan):* T-SEND telah commit `SENDING`, lock database telah dilepas. Global Logout commit. Worker sedang mempersiapkan socket HTTP.
     - *Batas Database:* Database tidak memiliki mekanisme transaksional untuk membatalkan thread worker di userspace.
     - *Mitigasi Worker:* Tepat sebelum membuka socket HTTP, worker mengecek token pembatalan lokal (`AbortSignal` / Redis cancellation flag). Jika terdeteksi batal, worker membatalkan socket dan menandai dispatch `CANCELLED_PRIOR_TO_HTTP_EMISSION`.
   - *Jendela 4 (HTTP In-Flight di Jaringan / Sudah Diterima Gateway):* Paket TCP telah meninggalkan kartu jaringan (*NIC*) server. Database dan worker lokal tidak dapat menarik paket di internet. Gateway push memproses pengiriman ke perangkat.
3. **Risiko Residual & Keputusan System Owner:**
   Risiko pada Jendela 3 dan 4 merupakan batas fisik jaringan yang tidak dapat dieliminasi oleh transaksi database. Ketika pengguna mengetuk notifikasi, aplikasi PWA akan memuat data dengan token JWT lama. `JwtAuthGuard` backend akan menolak token dengan HTTP 401 Unauthorized karena `token.epoch < users.epoch`. Risiko residual ini wajib diterima oleh System Owner (`OPEN`).

---

### 5.6. PWA-F-05 & PWA-F-06 — Standarisasi Pengujian & Batas Observabilitas Jaringan

```mermaid
flowchart TD
    P1["Fase 1: Dispatch PENDING di Database<br>(send_started_at IS NULL)"] -->|T-CANCEL (Phase B1)| C1["Jaminan Desain Database:<br>Status dibatalkan; worker tidak memperoleh otorisasi."]
    P2["Fase 2: Dispatch CLAIMED_AWAITING_SEND<br>(Worker memegang lease pra-kirim)"] -->|T-CANCEL (Phase B2)| C2["Jaminan Desain Database:<br>T-SEND gagal (affectedRows=0), soket HTTP dilarang dibuka."]
    P3["Fase 3: T-SEND Commit Selesai<br>(T-SEND sukses, sebelum HTTP request dimulai)"] -->|Revokasi Terjadi di Window Mikrodetik ini| C3["Risiko Balapan Jaringan (Race Condition):<br>Kecuali worker memeriksa abort signal lokal, HTTP request tetap terkirim."]
    P4["Fase 4: HTTP Request In-Flight di Jaringan<br>(Paket TCP sedang transit menuju FCM/APNs)"] -->|Revokasi Terjadi Saat Request Transit| C4["Di Luar Kontrol Database:<br>Paket telah meninggalkan server; gateway memproses payload secara independen.<br>Database hanya mencatat audit forensic (F-01)."]
    P5["Fase 5: HTTP Socket Timeout / OUTCOME_UNKNOWN<br>(Respons gateway tidak diterima dalam 5s)"] -->|Status Selesai Tanpa Kepastian| C5["Ketidakpastian Fisik (Indeterminate):<br>Tidak dapat dibuktikan apakah gateway menerima payload atau menolaknya."]
```

### 5.6.1. Rancangan Spesifikasi Bersyarat: Pemetaan Keputusan D-2 terhadap Antrean BullMQ (D-5)
*(Status: CONDITIONAL DESIGN SPECIFICATION — DOCUMENTED, NOT TESTED)*

> [!IMPORTANT]
> **Kondisi Runtime Repositori Saat Ini:**
> Di repositori saat ini, antrean push BullMQ **BELUM DIIMPLEMENTASIKAN** dan runtime masih menggunakan `mockQueueProvider` (infrastruktur Redis belum diprovisioning, keputusan `D-5` berstatus `OPEN`). Parameter yang dirumuskan di bawah ini (`attempts: 1`, `attempts: 2`, fixed backoff, status terminal `FAILED_NETWORK_TIMEOUT_NO_RETRY` dan `FAILED_MAX_RETRIES_EXCEEDED`) adalah **rancangan spesifikasi bersyarat (conditional design specification)** yang belum pernah diterapkan maupun diuji pada runtime aplikasi. Keputusan `D-2` (No-Retry vs Bounded Retry 1x) tetap sepenuhnya berstatus **`OPEN`** hingga ditetapkan secara formal dan tertulis oleh System Owner.

Status `OUTCOME_UNKNOWN` (Fase 5 pada diagram di atas) merepresentasikan kondisi di mana permintaan HTTP ke push gateway eksternal (FCM / APNs / WNS) mengalami socket timeout melampaui ambang batas rancangan `5.000 ms` (`D-3`). Pada kondisi ini, tidak dapat dipastikan apakah gateway sebenarnya berhasil memproses payload atau menolaknya.

Dua opsi rancangan teknis bersyarat dipetakan sesuai pilihan bisnis yang nantinya diambil oleh System Owner:

1. **Rancangan Bersyarat Opsi A (No-Retry / Anti-Duplication — Jika Dipilih System Owner):**
   - *Rancangan Perilaku Worker:* Worker dirancang untuk menangkap error timeout, mencatat audit forensik dengan rancangan status terminal `FAILED_NETWORK_TIMEOUT_NO_RETRY` pada tabel `push_dispatches` (disertai pembebasan lease `lease_owner = NULL`), dan menyelesaikan BullMQ job secara normal (`job.moveToCompleted()` atau return status terminal) tanpa melempar unhandled exception.
   - *Rancangan Konfigurasi BullMQ:* Job antrean dirancang dengan opsi `attempts: 1` agar BullMQ tidak melakukan re-queue otomatis.
   - *Trade-Off Bisnis:* Mengeliminasi risiko notifikasi ganda di perangkat pengguna, namun membawa konsekuensi potensi kehilangan notifikasi jika timeout terjadi sebelum gateway sempat memproses payload.
2. **Rancangan Bersyarat Opsi B (Bounded Retry 1x / Delivery Guarantee — Jika Dipilih System Owner):**
   - *Rancangan Perilaku Worker:* Worker dirancang mengonfigurasi toleransi retry terbatas pada BullMQ: opsi `attempts: 2` dengan delay backoff (rancangan default 10 detik).
   - *Rancangan Pelaksanaan Retry:* Pada percobaan kedua (`retry_count = 1`), worker mengakuisisi lease baru dan mengirimkan ulang payload dengan menyertakan header/audit yang sama. Jika percobaan kedua kembali timeout atau gagal, worker mencatat rancangan status terminal `FAILED_MAX_RETRIES_EXCEEDED` dan menghentikan pengulangan.
   - *Trade-Off Bisnis:* Meningkatkan peluang penyampaian informasi penting, namun membawa konsekuensi potensi munculnya banner notifikasi ganda jika timeout pertama sebenarnya berhasil diproses oleh gateway push.

> [!NOTE]
> **Netralitas Tata Kelola Mutlak:** Penentuan pilihan antara Opsi A dan Opsi B merupakan keputusan bisnis strategis yang **TIDAK BOLEH DITETAPKAN SECARA SEPIHAK** oleh arsitek atau tim implementasi. Keputusan `D-2` tetap berstatus **`OPEN`** hingga penetapan formal System Owner.

1. **Pengujian yang Ditemukan di Repositori (`VERIFIED`):**
   - Unit test Jest tersedia untuk logika notifikasi in-app: [`notificationCount.test.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notificationCount.test.ts), [`notificationSync.test.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notificationSync.test.ts), [`notificationBellBehavior.test.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/frontend/src/lib/__tests__/notificationBellBehavior.test.ts), dan [`tender-followup-governance.spec.ts`](file:///c:/Users/UBDOPS3/Herd/epms_tvmubd/backend/src/modules/marketing/__tests__/tender-followup-governance.spec.ts).
   - E2E Playwright test tersedia untuk alur fungsional Desktop Chromium (35+ spec files).
2. **Pengujian yang Belum Ada (`NOT FOUND IN INSPECTED SCOPE`):**
   - Belum ditemukan pengujian PWA maupun Web Push pada cakupan repositori yang diperiksa (denominator suite pengujian PWA/Web Push adalah `0 / 0`).
   - Tidak ada test suite untuk registrasi Service Worker, PushManager, VAPID handshake, event `push`, atau emulasi mobile.
3. **Pengujian yang Belum Dijalankan (`DOCUMENTED, NOT TESTED`):**
   - Belum pernah dilakukan pengujian pada perangkat fisik nyata (ponsel Android fisik atau iPhone fisik) pada kondisi aplikasi tertutup dan layar terkunci.

---

## 6. DAFTAR KEPUTUSAN SYSTEM OWNER LENGKAP (`D-1` s.d. `D-6` & `D-PWA-1` s.d. `D-PWA-3`)

> [!IMPORTANT]
> **Otoritas Tata Kelola:**
> Matriks di bawah ini merupakan **satu-satunya referensi sah dan otoritatif** untuk seluruh ID keputusan tata kelola sistem. Seluruh penamaan informal di luar tabel ini (misalnya menyebut `D-1` sebagai *"Grace Period Cleanup"* atau `D-1b` sebagai *"Stale Candidate"*) dinyatakan tidak berlaku (*superseded*).
> **Seluruh 10 keputusan di bawah ini berstatus `OPEN`** dan memerlukan keputusan formal tertulis dari System Owner sebelum Stage 3 dapat diotorisasi:

| ID Keputusan | Judul Keputusan Resmi | Opsi Pilihan & Analisis Trade-Off | Konsekuensi & Dependensi Arsitektural | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`D-1`** | **Refactoring Modul Auth & Skema Sesi** | Menyetujui skema DDL `auth_sessions`, `refresh_tokens`, `auth_revocation_events`, kolom `users.user_auth_epoch`, dan model logout dua tingkat (Single-Device vs Global). | Mengubah model single-token menjadi multi-device session. Memerlukan migrasi database TypeORM baru. | **`OPEN`** |
| **`D-1b`** | **Klaim Epoch / Session ID pada JWT** | Menyertakan klaim `user_auth_epoch` dan `sid` pada token akses JWT untuk validasi sinkron per request. | Menutup jendela masa aktif token 15 menit paska-logout dengan konsekuensi query verifikasi epoch di database / cache. | **`OPEN`** |
| **`D-2`** | **Kebijakan Retry `OUTCOME_UNKNOWN` (Jaringan)** | **Opsi A (No-Retry):** Mengeliminasi risiko notifikasi ganda ke HP pengguna, namun berisiko kehilangan notifikasi penting jika timeout terjadi sebelum gateway push memproses pesan.<br>**Opsi B (Bounded Retry 1x):** Meningkatkan peluang notifikasi sampai, namun berisiko memunculkan banner notifikasi ganda jika timeout terjadi pada respons ACK gateway. | Pilihan bisnis antara integritas ketenangan pengguna (*anti-duplication*) versus kepastian penyampaian informasi eskalasi (*delivery guarantee*). Terpisah dari deadlock retry internal (`F-04`). | **`OPEN`** |
| **`D-3`** | **Parameter Timeout & Lease Sistem** | Mengesahkan ambang batas: HTTP push timeout = `5.000 ms`, worker lease = `15.000 ms`, periodic sweeper = `30.000 ms`. | Menentukan ketahanan terhadap latensi jaringan gateway push dan kecepatan pemulihan worker crash. | **`OPEN`** |
| **`D-4`** | **Allowlist Push Service & Proteksi SSRF Berlapis** | Mengesahkan allowlist hostname resmi (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, regex Apple, regex Windows) dan 8 lapis mitigasi SSRF. | Mencegah eksploitasi Server-Side Request Forgery via endpoint URL palsu, userinfo injection, redirect, dan DNS rebinding. | **`OPEN`** |
| **`D-5`** | **Otorisasi Aktivasi BullMQ & Redis** | Mengganti `mockQueueProvider` dengan BullMQ riil dan provisioning Redis server untuk antrean dispatch. | Mengubah arsitektur antrean menjadi asynchronous riil. Memerlukan infrastruktur Redis aktif di server. | **`OPEN`** |
| **`D-6`** | **Hak Akses Database Runtime Granular** | Menyetujui pemisahan privilege database per tabel: hak `SELECT, INSERT` saja pada tabel audit `auth_revocation_events`, hak operasional `SELECT, INSERT, UPDATE` pada tabel push, dan pemisahan akun migrasi. | Menjamin imutabilitas log audit pada level database server tanpa merusak fungsi operasional aplikasi. | **`OPEN`** |
| **`D-PWA-1`** | **Strategi UX Prompt Instalasi PWA** | **Rekomendasi (Opsi A):** Custom Floating Modal edukatif yang mendeteksi platform (instruksi visual Share $\to$ Add to Home Screen untuk iOS, dan pemicu `beforeinstallprompt` untuk Android).<br>**Opsi B:** Membiarkan ambient banner bawaan browser. | Mempengaruhi tingkat adopsi instalasi PWA oleh pengguna seluler, terutama di iOS. | **`OPEN`** |
| **`D-PWA-2`** | **Waktu & Pemicu Izin Notifikasi** | **Rekomendasi (Opsi A):** Tombol/Switch eksplisit pada menu profil atau NotificationBell (*User Gesture Compliance*).<br>**Opsi B:** Pop-up modal otomatis 3 detik setelah login pertama. | Opsi A menjamin kepatuhan penuh terhadap kebijakan WebKit iOS dan Chrome. Opsi B berisiko diblokir otomatis oleh browser. | **`OPEN`** |
| **`D-PWA-3`** | **Pilihan Arsitektur Service Worker** | **Rekomendasi (Opsi A):** Vanilla Service Worker (`public/sw.js`) murni tanpa wrapper eksternal.<br>**Opsi B:** Library wrapper (`@ducanh2912/next-pwa` atau `serwist`). | Opsi A sangat ringan, transparan, dan terisolasi dari potensi breaking changes build Next.js 14 App Router. | **`OPEN`** |

---

### 6.1. Spesifikasi Desain Mitigasi SSRF & Validasi Endpoint (Design Specification — Documented, Not Tested)

Untuk menutup celah keamanan SSRF pada keputusan `D-4`, pemrosesan endpoint push dirancang mematuhi 8 lapisan validasi berurutan yang diselaraskan secara penuh antara diagram dan uraian teknis:

```mermaid
flowchart TD
    URL_In["Endpoint URL dari Subscription Browser"] --> R1["1. Parse URL: new URL(endpoint)"]
    R1 --> R2{"2. Lapis 1: Skema Valid?<br>url.protocol === 'https:'"}
    R2 -- Tidak --> Reject["TOLAK: SSRFBlockedException"]
    R2 -- Ya --> R3{"3. Lapis 2: Port Valid?<br>port === '' || port === '443'"}
    R3 -- Tidak --> Reject
    R3 -- Ya --> R4{"4. Lapis 3: Userinfo Kosong?<br>!url.username && !url.password"}
    R4 -- Tidak --> Reject
    R4 -- Ya --> R5{"5. Lapis 4: Hostname Cocok Allowlist?<br>Exact match FCM/Mozilla, Strict Regex Apple/Windows"}
    R5 -- Tidak --> Reject
    R5 -- Ya --> R6{"6. Lapis 5: Redirect Dimatikan?<br>maxRedirects === 0"}
    R6 -- Tidak --> Reject
    R6 -- Ya --> R7["7. Lapis 6: DNS Hook & Filter IP Berbasis RFC 6890<br>Periksa SELURUH Record A & AAAA"]
    R7 --> R8{"IP Non-Publik / Spesial?<br>RFC 6890, Loopback, RFC1918, Link-Local, CGNAT, Metadata, Mapped IPv6"}
    R8 -- Ya (Ada IP Terlarang) --> Reject
    R8 -- Tidak (Seluruh IP Publik Sah) --> R9["8. Lapis 7: Socket IP Pinning dengan Pelestarian TLS SNI"]
    R9 --> R10["9. Lapis 8: Egress Firewall L3/L4 (Pertahanan Komplementer)"]
```

#### Rincian Delapan Lapis Proteksi SSRF:
1. **Lapis 1 — Skema Protokol Wajib HTTPS:**
   Hanya protokol `https:` yang diizinkan. Protokol `http:`, `file:`, `ftp:`, `gopher:`, dan skema kustom lainnya ditolak seketika.
2. **Lapis 2 — Port Wajib Standar (443):**
   Port harus eksplisit `443` atau string kosong (default HTTPS). Port non-standar (misalnya `:8080`, `:8443`, `:22`) ditolak.
3. **Lapis 3 — Penolakan Kredensial Userinfo:**
   URL yang mengandung kredensial (`https://user:pass@domain`) ditolak untuk mencegah manipulasi parsing URL.
4. **Lapis 4 — Pencocokan Hostname Eksplisit Terhadap Allowlist Resmi:**
   Hostname wajib cocok secara tepat dengan domain push service resmi. Validasi menggunakan pencocokan exact dan regex ketat yang memvalidasi batas label DNS (panjang label 1–63 karakter, tidak diawali/diakhiri tanda hubung sesuai RFC 1035 / RFC 1123):
   - **Exact Match Hostnames:**
     - `fcm.googleapis.com` (Google Firebase Cloud Messaging)
     - `updates.push.services.mozilla.com` (Mozilla Autopush)
   - **Strict Subdomain Allowed Regexes (Mewajibkan Subdomain Resmi):**
     - Apple APNs: `^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+push\.apple\.com$`
     - Microsoft WNS: `^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:notify\.windows\.com|wns\.windows\.com)$`
   - **Dasar Teknis, Analisis Karakter Escape, & Kebijakan Hostname WNS/APNs:**
     - **Pola Mentah Regex & Analisis Escaping:**
       - Pola regex di atas diekstrak langsung dari teks Markdown dan dikompilasi secara deterministik oleh Node.js (`new RegExp(rawPattern)`).
       - *Dekomposisi Karakter Escape:* Pada pola Apple APNs (70 karakter), terdapat tepat 3 karakter backslash yang seluruhnya meng-escape titik DNS (`\.`). Pada pola Microsoft WNS (96 karakter), terdapat tepat 5 karakter backslash yang seluruhnya meng-escape titik DNS (`\.`).
       - *Ketiadaan Escape pada Kurung Buka:* Seluruh kurung buka pada konstruksi non-capturing group (`(?:...`) adalah karakter unescaped `(`. Tidak ada backslash sebelum `?:` (menghindari kesalahan sintaksis yang memperlakukan kurung sebagai karakter literal).
       - *Kompilasi Node.js:* Konstruktor `new RegExp(rawPattern)` menghasilkan objek regex dengan `RegExp.source` yang identik 100% dengan teks dokumen.
     - **Kebijakan Hostname Microsoft WNS & Dasar Perlakuan Hostname Root:**
       - *Sumber Primer Resmi:* Microsoft Learn: *"Windows Push Notification Services (WNS) overview"* (`https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/windows-push-notification-services--wns--overview`) dan *"Enterprise firewall and proxy configurations to support WNS traffic"*.
       - *Diferensiasi Endpoint:* Sisi server cloud EPMS mengirimkan HTTP POST notifikasi ke **Channel URI** pada namespace `*.notify.windows.com` (di mana subdomaintaraf kluster seperti `db5`, `sn4`, `hk2` bersifat dinamis). Sedangkan koneksi persistent client Windows menggunakan namespace `*.wns.windows.com` (seperti `client.wns.windows.com`).
       - *Dasar Kuantifier Subdomain (`+`) vs Status Hostname Root:* Pada rancangan spesifikasi ini, kuantifier `+` dipilih sebagai mitigasi keamanan konservatif (*Least Privilege*) untuk memastikan server hanya mengirimkan request ke kluster regional aktif dan menolak domain apex root (`push.apple.com`, `notify.windows.com`, `wns.windows.com`).
       - *Ketidakpastian yang Belum Terselesaikan (`OPEN / UNVERIFIED`):* Dokumentasi resmi Microsoft mewajibkan cloud service memastikan bahwa channel URI menggunakan domain `notify.windows.com`, namun tidak secara definitif menyatakan apakah WNS dapat menerbitkan Channel URI tanpa subdomain pada skenario tertentu. Status dukungan hostname root Microsoft WNS dipertahankan berstatus **`OPEN / UNVERIFIED`** dan memerlukan verifikasi empiris channel URI aktual saat pengujian runtime Edge di Stage 3 di bawah persetujuan System Owner (`D-4`).
     - **Peringatan Keselamatan Runtime:** Kelulusan pengujian regex unit test **BUKAN BUKTI** bahwa proteksi SSRF runtime telah aktif atau aman. Validasi hostname hanya Lapis 4; perlindungan mutlak tetap bergantung pada implementasi Lapis 5 s.d. Lapis 8 (DNS hook, IP filter RFC 6890, socket pinning, dan egress firewall).
   - **Matriks Evaluasi Kasus Uji Validasi Hostname (30 Test Cases Lokal Terverifikasi):**
     - *Hostname Sah Subdomain (Diizinkan):* `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`, `api.push.apple.com`, `api.development.push.apple.com`, `db5.notify.windows.com`, `sn4.notify.windows.com`, `hk2.notify.windows.com`, `client.wns.windows.com`.
     - *Hostname Root (Ditolak Secara Sengaja - Bukan Endpoint Push):* `push.apple.com`, `notify.windows.com`, `wns.windows.com`.
     - *Label Cacat DNS RFC 1035/1123 (Ditolak):* `-bad-.push.apple.com` (tanda hubung di awal/akhir), `bad..push.apple.com` (label kosong/double dot), label $> 63$ karakter, `-bad-.notify.windows.com`, `bad..notify.windows.com`, `bad..wns.windows.com`.
     - *Suffix Berbahaya (Ditolak):* `push.apple.com.evil.com`, `web.push.apple.com.attacker.org`, `notify.windows.com.evil.com`, `wns.windows.com.attacker.org`, `fcm.googleapis.com.evil.com`.
     - *Domain Menyerupai Allowlist / Typosquatting (Ditolak):* `evil-push.apple.com` (tanpa pemisah titik), `push-apple.com`, `apple.com`, `evil-notify.windows.com`, `notif-windows.com`, `windows.com`.
     - *Injeksi Kredensial, Protokol, & Port (Ditolak):* `user:pass@web.push.apple.com`, `web.push.apple.com:443`, `user:pass@db5.notify.windows.com`, `db5.notify.windows.com:8080`, `http://fcm.googleapis.com`.
   - *Peringatan Arsitektural:* Regex hostname hanya memvalidasi sintaks nama host, **BUKAN BUKTI BAHWA TUJUAN AKHIR AMAN**. Oleh karena itu, Lapis 5 s.d. Lapis 8 tetap wajib dieksekusi secara berurutan.
5. **Lapis 5 — Penonaktifan HTTP Redirect (`maxRedirects: 0`):**
   HTTP client dilarang mengikuti redirect status 3xx (301, 302, 307, 308) agar endpoint yang lolos pemeriksaan awal tidak dapat mengarahkan koneksi ke endpoint internal secara sembunyi-sembunyi.
6. **Lapis 6 — DNS Resolution Hook & Filter IP Berbasis IANA Special-Purpose (RFC 6890):**
   Sebelum soket dibuka, fungsi DNS hook me-resolve hostname dan memvalidasi **SELURUH** alamat IP hasil resolusi (baik record IPv4 A maupun IPv6 AAAA). Jika **SALAH SATU** IP hasil resolusi termasuk dalam kategori non-publik/spesial, koneksi ditolak:
   - **Rentang IPv4 Khusus (RFC 6890 / IANA):**
     - `0.0.0.0/8` (Current Network / Broadcast Fallback)
     - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Private IPv4 - RFC 1918)
     - `100.64.0.0/10` (Shared Address Space / CGNAT - RFC 6598)
     - `127.0.0.0/8` (Loopback IPv4)
     - `169.254.0.0/16` (Link-Local / Cloud Metadata `169.254.169.254`)
     - `192.0.0.0/24` (IETF Protocol Assignments)
     - `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` (Documentation TEST-NET 1, 2, 3)
     - `192.88.99.0/24` (6to4 Relay Anycast)
     - `198.18.0.0/15` (Network Benchmark Tests)
     - `224.0.0.0/4` (Multicast)
     - `240.0.0.0/4` (Reserved for Future Use)
     - `255.255.255.255/32` (Limited Broadcast)
   - **Rentang IPv6 Khusus (RFC 6890 / IANA):**
     - `::/128` (Unspecified)
     - `::1/128` (Loopback IPv6)
     - `::ffff:0:0/96` (IPv4-Mapped IPv6) — wajib di-unmap dan dievaluasi ulang terhadap seluruh aturan IPv4 di atas guna mencegah bypass filtering.
     - `64:ff9b::/96` (IPv4/IPv6 Translation)
     - `100::/64` (Discard-only)
     - `2001::/23` (IETF Protocol Assignments)
     - `2001:db8::/32` (Documentation IPv6)
     - `2002::/16` (6to4)
     - `fc00::/7` (IPv6 Unique Local Address - ULA)
     - `fe80::/10` (IPv6 Link-Local Unicast)
     - `ff00::/8` (IPv6 Multicast)
   - *Implementasi Standar:* Menggunakan pustaka parser IP standar terpercaya (seperti `ipaddr.js` atau fungsi klasifikasi native) untuk memastikan validasi berbasis range CIDR matematis, bukan sekadar perbandingan string parsial.
7. **Lapis 7 — Socket IP Pinning dengan Pelestarian TLS SNI & Verifikasi Hostname:**
   Koneksi soket TCP dihubungkan langsung ke alamat IP publik yang telah tervalidasi guna memitigasi *DNS Rebinding (Time-of-Check to Time-of-Use)*.
   *Persyaratan TLS:* Custom lookup agent pada Node.js **WAJIB** melestarikan `servername: parsedUrl.hostname` dan menjalankan verifikasi sertifikat SAN/Common Name standard (`checkServerIdentity`). Hal ini mencegah kegagalan `ERR_TLS_CERTALTNAME_INVALID` saat soket di-pin ke IP tanpa mengorbankan validitas sertifikat TLS gateway.
8. **Lapis 8 — Egress Firewall Jaringan (L3/L4) & Batas Fungsinya:**
   Security group server membatasi koneksi keluar port 443 hanya ke IP publik eksternal dan memblokir akses ke subnet internal (MySQL port 3306, Redis port 6379, microservices internal).
   *Batas Fungsi Firewall:* Firewall L3/L4 beroperasi sebagai pertahanan infrastruktur komplementer (*defense-in-depth*). Firewall **TIDAK DAPAT** memeriksa muatan payload HTTP, token VAPID, atau menggantikan validasi aplikasi (Lapis 1–7).

> [!NOTE]
> **Status Verifikasi SSRF:** Seluruh 8 lapis proteksi di atas berstatus **`OPEN / UNVERIFIED (DOCUMENTED, NOT TESTED)`**. Spesifikasi ini belum membuktikan proteksi runtime sebelum modul `push-egress.guard.ts` diimplementasikan dan diuji secara komprehensif menggunakan test suite SSRF pada Stage 3.

---

### 6.2. Rancangan Matriks Hak Akses Database Runtime Granular (Design Specification — Documented, Not Tested)

Untuk memastikan prinsip *Least Privilege* berjalan secara nyata pada keputusan `D-6`, hak akses database dipetakan secara spesifik per tabel dan per operasi yang dibutuhkan oleh proses PWA / Web Push:

| Tabel Basis Data | Pengguna Runtime (`epms_app_runtime`) | Pengguna Migrasi (`epms_migration_admin`) | Operasi Spesifik & Mekanisme Pertahanan |
| :--- | :--- | :--- | :--- |
| **`auth_revocation_events`** *(Tabel Audit Imutabel)* | **`SELECT, INSERT` SAJA**<br>(Dilarang keras: `UPDATE, DELETE, DROP`) | `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP` | Database Triggers `BEFORE UPDATE` dan `BEFORE DELETE` melempar `SIGNAL SQLSTATE '45000'`. |
| **`push_subscriptions`** *(Tabel Operasional)* | **`SELECT, INSERT, UPDATE`**<br>(Dilarang: `DELETE, DROP, ALTER`) | Full DDL/DML | Operasi UPDATE dibatasi pada kolom: `is_active`, `unsubscribed_at`, `failure_count`, `last_used_at`, `auth_token`, `p256dh_key`, `updated_at`. Relasi ke `users(id)` via Foreign Key. |
| **`push_dispatches`** *(Tabel Operasional)* | **`SELECT, INSERT, UPDATE`**<br>(Dilarang: `DELETE, DROP, ALTER`) | Full DDL/DML | Operasi UPDATE dibatasi pada kolom: `status`, `send_started_at`, `lease_owner`, `lease_version`, `lease_expires_at`, `failed_at`, `failure_reason`, `retry_count`, `completed_at`, `completed_by_worker`, `completed_lease_version`. |
| **`users`** *(Tabel Inti EPMS)* | **`SELECT` (Validasi Epoch / Status)**<br>**`UPDATE` (Khusus Kolom `user_auth_epoch` pada Global Logout)** | Full DDL/DML | Runtime aplikasi DILARANG melakukan `DELETE` atau `DROP` pada tabel `users`. Kenaikan epoch diisolasi pada service auth. |
| **`notifications`** *(Tabel Notifikasi Inti)* | **`SELECT` (Baca Riwayat)**<br>**`UPDATE` (Tandai Baca: `is_read`, `read_at`)** | Full DDL/DML | Runtime aplikasi DILARANG melakukan `DELETE` fisik (menggunakan soft delete jika ada). |

> [!NOTE]
> **Status Verifikasi Hak Akses Database: `OPEN / UNVERIFIED`**
> Matriks di atas merupakan rancangan spesifikasi *least privilege*. Pembuktian grant yang sesungguhnya belum dapat diverifikasi pada database aktif karena akun runtime granular (`epms_app_runtime`) **belum dibuat di MySQL server aktif** (lingkungan pengembangan saat ini masih menggunakan kredensial root/admin). Verifikasi grant memerlukan eksekusi `SHOW GRANTS FOR 'epms_app_runtime'@'%'` paska-provisioning di Stage 3.

---

## 7. MATRIKS KESIAPAN LINTAS KOMPONEN SISTEM

Evaluasi kesiapan komprehensif sebelum otorisasi implementasi:

| Komponen Sistem | Status Desain (Spesifikasi) | Status Kode di Repositori | Status Pengujian Empiris | Kesiapan Operasional & Infra |
| :--- | :--- | :--- | :--- | :--- |
| **Backend DDL & SQL** | **`DOCUMENTED, NOT TESTED`** | **`NOT FOUND IN SCOPE`** (0 Tabel) | **`NOT FOUND IN SCOPE`** (0 Test) | Menunggu Otorisasi Stage 3 & Migrasi |
| **Backend Worker** | **`DOCUMENTED, NOT TESTED`** | **`NOT FOUND IN SCOPE`** (0 Kode) | **`NOT FOUND IN SCOPE`** (0 Test) | Menunggu Otorisasi Stage 3 & BullMQ |
| **Queue & Redis** | **`DOCUMENTED, NOT TESTED`** | `mockQueueProvider` aktif | **`NOT FOUND IN SCOPE`** (0 Test) | **`OPEN`** (Menunggu Setup Redis & D-5) |
| **Modul Autentikasi** | **`DOCUMENTED, NOT TESTED`** | Single-Token Model aktif | Unit test login standar | **`OPEN`** (Menunggu Keputusan D-1 & D-1b) |
| **Keamanan & Audit** | **`DOCUMENTED, NOT TESTED`** | Akun DB root aktif | **`NOT FOUND IN SCOPE`** (0 Test) | **`OPEN`** (Menunggu Setup User D-6) |
| **Frontend Manifest** | **`DOCUMENTED, NOT TESTED`** | **`NOT FOUND IN SCOPE`** (0 Manifest) | **`NOT FOUND IN SCOPE`** (0 Test) | Menunggu Otorisasi Stage 3 |
| **Service Worker** | **`DOCUMENTED, NOT TESTED`** | **`NOT FOUND IN SCOPE`** (0 SW) | **`NOT FOUND IN SCOPE`** (0 Test) | Menunggu Otorisasi Stage 3 |
| **UI Permission** | **`DOCUMENTED, NOT TESTED`** | **`NOT FOUND IN SCOPE`** (0 UI) | **`NOT FOUND IN SCOPE`** (0 Test) | **`OPEN`** (Menunggu Keputusan D-PWA-1/2) |
| **Testing Suite** | **`DOCUMENTED, NOT TESTED`** | Desktop UI Test aktif | **`0 / 0` PWA/Push Tests** | Menunggu Harness Mobile & SSL Staging |
| **Staging HTTPS** | **`DOCUMENTED, NOT TESTED`** | Localhost HTTP dev | **`NOT TESTED` on Physical Mobile** | **`OPEN`** (Menunggu Sertifikat SSL Staging) |

---

## 8. DAFTAR BLOCKER IMPLEMENTASI YANG BENAR-BENAR BELUM SELESAI

Berikut adalah daftar blocker nyata yang menghalangi dimulainya implementasi teknis:

1. **`BLOCKER-01` (Ketiadaan Persetujuan Tertulis System Owner):**
   Keputusan strategis `D-1`, `D-1b`, `D-2` s.d. `D-6` dan `D-PWA-1` s.d. `D-PWA-3` belum diputuskan secara formal oleh System Owner (seluruhnya masih `OPEN`).
2. **`BLOCKER-02` (Ketiadaan Infrastruktur Redis Aktif):**
   Penggantian `mockQueueProvider` dengan BullMQ membutuhkan instance Redis yang siap digunakan pada lingkungan server pengujian/produksi. Kredensial server Redis (host, port, password) saat ini berstatus `[NOT_YET_PROVISIONED]` (tidak ada rahasia nyata yang dituliskan dalam dokumen).
3. **`BLOCKER-03` (Ketiadaan Pasangan Kunci VAPID Resmi):**
   Kunci VAPID (*VAPID Keypair*: Public Key & Private Key) saat ini berstatus `[NOT_YET_GENERATED]`, dengan subjek kontak operasional `mailto:ops@epms.tvmubd.com` (tidak ada secret key yang dicantumkan dalam dokumen).
4. **`BLOCKER-04` (Ketiadaan Domain / Sertifikat SSL Staging untuk Pengujian Ponsel):**
   Pengujian Service Worker pada ponsel Android/iPhone fisik melalui jaringan lokal Wi-Fi membutuhkan domain HTTPS yang valid. IP address non-HTTPS (`http://192.168.x.x`) diblokir secara otomatis oleh browser seluler.
5. **`BLOCKER-05` (Aset Ikon Standar PWA Belum Dibuat):**
   File ikon beresolusi 192x192 px, 512x512 px, dan maskable icon berbasis logo resmi EPMS belum diproduksi dan belum diletakkan di `frontend/public/icons/`.

---

## 9. TARGET ACCEPTANCE CRITERIA UNTUK TAHAP IMPLEMENTASI (STAGE 3)

Kriteria penerimaan ini merupakan **target spesifikasi pengujian masa depan** yang wajib dipenuhi pada saat implementasi Stage 3 diotorisasi (bukan hasil pengujian yang saat ini sudah lulus):

1. **`AC-PWA-01` (Kepatuhan Web App Manifest & Installability):**
   Validasi via Chrome DevTools Application Panel membuktikan manifest terdeteksi tanpa error: `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `background_color: "#ffffff"`, dan array ikon (192x192 px & 512x512 px) valid. Status: **`NOT VERIFIED (NO IMPLEMENTATION IN REPO)`**.
2. **`AC-PWA-02` (Pendaftaran Service Worker Tanpa Eror):**
   Pemeriksaan `navigator.serviceWorker.getRegistrations()` di konsol browser menghasilkan minimal satu registrasi aktif dengan scope `/` dan status `activated`. Status: **`NOT VERIFIED (NO SW IN REPO)`**.
3. **`AC-PWA-03` (Pertukaran Kunci VAPID & Registrasi Subscription):**
   Pemanggilan `GET /api/v1/notifications/push/vapid-public-key` mengembalikan public key yang valid. Registrasi via `POST /api/v1/notifications/push/subscribe` menghasilkan kode status HTTP 201 dengan ID record tersimpan pada basis data. Status: **`NOT VERIFIED (NO VAPID/API IN REPO)`**.
4. **`AC-PWA-04` (Penerimaan Push Latar Belakang pada Perangkat Android & iOS 16.4+):**
   Rancangan verifikasi pengiriman push saat ponsel fisik berada di luar aplikasi aktif (layar mati/terkunci, tab browser ditutup, atau aplikasi digeser dari Recent Apps / App Switcher) untuk memastikan payload diterima oleh gateway resmi OS dan ditampilkan pada Lock Screen / Notification Center sesuai preferensi notifikasi, volume, dan mode fokus perangkat pada PWA standalone iOS 16.4+ dan Android.
   - *Diferensiasi Siklus Hidup Aplikasi & Batasan Teknis Platform:*
     1. *Layar Mati / Perangkat Terkunci (Device Screen Off / Doze Mode / Focus Mode):* Dirancang menerima push prioritas tinggi via FCM (Android) dan APNs (iOS) untuk membangunkan notifikasi sistem, tunduk pada kebijakan hemat daya dan Do Not Disturb (DND).
     2. *Tab Browser Ditutup (Browser Tab Closed):* Dirancang agar Service Worker yang terdaftar dibangunkan oleh push event dari push service OS untuk memanggil `showNotification()`.
     3. *Aplikasi Digeser dari Recent Apps / App Switcher (Task Terminated from Foreground):*
        - *iOS 16.4+ (Standalone PWA):* Penerimaan notifikasi dikelola langsung oleh daemon sistem iOS (`apsd`) di level OS, sehingga banner notifikasi tetap dapat muncul di Lock Screen meskipun proses web aplikasi sedang tidak berjalan di memori.
        - *Android:* Pada instalasi WebAPK / browser standar, pesan FCM yang diterima Google Play Services dirancang membangunkan Service Worker; namun ketahanan proses latar belakang pada perangkat Android pihak ketiga (OEM dengan modifikasi manajemen daya agresif) dapat bervariasi.
     4. *Force Stop Khusus Pengaturan Aplikasi Android (Settings $\to$ Apps $\to$ Force Stop):* Pada sistem operasi Android, tindakan "Paksa Berhenti" secara spesifik menempatkan paket aplikasi ke status `FLAG_EXCLUDE_STOPPED_PACKAGES` yang memblokir seluruh broadcast receiver FCM oleh OS hingga aplikasi diluncurkan kembali secara manual oleh pengguna. Batasan ini adalah karakteristik spesifik OS Android dan tidak berlaku untuk model proses iOS.
   - *Status Verifikasi Repositori:* Karena belum pernah dilakukan pengujian pada ponsel Android fisik maupun iPhone fisik nyata di repositori ini, seluruh skenario penerimaan latar belakang di atas berstatus **`NOT VERIFIED (NO PHYSICAL DEVICE TEST)`**.
5. **`AC-PWA-05` (Akurasi Deep-Link saat Notifikasi Ditekan):**
   Penekanan pada banner notifikasi di sistem operasi membuka PWA dan secara langsung mengarahkan pengguna ke halaman bisnis spesifik (misal: `/sales/tenders/159` atau `/governance/tasks?projectId=10`) tanpa tersangkut di halaman awal. Status: **`NOT VERIFIED (NO RUNTIME PUSH TEST)`**.
6. **`AC-PWA-06` (Foreground Push Handling, Kriteria Sinyal Visibilitas, & Kepatuhan UserVisibleOnly):**
   - **Kriteria Sinyal Visibilitas Foreground & Batasannya:** Evaluasi multi-faktor tab aktif (`visibilityState === 'visible'` DAN `hasFocus() === true`) serta heartbeat telemetry ($\le 15$ detik) diakui sebagai **telemetri keberadaan (presence telemetry)**, bukan bukti mutlak bahwa notifikasi tertentu telah diterima oleh mata pengguna.
   - **Mekanisme Delivery Acknowledgment (ACK) & Kebijakan Fallback Timeout:**
     - Backend memancarkan notifikasi via WebSocket dan memulai pewaktu fallback (3 s.d. 5 detik).
     - Jika klien mengirim `notification:ack` dalam batas waktu: Web Push ditekan di backend.
     - Jika `notification:ack` tidak diterima dalam batas waktu, tab terminimalkan (`visibilityState === 'hidden'`), heartbeat kedaluwarsa (> 15 detik), atau koneksi WebSocket terputus: backend **DILARANG MENEKAN PUSH** dan **WAJIB MENERUSKAN PUSH** ke push gateway OS sebagai fallback otomatis.
     - *Catatan Supresi Best-Effort:* Jika supresi diterapkan murni berbasis presence tanpa per-message ACK, supresi tersebut diakui sebagai mitigasi *best-effort* yang mengandung jendela risiko hilangnya notifikasi.
   - **Kepatuhan Service Worker (`userVisibleOnly: true`):** Jika push eksternal tetap diterima oleh Service Worker, Service Worker **WAJIB** memanggil `self.registration.showNotification()` guna mematuhi kontrak WebKit Safari dan Chrome. Untuk mencegah notifikasi ganda yang mengganggu pengguna saat tab terbuka, Service Worker mengonfigurasikan opsi `tag: item.canonicalId` dan `renotify: false`, serta mengirimkan pesan pembaruan via `client.postMessage()` ke tab aktif (*quiet in-app sync*).
   - **Batas Jaminan Deduplikasi Lintas Kanal:** Mekanisme deduplikasi (cache lokal React TTL 24 jam, opsi `tag` Service Worker, dan `BroadcastChannel`) adalah **lapisan mitigasi bertingkat (defense-in-depth best-effort mitigations)** pada domain masing-masing, bukan jaminan atomik mutlak lintas perangkat. Pada skenario multi-device, notifikasi OS muncul di setiap perangkat aktif; sinkronisasi status keterbacaan dilakukan saat aplikasi dibuka (`is_read = true`).
   - **Delapan Target Skenario Desain Pengujian Deduplikasi (Spesifikasi Perancangan — Belum Dieksekusi / Unexecuted):**
     - *S1 (Tab Aktif, Terlihat, & ACK Diterima):* WebSocket menampilkan toast in-app; klien mengirim `notification:ack`; Web Push ditekan di backend.
     - *S2 (Tab Aktif tapi Tersembunyi/Minimalkan):* Web Push diteruskan otomatis; Service Worker memanggil `showNotification()` untuk menampilkan banner OS.
     - *S3 (Beberapa Tab Terbuka):* Satu leader tab menampilkan toast; tab lain hanya mengupdate counter angka lonceng secara hening via `BroadcastChannel`.
     - *S4 (WebSocket Terputus atau ACK Timeout):* Web Push dikirimkan sebagai fallback otomatis; SW menampilkan notifikasi OS.
     - *S5 (Heartbeat Kedaluwarsa > 15s):* Backend menganggap presence mati; Web Push otomatis dikirimkan.
     - *S6 (Service Worker Menerima Push saat Tab Tutup / Swiped Away):* SW memunculkan notifikasi OS; klik banner membuka PWA standalone ke deep-link target.
     - *S7 (Status Notifikasi Berubah selama Transit):* Saat banner diklik di perangkat 2, aplikasi mengecek API dan melihat status `is_read = true`, melakukan navigasi tanpa re-alerting.
     - *S8 (Event Ganda Tiba via WebSocket & Web Push):* React frontend memverifikasi `canonical_notification_id` pada cache deduplikasi lokal (TTL 24 jam); hanya kedatangan pertama yang memicu toast/audio pada tab tersebut.
   Status: **`NOT VERIFIED (DOCUMENTED, NOT TESTED)`**.
7. **`AC-PWA-07A` (Isolasi Sesi pada Single-Device Logout):**
   Ketika Pengguna A melakukan logout pada Perangkat 1:
   - Backend mengeksekusi: `UPDATE auth_sessions SET status = 'REVOKED', revoked_at = NOW(3) WHERE id = :sid` dan `UPDATE push_subscriptions SET is_active = FALSE, unsubscribed_at = NOW(3) WHERE endpoint = :deviceEndpoint`.
   - Nilai `users.user_auth_epoch` tidak berubah.
   - Sesi dan token Pengguna A pada Perangkat 2 (laptop/tablet) tetap valid dan tidak terputus.
   - Antrean dispatch lama yang menargetkan endpoint Perangkat 1 dilewati (`is_active = FALSE`).
   Status: **`NOT VERIFIED (DOCUMENTED, NOT TESTED)`**.
8. **`AC-PWA-07B` (Isolasi Sesi pada Global Logout / Security Revocation):**
   Ketika Pengguna A melakukan logout global ("Logout dari semua perangkat"):
   - Backend mengeksekusi `Phase A`: `UPDATE users SET user_auth_epoch = user_auth_epoch + 1 WHERE id = :userId` dan mencabut seluruh baris `auth_sessions` dan `push_subscriptions` milik user.
   - Pada antrean dispatch yang tertunda, query `T-SEND` yang mengevaluasi `users.user_auth_epoch = :sendUserAuthEpoch` mendeteksi ketidakcocokan epoch dan membatalkan pengiriman sebelum HTTP request dibuka.
   - Pengguna B yang login pada perangkat yang sama mengikatkan endpoint dengan user ID dan epoch Pengguna B, bebas dari notifikasi Pengguna A.
   Status: **`NOT VERIFIED (DOCUMENTED, NOT TESTED)`**.
9. **`AC-PWA-08` (Verifikasi Pertahanan SSRF Berlapis):**
   Unit test pengujian endpoint push dengan input URL berbahaya (`http://`, `169.254.169.254`, `::ffff:127.0.0.1`, `fe80::1`, `100.64.0.1`, `fcm.googleapis.com.evil.com`, userinfo `@`, non-standard port `:8080`, redirect 302) ditolak secara mutlak dengan exception `SSRFBlockedException`. Status: **`NOT VERIFIED (DOCUMENTED, NOT TESTED)`**.
10. **`AC-PWA-09` (Verifikasi Privilege Database Runtime):**
    Percobaan query `UPDATE` atau `DELETE` pada tabel `auth_revocation_events` oleh koneksi `epms_app_runtime` ditolak oleh MySQL server dengan pesan `ERROR 1142` atau trigger exception `SQLSTATE 45000`. Status: **`NOT VERIFIED (UNVERIFIED GRANT IN LIVE DB)`**.

---

## 10. MATRIKS PENGUJIAN BROWSER/OS & KEBUTUHAN PENGUJIAN FISIK

Rencana pengujian menyeluruh yang wajib dieksekusi pada tahap pengujian:

| Target Platform & Browser | Lingkungan Pengujian | Skenario Validasi Wajib | Metode Verifikasi |
| :--- | :--- | :--- | :--- |
| **Desktop Windows 11 / macOS**<br>*(Chrome, Edge, Firefox)* | Browser Desktop Nyata / Playwright Automation | 1. Munculnya ikon instalasi di omnibox.<br>2. Dialog izin notifikasi dipicu klik pengguna.<br>3. Penerimaan notifikasi saat browser di-minimize.<br>4. Navigasi tab saat notifikasi diklik. | Playwright E2E Test & Chrome DevTools Protocol (CDP). |
| **Desktop macOS (Sonoma+)**<br>*(Safari 17+)* | Perangkat Mac Fisik | 1. Penambahan ke Dock sebagai Web App.<br>2. Penerimaan Web Push via APNs di Notification Center macOS. | Manual Verification pada hardware Mac. |
| **Ponsel Android (10 s.d. 14+)**<br>*(Google Chrome, Samsung Internet)* | Perangkat Ponsel Fisik Android terhubung Wi-Fi Staging HTTPS | 1. Prompt instalasi WebAPK / menu pasang.<br>2. Penerimaan background push saat layar terkunci atau aplikasi digeser dari recent apps (FCM Wake-up). *(Catatan: Perilaku aktual berstatus NOT VERIFIED hingga diuji fisik; kondisi Force Stop via Pengaturan Android secara teknis diblokir OS via FLAG_EXCLUDE_STOPPED_PACKAGES).*<br>3. Izin Android 13+ `POST_NOTIFICATIONS`.<br>4. Tap notifikasi membuka PWA mandiri (tergantung mode DND/baterai). | Uji Fisik Perangkat Nyata (Real Device Hardware Testing). |
| **iPhone & iPad (iOS/iPadOS 16.4+)**<br>*(Apple Safari & Chrome iOS)* | Perangkat iPhone Fisik terhubung Wi-Fi Staging HTTPS | 1. Share Sheet $\to$ "Add to Home Screen" (Verifikasi standalone PWA).<br>2. Buka PWA standalone $\to$ Tap tombol "Aktifkan Notifikasi" (User Gesture).<br>3. Dialog sistem iOS muncul dan diizinkan.<br>4. Kunci iPhone $\to$ Trigger push $\to$ Banner APNs muncul di Lock Screen (tergantung Focus Mode/DND). | Uji Fisik Perangkat Nyata (Wajib iPhone Fisik dengan iOS $\ge 16.4$). |
| **Browser Tanpa Dukungan Push**<br>*(iOS < 16.4, Tab Incognito)* | Simulasi Browser Private Window | 1. PWA mendeteksi ketiadaan `PushManager`.<br>2. UI menampilkan pesan informatif graceful fallback.<br>3. Notifikasi in-app WebSocket tetap berfungsi normal saat online. | Automated Browser Test (Playwright Context with permissions disabled). |

---

## 11. URUTAN IMPLEMENTASI YANG DISARANKAN (SELEPAS OTORISASI DILEPAS)

Jika dan hanya jika System Owner telah memberikan persetujuan tertulis eksplisit atas seluruh keputusan tata kelola, implementasi direkomendasikan berjalan dalam **8 sprint terencana (Sprint 0 s.d. Sprint 7)** secara sekuensial:

```mermaid
flowchart TD
    S0["Sprint 0: Governance Sign-off & Environment Provisioning<br>(Persetujuan Owner, Setup Redis, Generate VAPID Keypair)"]
    S1["Sprint 1: Backend DDL & Push Infrastructure<br>(Tabel push_*, Entity TypeORM, BullMQ Queue Module, SSRF Guard)"]
    S2["Sprint 2: Backend Transaction & Worker Dispatch Engine<br>(T-CLAIM, T-SEND, T-COMPLETE, 7 Jalur Transaksi)"]
    S3["Sprint 3: Frontend PWA Foundations & Manifest<br>(manifest.json, Asset Icons 192/512, Layout Metadata)"]
    S4["Sprint 4: Frontend Service Worker & Subscription Client<br>(public/sw.js, PushManager Service, VAPID Handshake)"]
    S5["Sprint 5: UX Permission UI & Deep-Link Navigation<br>(NotificationBell Permission Switch, Target URL Resolver)"]
    S6["Sprint 6: Auth Integration & Cross-Device Teardown<br>(Model Logout Dua Tingkat di AuthContext, Unsubscribe API)"]
    S7["Sprint 7: End-to-End & Real-Device Hardware Acceptance<br>(Uji Desktop, Uji Android WebAPK, Uji iPhone Home Screen PWA)"]

    S0 --> S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7
```

---

## 12. KEPUTUSAN DAN TINDAKAN BERIKUTNYA BAGI SYSTEM OWNER

### Tindakan yang Wajib Dilakukan oleh System Owner:
1. **Meninjau Dokumen Konsolidasi Ini:** Memvalidasi bahwa seluruh analisis risiko, batas jaminan fisik database, matriks kesiapan, dan arsitektur pengamanan telah sesuai dengan visi tata kelola sistem enterprise EPMS.
2. **Memberikan Keputusan Tertulis Resmi atas 10 Keputusan Terbuka:**
   - Menandatangani persetujuan atas `D-1`, `D-1b`, `D-2`, `D-3`, `D-4`, `D-5`, `D-6` (Backend).
   - Menandatangani persetujuan atas `D-PWA-1`, `D-PWA-2`, `D-PWA-3` (Frontend).
3. **Mengalokasikan Prasyarat Infrastruktur:**
   - Menyediakan akses kredensial instance server Redis untuk antrean BullMQ.
   - Menyediakan domain dan sertifikat SSL staging untuk keperluan pengujian perangkat seluler fisik.

> [!WARNING]
> **PENGINGAT KESELAMATAN ARSITEKTUR:**
> Agen AI, tim pengembang, dan tim QA **DILARANG** memulai pekerjaan coding, menginstal package, atau menjalankan migrasi basis data sebelum keputusan tertulis di atas diterbitkan. Status sistem tetap berada pada mode **READ ONLY**.
