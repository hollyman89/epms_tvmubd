"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Tag, Tooltip, message, Space, Modal, Tabs, Typography, Card } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  StopOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
  MobileOutlined,
  DesktopOutlined,
  AppleOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  getWebPushStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  WebPushStatus,
  getDevicePlatform,
} from '@/lib/webPushClient';

const { Text, Paragraph } = Typography;

export interface PushNotificationToggleProps {
  compact?: boolean;
  onStatusChange?: (status: WebPushStatus) => void;
  showGuideButton?: boolean;
}

export const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({
  compact = false,
  onStatusChange,
  showGuideButton = false,
}) => {
  const [status, setStatus] = useState<WebPushStatus>('INACTIVE');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Modals state
  const [preModalOpen, setPreModalOpen] = useState<boolean>(false);
  const [guideModalOpen, setGuideModalOpen] = useState<boolean>(false);
  const [iosModalOpen, setIosModalOpen] = useState<boolean>(false);
  const [guideDefaultTab, setGuideDefaultTab] = useState<string>('android');

  const platform = typeof window !== 'undefined' ? getDevicePlatform() : 'desktop';

  // Stable ref for onStatusChange to prevent hook dependency churn
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  // Status check is read-only: strictly DO NOT invoke onStatusChange here to avoid re-render loops
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      const current = await getWebPushStatus({ verifyWithBackend: true });
      setStatus(current);
    } catch {
      setStatus('INACTIVE');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const executeSubscribe = async () => {
    try {
      setActionLoading(true);
      setPreModalOpen(false);
      const res = await subscribeToWebPush();
      if (res.success) {
        message.success('Notifikasi Web Push berhasil diaktifkan untuk perangkat ini!');
        setStatus('ACTIVE');
        onStatusChangeRef.current?.('ACTIVE');
      } else {
        if (res.error?.includes('Layar Utama')) {
          setIosModalOpen(true);
        } else {
          message.warning(res.error || 'Gagal mengaktifkan notifikasi.');
        }
        refreshStatus();
      }
    } catch (err: any) {
      message.error(err?.message || 'Terjadi kesalahan saat mengaktifkan notifikasi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubscribeClick = () => {
    if (status === 'IOS_PWA_REQUIRED') {
      setIosModalOpen(true);
      return;
    }
    // Show gentle guidance modal before invoking native browser prompt
    setPreModalOpen(true);
  };

  const handleUnsubscribe = async () => {
    Modal.confirm({
      title: 'Nonaktifkan Notifikasi Push di Perangkat Ini?',
      icon: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />,
      content:
        'Setelah dinonaktifkan, perangkat ini tidak akan lagi menerima pemberitahuan instan saat ada tugas baru atau update persetujuan.',
      okText: 'Ya, Nonaktifkan',
      okType: 'danger',
      cancelText: 'Batal',
      onOk: async () => {
        try {
          setActionLoading(true);
          const res = await unsubscribeFromWebPush();
          if (res.success) {
            message.info('Notifikasi Web Push telah dinonaktifkan untuk perangkat ini.');
            setStatus('INACTIVE');
            onStatusChangeRef.current?.('INACTIVE');
          } else {
            message.error(res.error || 'Gagal menonaktifkan notifikasi.');
          }
        } catch (err: any) {
          message.error(err?.message || 'Terjadi kesalahan saat menonaktifkan notifikasi.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const openPermissionGuide = () => {
    setGuideDefaultTab(platform === 'android' ? 'android' : 'desktop');
    setGuideModalOpen(true);
  };

  // 1. Loading State (renders button dimensions and spinner to prevent DOM layout shift)
  if (loading) {
    return (
      <Button
        size="small"
        loading
        disabled
        style={{
          fontSize: 12,
          height: compact ? 26 : 28,
          borderRadius: 6,
          fontWeight: 500,
        }}
      >
        {compact ? 'Memeriksa...' : 'Memeriksa Status...'}
      </Button>
    );
  }

  // 2. Unsupported Environment State
  if (status === 'UNSUPPORTED') {
    return (
      <Tooltip title="Browser atau lingkungan ini tidak mendukung Web Push API standar (gunakan Chrome, Edge, Safari 16.4+, atau Firefox)">
        <Tag color="default" style={{ fontSize: 11, margin: 0 }}>
          Push Tidak Didukung
        </Tag>
      </Tooltip>
    );
  }

  // 3. iOS PWA Required State
  if (status === 'IOS_PWA_REQUIRED') {
    return (
      <>
        <Space direction="horizontal" size={compact ? 4 : 8}>
          <Tag
            icon={<AppleOutlined />}
            color="warning"
            style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}
            onClick={() => setIosModalOpen(true)}
          >
            {compact ? 'Perlu Pasang di HP' : 'Perlu Tambah ke Layar Utama'}
          </Tag>
          <Button
            type="link"
            size="small"
            onClick={() => setIosModalOpen(true)}
            style={{ fontSize: 11, padding: 0, height: 22 }}
          >
            Petunjuk iOS
          </Button>
        </Space>

        {/* Modal Guidance iOS */}
        <Modal
          title={
            <Space>
              <AppleOutlined style={{ color: '#0f172a' }} />
              <span>Panduan Notifikasi Push di iPhone / iPad</span>
            </Space>
          }
          open={iosModalOpen}
          onOk={() => setIosModalOpen(false)}
          cancelButtonProps={{ style: { display: 'none' } }}
          okText="Mengerti"
          centered
        >
          <div style={{ marginTop: 16 }}>
            <Paragraph style={{ color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
              Sistem operasi Apple iOS (versi 16.4+) mewajibkan aplikasi web ditambahkan ke Layar Utama
              agar dapat menerima notifikasi push. Ikuti 3 langkah mudah berikut:
            </Paragraph>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <Card size="small" style={{ borderRadius: 8, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Text strong style={{ color: '#1e293b' }}>Langkah 1: Buka Menu Bagikan (Share)</Text>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Buka EPMS melalui browser <b>Safari</b>, lalu ketuk ikon <b>Bagikan (Share / kotak tanda panah ke atas)</b> pada bar menu bawah layar HP Anda.
                </div>
              </Card>

              <Card size="small" style={{ borderRadius: 8, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Text strong style={{ color: '#1e293b' }}>Langkah 2: Tambahkan ke Layar Utama</Text>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Gulir ke bawah pada menu yang muncul, lalu pilih <b>"Tambahkan ke Layar Utama" (Add to Home Screen)</b>. Kemudian ketuk <b>Tambah</b> di pojok kanan atas.
                </div>
              </Card>

              <Card size="small" style={{ borderRadius: 8, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Text strong style={{ color: '#1e293b' }}>Langkah 3: Buka Aplikasi & Aktifkan Notifikasi</Text>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Buka aplikasi <b>EPMS</b> langsung dari ikon baru di Layar Utama HP Anda, login kembali, lalu aktifkan notifikasi di menu ini.
                </div>
              </Card>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  // 4. Permission Denied State
  if (status === 'PERMISSION_DENIED') {
    return (
      <>
        <Space direction="horizontal" size={compact ? 4 : 8}>
          <Tooltip title="Izin notifikasi diblokir di pengaturan browser Anda. Klik untuk panduan membuka blokir.">
            <Tag
              icon={<StopOutlined />}
              color="error"
              style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}
              onClick={openPermissionGuide}
            >
              Izin Diblokir
            </Tag>
          </Tooltip>
          <Button
            type="link"
            size="small"
            danger
            onClick={openPermissionGuide}
            style={{ fontSize: 11, padding: 0, height: 22 }}
          >
            Buka Izin
          </Button>
        </Space>

        {/* Modal Guidance Unblock Permission */}
        <Modal
          title={
            <Space>
              <StopOutlined style={{ color: '#ef4444' }} />
              <span>Cara Membuka Izin Notifikasi yang Diblokir</span>
            </Space>
          }
          open={guideModalOpen}
          onOk={() => {
            setGuideModalOpen(false);
            refreshStatus();
          }}
          cancelButtonProps={{ style: { display: 'none' } }}
          okText="Saya Sudah Mengubah Setelan"
          centered
        >
          <div style={{ marginTop: 12 }}>
            <Paragraph style={{ color: '#475569', fontSize: 13 }}>
              Izin notifikasi saat ini disetel ke <b>"Blokir"</b> pada browser Anda. Browser tidak akan memunculkan dialog izin otomatis hingga setelan ini diubah secara manual:
            </Paragraph>
            <Tabs
              defaultActiveKey={guideDefaultTab}
              items={[
                {
                  key: 'android',
                  label: (
                    <span>
                      <MobileOutlined /> HP Android (Chrome)
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155' }}>
                      <div><b>1.</b> Ketuk ikon <b>gembok / setelan</b> di samping alamat web (URL) di bagian atas layar HP Anda.</div>
                      <div><b>2.</b> Pilih menu <b>"Izin" (Permissions)</b> atau <b>"Setelan situs"</b>.</div>
                      <div><b>3.</b> Ketuk <b>"Notifikasi"</b> dan ubah pilihannya menjadi <b>"Izinkan" (Allow)</b>.</div>
                      <div><b>4.</b> Kembali ke halaman ini lalu ketuk tombol <i>"Saya Sudah Mengubah Setelan"</i> di bawah.</div>
                    </div>
                  ),
                },
                {
                  key: 'desktop',
                  label: (
                    <span>
                      <DesktopOutlined /> Komputer / Laptop
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#334155' }}>
                      <div><b>1.</b> Klik ikon <b>gembok / slider</b> di samping kiri alamat web (URL) browser Anda.</div>
                      <div><b>2.</b> Cari opsi <b>Notifikasi (Notifications)</b> dan ubah toggle ke posisi <b>Izinkan (Allow)</b>.</div>
                      <div><b>3.</b> Muat ulang (Refresh / F5) halaman aplikasi EPMS.</div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Modal>
      </>
    );
  }

  // 5. Active State
  if (status === 'ACTIVE') {
    return (
      <Space direction="horizontal" size={compact ? 4 : 8}>
        <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11, margin: 0 }}>
          {compact ? 'Push Aktif' : 'Push Aktif di HP Ini'}
        </Tag>
        <Button
          type="text"
          size="small"
          danger
          loading={actionLoading}
          onClick={handleUnsubscribe}
          style={{ fontSize: 11, padding: '0 4px', height: 22 }}
        >
          Nonaktifkan
        </Button>
      </Space>
    );
  }

  // 6. Inactive State (Default Ready to Activate)
  return (
    <>
      <Space direction="horizontal" size={compact ? 4 : 8}>
        <Button
          type="primary"
          size="small"
          icon={<BellOutlined />}
          loading={actionLoading}
          onClick={handleSubscribeClick}
          style={{
            fontSize: 12,
            height: compact ? 26 : 28,
            borderRadius: 6,
            background: '#2563eb',
            borderColor: '#2563eb',
            fontWeight: 500,
          }}
        >
          {compact ? 'Aktifkan Push' : 'Aktifkan Notifikasi Push'}
        </Button>
        {showGuideButton && (
          <Tooltip title="Pelajari cara kerja dan manfaat notifikasi push">
            <Button
              type="text"
              size="small"
              icon={<QuestionCircleOutlined style={{ color: '#64748b' }} />}
              onClick={() => setPreModalOpen(true)}
            />
          </Tooltip>
        )}
      </Space>

      {/* Pre-Prompt Activation Guidance Modal */}
      <Modal
        title={
          <Space>
            <BellOutlined style={{ color: '#2563eb' }} />
            <span>Aktifkan Notifikasi Web Push</span>
          </Space>
        }
        open={preModalOpen}
        onOk={executeSubscribe}
        onCancel={() => setPreModalOpen(false)}
        confirmLoading={actionLoading}
        okText="Lanjutkan & Izinkan"
        cancelText="Nanti Saja"
        centered
        okButtonProps={{ style: { background: '#2563eb', borderRadius: 6 } }}
      >
        <div style={{ marginTop: 12 }}>
          <Paragraph style={{ color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
            Dengan mengaktifkan notifikasi push, Anda akan menerima pemberitahuan instan langsung ke perangkat ini
            saat ada:
          </Paragraph>
          <ul style={{ paddingLeft: 20, color: '#475569', fontSize: 13, lineHeight: 1.8 }}>
            <li>Tugas baru (To-Do) yang ditugaskan kepada Anda</li>
            <li>Pengajuan dokumen yang membutuhkan persetujuan Anda</li>
            <li>Revisi tender, operational plan, atau invoice</li>
          </ul>
          <Card
            size="small"
            style={{
              backgroundColor: '#eff6ff',
              borderColor: '#bfdbfe',
              borderRadius: 8,
              marginTop: 14,
            }}
          >
            <Space align="start">
              <InfoCircleOutlined style={{ color: '#2563eb', marginTop: 2 }} />
              <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
                <b>Perhatian:</b> Setelah menekan tombol <b>"Lanjutkan & Izinkan"</b>, browser Anda akan menampilkan dialog izin notifikasi. Silakan pilih <b>"Izinkan" (Allow)</b>.
              </div>
            </Space>
          </Card>
        </div>
      </Modal>
    </>
  );
};
