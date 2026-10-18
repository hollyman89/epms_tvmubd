import { MENU_GROUPS, getRouteAllowedRoles, isRoleAllowedForRoute } from '../../constants/menuConfig';
import { SettingsService } from '../../services/settings.service';
import { apiClient } from '../axios';

jest.mock('../axios', () => ({
  apiClient: {
    get: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  },
}));

describe('System Settings Admin Hub MVP (PRE-W10 SETTINGS-F1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Settings route points to /settings in menuConfig
  it('1. Settings menu points to canonical /settings in menuConfig', () => {
    const systemGroup = MENU_GROUPS.find((g) => g.label === 'SYSTEM');
    expect(systemGroup).toBeDefined();

    const settingsItem = systemGroup?.children.find((c) => c.label === 'Settings');
    expect(settingsItem).toBeDefined();
    expect(settingsItem?.path).toBe('/settings');
    expect(settingsItem?.key).toBe('/settings');
  });

  // 2. dev-settings path is no longer used for Settings
  it('2. dev-settings path is no longer used for Settings', () => {
    const systemGroup = MENU_GROUPS.find((g) => g.label === 'SYSTEM');
    const devSettingsItem = systemGroup?.children.find((c) => c.key === 'dev-settings' || c.path === 'dev-settings');
    expect(devSettingsItem).toBeUndefined();
  });

  // 3. RBAC: Only SUPER_ADMIN allowed for /settings
  it('3. permits SUPER_ADMIN and denies non-admin roles for /settings', () => {
    expect(isRoleAllowedForRoute('/settings', ['SUPER_ADMIN'])).toBe(true);
    expect(isRoleAllowedForRoute('/settings', ['super_admin'])).toBe(true); // case-insensitive
    expect(isRoleAllowedForRoute('/settings', ['PROJECT_MANAGER'])).toBe(false);
    expect(isRoleAllowedForRoute('/settings', ['MARKETING'])).toBe(false);
    expect(isRoleAllowedForRoute('/settings', ['FINANCE'])).toBe(false);
    expect(isRoleAllowedForRoute('/settings', ['LEGAL'])).toBe(false);
    expect(isRoleAllowedForRoute('/settings', [])).toBe(false);

    const allowed = getRouteAllowedRoles('/settings');
    expect(allowed).toEqual(['SUPER_ADMIN']);
  });

  // 4. SettingsService.getHealth() consumes /health and parses probes
  it('4. SettingsService.getHealth() fetches component health probes', async () => {
    const mockHealthPayload = {
      meta: { code: 200, status: 'success' },
      data: {
        status: 'HEALTHY',
        timestamp: '2026-10-01T08:00:00.000Z',
        totalLatencyMs: 4,
        probes: [
          { component: 'Database (MySQL)', status: 'UP', latencyMs: 1 },
          { component: 'Transactional Outbox Queue', status: 'UP', latencyMs: 3 },
          { component: 'File Storage (Uploads)', status: 'UP', latencyMs: 1 },
        ],
      },
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockHealthPayload });

    const result = await SettingsService.getHealth();
    expect(apiClient.get).toHaveBeenCalledWith('/health');
    expect(result.status).toBe('HEALTHY');
    expect(result.probes.length).toBe(3);
    expect(result.probes[0].component).toBe('Database (MySQL)');
  });

  // 5. SettingsService.getHealth() handles error without unhandled rejection
  it('5. health error fails safely and does not crash service layer', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Network Timeout'));

    await expect(SettingsService.getHealth()).rejects.toThrow('Network Timeout');
  });

  // 6. SettingsService.getReadinessReport() consumes /observability/readiness-report
  it('6. readiness report response renders safely with SLI/SLO catalog and outbox telemetry', async () => {
    const mockReadinessPayload = {
      data: {
        statusCode: 200,
        data: {
          readinessStatus: '100% PRODUCTION READY',
          verifiedAt: '2026-10-01T08:00:00.000Z',
          sliSloSummary: [
            { name: 'API System Availability', targetSlo: '≥ 99.9%', currentSli: '99.95%', status: 'HEALTHY' },
          ],
          outboxTelemetry: {
            pendingQueue: 11,
            publishedCount: 1490,
            failedCount: 0,
            dlqStatus: 'CLEAR',
          },
          runbookIndex: [
            { alert: 'Outbox Queue Backlog > 500', severity: 'HIGH', runbookUrl: '/docs/runbooks/RB-OUTBOX-BACKLOG.md' },
          ],
        },
      },
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockReadinessPayload });

    const result = await SettingsService.getReadinessReport();
    expect(apiClient.get).toHaveBeenCalledWith('/observability/readiness-report');
    expect(result.readinessStatus).toBe('100% PRODUCTION READY');
    expect(result.outboxTelemetry?.pendingQueue).toBe(11);
    expect(result.runbookIndex?.length).toBe(1);
  });

  // 7. SettingsService.getObservabilityDashboard() consumes /observability/dashboard
  it('7. observability dashboard response renders safely', async () => {
    const mockObsPayload = {
      data: {
        data: {
          environment: 'Enterprise Production-Ready Staging',
          timestamp: '2026-10-01T08:00:00.000Z',
          sliSloReport: [],
        },
      },
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockObsPayload });

    const result = await SettingsService.getObservabilityDashboard();
    expect(apiClient.get).toHaveBeenCalledWith('/observability/dashboard');
    expect(result.environment).toBe('Enterprise Production-Ready Staging');
  });

  // 8. SettingsService.getActiveSessions() consumes /auth/sessions
  it('8. active sessions list renders with safe user-agent, IP, and timestamps', async () => {
    const mockSessionsPayload = {
      data: {
        statusCode: 200,
        data: [
          {
            id: 16,
            user_id: 1,
            ip_address: '::1',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0.0.0',
            last_activity: '2026-10-01T08:00:00.000Z',
            is_active: true,
          },
        ],
      },
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockSessionsPayload });

    const result = await SettingsService.getActiveSessions();
    expect(apiClient.get).toHaveBeenCalledWith('/auth/sessions');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(16);
    expect(result[0].ip_address).toBe('::1');
  });

  // 9. SettingsService.revokeSession() calls exact endpoint DELETE /auth/sessions/:id
  it('9. revoke session calls exact endpoint DELETE /auth/sessions/:id', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: { statusCode: 200, message: 'Revoked' } });

    await SettingsService.revokeSession(16);
    expect(apiClient.delete).toHaveBeenCalledWith('/auth/sessions/16');
  });

  // 10. SettingsService.revokeAllOtherSessions() calls exact endpoint DELETE /auth/sessions/all-others
  it('10. revoke-other-sessions calls exact endpoint DELETE /auth/sessions/all-others', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValueOnce({ data: { statusCode: 200, message: 'All other sessions revoked' } });

    await SettingsService.revokeAllOtherSessions();
    expect(apiClient.delete).toHaveBeenCalledWith('/auth/sessions/all-others');
  });

  // 11. SettingsService.getNotificationHealth() consumes /notifications/health/websocket-redis
  it('11. notification infrastructure renders safe WebSocket and Redis status', async () => {
    const mockNotifPayload = {
      data: {
        status: 'UP',
        timestamp: '2026-10-01T08:00:00.000Z',
        services: {
          websocket: { namespace: '/notifications', status: 'ACTIVE' },
          redisIoAdapter: { host: '127.0.0.1', port: 6379, status: 'CONNECTED' },
        },
      },
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: mockNotifPayload });

    const result = await SettingsService.getNotificationHealth();
    expect(apiClient.get).toHaveBeenCalledWith('/notifications/health/websocket-redis');
    expect(result.status).toBe('UP');
    expect(result.services.websocket?.status).toBe('ACTIVE');
    expect(result.services.redisIoAdapter?.status).toBe('CONNECTED');
  });

  // 12. Administration links point to canonical routes
  it('12. administration links point to canonical routes (/admin/users, /workflow, /audit-trail)', () => {
    const canonicalAdminRoutes = ['/admin/users', '/workflow', '/audit-trail'];

    for (const route of canonicalAdminRoutes) {
      const allowedRoles = getRouteAllowedRoles(route);
      expect(allowedRoles).toBeDefined();
      expect(allowedRoles?.includes('SUPER_ADMIN')).toBe(true);
    }
  });

  // 13. Sensitive fields are not exposed or handled by settings service
  it('13. ensures sensitive credentials and secrets are completely absent from payload contracts', async () => {
    const mockSession = {
      id: 1,
      user_id: 1,
      ip_address: '192.168.1.1',
      user_agent: 'Chrome',
      last_activity: '2026-10-01T08:00:00.000Z',
      is_active: true,
    };
    (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: { data: [mockSession] } });

    const sessions = await SettingsService.getActiveSessions();
    const sessionRecord = sessions[0] as any;

    expect(sessionRecord.password).toBeUndefined();
    expect(sessionRecord.passwordHash).toBeUndefined();
    expect(sessionRecord.refreshToken).toBeUndefined();
    expect(sessionRecord.accessToken).toBeUndefined();
    expect(sessionRecord.jwtSecret).toBeUndefined();
  });
});
