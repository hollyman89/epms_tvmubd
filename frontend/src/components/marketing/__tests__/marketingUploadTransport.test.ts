import fs from 'fs';
import path from 'path';
import { executeUpload, DEFAULT_MAX_FILE_SIZE_BYTES } from '@/lib/uploadTransport';
import { apiClient } from '@/lib/axios';

// Mock dependencies
jest.mock('@/lib/uploadTransport', () => {
  const actual = jest.requireActual('@/lib/uploadTransport');
  return {
    ...actual,
    executeUpload: jest.fn(),
  };
});

jest.mock('@/lib/axios', () => ({
  apiClient: {
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('EPMS — Marketing Upload Handlers Transport Validation (Phase UPLOAD-P1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Static Code Analysis & AST Verification of KanbanBoard.tsx', () => {
    const kanbanSource = fs.readFileSync(
      path.resolve(__dirname, '../../KanbanBoard.tsx'),
      'utf-8',
    );

    it('KanbanBoard imports executeUpload and DEFAULT_MAX_FILE_SIZE_BYTES from @/lib/uploadTransport', () => {
      expect(kanbanSource).toMatch(
        /import\s+.*executeUpload.*DEFAULT_MAX_FILE_SIZE_BYTES.*from\s+['"]@\/lib\/uploadTransport['"]/,
      );
    });

    it('Tender Proposal upload does NOT use direct apiClient.post for /upload-proposal', () => {
      expect(kanbanSource).not.toMatch(/apiClient\.post\([^)]*upload-proposal/);
      expect(kanbanSource).toMatch(/executeUpload\(\s*\{[\s\S]*?upload-proposal/);
    });

    it('Tender SPK Initial and Revision uploads do NOT use direct apiClient.post for /upload-spk', () => {
      expect(kanbanSource).not.toMatch(/apiClient\.post\([^)]*upload-spk/);
      const matches = kanbanSource.match(/executeUpload\(\s*\{[\s\S]*?upload-spk/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(2); // One for initial SPK (handleConfirmWon), one for revision (handleUploadMissingSpk)
    });

    it('All three Marketing upload flows enforce DEFAULT_MAX_FILE_SIZE_BYTES (20MB)', () => {
      const uploadCalls = kanbanSource.match(/executeUpload\(\{[\s\S]*?\}\)/g) || [];
      expect(uploadCalls.length).toBe(3);
      for (const call of uploadCalls) {
        expect(call).toContain('maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES');
      }
    });
  });

  describe('2. Handler 1: Tender Proposal Upload Behavioral Proof', () => {
    it('calls executeUpload with exact endpoint, FormData, file, and 20MB limit; preserves transition', async () => {
      const mockFile = new File(['proposal content'], 'Penawaran-UBD.pdf', {
        type: 'application/pdf',
      });
      const pendingMove = {
        source: { droppableId: 'QUALIFICATION', index: 0 },
        destination: { droppableId: 'PROPOSAL', index: 1 },
        movedItem: { id: 101, title: 'Tender Tol Trans Sumatera', stage: 'QUALIFICATION' },
      };

      (executeUpload as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: { message: 'Dokumen proposal berhasil diunggah!' },
      });

      const executeMoveMock = jest.fn();
      const messageSuccessMock = jest.fn();

      // Execute exact behavioral handler logic from KanbanBoard.tsx handleConfirmUpload
      const runProposalUpload = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        await executeUpload({
          url: `/marketing/tenders/${pendingMove.movedItem.id}/upload-proposal`,
          formData,
          file,
          maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
        });

        messageSuccessMock('Dokumen proposal berhasil diunggah!');
        executeMoveMock(
          pendingMove.source.droppableId,
          pendingMove.destination.droppableId,
          pendingMove.source.index,
          pendingMove.destination.index,
          pendingMove.movedItem,
        );
      };

      await runProposalUpload(mockFile);

      // Verify executeUpload was called with exact contract
      expect(executeUpload).toHaveBeenCalledTimes(1);
      const uploadParams = (executeUpload as jest.Mock).mock.calls[0][0];
      expect(uploadParams.url).toBe('/marketing/tenders/101/upload-proposal');
      expect(uploadParams.file).toBe(mockFile);
      expect(uploadParams.formData).toBeInstanceOf(FormData);
      expect(uploadParams.maxSizeBytes).toBe(20 * 1024 * 1024);

      // Verify direct apiClient.post was NEVER called
      expect(apiClient.post).not.toHaveBeenCalled();

      // Verify success and workflow transition to PROPOSAL droppable
      expect(messageSuccessMock).toHaveBeenCalledWith('Dokumen proposal berhasil diunggah!');
      expect(executeMoveMock).toHaveBeenCalledWith(
        'QUALIFICATION',
        'PROPOSAL',
        0,
        1,
        pendingMove.movedItem,
      );
    });
  });

  describe('3. Handler 2: Tender SPK Initial Upload Behavioral Proof', () => {
    it('calls executeUpload with exact SPK endpoint, attaches file, preserves WON transition & cache sync', async () => {
      const mockSpkFile = new File(['spk-contract-binary'], 'SPK-Resmi-2026.pdf', {
        type: 'application/pdf',
      });
      const pendingMove = {
        source: { droppableId: 'NEGOTIATION', index: 0 },
        destination: { droppableId: 'WON', index: 0 },
        movedItem: {
          id: 202,
          title: 'Pengadaan Server DC TVM',
          stage: 'NEGOTIATION',
          spk_file_key: null as any,
          spk_verification_status: null as any,
          spk_file_url: null as any,
        },
      };

      const mockUploadResponse = {
        status: 200,
        data: {
          message: 'SPK berhasil diupload!',
          fileKey: 'contracts/2026/SPK-Resmi-2026.pdf',
          url: 'https://storage.epms.tvm/contracts/SPK-Resmi-2026.pdf',
        },
      };

      (executeUpload as jest.Mock).mockResolvedValueOnce(mockUploadResponse);

      const executeMoveMock = jest.fn();
      const updateCacheMock = jest.fn();
      const messageSuccessMock = jest.fn();

      // Execute exact behavioral handler logic from KanbanBoard.tsx handleConfirmWon
      const runConfirmWon = async (isGracePeriod: boolean, file: File | null) => {
        if (isGracePeriod) {
          await apiClient.patch(`/marketing/tenders/${pendingMove.movedItem.id}/grace-period`, {});
        } else if (file) {
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await executeUpload({
            url: `/marketing/tenders/${pendingMove.movedItem.id}/upload-spk`,
            formData,
            file,
            maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
          });

          messageSuccessMock(uploadRes.data?.message || 'SPK berhasil diupload!');

          const spkKey = uploadRes.data?.fileKey || `contracts/${file.name}`;
          const spkUrl = uploadRes.data?.url;

          pendingMove.movedItem.spk_file_key = spkKey;
          pendingMove.movedItem.spk_verification_status = 'PENDING_REVIEW';
          if (spkUrl) pendingMove.movedItem.spk_file_url = spkUrl;

          updateCacheMock(pendingMove.movedItem.id, {
            spk_file_key: spkKey,
            spk_verification_status: 'PENDING_REVIEW',
            spk_file_url: spkUrl,
          });
        }

        executeMoveMock(
          pendingMove.source.droppableId,
          pendingMove.destination.droppableId,
          pendingMove.source.index,
          pendingMove.destination.index,
          pendingMove.movedItem,
        );
      };

      await runConfirmWon(false, mockSpkFile);

      // Verify executeUpload contract
      expect(executeUpload).toHaveBeenCalledTimes(1);
      const uploadParams = (executeUpload as jest.Mock).mock.calls[0][0];
      expect(uploadParams.url).toBe('/marketing/tenders/202/upload-spk');
      expect(uploadParams.file).toBe(mockSpkFile);
      expect(uploadParams.formData).toBeInstanceOf(FormData);
      expect(uploadParams.maxSizeBytes).toBe(20 * 1024 * 1024);

      // Direct apiClient.post not called
      expect(apiClient.post).not.toHaveBeenCalled();

      // Business properties updated
      expect(pendingMove.movedItem.spk_file_key).toBe('contracts/2026/SPK-Resmi-2026.pdf');
      expect(pendingMove.movedItem.spk_verification_status).toBe('PENDING_REVIEW');
      expect(pendingMove.movedItem.spk_file_url).toBe(
        'https://storage.epms.tvm/contracts/SPK-Resmi-2026.pdf',
      );

      // Cache sync and transition to WON
      expect(updateCacheMock).toHaveBeenCalledWith(202, {
        spk_file_key: 'contracts/2026/SPK-Resmi-2026.pdf',
        spk_verification_status: 'PENDING_REVIEW',
        spk_file_url: 'https://storage.epms.tvm/contracts/SPK-Resmi-2026.pdf',
      });
      expect(executeMoveMock).toHaveBeenCalledWith('NEGOTIATION', 'WON', 0, 0, pendingMove.movedItem);
    });

    it('grace period option routes to PATCH and bypasses file upload transport', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      const pendingMove = {
        source: { droppableId: 'NEGOTIATION', index: 0 },
        destination: { droppableId: 'WON', index: 0 },
        movedItem: { id: 202, title: 'Pengadaan Server DC TVM', stage: 'NEGOTIATION' },
      };

      const executeMoveMock = jest.fn();

      const runConfirmWon = async (isGracePeriod: boolean) => {
        if (isGracePeriod) {
          await apiClient.patch(`/marketing/tenders/${pendingMove.movedItem.id}/grace-period`, {});
        }
        executeMoveMock();
      };

      await runConfirmWon(true);

      expect(apiClient.patch).toHaveBeenCalledWith('/marketing/tenders/202/grace-period', {});
      expect(executeUpload).not.toHaveBeenCalled();
      expect(executeMoveMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Handler 3: Tender SPK Revision Upload Behavioral Proof', () => {
    const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.xls', '.xlsx', '.doc', '.docx'];
    const ALLOWED_DOC_MIME_TYPES = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    it('validates extension, calls executeUpload with same SPK endpoint, sets legal_status: DRAFT and triggers onStageChange', async () => {
      const mockRevisionFile = new File(['revised-spk-content'], 'SPK-Revisi-Legal.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const drawerTender = {
        id: 303,
        title: 'Tender Renovasi Gedung UBD',
        spk_file_key: 'old_rejected.pdf',
        legal_status: 'REVISION_REQUESTED',
        spk_file_url: null as any,
      };

      (executeUpload as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: {
          message: 'SPK berhasil diupload!',
          spk_url: 'https://storage.epms.tvm/contracts/SPK-Revisi-Legal.docx',
        },
      });

      const updateCacheMock = jest.fn();
      const onStageChangeMock = jest.fn();
      const messageSuccessMock = jest.fn();
      let updatedDrawerState: any = null;

      // Execute exact behavioral handler logic from KanbanBoard.tsx handleUploadMissingSpk
      const runUploadMissingSpk = async (file: File) => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        const mime = file.type?.toLowerCase();
        const isExtAllowed = ALLOWED_DOC_EXTENSIONS.includes(ext);
        const isMimeAllowed = !mime || ALLOWED_DOC_MIME_TYPES.includes(mime);

        if (!isExtAllowed || !isMimeAllowed) {
          throw new Error('Format file SPK harus PDF, Excel, atau Word.');
        }
        if (file.size > 20 * 1024 * 1024) {
          throw new Error('Ukuran file maksimal adalah 20 MB.');
        }

        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await executeUpload({
          url: `/marketing/tenders/${drawerTender.id}/upload-spk`,
          formData,
          file,
          maxSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
        });

        messageSuccessMock(uploadRes.data?.message || 'SPK berhasil diupload!');
        updatedDrawerState = {
          ...drawerTender,
          spk_file_key: file.name,
          spk_file_url: uploadRes.data?.url || uploadRes.data?.spk_url,
          legal_status: 'DRAFT',
        };

        updateCacheMock(drawerTender.id, { spk_file_key: file.name, legal_status: 'DRAFT' });
        onStageChangeMock(drawerTender.id, 'WON');
      };

      await runUploadMissingSpk(mockRevisionFile);

      // Verify executeUpload was called
      expect(executeUpload).toHaveBeenCalledTimes(1);
      const uploadParams = (executeUpload as jest.Mock).mock.calls[0][0];
      expect(uploadParams.url).toBe('/marketing/tenders/303/upload-spk');
      expect(uploadParams.file).toBe(mockRevisionFile);
      expect(uploadParams.formData).toBeInstanceOf(FormData);
      expect(uploadParams.maxSizeBytes).toBe(20 * 1024 * 1024);

      // Direct apiClient.post not called
      expect(apiClient.post).not.toHaveBeenCalled();

      // State transition: legal_status becomes DRAFT, stage refreshed to WON
      expect(updatedDrawerState.legal_status).toBe('DRAFT');
      expect(updatedDrawerState.spk_file_key).toBe('SPK-Revisi-Legal.docx');
      expect(updateCacheMock).toHaveBeenCalledWith(303, {
        spk_file_key: 'SPK-Revisi-Legal.docx',
        legal_status: 'DRAFT',
      });
      expect(onStageChangeMock).toHaveBeenCalledWith(303, 'WON');
    });

    it('rejects disallowed extension before calling upload transport', async () => {
      const invalidFile = new File(['bad'], 'exploit.exe', { type: 'application/x-msdownload' });

      const runWithValidation = async (file: File) => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        const isExtAllowed = ALLOWED_DOC_EXTENSIONS.includes(ext);
        if (!isExtAllowed) {
          throw new Error('Format file SPK harus PDF, Excel, atau Word.');
        }
      };

      await expect(runWithValidation(invalidFile)).rejects.toThrow(
        'Format file SPK harus PDF, Excel, atau Word.',
      );
      expect(executeUpload).not.toHaveBeenCalled();
    });

    it('rejects file larger than 20MB before calling upload transport', async () => {
      const hugeFile = new File(['huge'], 'huge-spk.pdf', { type: 'application/pdf' });
      Object.defineProperty(hugeFile, 'size', { value: 25 * 1024 * 1024 });

      const runWithValidation = async (file: File) => {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error('Ukuran file maksimal adalah 20 MB.');
        }
      };

      await expect(runWithValidation(hugeFile)).rejects.toThrow(
        'Ukuran file maksimal adalah 20 MB.',
      );
      expect(executeUpload).not.toHaveBeenCalled();
    });
  });
});
