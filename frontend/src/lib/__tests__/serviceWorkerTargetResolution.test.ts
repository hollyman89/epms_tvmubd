/**
 * SERVICE WORKER PUSH TARGET RESOLUTION & ORIGIN SAFETY TEST SUITE
 *
 * Verifies Section 4.B of Fase 1.3-R3:
 * 1. Hanya actionLink -> Gunakan actionLink
 * 2. Hanya actionTarget -> Gunakan actionTarget
 * 3. Keduanya tersedia dan identik -> Gunakan target yang sama
 * 4. Keduanya tersedia tetapi berbeda -> Ikuti prioritas actionLink
 * 5. Keduanya tidak tersedia -> Gunakan /
 * 6. Target kosong/null/whitespace -> Gunakan target valid berikutnya atau /
 * 7. Format payload lama -> Tetap kompatibel
 * 8. Origin validation & open-redirect safety
 */

export function resolvePushActionTarget(link?: any, target?: any): string {
  if (typeof link === 'string' && link.trim().length > 0) return link.trim();
  if (typeof target === 'string' && target.trim().length > 0) return target.trim();
  return '/';
}

export function resolveSafeTargetUrl(rawTarget: string, origin: string = 'http://localhost:3000'): string {
  try {
    const url = new URL(rawTarget, origin);
    if (url.origin !== origin) {
      return new URL('/', origin).href;
    }
    return url.href;
  } catch {
    return new URL('/', origin).href;
  }
}

describe('Service Worker Push Action Target Resolution (Section 4.B)', () => {
  const ORIGIN = 'http://localhost:3000';

  it('1. Hanya actionLink -> Gunakan actionLink', () => {
    const payload = { actionLink: '/sales/tenders/101' };
    const target = resolvePushActionTarget(payload.actionLink, undefined);
    expect(target).toBe('/sales/tenders/101');
    expect(resolveSafeTargetUrl(target, ORIGIN)).toBe('http://localhost:3000/sales/tenders/101');
  });

  it('2. Hanya actionTarget -> Gunakan actionTarget', () => {
    const payload = { actionTarget: '/procurement?tab=po&poId=202' };
    const target = resolvePushActionTarget(undefined, payload.actionTarget);
    expect(target).toBe('/procurement?tab=po&poId=202');
    expect(resolveSafeTargetUrl(target, ORIGIN)).toBe('http://localhost:3000/procurement?tab=po&poId=202');
  });

  it('3. Keduanya tersedia dan identik -> Gunakan target yang sama', () => {
    const payload = {
      actionLink: '/finance/invoices?tab=ready_pos&poId=202&serviceClaimId=501',
      actionTarget: '/finance/invoices?tab=ready_pos&poId=202&serviceClaimId=501',
    };
    const target = resolvePushActionTarget(payload.actionLink, payload.actionTarget);
    expect(target).toBe('/finance/invoices?tab=ready_pos&poId=202&serviceClaimId=501');
    expect(resolveSafeTargetUrl(target, ORIGIN)).toBe(
      'http://localhost:3000/finance/invoices?tab=ready_pos&poId=202&serviceClaimId=501',
    );
  });

  it('4. Keduanya tersedia tetapi berbeda -> Ikuti prioritas actionLink', () => {
    const payload = {
      actionLink: '/governance/tasks?taskId=55&projectId=10',
      actionTarget: '/project-delivery?projectId=10',
    };
    const target = resolvePushActionTarget(payload.actionLink, payload.actionTarget);
    expect(target).toBe('/governance/tasks?taskId=55&projectId=10');
    expect(resolveSafeTargetUrl(target, ORIGIN)).toBe('http://localhost:3000/governance/tasks?taskId=55&projectId=10');
  });

  it('5. Keduanya tidak tersedia -> Gunakan /', () => {
    const payload = {};
    const target = resolvePushActionTarget((payload as any).actionLink, (payload as any).actionTarget);
    expect(target).toBe('/');
    expect(resolveSafeTargetUrl(target, ORIGIN)).toBe('http://localhost:3000/');
  });

  it('6a. Target actionLink kosong/whitespace -> Gunakan target valid actionTarget', () => {
    expect(resolvePushActionTarget('', '/project-delivery')).toBe('/project-delivery');
    expect(resolvePushActionTarget('   ', '/project-delivery')).toBe('/project-delivery');
    expect(resolvePushActionTarget(null, '/project-delivery')).toBe('/project-delivery');
    expect(resolvePushActionTarget(undefined, '/project-delivery')).toBe('/project-delivery');
  });

  it('6b. Kedua target kosong/null/whitespace -> Gunakan /', () => {
    expect(resolvePushActionTarget('', '')).toBe('/');
    expect(resolvePushActionTarget('   ', '   ')).toBe('/');
    expect(resolvePushActionTarget(null, null)).toBe('/');
    expect(resolvePushActionTarget(undefined, undefined)).toBe('/');
  });

  it('7. Format payload lama (legacy) -> Tetap kompatibel', () => {
    const legacyPayload1 = { actionTarget: '/sales' };
    expect(resolvePushActionTarget((legacyPayload1 as any).actionLink, legacyPayload1.actionTarget)).toBe('/sales');

    const legacyPayload2 = { actionLink: '/legal/review?tab=WAITING' };
    expect(resolvePushActionTarget(legacyPayload2.actionLink, (legacyPayload2 as any).actionTarget)).toBe(
      '/legal/review?tab=WAITING',
    );
  });

  it('8. Origin validation blocks open-redirect to external domains', () => {
    const maliciousTarget = 'https://attacker.com/malicious-phish';
    expect(resolveSafeTargetUrl(maliciousTarget, ORIGIN)).toBe('http://localhost:3000/');
  });
});

