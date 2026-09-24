import { apiClient } from './axios';

/**
 * Shared Secure File Delivery Helpers (P0-3C2B SSOT)
 * Bridges frontend consumption to backend secure delivery endpoints:
 * - /api/v1/documents/:id/stream & download
 * - /api/v1/contracts/:id/spk/stream & download
 */

export interface SecureBlobResult {
  blob: Blob;
  objectUrl: string;
  contentType: string;
}

/**
 * Triggers a native browser file download from a Blob and automatically revokes the URL.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Fetches an authenticated blob from any secure endpoint using apiClient.
 * The returned objectUrl MUST be revoked by the caller when unmounting or closing viewer.
 */
export async function fetchSecureBlob(
  endpoint: string,
  defaultMimeType: string = 'application/pdf'
): Promise<SecureBlobResult> {
  const response = await apiClient.get(endpoint, {
    responseType: 'blob',
  });
  const contentType = (response.headers['content-type'] as string) || defaultMimeType;
  const blob = new Blob([response.data], { type: contentType });
  const objectUrl = window.URL.createObjectURL(blob);
  return { blob, objectUrl, contentType };
}

/**
 * Streams a document by ID for inline preview in an iframe.
 */
export async function streamSecureDocument(documentId: number): Promise<SecureBlobResult> {
  return fetchSecureBlob(`/documents/${documentId}/stream`, 'application/pdf');
}

/**
 * Downloads a document by ID with authenticated blob handling.
 */
export async function downloadSecureDocument(documentId: number, fileName: string): Promise<void> {
  const response = await apiClient.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  });
  const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
  const blob = new Blob([response.data], { type: contentType });
  triggerBlobDownload(blob, fileName);
}

/**
 * Streams a Contract SPK document by contract ID for inline preview in an iframe.
 */
export async function streamSecureContractSpk(contractId: number): Promise<SecureBlobResult> {
  return fetchSecureBlob(`/contracts/${contractId}/spk/stream`, 'application/pdf');
}

/**
 * Downloads a Contract SPK document by contract ID with authenticated blob handling.
 */
export async function downloadSecureContractSpk(contractId: number, fileName: string): Promise<void> {
  const response = await apiClient.get(`/contracts/${contractId}/spk/download`, {
    responseType: 'blob',
  });
  const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
  const blob = new Blob([response.data], { type: contentType });
  triggerBlobDownload(blob, fileName);
}
