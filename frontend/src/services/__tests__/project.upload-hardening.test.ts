import { ProjectService, MAX_DOCUMENT_FILE_SIZE_BYTES, UPLOAD_DOCUMENT_TIMEOUT_MS } from '../project.service';
import { apiClient } from '@/lib/axios';

jest.mock('@/lib/axios', () => {
  const mockInstance = {
    defaults: {
      timeout: 15000,
    },
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    apiClient: mockInstance,
  };
});

describe('EPMS — Project Document Upload Reliability Hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Technical Constants & Boundary Definitions', () => {
    test('MAX_DOCUMENT_FILE_SIZE_BYTES is strictly 20 MB (20 * 1024 * 1024 bytes)', () => {
      expect(MAX_DOCUMENT_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
      expect(ProjectService.MAX_FILE_SIZE).toBe(20 * 1024 * 1024);
    });

    test('UPLOAD_DOCUMENT_TIMEOUT_MS is configured to 60,000 ms (60 seconds operational timeout)', () => {
      expect(UPLOAD_DOCUMENT_TIMEOUT_MS).toBe(60000);
      expect(ProjectService.UPLOAD_TIMEOUT_MS).toBe(60000);
    });

    test('Global Axios default timeout remains strictly 15,000 ms (unchanged)', () => {
      expect(apiClient.defaults.timeout).toBe(15000);
    });
  });

  describe('2. Client-Side Pre-Flight Size Gating (CASE 1 & CASE 6)', () => {
    test('CASE 1: file > 20MB blocks before API call and throws user-friendly error without network invocation', async () => {
      const oversizeFile = new File(['x'], 'large-drawing.dwg', { type: 'application/octet-stream' });
      Object.defineProperty(oversizeFile, 'size', {
        value: 20 * 1024 * 1024 + 1, // 20 MB + 1 byte
      });

      await expect(ProjectService.uploadEvidence(10, oversizeFile, 'CUSTOMER_BAST')).rejects.toThrow(
        'Ukuran file maksimal 20 MB.'
      );

      // Verify zero network request was made
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    test('CASE 6: Oversize error does not leak Multer internals (MulterError or LIMIT_FILE_SIZE)', async () => {
      const oversizeFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversizeFile, 'size', {
        value: 25 * 1024 * 1024,
      });

      let caughtError: any = null;
      try {
        await ProjectService.uploadEvidence(10, oversizeFile);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect(caughtError.message).toBe('Ukuran file maksimal 20 MB.');
      expect(caughtError.message).not.toContain('LIMIT_FILE_SIZE');
      expect(caughtError.message).not.toContain('MulterError');
      expect(caughtError.message).not.toContain('ECONNRESET');
    });

    test('Null/undefined file throws descriptive error without making network call', async () => {
      await expect(ProjectService.uploadEvidence(10, null as any)).rejects.toThrow(
        'Berkas tidak ditemukan. Silakan pilih berkas dokumen.'
      );
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('3. Valid File Transmission & Operational Timeout (CASE 3 & CASE 5)', () => {
    test('CASE 3 & 5: Valid file (<= 20MB) proceeds with upload-specific 60s timeout and multipart headers', async () => {
      const validFile = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' });
      Object.defineProperty(validFile, 'size', {
        value: 5 * 1024 * 1024, // 5 MB
      });

      const mockResponse = {
        data: {
          data: {
            id: 999,
            fileName: 'report.pdf',
            filePath: 'uploads/project/report.pdf',
            category: 'FINAL_REPORT',
          },
        },
      };

      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await ProjectService.uploadEvidence(42, validFile, 'FINAL_REPORT');

      expect(result).toBeDefined();
      expect(result.id).toBe(999);
      expect(result.fileName).toBe('report.pdf');

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      const [url, formData, config] = (apiClient.post as jest.Mock).mock.calls[0];

      expect(url).toBe('/documents/upload');
      expect(formData).toBeInstanceOf(FormData);
      expect(config).toEqual({
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
    });

    test('CASE 5: Exactly 20 MB file (boundary value) is accepted by client-side pre-flight check', async () => {
      const boundaryFile = new File(['exact'], 'exact-20mb.pdf', { type: 'application/pdf' });
      Object.defineProperty(boundaryFile, 'size', {
        value: 20 * 1024 * 1024, // Exactly 20 MB
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { data: { id: 1000, fileName: 'exact-20mb.pdf' } },
      });

      const result = await ProjectService.uploadEvidence(10, boundaryFile);
      expect(result.id).toBe(1000);
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Progress Evidence 10MB Custom Limit Enforcement', () => {
    test('enforces 10MB limit when called with PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES', async () => {
      const tenMbLimit = 10 * 1024 * 1024;
      const file11Mb = new File(['progress-evidence'], 'site-photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file11Mb, 'size', {
        value: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
      });

      await expect(
        ProjectService.uploadEvidence(10, file11Mb, undefined, tenMbLimit)
      ).rejects.toThrow('Ukuran file maksimal 10 MB.');

      expect(apiClient.post).not.toHaveBeenCalled();
    });

    test('accepts valid evidence <= 10MB and routes to /documents/upload with 60s timeout', async () => {
      const tenMbLimit = 10 * 1024 * 1024;
      const validEvidence = new File(['progress-evidence'], 'site-photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(validEvidence, 'size', {
        value: 5 * 1024 * 1024, // 5MB
      });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: { data: { id: 777, fileName: 'site-photo.jpg' } },
      });

      const result = await ProjectService.uploadEvidence(10, validEvidence, undefined, tenMbLimit);
      expect(result.id).toBe(777);
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      const [url, , config] = (apiClient.post as jest.Mock).mock.calls[0];
      expect(url).toBe('/documents/upload');
      expect(config.timeout).toBe(60000);
      expect(config.headers['Content-Type']).toBe('multipart/form-data');
    });
  });
});
