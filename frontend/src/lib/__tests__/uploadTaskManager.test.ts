import { uploadTaskManager } from '../uploadTaskManager';
import { executeUpload, UPLOAD_REQUEST_TIMEOUT_MS, DEFAULT_MAX_FILE_SIZE_BYTES, PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES } from '../uploadTransport';
import { apiClient } from '../axios';

describe('Fast Non-Blocking Upload UX & Task Manager', () => {
  beforeEach(() => {
    uploadTaskManager.clearTasks();
    jest.clearAllMocks();
  });

  test('1. Valid submit releases modal immediately without waiting for upload promise', () => {
    let uploadResolved = false;
    let resolveUpload: (val: any) => void;
    const pendingUploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'ProjectDoc.pdf',
      flowLabel: 'Dokumen Proyek',
      uploadFn: async () => {
        return pendingUploadPromise;
      },
      onSuccess: () => {
        uploadResolved = true;
      },
    });

    // Verification: startUploadTask returned synchronously with taskId
    expect(taskId).toBeTruthy();
    // The upload promise has NOT resolved yet
    expect(uploadResolved).toBe(false);

    // Modal has already been released (synchronous return)
    const task = uploadTaskManager.getTask(taskId);
    expect(task).toBeDefined();
    expect(task?.status).toBe('UPLOADING');
    expect(task?.fileName).toBe('ProjectDoc.pdf');
  });

  test('2. Upload remains UPLOADING after modal closes', () => {
    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'SPK-Asianet.pdf',
      flowLabel: 'SPK Tender #162',
      uploadFn: async () => {
        return new Promise(() => {}); // never resolves
      },
    });

    const task = uploadTaskManager.getTask(taskId);
    expect(task?.status).toBe('UPLOADING');
    expect(task?.progress).toBe(0);
  });

  test('3. Real progress updates task percentage', async () => {
    let capturedOnProgress: (ev: any) => void = () => {};

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'LargeDrawing.pdf',
      flowLabel: 'Dokumen Proyek',
      uploadFn: async (onProgress) => {
        capturedOnProgress = onProgress;
        return new Promise(() => {});
      },
    });

    expect(uploadTaskManager.getTask(taskId)?.progress).toBe(0);

    // Simulate 35% progress
    capturedOnProgress({ loaded: 3500000, total: 10000000 });
    expect(uploadTaskManager.getTask(taskId)?.progress).toBe(35);

    // Simulate 80% progress
    capturedOnProgress({ loaded: 8000000, total: 10000000 });
    expect(uploadTaskManager.getTask(taskId)?.progress).toBe(80);

    // Simulate indeterminate progress (no total bytes)
    capturedOnProgress({ loaded: 9000000 });
    expect(uploadTaskManager.getTask(taskId)?.progress).toBeUndefined();
  });

  test('4. Duplicate concurrent retry is blocked', async () => {
    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'TenderSPK.pdf',
      flowLabel: 'SPK Tender #100',
      uploadFn: async () => new Promise(() => {}),
    });

    expect(uploadTaskManager.getTask(taskId)?.status).toBe('UPLOADING');

    // Attempting to retry while still UPLOADING should be ignored
    await uploadTaskManager.retryTask(taskId);
    expect(uploadTaskManager.getTask(taskId)?.status).toBe('UPLOADING');
  });

  test('5. Project Document success triggers refetch and marks SUCCESS', async () => {
    let refetchCalled = false;

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'BastCustomer.pdf',
      flowLabel: 'Dokumen Proyek',
      uploadFn: async () => {
        return { id: 88, fileName: 'BastCustomer.pdf' };
      },
      onSuccess: async () => {
        refetchCalled = true;
      },
    });

    // Wait for microtask queue to settle
    await new Promise((r) => setTimeout(r, 20));

    expect(uploadTaskManager.getTask(taskId)?.status).toBe('SUCCESS');
    expect(uploadTaskManager.getTask(taskId)?.progress).toBe(100);
    expect(refetchCalled).toBe(true);
  });

  test('6. Project Document failure creates no fake success', async () => {
    let refetchCalled = false;
    let errorHandled = false;

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'Broken.pdf',
      flowLabel: 'Dokumen Proyek',
      uploadFn: async () => {
        throw new Error('Network transfer timeout');
      },
      onSuccess: async () => {
        refetchCalled = true;
      },
      onError: async (err) => {
        errorHandled = true;
      },
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(uploadTaskManager.getTask(taskId)?.status).toBe('FAILED');
    expect(uploadTaskManager.getTask(taskId)?.error).toContain('Network transfer timeout');
    expect(refetchCalled).toBe(false);
    expect(errorHandled).toBe(true);
  });

  test('7. Progress Evidence business submit waits for evidence upload success', async () => {
    let progressClaimCreated = false;
    let resolveUpload: (val: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'ProgressEvidence.pdf',
      flowLabel: 'Bukti Progres',
      uploadFn: async () => uploadPromise,
      onSuccess: async (uploadedDoc: any) => {
        // Business action requires uploaded doc ID
        expect(uploadedDoc.id).toBe(99);
        progressClaimCreated = true;
      },
    });

    // While uploading, progress claim must NOT be created yet
    expect(progressClaimCreated).toBe(false);

    // Resolve upload with server response
    resolveUpload!({ id: 99, fileName: 'ProgressEvidence.pdf' });
    await new Promise((r) => setTimeout(r, 20));

    // Now progress claim was created
    expect(progressClaimCreated).toBe(true);
    expect(uploadTaskManager.getTask(taskId)?.status).toBe('SUCCESS');
  });

  test('8. Tender Proposal transition waits for upload success', async () => {
    let stageTransitioned = false;
    let resolveUpload: (val: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'Proposal.pdf',
      flowLabel: 'Proposal Tender #10',
      uploadFn: async () => uploadPromise,
      onSuccess: async () => {
        stageTransitioned = true;
      },
    });

    expect(stageTransitioned).toBe(false);

    // Simulate network completion
    resolveUpload!({ status: 200, data: { success: true } });
    await new Promise((r) => setTimeout(r, 20));

    expect(stageTransitioned).toBe(true);
  });

  test('9. Tender SPK Initial transition waits for upload success', async () => {
    let cardMovedToWon = false;
    let resolveUpload: (val: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'SPK-Final.pdf',
      flowLabel: 'SPK Tender #42',
      uploadFn: async () => uploadPromise,
      onSuccess: async () => {
        cardMovedToWon = true;
      },
    });

    expect(cardMovedToWon).toBe(false);

    resolveUpload!({ status: 201, data: { success: true, spk_file_key: 'contracts/spk-42.pdf' } });
    await new Promise((r) => setTimeout(r, 20));

    expect(cardMovedToWon).toBe(true);
  });

  test('10. Tender SPK Revision continuation waits for upload success', async () => {
    let revisionRefreshed = false;
    let resolveUpload: (val: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'SPK-Rev1.pdf',
      flowLabel: 'Revisi SPK #42',
      uploadFn: async () => uploadPromise,
      onSuccess: async () => {
        revisionRefreshed = true;
      },
    });

    expect(revisionRefreshed).toBe(false);

    resolveUpload!({ status: 201, data: { url: 'http://localhost:4000/spk.pdf' } });
    await new Promise((r) => setTimeout(r, 20));

    expect(revisionRefreshed).toBe(true);
  });

  test('11. Failed upload never mutates business state', async () => {
    let wonTransitioned = false;

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'SPK-Corrupt.pdf',
      flowLabel: 'SPK Tender #99',
      uploadFn: async () => {
        throw new Error('Connection reset by peer');
      },
      onSuccess: async () => {
        wonTransitioned = true;
      },
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(uploadTaskManager.getTask(taskId)?.status).toBe('FAILED');
    expect(wonTransitioned).toBe(false);
  });

  test('12. Retry re-runs upload and triggers transition exactly once', async () => {
    let uploadAttempts = 0;
    let businessTransitionCount = 0;

    const testFile = new File(['mock content'], 'RetryDoc.pdf', { type: 'application/pdf' });

    const taskId = uploadTaskManager.startUploadTask({
      fileName: 'RetryDoc.pdf',
      flowLabel: 'Dokumen Proyek',
      file: testFile,
      uploadFn: async () => {
        uploadAttempts++;
        if (uploadAttempts === 1) {
          throw new Error('First attempt failed');
        }
        return { id: 123, fileName: 'RetryDoc.pdf' };
      },
      onSuccess: async () => {
        businessTransitionCount++;
      },
    });

    await new Promise((r) => setTimeout(r, 20));

    // First attempt failed
    expect(uploadAttempts).toBe(1);
    expect(businessTransitionCount).toBe(0);
    expect(uploadTaskManager.getTask(taskId)?.status).toBe('FAILED');

    // Trigger retry
    await uploadTaskManager.retryTask(taskId);
    await new Promise((r) => setTimeout(r, 20));

    // Second attempt succeeded
    expect(uploadAttempts).toBe(2);
    expect(businessTransitionCount).toBe(1); // exactly once
    expect(uploadTaskManager.getTask(taskId)?.status).toBe('SUCCESS');
  });

  test('13. Existing endpoints and size constants remain unchanged', () => {
    expect(UPLOAD_REQUEST_TIMEOUT_MS).toBe(60000);
    expect(DEFAULT_MAX_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
    expect(PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });

  test('14. Global REST timeout remains strictly 15000ms', () => {
    expect(apiClient.defaults.timeout).toBe(15000);
  });
});
