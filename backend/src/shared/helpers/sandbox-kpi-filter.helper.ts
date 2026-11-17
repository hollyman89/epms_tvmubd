/**
 * Phase B — Data Governance: Sandbox KPI Isolation Filter
 *
 * Explicitly segregates non-production test fixture records from production BI KPI aggregations
 * without altering historical records in the database.
 *
 * CRITICAL SAFETY INVARIANTS:
 * 1. Tender #170 ('JASA PENGURUSAN PERIZINAN SLF CIREBON', Rp2,127,000,000) is NOT a sandbox tender
 *    and MUST remain eligible for production reporting.
 * 2. Invoice #23 is a Sandbox invoice (linked to PO #23 / Project #124 'PROJECT PERCOBAAN PAJAK' / Tender #172)
 *    despite carrying company_code = 'UBD'. It must be excluded.
 * 3. Invoice #24 is a Production invoice (linked to PO #24 / Project #57 / Tender #110)
 *    and MUST NOT be excluded.
 */

export const SANDBOX_TENDER_IDS: readonly number[] = Object.freeze([166, 133, 163, 164, 165, 171, 172]);
export const SANDBOX_CONTRACT_IDS: readonly number[] = Object.freeze([3, 4, 5, 8, 14, 32, 33]);
export const SANDBOX_PROJECT_IDS: readonly number[] = Object.freeze([3, 4, 5, 6, 53, 88, 124, 96]);
export const SANDBOX_PR_IDS: readonly number[] = Object.freeze([4, 5, 6, 7, 8, 9, 10, 16, 17, 19, 20, 21, 22, 23]);
export const SANDBOX_PO_IDS: readonly number[] = Object.freeze([4, 5, 6, 7, 8, 9, 13, 14, 18, 19, 20, 21, 22, 23]);
export const SANDBOX_INVOICE_IDS: readonly number[] = Object.freeze([4, 5, 6, 7, 8, 9, 13, 14, 17, 18, 20, 23]);
export const SANDBOX_PAYMENT_IDS: readonly number[] = Object.freeze([2, 5, 6, 7, 8, 9, 12, 13, 16, 19]);
export const SANDBOX_GR_IDS: readonly number[] = Object.freeze([3, 4, 5, 8, 10, 11, 12]);

/**
 * Returns SQL condition string to exclude sandbox records.
 * If alias is provided, formats as `AND {alias}.id NOT IN (...)`.
 * If alias is omitted or empty, formats as `AND id NOT IN (...)`.
 */
export function getSandboxTenderFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_TENDER_IDS.join(', ')})`;
}

export function getSandboxContractFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_CONTRACT_IDS.join(', ')})`;
}

export function getSandboxProjectFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_PROJECT_IDS.join(', ')})`;
}

export function getSandboxPrFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_PR_IDS.join(', ')})`;
}

export function getSandboxPoFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_PO_IDS.join(', ')})`;
}

export function getSandboxInvoiceFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_INVOICE_IDS.join(', ')})`;
}

export function getSandboxPaymentFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_PAYMENT_IDS.join(', ')})`;
}

export function getSandboxGrFilter(alias?: string): string {
  const col = alias ? `${alias}.id` : 'id';
  return `AND ${col} NOT IN (${SANDBOX_GR_IDS.join(', ')})`;
}

export function getSandboxProjectRiskFilter(alias: string = 'prisk'): string {
  return `AND ${alias}.project_id NOT IN (${SANDBOX_PROJECT_IDS.join(', ')})`;
}

export function getSandboxProjectIssueFilter(alias: string = 'piss'): string {
  return `AND ${alias}.project_id NOT IN (${SANDBOX_PROJECT_IDS.join(', ')})`;
}

export function getSandboxPaymentRequestFilter(alias?: string): string {
  const col = alias ? `${alias}.invoice_id` : 'invoice_id';
  return `AND ${col} NOT IN (${SANDBOX_INVOICE_IDS.join(', ')})`;
}

export function isSandboxTender(id: number): boolean {
  return SANDBOX_TENDER_IDS.includes(id);
}

export function isSandboxContract(id: number): boolean {
  return SANDBOX_CONTRACT_IDS.includes(id);
}

export function isSandboxProject(id: number): boolean {
  return SANDBOX_PROJECT_IDS.includes(id);
}

export function isSandboxPr(id: number): boolean {
  return SANDBOX_PR_IDS.includes(id);
}

export function isSandboxPo(id: number): boolean {
  return SANDBOX_PO_IDS.includes(id);
}

export function isSandboxInvoice(id: number): boolean {
  return SANDBOX_INVOICE_IDS.includes(id);
}

export function isSandboxPayment(id: number): boolean {
  return SANDBOX_PAYMENT_IDS.includes(id);
}

export function isSandboxGr(id: number): boolean {
  return SANDBOX_GR_IDS.includes(id);
}
