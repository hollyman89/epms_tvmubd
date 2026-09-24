# NEXT.JS DEVELOPMENT RULES — EPMS FRONTEND

> **WAJIB DIBACA** oleh seluruh developer sebelum memulai sesi development.

---

## 🚨 ATURAN UTAMA

### DILARANG menjalankan `npm run build` saat `npm run dev` masih aktif.

**Alasan**:  
`next build` menimpa isi folder `.next/` dengan production chunks (hash berbeda). Dev server yang masih berjalan tetap mereferensikan development chunks lama yang sudah tidak ada, menyebabkan **semua JS/CSS return 404** → **blank white screen**.

---

## ✅ Cara Verifikasi Kode (Tanpa Build)

```bash
# Type checking tanpa build
npm run type-check

# ESLint checking
npm run lint
```

---

## ✅ Cara Build Produksi yang Aman

```bash
# Opsi 1: Build dengan safety guard (RECOMMENDED)
npm run build:safe

# Opsi 2: Manual
# 1. Stop dev server terlebih dahulu (Ctrl+C)
# 2. Pastikan port 3000 tidak digunakan:
netstat -ano | findstr :3000
# 3. Baru jalankan build:
npm run build
```

---

## 🔄 Cara Recovery Blank White Screen

Jika terjadi blank white screen dengan 404 pada `/_next/static/*`:

```bash
# Opsi 1: One-command recovery (RECOMMENDED)
npm run dev:clean

# Opsi 2: Manual
# 1. Stop dev server (Ctrl+C atau kill process)
# 2. Hapus cache:
npm run clean:next
# 3. Restart dev server:
npm run dev
```

---

## 📦 Daftar Script NPM

| Script | Perintah | Fungsi |
|--------|----------|--------|
| `dev` | `next dev` | Menjalankan development server |
| `dev:clean` | `clean:next` + `dev` | Hapus cache lalu jalankan dev server |
| `build` | `next build` | Production build (⚠️ jangan saat dev aktif) |
| `build:safe` | Guard check + `next build` | Build dengan proteksi port 3000 |
| `clean:next` | Hapus folder `.next/` | Membersihkan cache development/build |
| `type-check` | `tsc --noEmit` | Verifikasi TypeScript tanpa build |
| `lint` | `next lint` | ESLint check |

---

## ⚠️ Checklist Sebelum Build

- [ ] Dev server sudah dihentikan (`Ctrl+C`)
- [ ] Port 3000 tidak digunakan (`netstat -ano | findstr :3000` kosong)
- [ ] Gunakan `npm run build:safe` sebagai pengganti `npm run build`

---

## 📋 Kronologi Insiden

| Tanggal | Insiden | Penyebab | Resolusi |
|---------|---------|----------|----------|
| 2026-08-10 | Blank White Screen #1 | `next build` saat `next dev` aktif | `rm .next/` + restart dev |
| 2026-08-10 | Blank White Screen #2 | `next build` saat `next dev` aktif (KPI V1 verification) | `rm .next/` + restart dev |
