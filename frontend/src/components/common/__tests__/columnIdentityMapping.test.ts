import { resolveUserIdentity } from '../UserIdentityDisplay';
import { InvoiceDto } from '@/services/finance.service';

describe('PRE-W10 UIUX-DP1-R2 Column Identity Mapping Tests', () => {
  describe('Finance Invoice List — Penerbit Column', () => {
    // Exact mapping used in frontend/src/app/(dashboard)/finance/invoices/page.tsx
    const renderPenerbitIdentity = (r: InvoiceDto) => {
      return resolveUserIdentity({
        user: r.creator,
        userId: r.createdBy,
        fallbackRole: 'Finance Team',
        showEmail: true,
      });
    };

    it('1. creator.fullName exists → Penerbit renders actual full name and does NOT render User #3', () => {
      const invoiceWithCreator: InvoiceDto = {
        id: 4,
        poId: 1,
        invoiceNumber: 'INV-20260928-001',
        invoiceDate: '2026-09-28',
        totalAmount: 50000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'PAID',
        status: 'PAID',
        createdBy: 3,
        creator: {
          id: 3,
          fullName: 'Finance User',
          email: 'finance@epms.com',
        },
        createdAt: '2026-09-28T10:00:00.000Z',
      };

      const result = renderPenerbitIdentity(invoiceWithCreator);

      expect(result.displayName).toBe('Finance User');
      expect(result.email).toBe('finance@epms.com');
      expect(result.isTechnicalFallback).toBe(false);
      expect(result.displayName).not.toContain('User #');
      expect(result.displayName).not.toBe('User #3');
    });

    it('2. creator is null but createdBy exists → renders safe business role fallback', () => {
      const invoiceWithoutCreator: InvoiceDto = {
        id: 1,
        poId: 1,
        invoiceNumber: 'INV-20260922-001',
        invoiceDate: '2026-09-22',
        totalAmount: 10000000,
        matchStatus: 'VERIFIED',
        paymentStatus: 'PAID',
        status: 'PAID',
        createdBy: 3,
        creator: null,
        createdAt: '2026-09-22T10:00:00.000Z',
      };

      const result = renderPenerbitIdentity(invoiceWithoutCreator);

      expect(result.displayName).toBe('Finance Team');
      expect(result.isRoleFallback).toBe(true);
      expect(result.isTechnicalFallback).toBe(false);
    });
  });

  describe('Governance Contracts — Project Manager Column', () => {
    // Exact mapping used in frontend/src/app/(dashboard)/governance/contracts/page.tsx
    const renderContractPmIdentity = (record: {
      project_manager?: { id: number; fullName?: string; email?: string } | null;
      project_manager_id?: number | null;
    }) => {
      if (!record.project_manager && !record.project_manager_id) {
        return { displayName: '-', isBusinessEmptyState: true, email: undefined };
      }
      const res = resolveUserIdentity({
        user: record.project_manager,
        userId: record.project_manager_id,
        fallbackText: '-',
        showEmail: true,
      });
      return { ...res, isBusinessEmptyState: false };
    };

    it('3. project_manager.fullName exists → PM name rendered correctly', () => {
      const contractWithPm = {
        id: 99,
        contract_number: 'CONT-20260930-0099',
        project_manager_id: 2,
        project_manager: {
          id: 2,
          fullName: 'Project Manager',
          email: 'pm@epms.com',
        },
      };

      const result = renderContractPmIdentity(contractWithPm);

      expect(result.displayName).toBe('Project Manager');
      expect(result.email).toBe('pm@epms.com');
      expect(result.isBusinessEmptyState).toBe(false);
    });

    it('4. project_manager with Faza Afina renders full name correctly', () => {
      const contractFaza = {
        id: 10,
        contract_number: 'CONT-20260921-0010',
        project_manager_id: 879,
        project_manager: {
          id: 879,
          fullName: 'Faza Afina',
          email: 'faza@epms.com',
        },
      };

      const result = renderContractPmIdentity(contractFaza);

      expect(result.displayName).toBe('Faza Afina');
      expect(result.email).toBe('faza@epms.com');
    });

    it('5. project_manager = null and project_manager_id = null → no fabricated PM identity, returns safe empty state', () => {
      const unassignedContract = {
        id: 100,
        contract_number: 'CONT-20260930-0100',
        project_manager_id: null,
        project_manager: null,
      };

      const result = renderContractPmIdentity(unassignedContract);

      expect(result.displayName).toBe('-');
      expect(result.isBusinessEmptyState).toBe(true);
    });

    it('6. rejected contract with no PM → returns safe empty state', () => {
      const rejectedContract = {
        id: 101,
        contract_number: 'CONT-20260930-0101',
        project_manager_id: null,
        project_manager: null,
      };

      const result = renderContractPmIdentity(rejectedContract);

      expect(result.displayName).toBe('-');
      expect(result.isBusinessEmptyState).toBe(true);
    });
  });
});
