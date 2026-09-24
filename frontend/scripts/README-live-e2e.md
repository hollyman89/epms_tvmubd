# Live Browser E2E Runner Guide

Dokumentasi untuk menjalankan Pure Browser E2E secara langsung pada monitor fisik Windows desktop user.

---

### Prerequisites

* Next.js frontend berjalan di port 3000 (`http://localhost:3000`)
* NestJS backend berjalan di port 4000 (`http://localhost:4000`)
* PowerShell dijalankan dari Windows desktop fisik user (`WinSta0\Default`), **BUKAN** dari terminal agent sandbox (`exebox-*`)
* Chromium / Playwright sudah terpasang

---

### Command

Buka terminal PowerShell lokal di desktop fisik Anda, lalu jalankan:

```powershell
cd C:\Users\UBDOPS3\Herd\epms_tvmubd\frontend
.\scripts\run-live-e2e.ps1
```

atau untuk menjalankan spesifik canonical lifecycle spec:

```powershell
npx playwright test tests/canonical-pure-browser-lifecycle.spec.ts --project=chromium-live --headed
```

---

### Expected Behavior

```text
PowerShell lokal user (WinSta0\Default)
       ↓
Playwright CLI
       ↓
Chromium visible window (headless: false, slowMo: 300)
       ↓
Chromium muncul langsung di monitor user
       ↓
Observasi visual langsung perpindahan UI, klik, form fill, & multi-role handover
```

> **Catatan Penting:**  
> Command di atas **wajib** dijalankan dari PowerShell / Windows Terminal lokal Anda sendiri. Jika dijalankan melalui agent runner, sistem operasi Windows akan mengisolasi window browser ke dalam virtual desktop runner (`exebox-*`) sehingga tidak akan terlihat di monitor fisik Anda.
