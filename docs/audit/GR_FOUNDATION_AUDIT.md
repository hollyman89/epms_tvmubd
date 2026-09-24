# GOODS RECEIPT FOUNDATION AUDIT & DESIGN
**Versi Dokumen:** 1.0 (READ-ONLY Audit — Zero Mutation)
**Tanggal Pelaksanaan:** 08 September 2026
**Scope:** Audit menyeluruh arsitektur Goods Receipt sebagai prerequisite P1 untuk Progress Billing (Termin 2 & 3)
**Baseline Database:** `{ pr: 1, po: 1, poi: 2, terms: 4, invoices: 1, invoice_items: 2, payments: 2, goods_receipts: 0 }`

---

## 1. Executive Summary

Audit ini mengevaluasi kesiapan produksi arsitektur **Goods Receipt (GR)** pada sistem EPMS TVM-UBD berdasarkan status closure audit P1 dari `EPMS_LIFECYCLE_CLOSURE_AUDIT.md`. Temuan utama: **backend GR sudah solid**, tetapi terdapat **1 blocker kritis (RED)** pada database — tabel `goods_receipt_items` **tidak ada di production database** — serta beberapa kesenjangan yang perlu diselesaikan sebelum GR dapat dioperasionalkan untuk Progress Billing.

### Ringkasan Status:

| Komponen | Status | Keterangan |
| :--- | :---: | :--- |
| Backend Entity (GoodsReceipt) | `GREEN` | Entity lengkap, relasi benar |
| Backend Entity (GoodsReceiptItem) | `RED` | Tabel `goods_receipt_items` **TIDAK ADA** di DB |
| Backend DTO (create-gr.dto.ts) | `GREEN` | Validasi lengkap |
| Backend Controller (GR endpoints) | `GREEN` | 3 endpoints terdefinisi, RBAC terpasang |
| Backend Service (createGoodsReceipt) | `GREEN` | Logic lengkap, transaksi atomik |
| Backend Service (getAllGoodsReceipts) | `GREEN` | Relasi lengkap |
| Finance Matching Engine | `YELLOW` | DP path: PO-Invoice only; Progress path: evidenceRef string (bukan GR record aktual) |
| Frontend Service (procurement.service.ts) | `GREEN` | 3 metode terkoneksi ke backend API |
| Frontend Modal (GoodsReceiptModal.tsx) | `YELLOW` | Logic benar, tapi source PO masih dari prototype record type |
| Frontend Page (/procurement/gr/create) | `RED` | Stub — "Form Buat GR (Belum diimplementasi)" |
| Database (goods_receipts) | `GREEN` | Tabel ada, skema sesuai entity |
| Database (goods_receipt_items) | `RED` | **Tabel tidak ada di production** |
| RBAC (Backend) | `GREEN` | Role terdefinisi dengan benar |
| RBAC (Frontend) | `YELLOW` | canReceiveGoods tidak include PMO & HEAD_OF_OPERATIONS |
| Event / Audit Log | `YELLOW` | Event `gr.created` emit tapi tidak ada listener/consumer aktif |

---

## 2. A. Current State — Backend Entities

### A.1 — GoodsReceipt Entity

**File:** `backend/src/entities/goods-receipt.entity.ts`

```
@Entity('goods_receipts')
Fields: id, version (optimistic lock), poId (FK), grNumber (UNIQUE),
        receiptDate, totalReceivedAmount,
        createdBy, updatedBy, deletedBy, createdAt, updatedAt, deletedAt
Relations:
  @ManyToOne -> PurchaseOrder (RESTRICT)
  @OneToMany -> GoodsReceiptItem[] (cascade: true)
```

**Status:** `GREEN` — Entity valid. `@VersionColumn` hadir untuk optimistic locking.

> **CATATAN:** Field `remarks` ada di DTO `CreateGoodsReceiptDto` dan digunakan di service code `gr.remarks = dto.remarks`, tetapi **tidak ada column `remarks` di entity maupun tabel `goods_receipts`**. Remarks diterima API namun di-drop secara silent oleh TypeORM (tidak error, tidak tersimpan).

---

### A.2 — GoodsReceiptItem Entity

**File:** `backend/src/entities/goods-receipt-item.entity.ts`

```
@Entity('goods_receipt_items')
Fields: id, grId (FK), poItemId (FK), receivedQuantity (decimal 10,2),
        remarks (text nullable), createdBy, updatedBy, deletedBy, ...timestamps
Relations:
  @ManyToOne -> GoodsReceipt (CASCADE DELETE)
  @ManyToOne -> PurchaseOrderItem (RESTRICT DELETE)
```

**Status:** `RED` — **TABEL `goods_receipt_items` TIDAK ADA DI DATABASE PRODUCTION.**

```
Error: Table 'epms_tvmubd_db.goods_receipt_items' doesn't exist
```

Tabel `goods_receipts` (header) ada. Tabel item-level **belum pernah dimigrasikan**.

---

## 3. B. Endpoint Map

| Method | Path | RBAC Roles | Status |
| :--- | :--- | :--- | :---: |
| `POST` | `/procurement/goods-receipts` | PROCUREMENT, PURCHASING, PROJECT_MANAGER, PMO, SUPER_ADMIN, ADMIN, HEAD_OF_OPERATIONS | `GREEN` |
| `GET` | `/procurement/goods-receipts` | + FINANCE, DIRECTOR, GENERAL_MANAGER, MANAGER | `GREEN` |
| `GET` | `/procurement/goods-receipts/:goodsReceiptId` | (sama dengan GET list) | `GREEN` |

**File Controller:** `backend/src/modules/procurement/procurement.controller.ts` (L116-L136)

---

## 4. C. Database Schema Audit

### goods_receipts (ada di DB)

| Kolom DB | Type DB | Entity Type | Match |
| :--- | :--- | :--- | :---: |
| `id` | bigint unsigned | PrimaryGeneratedColumn | OK |
| `po_id` | bigint unsigned NOT NULL | @Column + @ManyToOne | OK |
| `gr_number` | varchar(100) UNIQUE | @Column unique | OK |
| `receipt_date` | `date` | `datetime` | **MISMATCH** |
| `total_received_amount` | decimal(19,2) | decimal(19,2) | OK |
| `created_by/updated_by/deleted_by` | nullable bigint | nullable | OK |
| `version` | int NOT NULL DEFAULT 1 | @VersionColumn | OK |
| `remarks` | **TIDAK ADA** | **TIDAK ADA di entity** (ada di DTO) | Silent drop |

> **CAUTION:** `receipt_date` di DB adalah type `date` tetapi entity mendefinisikan `type: 'datetime'`. MySQL kemungkinan auto-truncate timestamp menjadi date, namun berpotensi error pada strict mode.

### goods_receipt_items (TIDAK ADA di DB)

Tabel ini **tidak ditemukan** dalam production database. Entity dan service sudah siap tetapi tabel belum pernah dibuat via migration.

### goods_receipts — FK Constraints yang ada:

```
fk_gr_po: goods_receipts.po_id -> purchase_orders.id
```

FK ke `purchase_order_items` belum ada (tabel items belum exist).

---

## 5. D. Business Logic Audit — createGoodsReceipt()

**File:** `backend/src/modules/procurement/procurement.service.ts:979-1091`

```
Flow:
1. Fetch PO + items dalam queryRunner transaction
2. Validasi PO status: hanya ISSUED atau PARTIALLY_FULFILLED
3. Generate GR Number: GR-YYYYMMDD-SEQ (atomic, sequential)
4. Create GR Header -> savedGr
5. Per item: validasi poItemId milik PO, cek remainingQty, create GRItem, update poItem.receivedQuantity
6. Kalkulasi PO status baru: PARTIALLY_FULFILLED / COMPLETED
7. Commit transaction
8. Emit event gr.created
```

**Status:** `GREEN` — Logic solid, transaksi atomik. Semua validasi ada.

> **WARNING:** Langkah #5 akan **CRASH** (`ER_NO_SUCH_TABLE`) saat runtime karena `goods_receipt_items` tidak ada di DB. Ini adalah direct consequence dari blocker R1.

---

## 6. E. Over-Receipt Rule Audit

### Backend Validasi (procurement.service.ts:1028-1031):

```typescript
const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQuantity);
if (itemDto.receivedQuantity > remainingQty) {
  throw new BadRequestException(`Cannot receive ${itemDto.receivedQuantity}...`)
}
```

### Frontend Validasi (GoodsReceiptModal.tsx:301-312):

```typescript
if (inputQty < 0) { message.error('...negatif'); return; }
if (inputQty > liveRemaining) { message.error('...maksimal'); return; }
```

### DTO Validasi:

```typescript
@Min(0.01) receivedQuantity: number;  // mencegah nilai nol/negatif
```

| Rule | Backend | Frontend | Status |
| :--- | :---: | :---: | :---: |
| Over-receipt guard | YES | YES | `GREEN` |
| Negative quantity guard | YES (Min 0.01) | YES | `GREEN` |
| Minimal 1 item received | YES (implicit) | YES (explicit) | `GREEN` |
| Item bukan milik PO | YES | N/A (filtered di UI) | `GREEN` |
| Double-submit protection | Partial (status check) | isSubmitting flag | `YELLOW` |
| Idempotency key | TIDAK ADA | TIDAK ADA | `YELLOW` |

---

## 7. F. Progress Billing Dependency Audit

### Finance Matching Engine — evaluateMatching()

Engine memiliki **dua path berbeda**:

#### Path A: Term-Based Invoice (`invoice.paymentTermId != null`)

```typescript
if (invoice.paymentTermId) {
  // Cek: sequence, status term, evidence ref, amount cap
  // GR TIDAK DIPERIKSA di path ini
  if (paymentTerm.termType === 'PROGRESS') {
    if (!dto?.evidenceRef || dto.evidenceRef.trim() === '') {
      // ERROR: evidenceRef required (string BAST)
    }
  }
}
```

#### Path B: Full PO Invoice (tanpa `paymentTermId`)

```typescript
} else {
  // 3-WAY MATCHING: Invoice <-> PO <-> GoodsReceipt
  const goodsReceipts = await em.find(GoodsReceipt, { where: {poId}, relations: ['items'] });
  // Hitung totalGrAmount dari GR items
  // Cocokkan invoice == po == totalGrAmount
}
```

### Kesimpulan per Termin:

| Termin | Type | GR Required by Engine? | Status Saat Ini |
| :--- | :---: | :---: | :--- |
| Termin 1 — DP 30% | DOWN_PAYMENT | **NO** | `GREEN` — PAID |
| Termin 2 — Progress 1 30% | PROGRESS | evidenceRef string saja (bukan GR record) | `YELLOW` — belum diuji |
| Termin 3 — Progress 2 30% | PROGRESS | evidenceRef string saja | `YELLOW` — belum diuji |
| Termin 4 — Retention 10% | RETENTION | evidenceRef + PO status COMPLETED | `RED` — goods_receipt_items tidak ada |

> **PENTING:** Finance Engine saat ini menggunakan **evidenceRef string** (nomor BAST) sebagai bukti Progress — bukan link ke GR record di database. Ini desain intentional yang memungkinkan Progress Billing tanpa GR fisik, namun mengurangi auditability.

---

## 8. G. Frontend Audit — GoodsReceiptModal

**File:** `frontend/src/components/procurement/GoodsReceiptModal.tsx`

| Aspek | Status | Detail |
| :--- | :---: | :--- |
| Source PO | `YELLOW` | Props `po: PurchaseOrderPrototypeRecord` — prototype type, bukan typed backend DTO |
| Source PO Items | `GREEN` | `po.items` dari backend API (receivedQuantity dari DB) |
| Ordered Quantity | `GREEN` | `Number(it.quantity)` dari backend |
| Previously Received Qty | `GREEN` | `Number(it.receivedQuantity)` dari `po_items.received_quantity` |
| Outstanding Quantity | `GREEN` | Computed: `Math.max(0, orderedQty - previouslyReceivedQty)` |
| Project mapping | `GREEN` | Dari `purchaseOrder.purchaseRequest.project` chain |
| Vendor mapping | `GREEN` | Dari `purchaseOrder.vendor` |
| Duplicate submit | `GREEN` | `isSubmitting` state flag |
| Loading/Error state | `GREEN` | `setIsSubmitting(true/false)` + message.error |
| API contract | `GREEN` | `ProcurementService.createGoodsReceipt()` -> POST /procurement/goods-receipts |
| Dead stub SSOT | `YELLOW` | `getGoodsReceiptsByPo` (L87-89) adalah empty stub yang masih diekspor |
| GR list source | `GREEN` | `allGoodsReceipts` dari `GET /procurement/goods-receipts` (backend) |
| `/procurement/gr/create` page | `RED` | Stub: "Form Buat GR (Belum diimplementasi)" |

**Catatan Penting:** Post-submit, modal membangun `newGr` lokal dari API response + PO props sebagai optimistic update — sah, bukan pengganti SSOT, karena `refetchPrPo()` dipanggil di `onGrCreated` callback.

---

## 9. H. RBAC Audit

### Backend (Controller):

| Operasi | Roles | Status |
| :--- | :--- | :---: |
| CREATE GR | PROCUREMENT, PURCHASING, PM, PMO, SUPER_ADMIN, ADMIN, HEAD_OF_OPERATIONS | `GREEN` |
| VIEW GR List | + FINANCE, DIRECTOR, GENERAL_MANAGER, MANAGER | `GREEN` |
| VIEW GR Detail | (sama dengan List) | `GREEN` |
| Edit / Cancel GR | Tidak ada endpoint | Append-only by design |

### Frontend:

```typescript
// ProcurementPage.tsx:63
const canReceiveGoods = isProcurement || isSuperAdmin || isProjectManager;
```

| Gap | Detail |
| :--- | :--- |
| PMO dan HEAD_OF_OPERATIONS | Backend mengizinkan, frontend tidak expose tombol GR untuk role ini |

---

## 10. I. Event & Audit Log Audit

```typescript
// procurement.service.ts:1073-1077
this.eventEmitter.emit('gr.created', { gr_id: savedGr.id, po_id: po.id });
this.logger.log(`RabbitMQ Event Emitted: gr.created for GR ${savedGr.id}`);
```

| Aspek | Status | Detail |
| :--- | :---: | :--- |
| JWT actor (createdBy) | `GREEN` | userId dari JWT disimpan di GR.createdBy |
| Optimistic locking | `GREEN` | @VersionColumn pada GoodsReceipt |
| Event emit | `GREEN` | gr.created di-emit via EventEmitter2 |
| Event listener | `YELLOW` | Tidak ada @OnEvent('gr.created') consumer di codebase |
| Audit log entry | `YELLOW` | Tidak ada entry di audit_logs untuk GR creation |
| Outbox event | `YELLOW` | Tidak ada OutboxEvent untuk GR |
| Idempotency key | `YELLOW` | Tidak ada deduplication mechanism |
| Logger label | `YELLOW` | Log label "RabbitMQ" tapi sistem pakai EventEmitter2 (misleading) |

---

## 11. J. Ringkasan Temuan — Klasifikasi RED / YELLOW / GREEN

### RED — Blocker (2 items)

| # | Issue | File / Lokasi | Dampak |
| :--- | :--- | :--- | :--- |
| **R1** | `goods_receipt_items` table TIDAK ADA di DB | Database schema | createGoodsReceipt() crash ER_NO_SUCH_TABLE saat simpan items |
| **R2** | `/procurement/gr/create` page adalah stub | `frontend/src/app/(dashboard)/procurement/gr/create/page.tsx` | Dedicated GR page tidak fungsional |

### YELLOW — Gap Non-Blocking (7 items)

| # | Issue | File / Lokasi | Dampak |
| :--- | :--- | :--- | :--- |
| **Y1** | getAllGoodsReceipts: GR tanpa items (side-effect R1) | `procurement.service.ts:1105-1110` | GR list ada tapi items kosong |
| **Y2** | receipt_date type mismatch: DB `date` vs Entity `datetime` | `goods-receipt.entity.ts:19` | Potential TypeORM mapping error |
| **Y3** | remarks field di DTO tidak tersimpan (tidak ada di entity/DB) | `goods-receipt.entity.ts`, `create-gr.dto.ts` | Silent data loss |
| **Y4** | Finance Engine Progress path: evidenceRef string, bukan GR record | `finance.service.ts:593-598` | Progress billing bisa tanpa GR fisik |
| **Y5** | Dead stub `getGoodsReceiptsByPo` masih diekspor | `GoodsReceiptModal.tsx:87-89` | Dead code |
| **Y6** | `gr.created` event tidak ada consumer/listener | `procurement.service.ts:1073` | Post-GR actions tidak terjadi |
| **Y7** | canReceiveGoods tidak include PMO & HEAD_OF_OPERATIONS | `ProcurementPage.tsx:63` | Role gap backend vs frontend |

### GREEN — Production Ready (12 items)

G1: GoodsReceipt entity & DB table (schema sesuai, FK valid)
G2: createGoodsReceipt() business logic (atomik, validasi lengkap)
G3: getAllGoodsReceipts & getGoodsReceiptById (relasi PO->PR->Project)
G4: Backend RBAC controller (role terdefinisi tepat)
G5: create-gr.dto.ts (class-validator lengkap, Min 0.01)
G6: Frontend API contract (3 metode procurement.service.ts)
G7: GoodsReceiptModal item list dari backend (po.items dari API)
G8: Outstanding quantity calculation (computed dari DB, tidak hardcoded)
G9: Over-receipt & negative guard (backend + frontend double-layer)
G10: JWT actor createdBy (userId dari token tersimpan di GR record)
G11: Optimistic locking (@VersionColumn pada GoodsReceipt)
G12: DP Termin tidak perlu GR (Finance engine by design — DOWN_PAYMENT path benar)

---

## 12. K. Rekomendasi — Exact Files & Minimal Change

### FASE 1 — Blocker Fix (prerequisite untuk semua GR operations)

#### [R1] CRITICAL — Buat tabel goods_receipt_items

**File baru:** `backend/src/migrations/1788700000000-CreateGoodsReceiptItems.ts`

SQL yang diperlukan:

```sql
CREATE TABLE `goods_receipt_items` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `gr_id` bigint UNSIGNED NOT NULL,
  `po_item_id` bigint UNSIGNED NOT NULL,
  `received_quantity` decimal(10,2) NOT NULL DEFAULT 0,
  `remarks` text,
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `updated_by` bigint UNSIGNED DEFAULT NULL,
  `deleted_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_gr_items_gr_id` (`gr_id`),
  KEY `IDX_gr_items_po_item_id` (`po_item_id`),
  CONSTRAINT `fk_gr_items_gr` FOREIGN KEY (`gr_id`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gr_items_poi` FOREIGN KEY (`po_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Opsional dalam migration yang sama (Y2 + Y3):

```sql
-- Fix receipt_date type
ALTER TABLE `goods_receipts` MODIFY COLUMN `receipt_date` datetime NOT NULL;
-- Tambah remarks column
ALTER TABLE `goods_receipts` ADD COLUMN `remarks` TEXT NULL AFTER `total_received_amount`;
```

**Entity change (Y2+Y3) — `goods-receipt.entity.ts`:**

```typescript
// Y2: Ganti type: 'datetime' (sudah di entity, tapi DB masih 'date')
@Column({ name: 'receipt_date', type: 'datetime' })
receiptDate: Date;

// Y3: Tambahkan remarks
@Column({ type: 'text', nullable: true })
remarks: string;
```

> Tidak perlu mengubah service atau controller — hanya migration + 1 field di entity.

---

### FASE 2 — Cleanup (setelah Fase 1 verified)

#### [Y5] Hapus dead stub

**File:** `frontend/src/components/procurement/GoodsReceiptModal.tsx:87-89`

```typescript
// HAPUS:
export const getGoodsReceiptsByPo = (_poIdOrNumber: string | number): GoodsReceiptRecord[] => {
  return [];
};
```

> Verifikasi dulu: tidak ada import `getGoodsReceiptsByPo` di file lain.

#### [Y7] Align canReceiveGoods dengan backend RBAC

**File:** `frontend/src/components/ProcurementPage.tsx:63`

```typescript
// SEBELUM:
const canReceiveGoods = isProcurement || isSuperAdmin || isProjectManager;
// SESUDAH (align dengan backend):
const canReceiveGoods = isProcurement || isSuperAdmin || isProjectManager || isPmo || isHeadOfOps;
```

---

### FASE 3 — Enhancement (setelah GR operational)

- **[Y4]** Upgrade Finance Engine: link termType PROGRESS ke GR existence check (saat ini evidenceRef string cukup)
- **[Y6]** Tambahkan `@OnEvent('gr.created')` listener untuk notifikasi, analytics update, audit log
- **[R2]** Dedicated `/procurement/gr/create` page — implement atau redirect ke GoodsReceiptModal flow

---

## 13. L. Verifikasi Invarian Database (Zero Mutation)

Seluruh audit dilakukan dalam mode read-only:

| Entitas | Baseline | Pasca Audit |
| :--- | :---: | :---: |
| `purchase_requests` | 1 | 1 |
| `purchase_orders` | 1 | 1 |
| `purchase_order_items` | 2 | 2 |
| `po_payment_terms` | 4 | 4 |
| `invoices` | 1 | 1 |
| `invoice_items` | 2 | 2 |
| `payments` | 2 | 2 |
| `goods_receipts` | 0 | 0 |

**ZERO MUTATION — Database baseline 100% intact.**

---

## 14. Kesimpulan

Arsitektur GR pada EPMS TVM-UBD sudah **sangat matang secara konseptual**: backend service, controller, DTO, entity, dan frontend modal semua menunjukkan implementasi yang benar dengan validasi berlapis.

**Satu-satunya blocker hard** adalah: **tabel `goods_receipt_items` tidak pernah dimigrasikan ke production database.** Satu migration file yang menciptakan tabel ini (beserta opsional: `remarks` column + receipt_date type fix) akan langsung **mengaktifkan sepenuhnya alur GR creation** tanpa perubahan apapun pada business logic backend atau frontend.

Setelah Fase 1 selesai, sistem siap untuk pengujian live GR creation sebagai prerequisite Progress Billing (Termin 2 & 3, PO-20260907-001).

---
*Dokumen ini adalah output audit read-only. Tidak ada code, database, atau migration yang diubah selama proses audit ini.*

