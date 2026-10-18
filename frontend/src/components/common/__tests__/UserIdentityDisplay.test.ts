import { resolveUserIdentity } from '../UserIdentityDisplay';

describe('PRE-W10 UIUX-DP1 Frontend User Identity Display Tests', () => {
  it('1. Full name shown instead of technical User #41 when identity is available', () => {
    const res = resolveUserIdentity({
      user: { id: 41, fullName: 'purchasing', email: 'purchasing@epms.com' },
      userId: 41,
      fallbackRole: 'Petugas Gudang',
    });

    expect(res.displayName).toBe('purchasing');
    expect(res.isTechnicalFallback).toBe(false);
    expect(res.isRoleFallback).toBe(false);
  });

  it('2. Email secondary display safe when showEmail is true and distinct from name', () => {
    const res = resolveUserIdentity({
      user: { id: 3, fullName: 'Finance User', email: 'finance@epms.com' },
      userId: 3,
      showEmail: true,
    });

    expect(res.displayName).toBe('Finance User');
    expect(res.email).toBe('finance@epms.com');
  });

  it('3. Missing or null user object does not crash and handles safely', () => {
    const resNull = resolveUserIdentity({ user: null, userId: null });
    const resUndefined = resolveUserIdentity({ user: undefined, userId: undefined });

    expect(resNull.displayName).toBe('—');
    expect(resUndefined.displayName).toBe('—');
    expect(resNull.email).toBeNull();
  });

  it('4. Technical user ID fallback works only when identity is unavailable and no role fallback', () => {
    const res = resolveUserIdentity({
      user: null,
      userId: 41,
    });

    expect(res.displayName).toBe('User #41');
    expect(res.isTechnicalFallback).toBe(true);
  });

  it('5. Generic role fallback does not override real fullName', () => {
    const res = resolveUserIdentity({
      user: { id: 41, fullName: 'Dwi Ragil Pribadi', email: 'ragil@epms.com' },
      userId: 41,
      fallbackRole: 'Petugas Logistik',
    });

    // Real fullName takes absolute priority over fallback role
    expect(res.displayName).toBe('Dwi Ragil Pribadi');
    expect(res.isRoleFallback).toBe(false);
    expect(res.isTechnicalFallback).toBe(false);
  });

  it('6. Project Manager actual name displayed (eliminates generic "Project Manager" fallback)', () => {
    const res = resolveUserIdentity({
      user: { id: 879, fullName: 'Faza Afina', email: 'pm@epms.com' },
      userId: 879,
      fallbackText: 'Project Manager',
      fallbackRole: 'Project Manager',
      showEmail: true,
    });

    expect(res.displayName).toBe('Faza Afina');
    expect(res.email).toBe('pm@epms.com');
  });

  it('7. GR receiver actual name displayed (eliminates "User #41" and "Petugas Gudang")', () => {
    const res = resolveUserIdentity({
      user: { id: 41, fullName: 'purchasing', email: 'purchasing@epms.com' },
      userId: 41,
      fallbackRole: 'Petugas Gudang',
    });

    expect(res.displayName).toBe('purchasing');
  });

  it('8. Invoice creator actual name displayed (eliminates "Finance Team")', () => {
    const res = resolveUserIdentity({
      user: { id: 3, fullName: 'Finance User', email: 'finance@epms.com' },
      userId: 3,
      fallbackRole: 'Finance Team',
      showEmail: true,
    });

    expect(res.displayName).toBe('Finance User');
    expect(res.email).toBe('finance@epms.com');
  });

  it('9. Payment creator actual name displayed (eliminates "User #3" and "Petugas Pembayaran")', () => {
    const res = resolveUserIdentity({
      user: { id: 3, fullName: 'Finance User', email: 'finance@epms.com' },
      userId: 3,
      fallbackRole: 'Petugas Pembayaran',
    });

    expect(res.displayName).toBe('Finance User');
  });

  it('10. Governance/Audit actor display preserves existing valid identity data', () => {
    // Audit log actor projection format: { full_name, email }
    const resAudit = resolveUserIdentity({
      user: { id: 1, full_name: 'System Admin', email: 'admin@epms.com' } as any,
      userId: 1,
      fallbackRole: 'Sistem',
    });

    expect(resAudit.displayName).toBe('System Admin');
    expect(resAudit.isRoleFallback).toBe(false);

    // Workflow transition actor format: { fullName, email }
    const resWf = resolveUserIdentity({
      user: { id: 879, fullName: 'Faza Afina', email: 'pm@epms.com' },
      userId: 879,
      fallbackRole: 'Sistem',
    });

    expect(resWf.displayName).toBe('Faza Afina');
  });

  it('11. Invoice list creator projection displays creator fullName and does not display User #3 when creator exists', () => {
    // When creator projection exists
    const withCreator = resolveUserIdentity({
      user: { id: 3, fullName: 'Finance User', email: 'finance@epms.com' },
      userId: 3,
      fallbackRole: 'Finance Team',
      showEmail: true,
    });
    expect(withCreator.displayName).toBe('Finance User');
    expect(withCreator.email).toBe('finance@epms.com');
    expect(withCreator.isTechnicalFallback).toBe(false);

    // When creator projection is legitimately missing
    const withoutCreator = resolveUserIdentity({
      user: null,
      userId: 3,
      fallbackRole: 'Finance Team',
      showEmail: true,
    });
    expect(withoutCreator.displayName).toBe('Finance Team');
    expect(withoutCreator.isRoleFallback).toBe(true);
  });

  it('12. Contracts assigned PM displays actual name and email if manager exists', () => {
    const assignedPm = resolveUserIdentity({
      user: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      userId: 2,
      fallbackText: '-',
      showEmail: true,
    });
    expect(assignedPm.displayName).toBe('Project Manager');
    expect(assignedPm.email).toBe('pm@epms.com');
    expect(assignedPm.isTechnicalFallback).toBe(false);
  });

  it('13. Contracts unassigned PM does not fabricate name and preserves safe fallback', () => {
    const unassignedPm = resolveUserIdentity({
      user: null,
      userId: null,
      fallbackText: '-',
      showEmail: true,
    });
    expect(unassignedPm.displayName).toBe('-');
    expect(unassignedPm.email).toBeNull();
  });
});

