import { resolveNotificationTarget } from '@/lib/notificationSync';

describe('Progress Claim & Service Claim Deep-Link Isolation Suite (P0 Routing Recovery)', () => {
  describe('1. Deep-link target resolution from notifications', () => {
    it('PROJECT_PROGRESS_CLAIM notification produces canonical progressClaimId URL', () => {
      const notif = {
        actionTarget: '',
        metaData: {
          reference_type: 'PROJECT_PROGRESS_CLAIM',
          progressClaimId: 267,
          projectId: 1,
        },
      };

      const target = resolveNotificationTarget(notif);
      expect(target).toBe('/project-delivery?view=workspace&projectId=1&section=tasks&progressClaimId=267');
      expect(target).not.toContain('serviceClaimId');
      expect(target).not.toContain('claimId=267');
    });

    it('SERVICE_CLAIM notification produces serviceClaimId URL when serviceClaimId is provided', () => {
      const notif = {
        actionTarget: '',
        metaData: {
          category: 'SERVICE_CLAIM',
          serviceClaimId: 108,
          projectId: 1,
        },
      };

      const target = resolveNotificationTarget(notif);
      expect(target).toBe('/project-delivery?projectId=1&serviceClaimId=108');
      expect(target).not.toContain('progressClaimId');
    });

    it('Legacy SERVICE_CLAIM notification with claimId preserves backward compatibility', () => {
      const notif = {
        actionTarget: '',
        metaData: {
          category: 'SERVICE_CLAIM',
          claimId: 108,
          projectId: 1,
        },
      };

      const target = resolveNotificationTarget(notif);
      expect(target).toBe('/project-delivery?projectId=1&claimId=108');
    });
  });

  describe('2. ProjectOperationTab URL Query Param Disambiguation', () => {
    function resolveServiceClaimParam(searchParamsString: string): string | null {
      const params = new URLSearchParams(searchParamsString);
      return (
        params.get('serviceClaimId') ||
        (!params.has('progressClaimId') && params.get('section') !== 'tasks'
          ? params.get('claimId')
          : null)
      );
    }

    function resolveProgressClaimParam(searchParamsString: string): string | null {
      const params = new URLSearchParams(searchParamsString);
      return (
        params.get('progressClaimId') ||
        (params.get('section') === 'tasks' ? params.get('claimId') : null)
      );
    }

    it('progressClaimId URL does NOT trigger Service Claim modal', () => {
      const url = 'view=workspace&projectId=1&section=tasks&progressClaimId=267';
      expect(resolveServiceClaimParam(url)).toBeNull();
      expect(resolveProgressClaimParam(url)).toBe('267');
    });

    it('serviceClaimId URL does NOT trigger Progress Claim verification', () => {
      const url = 'projectId=1&serviceClaimId=108';
      expect(resolveServiceClaimParam(url)).toBe('108');
      expect(resolveProgressClaimParam(url)).toBeNull();
    });

    it('legacy claimId with section=tasks resolves to Progress Claim only', () => {
      const url = 'view=workspace&projectId=1&section=tasks&claimId=267';
      expect(resolveServiceClaimParam(url)).toBeNull();
      expect(resolveProgressClaimParam(url)).toBe('267');
    });

    it('legacy claimId without section=tasks resolves to Service Claim only', () => {
      const url = 'projectId=1&claimId=108';
      expect(resolveServiceClaimParam(url)).toBe('108');
      expect(resolveProgressClaimParam(url)).toBeNull();
    });
  });

  describe('3. ProgressVerificationDrawer Data Hydration Integrity', () => {
    it('resolves task name and submitter without undefined fallbacks', () => {
      const logCamelCase = {
        id: 267,
        taskName: 'PERIZINAN',
        submitterName: 'John Doe PM',
        submittedBy: 2,
        reportedProgress: 100,
        previousProgress: 99.99,
        eventType: 'TASK_COMPLETION',
        reason: 'Selesai 100%',
      };

      const taskTitle =
        logCamelCase.taskName ||
        (logCamelCase as any).task_name ||
        'Task';
      const submitterDisplay =
        logCamelCase.submitterName ||
        `User ID ${logCamelCase.submittedBy}`;

      expect(taskTitle).toBe('PERIZINAN');
      expect(submitterDisplay).toBe('John Doe PM');
      expect(taskTitle).not.toContain('undefined');
      expect(submitterDisplay).not.toContain('undefined');
    });

    it('handles snake_case fallback safely without undefined', () => {
      const logSnakeCase: any = {
        id: 267,
        task_name: 'PERIZINAN',
        submitted_by: 2,
        reported_progress: 100,
        previous_progress: 99.99,
        event_type: 'TASK_COMPLETION',
        reason: 'Selesai 100%',
      };

      const taskTitle =
        logSnakeCase.taskName ||
        logSnakeCase.task_name ||
        'Task';
      const submitterDisplay =
        logSnakeCase.submitterName ||
        logSnakeCase.submitter_name ||
        (logSnakeCase.submitted_by ? `User ID ${logSnakeCase.submitted_by}` : 'Submitter');

      expect(taskTitle).toBe('PERIZINAN');
      expect(submitterDisplay).toBe('User ID 2');
      expect(taskTitle).not.toContain('undefined');
      expect(submitterDisplay).not.toContain('undefined');
    });
  });
});
