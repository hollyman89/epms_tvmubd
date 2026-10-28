import { apiClient } from '../axios';
import {
  executeUpload,
  UPLOAD_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES,
  UploadTransportError,
} from '../uploadTransport';

describe('EPMS — Shared Upload Transport (Phase UPLOAD-P1)', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
      data: { success: true, message: 'Upload OK' },
    });
  });

  afterEach(() => {
    postSpy.mockRestore();
  });

  describe('A. Global apiClient Timeout', () => {
    it('normal apiClient global default timeout remains strictly 15000 ms', () => {
      expect(apiClient.defaults.timeout).toBe(15000);
    });
  });

  describe('B. Default Upload Timeout', () => {
    it('executeUpload uses UPLOAD_REQUEST_TIMEOUT_MS (60000 ms) by default', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      await executeUpload({
        url: '/documents/upload',
        formData,
        file,
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [url, body, config] = postSpy.mock.calls[0];
      expect(url).toBe('/documents/upload');
      expect(body).toBe(formData);
      expect(config.timeout).toBe(60000);
      expect(UPLOAD_REQUEST_TIMEOUT_MS).toBe(60000);
    });
  });

  describe('C. Timeout Override Support', () => {
    it('allows caller to override upload timeout', async () => {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      await executeUpload({
        url: '/documents/upload',
        formData,
        file,
        timeoutMs: 45000,
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, , config] = postSpy.mock.calls[0];
      expect(config.timeout).toBe(45000);
    });
  });

  describe('D. 20MB Size Limit Validation', () => {
    it('passes when file is within 20MB (DEFAULT_MAX_FILE_SIZE_BYTES)', async () => {
      const file = new File(['data'], 'drawing.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 }); // 15MB
      const formData = new FormData();
      formData.append('file', file);

      const res = await executeUpload({
        url: '/documents/upload',
        formData,
        file,
        maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
      });

      expect(res.data.success).toBe(true);
      expect(postSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects when file exceeds 20MB (20 * 1024 * 1024 + 1)', async () => {
      const oversizeFile = new File(['data'], 'oversize.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversizeFile, 'size', { value: 20 * 1024 * 1024 + 1 });
      const formData = new FormData();
      formData.append('file', oversizeFile);

      await expect(
        executeUpload({
          url: '/documents/upload',
          formData,
          file: oversizeFile,
          maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
        }),
      ).rejects.toThrow('Ukuran file maksimal 20 MB.');
    });
  });

  describe('E. 10MB Caller-Supplied Rule (Progress Evidence)', () => {
    it('allows caller to enforce 10MB limit (PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES)', async () => {
      const file = new File(['data'], 'evidence.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 }); // 10MB + 1 byte
      const formData = new FormData();
      formData.append('file', file);

      await expect(
        executeUpload({
          url: '/documents/upload',
          formData,
          file,
          maxSizeBytes: PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES,
        }),
      ).rejects.toThrow('Ukuran file maksimal 10 MB.');
    });

    it('accepts file under 10MB with PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES', async () => {
      const file = new File(['data'], 'evidence.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }); // 5MB
      const formData = new FormData();
      formData.append('file', file);

      const res = await executeUpload({
        url: '/documents/upload',
        formData,
        file,
        maxSizeBytes: PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES,
      });

      expect(res.data.success).toBe(true);
      expect(postSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('F. Pre-Flight Gating Prevents API Call', () => {
    it('does not invoke apiClient.post if file exceeds maximum size', async () => {
      const file = new File(['data'], 'huge.zip', { type: 'application/zip' });
      Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
      const formData = new FormData();
      formData.append('file', file);

      let caughtErr: any;
      try {
        await executeUpload({
          url: '/documents/upload',
          formData,
          file,
          maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
        });
      } catch (err) {
        caughtErr = err;
      }

      expect(caughtErr).toBeInstanceOf(UploadTransportError);
      expect(caughtErr.message).toBe('Ukuran file maksimal 20 MB.');
      expect(caughtErr.isClientValidation).toBe(true);
      expect(postSpy).not.toHaveBeenCalled();
    });
  });

  describe('G. FormData Integrity', () => {
    it('passes FormData unchanged to apiClient.post', async () => {
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'PROJECT');
      formData.append('entityId', '42');
      formData.append('category', 'FINAL_REPORT');

      await executeUpload({
        url: '/documents/upload',
        formData,
        file,
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, passedBody] = postSpy.mock.calls[0];
      expect(passedBody).toBe(formData);
    });
  });

  describe('H. AbortSignal Forwarding', () => {
    it('forwards AbortSignal to Axios request config and normalizes abort error', async () => {
      const controller = new AbortController();
      const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      // Verify signal is passed to config
      await executeUpload({
        url: '/documents/upload',
        formData,
        file,
        signal: controller.signal,
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, , config] = postSpy.mock.calls[0];
      expect(config.signal).toBe(controller.signal);

      // Verify abort error normalization
      const cancelError: any = new Error('canceled');
      cancelError.code = 'ERR_CANCELED';
      postSpy.mockRejectedValueOnce(cancelError);

      await expect(
        executeUpload({
          url: '/documents/upload',
          formData,
          file,
          signal: controller.signal,
        }),
      ).rejects.toThrow('Pengunggahan berkas dibatalkan.');
    });
  });

  describe('I. Progress Callback Forwarding', () => {
    it('forwards onProgress callback to onUploadProgress in config', async () => {
      const onProgress = jest.fn();
      const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', file);

      await executeUpload({
        url: '/documents/upload',
        formData,
        file,
        onProgress,
      });

      expect(postSpy).toHaveBeenCalledTimes(1);
      const [, , config] = postSpy.mock.calls[0];
      expect(config.onUploadProgress).toBe(onProgress);
    });
  });

  describe('J. Error Propagation and Normalization', () => {
    const file = new File(['data'], 'test.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    it('normalizes Axios timeout into friendly message without leaking internal details', async () => {
      const timeoutError: any = new Error('timeout of 60000ms exceeded');
      timeoutError.code = 'ECONNABORTED';
      postSpy.mockRejectedValueOnce(timeoutError);

      let caught: any;
      try {
        await executeUpload({
          url: '/documents/upload',
          formData,
          file,
          timeoutMs: 60000,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(UploadTransportError);
      expect(caught.isTimeout).toBe(true);
      expect(caught.message).toContain('Waktu pengunggahan berkas habis (60 detik)');
    });

    it('normalizes network disconnects without response', async () => {
      const networkError: any = new Error('Network Error');
      networkError.code = 'ERR_NETWORK';
      postSpy.mockRejectedValueOnce(networkError);

      let caught: any;
      try {
        await executeUpload({
          url: '/documents/upload',
          formData,
          file,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(UploadTransportError);
      expect(caught.isNetworkError).toBe(true);
      expect(caught.message).toContain('Koneksi ke server terputus');
    });

    it('normalizes raw Multer 413 message in response data', async () => {
      const multerError: any = new Error('Request failed with status code 413');
      multerError.response = {
        status: 413,
        data: {
          message: 'File too large',
        },
      };
      postSpy.mockRejectedValueOnce(multerError);

      let caught: any;
      try {
        await executeUpload({
          url: '/documents/upload',
          formData,
          file,
        });
      } catch (err) {
        caught = err;
      }

      expect(caught.response?.status).toBe(413);
      expect(caught.response?.data?.message).toBe(
        'Ukuran berkas melebihi batas maksimal yang diizinkan server.',
      );
    });
  });
});
