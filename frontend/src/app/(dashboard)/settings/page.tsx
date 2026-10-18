"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Tabs,
  Card,
  Row,
  Col,
  Button,
  Tag,
  Table,
  Space,
  Alert,
  Spin,
  Modal,
  Badge,
  Descriptions,
  Collapse,
  message,
} from 'antd';
import {
  SettingOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  LineChartOutlined,
  DesktopOutlined,
  DeleteOutlined,
  CloudServerOutlined,
  BellOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  SettingsService,
  HealthData,
  ReadinessData,
  ObservabilityDashboardData,
  UserSessionItem,
  NotificationHealthData,
} from '@/services/settings.service';
import { formatDateTime } from '@/lib/formatters';
import { CANONICAL_FONT_FAMILY } from '@/constants/theme';

const { Title, Text, Paragraph } = Typography;

export default function SystemSettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Independent state management per capability
  const [health, setHealth] = useState<{ data: HealthData | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });

  const [readiness, setReadiness] = useState<{ data: ReadinessData | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });

  const [observability, setObservability] = useState<{
    data: ObservabilityDashboardData | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: true,
    error: null,
  });

  const [sessions, setSessions] = useState<{
    data: UserSessionItem[];
    loading: boolean;
    error: string | null;
  }>({
    data: [],
    loading: true,
    error: null,
  });

  const [notifHealth, setNotifHealth] = useState<{
    data: NotificationHealthData | null;
    loading: boolean;
    error: string | null;
  }>({
    data: null,
    loading: true,
    error: null,
  });

  // Fetch individual capabilities independently
  const loadHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await SettingsService.getHealth();
      setHealth({ data, loading: false, error: null });
    } catch (err: any) {
      setHealth({
        data: null,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Gagal memuat status kesehatan sistem',
      });
    }
  }, []);

  const loadReadiness = useCallback(async () => {
    setReadiness((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await SettingsService.getReadinessReport();
      setReadiness({ data, loading: false, error: null });
    } catch (err: any) {
      setReadiness({
        data: null,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Gagal memuat laporan kesiapan operasional',
      });
    }
  }, []);

  const loadObservability = useCallback(async () => {
    setObservability((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await SettingsService.getObservabilityDashboard();
      setObservability({ data, loading: false, error: null });
    } catch (err: any) {
      setObservability({
        data: null,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Gagal memuat dashboard observabilitas',
      });
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setSessions((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await SettingsService.getActiveSessions();
      setSessions({ data, loading: false, error: null });
    } catch (err: any) {
      setSessions({
        data: [],
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Gagal memuat daftar sesi aktif',
      });
    }
  }, []);

  const loadNotifHealth = useCallback(async () => {
    setNotifHealth((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await SettingsService.getNotificationHealth();
      setNotifHealth({ data, loading: false, error: null });
    } catch (err: any) {
      setNotifHealth({
        data: null,
        loading: false,
        error: err?.response?.data?.message || err?.message || 'Gagal memuat status infrastruktur notifikasi',
      });
    }
  }, []);

  const fetchAll = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      await Promise.allSettled([
        loadHealth(),
        loadReadiness(),
        loadObservability(),
        loadSessions(),
        loadNotifHealth(),
      ]);
      if (isManualRefresh) {
        setRefreshing(false);
        message.success('Status sistem berhasil diperbarui');
      }
    },
    [loadHealth, loadReadiness, loadObservability, loadSessions, loadNotifHealth]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Session revocation actions with confirmation modal
  const handleRevokeSession = (sessionId: string | number) => {
    Modal.confirm({
      title: 'Cabut Akses Sesi',
      icon: <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />,
      content: `Apakah Anda yakin ingin mengakhiri sesi perangkat #${sessionId}? Pengguna pada perangkat tersebut harus masuk kembali.`,
      okText: 'Ya, Cabut Sesi',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await SettingsService.revokeSession(sessionId);
          message.success(`Sesi #${sessionId} berhasil dicabut`);
          loadSessions();
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Gagal mencabut sesi');
        }
      },
    });
  };

  const handleRevokeAllOtherSessions = () => {
    Modal.confirm({
      title: 'Cabut Semua Sesi Lainnya',
      icon: <ExclamationCircleOutlined style={{ color: '#f5222d' }} />,
      content: 'Apakah Anda yakin ingin mengakhiri SEMUA sesi aktif lainnya kecuali sesi saat ini? Semua perangkat lain akan dipaksa logout.',
      okText: 'Ya, Cabut Semua Sesi Lain',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await SettingsService.revokeAllOtherSessions();
          message.success('Semua sesi lainnya berhasil dicabut');
          loadSessions();
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Gagal mencabut sesi lain');
        }
      },
    });
  };

  // Helper to parse user agent safely
  const parseUserAgent = (ua: string) => {
    if (!ua || ua === 'unknown') return 'Peramban / Klien API';
    if (ua.includes('Edg/')) return 'Microsoft Edge';
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Google Chrome';
    if (ua.includes('Firefox/')) return 'Mozilla Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Apple Safari';
    if (ua.includes('axios/') || ua.includes('node')) return 'Klien Sistem / API (Automated)';
    return ua.slice(0, 30);
  };

  // Status Badge Helper with Semantic Colors
  const renderStatusTag = (status?: string) => {
    const s = String(status || '').toUpperCase();
    if (s === 'HEALTHY' || s === 'UP' || s === 'CONNECTED' || s === 'ACTIVE' || s.includes('READY')) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          {status}
        </Tag>
      );
    }
    if (s === 'DEGRADED' || s === 'WARNING' || s === 'PARTIAL') {
      return (
        <Tag color="warning" icon={<WarningOutlined />}>
          {status}
        </Tag>
      );
    }
    return (
      <Tag color="error" icon={<CloseCircleOutlined />}>
        {status || 'UNAVAILABLE'}
      </Tag>
    );
  };

  // TAB 1: OVERVIEW
  const renderOverviewTab = () => {
    const isSystemHealthy = health.data?.status === 'HEALTHY';
    const isReadinessReady = readiness.data?.readinessStatus?.includes('READY');
    const isNotifConnected = notifHealth.data?.status === 'UP';
    const activeSessionCount = sessions.data.length;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* KPI Summary Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ padding: '20px' }}
            >
              <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                SYSTEM HEALTH
              </Text>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Title level={3} style={{ margin: 0 }}>
                  {health.loading ? <Spin size="small" /> : renderStatusTag(health.data?.status)}
                </Title>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                {health.data ? `Total Latensi: ${health.data.totalLatencyMs} ms` : 'Status probe aktif'}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ padding: '20px' }}
            >
              <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                PRODUCTION READINESS
              </Text>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Title level={4} style={{ margin: 0 }}>
                  {readiness.loading ? <Spin size="small" /> : renderStatusTag(readiness.data?.readinessStatus)}
                </Title>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                {readiness.data?.verifiedAt ? `Diverifikasi: ${formatDateTime(readiness.data.verifiedAt)}` : 'Katalog metrik siap'}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ padding: '20px' }}
            >
              <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                NOTIFICATION INFRASTRUCTURE
              </Text>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Title level={3} style={{ margin: 0 }}>
                  {notifHealth.loading ? <Spin size="small" /> : renderStatusTag(notifHealth.data?.status)}
                </Title>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                WebSocket & Redis IoAdapter
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ padding: '20px' }}
            >
              <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>
                ACTIVE SESSIONS
              </Text>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
                  {sessions.loading ? <Spin size="small" /> : `${activeSessionCount} Sesi`}
                </Title>
                <DesktopOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                Sesi aktif akun saat ini
              </div>
            </Card>
          </Col>
        </Row>

        {/* System Summary Banner */}
        <Card title="Ringkasan Operasional EPMS" bordered style={{ borderRadius: '10px' }}>
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
            <Descriptions.Item label="Lingkungan Sistem">Enterprise Production-Ready Staging</Descriptions.Item>
            <Descriptions.Item label="Peran Otorisasi">SUPER_ADMIN (Pusat Kendali Sistem)</Descriptions.Item>
            <Descriptions.Item label="Status Database (MySQL)">
              {health.data?.probes?.find((p) => p.component.includes('MySQL')) ? (
                <Tag color="success">Terkoneksi & Siap Baca/Tulis</Tag>
              ) : (
                <Tag color="default">Memeriksa...</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Transactional Outbox Queue">
              {health.data?.probes?.find((p) => p.component.includes('Outbox')) ? (
                <Tag color="success">Sehat (DLQ Clear)</Tag>
              ) : (
                <Tag color="default">Memeriksa...</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Penyimpanan Berkas (Uploads)">
              {health.data?.probes?.find((p) => p.component.includes('Storage')) ? (
                <Tag color="success">Dapat Ditulis (Local/S3)</Tag>
              ) : (
                <Tag color="default">Memeriksa...</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Gerbang Notifikasi Real-time">
              {notifHealth.data?.services?.websocket?.status === 'ACTIVE' ? (
                <Tag color="success">WebSocket Aktif (/notifications)</Tag>
              ) : (
                <Tag color="warning">Dalam Pemeriksaan</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Quick Navigation Cards */}
        <Card title="Akses Cepat Modul Administrasi" bordered style={{ borderRadius: '10px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card
                hoverable
                style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}
                onClick={() => router.push('/admin/users')}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <TeamOutlined style={{ fontSize: '20px', color: '#1677ff' }} />
                    <Text strong style={{ fontSize: '15px' }}>
                      Users & Roles
                    </Text>
                  </Space>
                  <Paragraph type="secondary" style={{ fontSize: '13px', margin: 0 }}>
                    Kelola akun pengguna, penugasan role organisasi, dan hak akses sistem.
                  </Paragraph>
                  <Button type="link" style={{ padding: 0 }}>
                    Buka Modul &rarr;
                  </Button>
                </Space>
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card
                hoverable
                style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}
                onClick={() => router.push('/workflow')}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <NodeIndexOutlined style={{ fontSize: '20px', color: '#1677ff' }} />
                    <Text strong style={{ fontSize: '15px' }}>
                      Workflow Designer
                    </Text>
                  </Space>
                  <Paragraph type="secondary" style={{ fontSize: '13px', margin: 0 }}>
                    Kelola definisi alur kerja, node persetujuan proyek, dan versioning BPMN.
                  </Paragraph>
                  <Button type="link" style={{ padding: 0 }}>
                    Buka Modul &rarr;
                  </Button>
                </Space>
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card
                hoverable
                style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}
                onClick={() => router.push('/audit-trail')}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space>
                    <LineChartOutlined style={{ fontSize: '20px', color: '#1677ff' }} />
                    <Text strong style={{ fontSize: '15px' }}>
                      Audit Trail
                    </Text>
                  </Space>
                  <Paragraph type="secondary" style={{ fontSize: '13px', margin: 0 }}>
                    Tinjau catatan log audit, rekam jejak transaksi, dan riwayat aktivitas sistem.
                  </Paragraph>
                  <Button type="link" style={{ padding: 0 }}>
                    Buka Modul &rarr;
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </Card>
      </Space>
    );
  };

  // TAB 2: SYSTEM STATUS
  const renderSystemStatusTab = () => {
    const probeColumns = [
      {
        title: 'Komponen Sistem',
        dataIndex: 'component',
        key: 'component',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => renderStatusTag(status),
      },
      {
        title: 'Latensi Probe',
        dataIndex: 'latencyMs',
        key: 'latencyMs',
        render: (latency: number) => <Text>{latency} ms</Text>,
      },
      {
        title: 'Detail Diagnostik',
        dataIndex: 'details',
        key: 'details',
        render: (details: Record<string, any>) => {
          if (!details) return <Text type="secondary">-</Text>;
          return (
            <Space direction="vertical" size={2}>
              {Object.entries(details).map(([k, v]) => (
                <Text key={k} style={{ fontSize: '12px' }}>
                  <Text type="secondary">{k}:</Text> {String(v)}
                </Text>
              ))}
            </Space>
          );
        },
      },
    ];

    const sliSloColumns = [
      {
        title: 'Nama Metrik SLI/SLO',
        dataIndex: 'name',
        key: 'name',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: 'Target SLO',
        dataIndex: 'targetSlo',
        key: 'targetSlo',
      },
      {
        title: 'Realisasi SLI Saat Ini',
        dataIndex: 'currentSli',
        key: 'currentSli',
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => renderStatusTag(status),
      },
    ];

    const runbookColumns = [
      {
        title: 'Skenario Peringatan',
        dataIndex: 'alert',
        key: 'alert',
        render: (text: string) => <Text strong>{text}</Text>,
      },
      {
        title: 'Tingkat Bahaya',
        dataIndex: 'severity',
        key: 'severity',
        render: (sev: string) => {
          const s = String(sev || '').toUpperCase();
          const color = s === 'CRITICAL' ? 'red' : s === 'HIGH' ? 'orange' : 'blue';
          return <Tag color={color}>{sev}</Tag>;
        },
      },
      {
        title: 'Langkah Mitigasi',
        dataIndex: 'mitigation',
        key: 'mitigation',
      },
    ];

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Active Probes Card */}
        <Card
          title="Hasil Pemeriksaan Komponen Aktif (Component Health Probes)"
          bordered
          style={{ borderRadius: '10px' }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadHealth} loading={health.loading} size="small">
              Refresh Probe
            </Button>
          }
        >
          {health.error ? (
            <Alert message="Pemeriksaan Komponen Terkendala" description={health.error} type="error" showIcon />
          ) : (
            <Table
              dataSource={health.data?.probes || []}
              columns={probeColumns}
              rowKey="component"
              pagination={false}
              loading={health.loading}
              size="middle"
            />
          )}
        </Card>

        {/* Readiness Report Card */}
        <Card
          title="Laporan Kesiapan Operasional (Production Readiness Report)"
          bordered
          style={{ borderRadius: '10px' }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadReadiness} loading={readiness.loading} size="small">
              Refresh Kesiapan
            </Button>
          }
        >
          {readiness.error ? (
            <Alert message="Laporan Kesiapan Terkendala" description={readiness.error} type="warning" showIcon />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Status Kesiapan Operasional">
                  {renderStatusTag(readiness.data?.readinessStatus)}
                </Descriptions.Item>
                <Descriptions.Item label="Waktu Verifikasi Terakhir">
                  {readiness.data?.verifiedAt ? formatDateTime(readiness.data.verifiedAt) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Antrean Outbox Tertunda">
                  <Text strong>{readiness.data?.outboxTelemetry?.pendingQueue ?? 0} Dokumen</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Event Outbox Terpublikasi">
                  <Text strong>{readiness.data?.outboxTelemetry?.publishedCount ?? 0} Event</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Dead Letter Queue (DLQ)">
                  <Tag color={readiness.data?.outboxTelemetry?.failedCount === 0 ? 'success' : 'error'}>
                    {readiness.data?.outboxTelemetry?.dlqStatus || 'CLEAR'} ({readiness.data?.outboxTelemetry?.failedCount ?? 0} Gagal)
                  </Tag>
                </Descriptions.Item>
              </Descriptions>

              <Title level={5} style={{ marginTop: '12px' }}>
                Katalog Target SLI / SLO Sistem
              </Title>
              <Table
                dataSource={readiness.data?.sliSloSummary || []}
                columns={sliSloColumns}
                rowKey="name"
                pagination={false}
                loading={readiness.loading}
                size="small"
              />
            </Space>
          )}
        </Card>

        {/* Advanced Observability Collapse */}
        <Collapse
          style={{ background: '#fff', borderRadius: '10px' }}
          items={[
            {
              key: 'runbooks',
              label: (
                <Text strong style={{ fontSize: '14px' }}>
                  Indeks Runbook & Mitigasi Insiden Operasional
                </Text>
              ),
              children: (
                <Table
                  dataSource={readiness.data?.runbookIndex || []}
                  columns={runbookColumns}
                  rowKey="alert"
                  pagination={false}
                  size="small"
                />
              ),
            },
          ]}
        />
      </Space>
    );
  };

  // TAB 3: SECURITY & SESSIONS
  const renderSecuritySessionsTab = () => {
    const sessionColumns = [
      {
        title: 'ID Sesi',
        dataIndex: 'id',
        key: 'id',
        render: (id: string | number) => <Text code>#{id}</Text>,
      },
      {
        title: 'Perangkat / Peramban',
        dataIndex: 'user_agent',
        key: 'user_agent',
        render: (ua: string) => (
          <Space>
            <DesktopOutlined style={{ color: '#1677ff' }} />
            <div>
              <Text strong>{parseUserAgent(ua)}</Text>
              <div>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {ua.slice(0, 60)}...
                </Text>
              </div>
            </div>
          </Space>
        ),
      },
      {
        title: 'Alamat IP',
        dataIndex: 'ip_address',
        key: 'ip_address',
        render: (ip: string) => <Text code>{ip}</Text>,
      },
      {
        title: 'Aktivitas Terakhir',
        dataIndex: 'last_activity',
        key: 'last_activity',
        render: (date: string) => <Text>{formatDateTime(date)}</Text>,
      },
      {
        title: 'Status',
        dataIndex: 'is_active',
        key: 'is_active',
        render: (active: boolean) =>
          active ? <Tag color="success">Aktif</Tag> : <Tag color="default">Dicabut</Tag>,
      },
      {
        title: 'Aksi',
        key: 'action',
        render: (_: any, record: UserSessionItem) => (
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleRevokeSession(record.id)}
          >
            Cabut Sesi
          </Button>
        ),
      },
    ];

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          message="Manajemen Keamanan Sesi Multi-Perangkat (Sesi Aktif Saya)"
          description="Daftar seluruh sesi peramban dan perangkat yang sedang aktif menggunakan akun Anda. Anda dapat mencabut sesi tertentu yang tidak dikenali untuk menjaga integritas keamanan akun. Sesi saat ini dilindungi dengan rotasi token berkala."
          type="info"
          showIcon
          style={{ borderRadius: '8px' }}
        />

        <Card
          title={`Daftar Sesi Aktif (${sessions.data.length} Perangkat)`}
          bordered
          style={{ borderRadius: '10px' }}
          extra={
            <Space>
              <Button
                danger
                onClick={handleRevokeAllOtherSessions}
                disabled={sessions.data.length <= 1}
                size="small"
              >
                Cabut Semua Sesi Lainnya
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSessions} loading={sessions.loading} size="small">
                Refresh Sesi
              </Button>
            </Space>
          }
        >
          {sessions.error ? (
            <Alert message="Gagal Memuat Sesi" description={sessions.error} type="error" showIcon />
          ) : (
            <Table
              dataSource={sessions.data}
              columns={sessionColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              loading={sessions.loading}
              size="middle"
            />
          )}
        </Card>

        <Card title="Prinsip Keamanan Akun EPMS" bordered style={{ borderRadius: '10px' }}>
          <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Transmisi Token">HttpOnly, Secure, SameSite=Strict Cookie</Descriptions.Item>
            <Descriptions.Item label="Masa Berlaku Access Token">15 Menit (Rotasi Otomatis)</Descriptions.Item>
            <Descriptions.Item label="Identifikasi Perangkat">SHA-256 Device Fingerprint</Descriptions.Item>
            <Descriptions.Item label="Perlindungan Kredensial">Kredensial rahasia tidak pernah diekspos ke klien</Descriptions.Item>
          </Descriptions>
        </Card>
      </Space>
    );
  };

  // TAB 4: NOTIFICATION INFRASTRUCTURE
  const renderNotificationsTab = () => {
    const ws = notifHealth.data?.services?.websocket;
    const redis = notifHealth.data?.services?.redisIoAdapter;

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          message="Infrastruktur Pengiriman Notifikasi & Gateway Real-time"
          description="Status konektivitas kluster Socket.IO dan Redis IoAdapter yang mengelola pengiriman notifikasi instan ke seluruh antarmuka pengguna EPMS."
          type="info"
          showIcon
          style={{ borderRadius: '8px' }}
        />

        <Card
          title="Status Infrastruktur Notifikasi"
          bordered
          style={{ borderRadius: '10px' }}
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={loadNotifHealth}
              loading={notifHealth.loading}
              size="small"
            >
              Refresh Notifikasi
            </Button>
          }
        >
          {notifHealth.error ? (
            <Alert
              message="Pemeriksaan Infrastruktur Notifikasi Terkendala"
              description={notifHealth.error}
              type="error"
              showIcon
            />
          ) : (
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card
                  bordered
                  style={{ borderRadius: '8px', background: '#fafafa' }}
                  title={
                    <Space>
                      <BellOutlined style={{ color: '#1677ff' }} />
                      <Text strong>Gerbang WebSocket (Socket.IO)</Text>
                    </Space>
                  }
                >
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Status Gerbang">
                      {renderStatusTag(ws?.status || (notifHealth.data?.status === 'UP' ? 'ACTIVE' : 'DOWN'))}
                    </Descriptions.Item>
                    <Descriptions.Item label="Namespace Kanal">
                      <Text code>{ws?.namespace || '/notifications'}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Protokol">WebSocket wss:// & polling fallback</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>

              <Col xs={24} md={12}>
                <Card
                  bordered
                  style={{ borderRadius: '8px', background: '#fafafa' }}
                  title={
                    <Space>
                      <CloudServerOutlined style={{ color: '#1677ff' }} />
                      <Text strong>Redis IoAdapter (Sinkronisasi Multi-Node)</Text>
                    </Space>
                  }
                >
                  <Descriptions size="small" column={1}>
                    <Descriptions.Item label="Status Koneksi Adapter">
                      {renderStatusTag(redis?.status || (notifHealth.data?.status === 'UP' ? 'CONNECTED' : 'DOWN'))}
                    </Descriptions.Item>
                    <Descriptions.Item label="Port Layanan">
                      <Text code>{redis?.port || 6379}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Peran">Pub/Sub Broadcast Antar Pod Kontainer</Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>
          )}
        </Card>

        <Card title="Catatan Arsitektur Notifikasi" bordered style={{ borderRadius: '10px' }}>
          <Paragraph type="secondary" style={{ margin: 0, fontSize: '13px' }}>
            EPMS menggunakan arsitektur event-driven outbox relay terpusat. Event notifikasi dipublikasikan secara asinkron ke tabel <Text code>notifications</Text> dan disiarkan melalui gateway WebSocket. Konfigurasi preferensi pengiriman kanal lanjutan (Email SMTP, SMS, WhatsApp) akan diintegrasikan pada tahap berikutnya.
          </Paragraph>
        </Card>
      </Space>
    );
  };

  // TAB 5: ADMINISTRATION
  const renderAdministrationTab = () => {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          message="Pusat Kendali Administrasi Sistem EPMS"
          description="Akses langsung ke modul-modul tata kelola kanonikal. Fitur ini dirancang sebagai navigasi terpusat bagi SUPER_ADMIN tanpa menduplikasi logika bisnis masing-masing modul."
          type="info"
          showIcon
          style={{ borderRadius: '8px' }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
            >
              <div>
                <Space align="center" style={{ marginBottom: '12px' }}>
                  <TeamOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
                  <Title level={4} style={{ margin: 0 }}>
                    Users & Roles
                  </Title>
                </Space>
                <Paragraph type="secondary" style={{ fontSize: '13px' }}>
                  Kelola basis data pengguna, penugasan peran jabatan (SUPER_ADMIN, PM, Finance, Legal, Marketing), dan kontrol otorisasi tingkat peran.
                </Paragraph>
              </div>
              <Button type="primary" onClick={() => router.push('/admin/users')} style={{ marginTop: '16px' }}>
                Buka Users & Roles
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
            >
              <div>
                <Space align="center" style={{ marginBottom: '12px' }}>
                  <NodeIndexOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
                  <Title level={4} style={{ margin: 0 }}>
                    Workflow Designer
                  </Title>
                </Space>
                <Paragraph type="secondary" style={{ fontSize: '13px' }}>
                  Kelola definisi alur kerja kanonikal, visualizer BPMN 2.0, state diagram persetujuan proyek, dan versioning workflow terintegrasi.
                </Paragraph>
              </div>
              <Button type="primary" onClick={() => router.push('/workflow')} style={{ marginTop: '16px' }}>
                Buka Workflow Designer
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card
              bordered
              style={{ borderRadius: '10px', height: '100%' }}
              bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
            >
              <div>
                <Space align="center" style={{ marginBottom: '12px' }}>
                  <LineChartOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
                  <Title level={4} style={{ margin: 0 }}>
                    Audit Trail
                  </Title>
                </Space>
                <Paragraph type="secondary" style={{ fontSize: '13px' }}>
                  Tinjau jejak rekam log audit seluruh entitas sistem, verifikasi integritas transaksi finansial, dan pemantauan aktivitas pengguna.
                </Paragraph>
              </div>
              <Button type="primary" onClick={() => router.push('/audit-trail')} style={{ marginTop: '16px' }}>
                Buka Audit Trail
              </Button>
            </Card>
          </Col>
        </Row>
      </Space>
    );
  };

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: renderOverviewTab(),
    },
    {
      key: 'system_status',
      label: 'System Status',
      children: renderSystemStatusTab(),
    },
    {
      key: 'security_sessions',
      label: 'Security & Sessions',
      children: renderSecuritySessionsTab(),
    },
    {
      key: 'notifications',
      label: 'Notification Infrastructure',
      children: renderNotificationsTab(),
    },
    {
      key: 'administration',
      label: 'Administration',
      children: renderAdministrationTab(),
    },
  ];

  return (
    <div style={{ fontFamily: CANONICAL_FONT_FAMILY, padding: '0 8px 24px 8px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <Title level={3} style={{ fontSize: '24px', fontWeight: 600, lineHeight: '32px', margin: 0, color: '#0f172a' }}>
            System Settings
          </Title>
          <Text type="secondary" style={{ fontSize: '13px', color: '#64748b' }}>
            Administrasi, keamanan, dan status operasional sistem EPMS.
          </Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchAll(true)}
            loading={refreshing}
            type="default"
            style={{ borderRadius: '6px' }}
          >
            Refresh Status
          </Button>
        </Space>
      </div>

      {/* Main Tabs Hub */}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k)}
        items={tabItems}
        size="large"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
