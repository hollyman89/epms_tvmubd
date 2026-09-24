---
trigger: always_on
description: Next.js process management, port safety, and Dev/Build mutual exclusion rules.
---

# RULE — NEXT.JS PROCESS MANAGEMENT & DEV/BUILD MUTUAL EXCLUSION (WAJIB)

Sebelum menjalankan:
- `npm run dev`
- `npm run build`
- `npm run start`

## Guiding Principles:
1. **"Process recovery MUST be evidence-driven."**
2. **"Never perform broad process termination when an exact process can be identified."**
3. **"Do not modify application code to solve a process management problem."**
4. **"DEV SERVER and PRODUCTION BUILD are mutually exclusive operating modes on the same repository."**

---

## Aturan Inti Mutual Exclusion (WAJIB):

1. **`npm run dev` dan `npm run build` TIDAK BOLEH berjalan bersamaan pada repository frontend yang sama.**
2. **Jika Next.js development server sedang aktif pada port 3000: JANGAN PERNAH menjalankan `npm run build`.**
3. **Sebelum menjalankan production build (`npm run build`):**
   - a. Wajib cek port 3000: `netstat -ano | findstr :3000`
   - b. Identifikasi exact PID yang `LISTENING`
   - c. Verifikasi bahwa PID tersebut adalah Next.js frontend: `Get-CimInstance Win32_Process -Filter "ProcessId=<PID>"`
   - d. Hentikan exact PID tersebut: `taskkill /PID <EXACT_PID> /F`
   - e. Verifikasi port 3000 benar-benar bebas
   - f. Baru jalankan `npm run build`
4. **Setelah build selesai:**
   - Hasil build diverifikasi (`✓ Compiled successfully`, static pages generated)
   - Dev server boleh dijalankan kembali jika diperlukan
   - Wajib hanya menjalankan tepat **SATU** instance `npm run dev`
5. **Dilarang menjalankan `npm run dev` + `npm run build` secara paralel.**
6. **Dilarang menjalankan dua `npm run build` secara bersamaan.**
7. **Dilarang menjalankan dua `npm run dev` pada port 3000.**
8. **Dilarang menghapus `.next` sebagai default routine/workaround.**

---

## Canonical Operational Flows:

### 1. Development Mode Flow:
```text
CHECK PORT 3000 (netstat -ano | findstr :3000)
       ↓
CONFIRM PORT FREE / ONE NEXT DEV SERVER
       ↓
START ONE npm run dev
       ↓
VERIFY NEXT READY
       ↓
STRICT RULE: NO npm run build WHILE DEV SERVER IS ACTIVE
```

### 2. Build Verification Mode Flow:
```text
CHECK PORT 3000 (netstat -ano | findstr :3000)
       ↓
IDENTIFY EXACT PID (LISTENING)
       ↓
VERIFY COMMAND LINE (Get-CimInstance Win32_Process)
       ↓
STOP EXACT PID ONLY (taskkill /PID <EXACT_PID> /F)
       ↓
VERIFY PORT 3000 FREE
       ↓
RUN npm run build
       ↓
VERIFY BUILD RESULT (HTTP status / compilation / page generation)
       ↓
OPTIONALLY RESTART ONE npm run dev (IF DEV ENVIRONMENT NEEDED)
```

### 3. Canonical Recovery Flow (Incident Recovery):
```text
PORT 3000 CHECK (netstat -ano | findstr :3000)
       ↓
IDENTIFY PID (LISTENING)
       ↓
VERIFY COMMAND LINE (Get-CimInstance Win32_Process)
       ↓
CONFIRM NEXT.JS FRONTEND
       ↓
KILL EXACT PID ONLY (taskkill /PID <PID> /F)
       ↓
VERIFY PORT FREE
       ↓
[CONDITIONAL: Clean .next ONLY IF chunk 404 / mismatch evidence exists]
       ↓
START ONE npm run dev
       ↓
VERIFY NEXT READY
       ↓
VERIFY BROWSER (HTTP 200 & Title rendered)
       ↓
IF STILL BROKEN → DIAGNOSE ROOT CAUSE (SEPARATE APPLICATION AUDIT)
       ↓
STOP
```

---

## Aturan Wajib Keselamatan Proses (25 Rules):

1. **Jangan pernah menjalankan:** `taskkill /IM node.exe /F`.
2. **Jangan membunuh seluruh Node.js processes.**
3. **Jangan membunuh NestJS/backend process** (port 4000).
4. **Sebelum menghentikan process pada port 3000**, wajib identifikasi PID terlebih dahulu.
5. **Wajib menjalankan:**
   ```cmd
   netstat -ano | findstr :3000
   ```
6. **Ambil PID yang `LISTENING`** pada port 3000.
7. **Wajib verifikasi PID tersebut** dengan PowerShell:
   ```powershell
   Get-CimInstance Win32_Process -Filter "ProcessId=<PID>" | Select-Object ProcessId, Name, CommandLine
   ```
8. **Hanya process yang terbukti merupakan Next.js frontend** pada repository frontend yang boleh dihentikan.
9. **Jika PID pada port 3000 bukan Next.js frontend:** STOP & REPORT.
10. **Jika PID sudah diverifikasi sebagai Next.js:** hanya kill PID spesifik tersebut:
    ```cmd
    taskkill /PID <EXACT_PID> /F
    ```
11. **Setelah kill:** verifikasi kembali port 3000 benar-benar bebas (`TIME_WAIT` / `CLOSED`):
    ```cmd
    netstat -ano | findstr :3000
    ```
12. **Pastikan tidak ada lebih dari satu Next.js server** pada port 3000.
13. **Jangan menjalankan beberapa `npm run dev` / `build` secara paralel.**
14. **Backend port 4000 harus tetap aman.** Jangan restart/kill backend kecuali ada evidence bahwa backend memang menjadi root cause.
15. **Jangan menjalankan `npm install`, `npm ci`, upgrade Next.js, upgrade React** sebagai langkah default recovery.
16. **Jangan menghapus `node_modules` atau `package-lock.json`** tanpa evidence dependency corruption.
17. **Direktori `.next` hanya boleh dihapus jika evidence menunjukkan stale/corrupt build artifact**, misalnya:
    - missing chunk
    - 404 webpack chunk
    - Cannot find module dari `.next`
    - dev/build artifact mismatch
18. **Sebelum menghapus `.next`**, report root-cause evidence.
19. **Setelah `.next` dihapus:** jalankan hanya satu `npm run dev`.
20. **Setelah restart:** verifikasi:
    - port 3000 state
    - exact PID
    - Next.js Ready
    - browser response (HTTP 200)
    - no fatal runtime error
21. **Jangan mengubah source code** hanya untuk menyelesaikan process-management incident.
22. **Jika setelah process recovery browser masih error:** diagnosis source code dilakukan **TERPISAH**. Jangan mencampur process recovery dengan code fix.
23. **Incident #2 Lesson Learned:** Menjalankan `npm run build` saat `npm run dev` aktif akan menimpa folder `.next` dengan artefak produksi, memicu *webpack chunk 404* pada runtime dev dan menghasilkan *blank page*. **DEV dan BUILD wajib mutually exclusive.**
24. **Build Failure Rule:** Jika build gagal, klasifikasikan terlebih dahulu (Compilation / Runtime / Dependency / Environment / Process). Jangan langsung mereset dependensi atau mengedit source code tanpa diagnosis akar masalah.
25. **Setiap process-management incident wajib melaporkan:**
    - PID yang dihentikan
    - alasan PID aman dihentikan
    - backend PID/status
    - apakah `.next` dihapus
    - apakah dependency disentuh
    - apakah source code berubah
    - final port 3000 state

---

## Critical Distinction:
- **PROCESS INCIDENT vs APPLICATION BUG**
- Process incident (Stale server, port 3000 conflict, dev/build overlap, .next artifact mismatch, 404 webpack chunk) $\rightarrow$ Recover environment terlebih dahulu.
- Application bug (TypeScript error, syntax error, runtime exception, API error) $\rightarrow$ Baru audit source code setelah process environment stabil.

---

## Forbidden Recovery Patterns:
- ❌ `taskkill /IM node.exe /F`
- ❌ Kill seluruh node.exe process
- ❌ Kill NestJS backend process (port 4000)
- ❌ Menjalankan `npm run build` saat `npm run dev` aktif
- ❌ Restart semua service secara massal
- ❌ Delete `node_modules`
- ❌ Delete `package-lock.json`
- ❌ Blind `npm install` / `npm update`
- ❌ Upgrade Next.js / React
- ❌ Edit source code aplikasi sebelum root cause diagnosis selesai


