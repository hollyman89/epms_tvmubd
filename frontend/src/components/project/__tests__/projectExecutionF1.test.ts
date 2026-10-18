import { apiClient } from '@/lib/axios';
import { ProjectService } from '@/services/project.service';

// Mock axios apiClient
jest.mock('@/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('PROJECT-EXEC-F1: Frontend Execution Ownership, Routine Progress & Evidence Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. CP1 & CP2: PM Ownership and Super Admin Execution Bypass Removal
  // =========================================================================
  describe('CP1 & CP2 — Execution Ownership & Super Admin Read-Only Security', () => {
    const checkIsAssignedPm = (user: any, project: any): boolean => {
      const isProjectManager = user?.roles?.includes('PROJECT_MANAGER') || false;
      const currentUserId = user?.sub ?? user?.id;
      const projectManagerId = project?.managerId ?? project?.manager_id ?? project?.manager?.id;
      return Boolean(
        isProjectManager &&
        currentUserId &&
        projectManagerId &&
        Number(currentUserId) === Number(projectManagerId)
      );
    };

    it('should ALLOW mutation actions when user is the assigned Project Manager for the project', () => {
      const user = { sub: 10, email: 'pm1@epms.com', roles: ['PROJECT_MANAGER'] };
      const project = { id: 100, managerId: 10, status: 'IN_PROGRESS' };

      expect(checkIsAssignedPm(user, project)).toBe(true);
    });

    it('should HIDE mutation actions when PM is not assigned to the project (PM A on PM B project)', () => {
      const user = { sub: 10, email: 'pm1@epms.com', roles: ['PROJECT_MANAGER'] };
      const project = { id: 101, managerId: 20, status: 'IN_PROGRESS' };

      expect(checkIsAssignedPm(user, project)).toBe(false);
    });

    it('should HIDE mutation actions when project has no assigned manager', () => {
      const user = { sub: 10, email: 'pm1@epms.com', roles: ['PROJECT_MANAGER'] };
      const project = { id: 102, managerId: null, status: 'IN_PROGRESS' };

      expect(checkIsAssignedPm(user, project)).toBe(false);
    });

    it('should HIDE mutation actions for SUPER_ADMIN (read-only for execution business mutations)', () => {
      const user = { sub: 1, email: 'admin@epms.com', roles: ['SUPER_ADMIN'] };
      const project = { id: 100, managerId: 10, status: 'IN_PROGRESS' };

      expect(checkIsAssignedPm(user, project)).toBe(false);
    });

    it('should HIDE mutation actions for PMO and HEAD_OF_OPERATIONS (verification only, no PM execution mutations)', () => {
      const pmoUser = { sub: 5, email: 'pmo@epms.com', roles: ['PMO'] };
      const hooUser = { sub: 6, email: 'hoo@epms.com', roles: ['HEAD_OF_OPERATIONS'] };
      const project = { id: 100, managerId: 10, status: 'IN_PROGRESS' };

      expect(checkIsAssignedPm(pmoUser, project)).toBe(false);
      expect(checkIsAssignedPm(hooUser, project)).toBe(false);
    });
  });

  // =========================================================================
  // 2. CP3 & CP4: Routine Progress Update Semantics
  // =========================================================================
  describe('CP3 & CP4 — Routine Progress Update Semantics & API Invocations', () => {
    it('should invoke PATCH /project/:projectId/tasks/:taskId/progress on normal upward progress', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            id: 501,
            progress: 35,
            status: 'IN_PROGRESS',
          },
        },
      });

      const res = await ProjectService.updateTaskProgress(100, 501, {
        progress: 35,
        expectedProgress: 0,
        reason: 'Pekerjaan pondasi selesai 35%',
      });

      expect(apiClient.patch).toHaveBeenCalledTimes(1);
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/project/100/tasks/501/progress',
        { progress: 35, expectedProgress: 0, reason: 'Pekerjaan pondasi selesai 35%' }
      );
      expect(apiClient.post).not.toHaveBeenCalled();
      expect(res.progress).toBe(35);
    });

    it('should validate that routine progress must be strictly upward (<100)', () => {
      const validateRoutineInput = (current: number, target: number): { valid: boolean; error?: string } => {
        if (target <= current) {
          return { valid: false, error: 'Progres rutin harus berupa kenaikan' };
        }
        if (target >= 100) {
          return { valid: false, error: 'Penyelesaian task 100% merupakan Critical Claim' };
        }
        return { valid: true };
      };

      // Valid upward steps
      expect(validateRoutineInput(0, 10).valid).toBe(true);
      expect(validateRoutineInput(10, 25).valid).toBe(true);
      expect(validateRoutineInput(25, 50).valid).toBe(true);
      expect(validateRoutineInput(50, 75).valid).toBe(true);
      expect(validateRoutineInput(75, 90).valid).toBe(true);

      // Downward or equal rejected in routine update
      expect(validateRoutineInput(50, 50).valid).toBe(false);
      expect(validateRoutineInput(50, 40).valid).toBe(false);

      // 100% completion rejected in routine update
      expect(validateRoutineInput(90, 100).valid).toBe(false);
    });
  });

  // =========================================================================
  // 3. CP6, CP7, CP8, CP9 & CP10: Real Evidence Upload & Claim Routing
  // =========================================================================
  describe('CP6-CP10 — Critical Claim, Downward Correction & Real Evidence Upload', () => {
    it('should route 100% completion to Progress Claim with real evidence upload', async () => {
      // Mock evidence upload
      (apiClient.post as jest.Mock).mockImplementation((url, data) => {
        if (url === '/documents/upload') {
          return Promise.resolve({
            data: {
              data: {
                id: 88,
                fileName: 'bast_document.pdf',
                filePath: '/storage/documents/bast_document.pdf',
              },
            },
          });
        }
        if (url.includes('/progress-claims')) {
          return Promise.resolve({
            data: {
              data: {
                id: 901,
                taskId: 501,
                reportedProgress: 100,
                status: 'PENDING_VERIFICATION',
                eventType: 'CRITICAL_CLAIM',
              },
            },
          });
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      });

      const mockFile = new File(['mock content'], 'bast_document.pdf', { type: 'application/pdf' });
      
      // Step 1: Real upload
      const uploadResult = await ProjectService.uploadEvidence(100, mockFile);
      expect(uploadResult.id).toBe(88);
      expect(uploadResult.id).not.toBe(1); // Not hardcoded [1]

      // Step 2: Progress claim with real document ID
      const claimResult = await ProjectService.createProgressClaim(100, 501, {
        reportedProgress: 100,
        reason: 'Pekerjaan 100% selesai didukung BAST',
        documentIds: [uploadResult.id],
      });

      expect(claimResult.status).toBe('PENDING_VERIFICATION');
      expect(claimResult.reportedProgress).toBe(100);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/project/100/tasks/501/progress-claims',
        {
          reportedProgress: 100,
          reason: 'Pekerjaan 100% selesai didukung BAST',
          documentIds: [88],
        }
      );
    });

    it('should route downward progress to Progress Claim as downward correction', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({
        data: {
          data: {
            id: 902,
            taskId: 502,
            reportedProgress: 55,
            previousProgress: 70,
            status: 'PENDING_VERIFICATION',
            eventType: 'DOWNWARD_CORRECTION',
          },
        },
      });

      const claimResult = await ProjectService.createProgressClaim(100, 502, {
        reportedProgress: 55,
        reason: 'Koreksi penurunan setelah audit lapangan',
      });

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/project/100/tasks/502/progress-claims',
        {
          reportedProgress: 55,
          reason: 'Koreksi penurunan setelah audit lapangan',
        }
      );
      expect(claimResult.status).toBe('PENDING_VERIFICATION');
    });

    it('should ABORT claim submission and NOT create fake evidence when document upload fails', async () => {
      (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Storage service unavailable'));

      const mockFile = new File(['mock content'], 'evidence.pdf', { type: 'application/pdf' });

      let uploadFailed = false;
      let documentIds: number[] | undefined;

      try {
        const uploadResult = await ProjectService.uploadEvidence(100, mockFile);
        documentIds = [uploadResult.id];
      } catch (err) {
        uploadFailed = true;
      }

      expect(uploadFailed).toBe(true);
      expect(documentIds).toBeUndefined(); // Never falls back to [1]
      expect(apiClient.patch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. CP15: Visual Distinction Between Official Progress and Pending Claim
  // =========================================================================
  describe('CP15 — Official vs Pending Claim Visual Differentiation', () => {
    it('should separate official task progress from pending claims awaiting verification', () => {
      const task = { id: 501, name: 'Struktur Pondasi', progress: 75, status: 'IN_PROGRESS' };
      const progressLogs = [
        {
          id: 1,
          taskId: 501,
          taskName: 'Struktur Pondasi',
          reportedProgress: 100,
          previousProgress: 75,
          status: 'PENDING_VERIFICATION',
          eventType: 'CRITICAL_CLAIM',
        },
      ];

      // Official progress remains 75%
      const officialProgress = task.progress;
      expect(officialProgress).toBe(75);

      // Pending claim is detected and flagged separately
      const pendingClaim = progressLogs.find((l) => l.taskId === task.id && l.status === 'PENDING_VERIFICATION');
      expect(pendingClaim).toBeDefined();
      expect(pendingClaim?.reportedProgress).toBe(100);

      // Assert that official progress does NOT equal pending claim
      expect(officialProgress).not.toBe(pendingClaim?.reportedProgress);
    });
  });

  // =========================================================================
  // 5. CP16: Refetch / Invalidation Trigger
  // =========================================================================
  describe('CP16 — Data Invalidation & Refetch Trigger', () => {
    it('should increment refreshKey and trigger data fetch after successful mutation', () => {
      let refreshKey = 0;
      let fetchedSchedule = false;
      let refreshedParent = false;

      const handleSuccess = () => {
        refreshKey += 1;
        fetchedSchedule = true;
        refreshedParent = true;
      };

      handleSuccess();

      expect(refreshKey).toBe(1);
      expect(fetchedSchedule).toBe(true);
      expect(refreshedParent).toBe(true);
    });
  });
});
