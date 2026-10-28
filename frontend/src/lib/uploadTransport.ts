import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { apiClient } from './axios';

/**
 * Operational default timeout for file/multipart uploads (60,000 ms / 60 seconds).
 * Decouples multipart transfers (up to 20MB) from the global 15-second REST timeout.
 * NOTE: This is an operational timeout safeguard, not proof of historical incident threshold.
 */
export const UPLOAD_REQUEST_TIMEOUT_MS = 60000;

/**
 * Standard technical limit for documents and tender files (20 MB).
 */
export const DEFAULT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Stricter business limit for Progress Evidence uploads (10 MB).
 */
export const PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ExecuteUploadParams {
  url: string;
  formData: FormData;
  file?: File | null;
  maxSizeBytes?: number;
  timeoutMs?: number;
  onProgress?: (progressEvent: any) => void;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export class UploadTransportError extends Error {
  code?: string;
  status?: number;
  isTimeout?: boolean;
  isCanceled?: boolean;
  isClientValidation?: boolean;
  isNetworkError?: boolean;
  response?: any;

  constructor(
    message: string,
    options?: {
      code?: string;
      status?: number;
      isTimeout?: boolean;
      isCanceled?: boolean;
      isClientValidation?: boolean;
      isNetworkError?: boolean;
      response?: any;
      cause?: any;
    },
  ) {
    super(message);
    this.name = 'UploadTransportError';
    if (options) {
      this.code = options.code;
      this.status = options.status;
      this.isTimeout = options.isTimeout;
      this.isCanceled = options.isCanceled;
      this.isClientValidation = options.isClientValidation;
      this.isNetworkError = options.isNetworkError;
      this.response = options.response;
      if (options.cause) this.cause = options.cause;
    }
  }
}

/**
 * Centralized, lightweight upload transport helper for all EPMS multipart file uploads.
 * Handles:
 * 1. Pre-flight file size validation before network transmission.
 * 2. Upload-specific operational timeout (default 60s), keeping global REST timeout (15s) intact.
 * 3. Multipart headers.
 * 4. Optional onUploadProgress and AbortSignal support.
 * 5. Normalized, user-friendly error wrapping without leaking Multer/Axios stack traces.
 */
export async function executeUpload<T = any>(
  params: ExecuteUploadParams,
): Promise<AxiosResponse<T>> {
  const {
    url,
    formData,
    file,
    maxSizeBytes,
    timeoutMs,
    onProgress,
    signal,
    headers,
  } = params;

  // 1. Client-Side Pre-Flight Size Validation
  const targetFile: File | null =
    file ?? (typeof formData?.get === 'function' ? (formData.get('file') as File) : null);

  if (targetFile && maxSizeBytes !== undefined && maxSizeBytes !== null) {
    if (targetFile.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      throw new UploadTransportError(`Ukuran file maksimal ${maxMb} MB.`, {
        code: 'FILE_TOO_LARGE',
        isClientValidation: true,
      });
    }
  }

  // 2. Build Axios Request Config with Upload-Specific Timeout
  const effectiveTimeout = timeoutMs ?? UPLOAD_REQUEST_TIMEOUT_MS;
  const config: AxiosRequestConfig = {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(headers || {}),
    },
    timeout: effectiveTimeout,
  };

  if (onProgress) {
    config.onUploadProgress = onProgress;
  }

  if (signal) {
    config.signal = signal;
  }

  // 3. Dispatch Upload via apiClient
  try {
    return await apiClient.post<T>(url, formData, config);
  } catch (err: any) {
    // 4. Transport Error Normalization

    // A. Axios Timeout (ECONNABORTED or message contains timeout)
    if (
      err?.code === 'ECONNABORTED' ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('timeout'))
    ) {
      const timeoutSec = Math.round(effectiveTimeout / 1000);
      throw new UploadTransportError(
        `Waktu pengunggahan berkas habis (${timeoutSec} detik). Silakan periksa koneksi internet Anda dan coba kembali.`,
        {
          code: 'ECONNABORTED',
          isTimeout: true,
          response: err?.response,
          cause: err,
        },
      );
    }

    // B. Abort / Cancel
    if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || (signal && signal.aborted)) {
      throw new UploadTransportError('Pengunggahan berkas dibatalkan.', {
        code: 'ERR_CANCELED',
        isCanceled: true,
        response: err?.response,
        cause: err,
      });
    }

    // C. Network Failure / Connection Reset (No HTTP response from server)
    if (
      !err?.response &&
      (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error' || err?.code === 'ECONNRESET')
    ) {
      throw new UploadTransportError(
        'Koneksi ke server terputus saat mengunggah berkas. Silakan periksa koneksi jaringan Anda.',
        {
          code: err?.code || 'ERR_NETWORK',
          isNetworkError: true,
          cause: err,
        },
      );
    }

    // D. HTTP 413 Payload Too Large Normalization
    if (err?.response?.status === 413) {
      const serverMsg = err.response?.data?.message;
      const isRawMulter =
        !serverMsg ||
        serverMsg === 'File too large' ||
        (typeof serverMsg === 'string' &&
          (serverMsg.includes('LIMIT_FILE_SIZE') || serverMsg.includes('MulterError')));

      if (isRawMulter) {
        if (err.response.data && typeof err.response.data === 'object') {
          err.response.data.message = 'Ukuran berkas melebihi batas maksimal yang diizinkan server.';
        }
      }
    }

    // Rethrow normalized error preserving Axios response
    throw err;
  }
}
