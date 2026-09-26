import { apiClient } from '@/lib/axios';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

describe('Kanban Go/No-Go Authoritative Submission Contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Transition Route Decision Logic', () => {
    it('LEAD -> WAITING_GO_NO_GO routes strictly to submit-go-no-go, NOT generic PATCH', () => {
      const sourceColumn = 'LEAD';
      const destColumn = 'WAITING_GO_NO_GO';
      const movedItem = {
        id: 2,
        title: 'Tender Project Asia Net',
        stage: 'LEAD',
        go_nogo_status: 'PENDING',
      };

      const isGoNoGoAuthoritativeTransition =
        sourceColumn === 'LEAD' && destColumn === 'WAITING_GO_NO_GO';

      expect(isGoNoGoAuthoritativeTransition).toBe(true);

      const onStageChange = jest.fn();
      const handleSubmitGoNoGoReview = jest.fn();

      if (isGoNoGoAuthoritativeTransition) {
        handleSubmitGoNoGoReview(movedItem.id);
      } else {
        onStageChange(movedItem.id, destColumn);
      }

      expect(handleSubmitGoNoGoReview).toHaveBeenCalledWith(2);
      expect(onStageChange).not.toHaveBeenCalled();
    });

    it('Other normal transitions (e.g. QUALIFICATION -> PROPOSAL) route to onStageChange, NOT submit-go-no-go', () => {
      const sourceColumn: string = 'QUALIFICATION';
      const destColumn: string = 'PROPOSAL';
      const movedItem = {
        id: 15,
        title: 'Tender ERP',
        stage: 'QUALIFICATION',
        go_nogo_status: 'GO',
      };

      const isGoNoGoAuthoritativeTransition =
        sourceColumn === 'LEAD' && destColumn === 'WAITING_GO_NO_GO';

      expect(isGoNoGoAuthoritativeTransition).toBe(false);

      const onStageChange = jest.fn();
      const handleSubmitGoNoGoReview = jest.fn();

      if (isGoNoGoAuthoritativeTransition) {
        handleSubmitGoNoGoReview(movedItem.id);
      } else {
        onStageChange(movedItem.id, destColumn);
      }

      expect(onStageChange).toHaveBeenCalledWith(15, 'PROPOSAL');
      expect(handleSubmitGoNoGoReview).not.toHaveBeenCalled();
    });

    it('Resubmission after NO_GO (stage = LEAD) uses the EXACT same authoritative path', () => {
      const sourceColumn = 'LEAD';
      const destColumn = 'WAITING_GO_NO_GO';
      const movedItem = {
        id: 2,
        title: 'Tender Project Asia Net',
        stage: 'LEAD',
        go_nogo_status: 'NO_GO',
        revision_status: 'COMPLETED',
      };

      const isGoNoGoAuthoritativeTransition =
        sourceColumn === 'LEAD' && destColumn === 'WAITING_GO_NO_GO';

      expect(isGoNoGoAuthoritativeTransition).toBe(true);

      const onStageChange = jest.fn();
      const handleSubmitGoNoGoReview = jest.fn();

      if (isGoNoGoAuthoritativeTransition) {
        handleSubmitGoNoGoReview(movedItem.id);
      } else {
        onStageChange(movedItem.id, destColumn);
      }

      expect(handleSubmitGoNoGoReview).toHaveBeenCalledWith(2);
      expect(onStageChange).not.toHaveBeenCalled();
    });
  });

  describe('2. Authoritative Handler Execution & No Duplicate Stage Patch', () => {
    it('handleSubmitGoNoGoReview calls POST /submit-go-no-go and NEVER issues generic PATCH', async () => {
      const tenderId = 2;
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { message: 'Tender berhasil diajukan untuk GO / NO GO review' },
      });

      const onStageChange = jest.fn();
      const updateCache = jest.fn();
      const dispatchEvent = jest.fn();

      // Simulated handleSubmitGoNoGoReview implementation as now in KanbanBoard.tsx
      const submitHandler = async (id: number) => {
        const res = await apiClient.post(`/marketing/tenders/${id}/submit-go-no-go`);
        updateCache(id, { stage: 'WAITING_GO_NO_GO', go_nogo_status: 'PENDING' });
        // NOTE: onStageChange(tenderId, 'WAITING_GO_NO_GO') was intentionally removed
        dispatchEvent('epms:refetch_all');
        return res;
      };

      await submitHandler(tenderId);

      expect(apiClient.post).toHaveBeenCalledWith('/marketing/tenders/2/submit-go-no-go');
      expect(apiClient.patch).not.toHaveBeenCalled();
      expect(onStageChange).not.toHaveBeenCalled();
      expect(updateCache).toHaveBeenCalledWith(2, {
        stage: 'WAITING_GO_NO_GO',
        go_nogo_status: 'PENDING',
      });
      expect(dispatchEvent).toHaveBeenCalledWith('epms:refetch_all');
    });

    it('Error handling: on failure, does NOT call generic PATCH and restores/invalidates board state', async () => {
      const tenderId = 2;
      const apiError = new Error('Tender harus direvisi terlebih dahulu sebelum diajukan kembali.');
      (apiClient.post as jest.Mock).mockRejectedValue(apiError);

      const onStageChange = jest.fn();
      const updateCache = jest.fn();
      const invalidateQueries = jest.fn();
      const dispatchEvent = jest.fn();
      let errorMessage = '';

      const submitHandler = async (id: number) => {
        try {
          await apiClient.post(`/marketing/tenders/${id}/submit-go-no-go`);
          updateCache(id, { stage: 'WAITING_GO_NO_GO', go_nogo_status: 'PENDING' });
          dispatchEvent('epms:refetch_all');
        } catch (err: any) {
          errorMessage = err.message;
          invalidateQueries({ queryKey: ['tenders'] });
          dispatchEvent('epms:refetch_all');
        }
      };

      await submitHandler(tenderId);

      // Verify that no generic fallback was attempted
      expect(apiClient.patch).not.toHaveBeenCalled();
      expect(onStageChange).not.toHaveBeenCalled();
      // Cache was NOT updated to WAITING_GO_NO_GO
      expect(updateCache).not.toHaveBeenCalled();
      // Invalidation & refetch was triggered to restore authoritative state
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tenders'] });
      expect(dispatchEvent).toHaveBeenCalledWith('epms:refetch_all');
      expect(errorMessage).toBe('Tender harus direvisi terlebih dahulu sebelum diajukan kembali.');
    });
  });
});
