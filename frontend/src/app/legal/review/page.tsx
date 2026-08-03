'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Spin, Tag, Space, Breadcrumb, Alert, Button, message, Tabs, Modal, Input, Empty, Collapse, Tooltip } from 'antd';

import { FilePdfOutlined, AuditOutlined, CheckCircleOutlined, FileSyncOutlined, ReloadOutlined, BookOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, ExpandAltOutlined } from '@ant-design/icons';

import { useSearchParams, useRouter } from 'next/navigation';
import { LegalService, AuthService } from '@/services';
import { io } from 'socket.io-client';
import { MainLayout } from '../../../components/MainLayout';
import { ProtectedRoute } from '../../../components/ProtectedRoute';
import { LegalTaskQueue, TaskQueueItem } from '../../../components/legal/LegalTaskQueue';
import { LegalWorkstationHeader } from '../../../components/legal/LegalWorkstationHeader';
import { GroupedLegalChecklist, ChecklistState } from '../../../components/legal/GroupedLegalChecklist';
import { LegalActivityCommentThread } from '../../../components/legal/LegalActivityCommentThread';
import { LegalVersionHistoryAttachments } from '../../../components/legal/LegalVersionHistoryAttachments';

const { Title, Text } = Typography;

export default function LegalReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryContractId = searchParams.get('contractId');
  const activeTab = searchParams.get('tab') || 'WAITING';

  const [pendingContracts, setPendingContracts] = useState<TaskQueueItem[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<number | undefined>(
    queryContractId ? Number(queryContractId) : undefined
  );
  
  const [s3Url, setS3Url] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [rawContractsData, setRawContractsData] = useState<any[]>([]);

  // State Checklist Reaktif
  const [checklist, setChecklist] = useState<ChecklistState>({
    nominal: false,
    paymentTerm: false,
    penalty: false,
    currency: false,
    sla: false,
    jurisdiction: false,
    signature: false,
    scope: false,
    deliverables: false,
    complianceCert: false,
  });

  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('1m lalu');

  // Revision Modal State
  const [isRevisionModalVisible, setIsRevisionModalVisible] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    message.config({ maxCount: 1, duration: 3 });
    fetchPendingContracts();

    const token = AuthService.getAccessToken();
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000/notifications', {
      transports: ['websocket'],
      auth: { token: `Bearer ${token}` }
    });

    socketInstance.emit('join-legal-room');

    const handleQueueUpdated = (payload: any) => {
      console.log('📢 Real-time update diterima:', payload);
      const ac = new AbortController();
      fetchPendingContracts(true, ac.signal);
    };

    socketInstance.on('legal.queue.updated', handleQueueUpdated);

    const handleContractDeleted = (data: any) => {
      console.log('📡 [LEGAL] Contract soft deleted via socket:', data);
      // Panggil fetchPendingContracts untuk memperbarui daftar kontrak di UI secara real-time
      const ac = new AbortController();
      fetchPendingContracts(true, ac.signal);
    };

    socketInstance.on('contract:soft_deleted', handleContractDeleted);

    return () => {
      socketInstance.off('legal.queue.updated', handleQueueUpdated);
      socketInstance.off('contract:soft_deleted', handleContractDeleted);
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      startPdfGenerationAndPolling(selectedContractId);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedContractId]);

  // Sinkronisasi selectedContractId saat berpindah tab
  useEffect(() => {
    if (pendingContracts.length === 0) return;

    const visibleContracts = pendingContracts.filter((item) => {
      if (activeTab === 'WAITING' && item.status !== 'WAITING') return false;
      if (activeTab === 'REVISION' && item.status !== 'REVISION') return false;
      if (activeTab === 'APPROVED' && item.status !== 'APPROVED') return false;
      return true;
    });

    if (visibleContracts.length > 0) {
      const isCurrentSelectedStillValid = visibleContracts.some(d => d.id === selectedContractId);
      if (!isCurrentSelectedStillValid) {
        setSelectedContractId(visibleContracts[0].id);
      }
    } else {
      setSelectedContractId(undefined);
    }
  }, [activeTab, pendingContracts]);

  // Reset checklist saat beralih kartu kontrak
  useEffect(() => {
    setChecklist({
      nominal: false,
      paymentTerm: false,
      penalty: false,
      currency: false,
      sla: false,
      jurisdiction: false,
      signature: false,
      scope: false,
      deliverables: false,
      complianceCert: false,
    });
    setAutosaveStatus('saved');
    setLastSavedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  }, [selectedContractId]);

  // Keyboard Shortcuts Global (Ctrl+S, Ctrl+Enter)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApprove();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [checklist]);

  const fetchPendingContracts = async (isSoftRefresh = false, signal?: AbortSignal) => {
    if (!isSoftRefresh) setLoadingContracts(true);
    try {
      const rawData = await LegalService.getPendingContracts(signal);
      
      // Saat mengambil daftar kontrak, urutkan yang punya file di atas (Prioritas SPK)
      rawData.sort((a: any, b: any) => {
        if (a.spk_file_url && !b.spk_file_url) return -1;
        if (!a.spk_file_url && b.spk_file_url) return 1;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });

      const mappedData: TaskQueueItem[] = rawData.map((item: any, idx: number) => ({
        id: item.id,
        contractNumber: item.contract_number || item.contractNumber || `CONT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(item.id).padStart(4, '0')}`,

        customerName: item.customer?.name || item.customerName || 'PT Customer',
        projectName: item.proposal?.tender?.title || item.proposal?.tender?.projectName || item.projectName || item.title || 'Pengadaan Server & Infrastructure EPMS',
        nominal: Number(item.contract_value || item.nominal || item.proposal?.proposed_amount || 0),
        priority: idx % 2 === 0 ? 'HIGH' : 'MEDIUM',
        slaDeadline: 'SLA: 24 Jam Sisa',
        status: item.legal_status === 'APPROVED' ? 'APPROVED' : (item.legal_status === 'REVISION' || item.legal_status === 'REJECTED') ? 'REVISION' : 'WAITING',
      }));

      setRawContractsData(rawData); // simpan raw data agar bisa baca spk_file_url

      setPendingContracts(mappedData);

      // Filter contracts berdasarkan activeTab agar auto-select sesuai dengan tab yang terbuka
      const visibleContracts = mappedData.filter((item) => {
        if (activeTab === 'WAITING' && item.status !== 'WAITING') return false;
        if (activeTab === 'REVISION' && item.status !== 'REVISION') return false;
        if (activeTab === 'APPROVED' && item.status !== 'APPROVED') return false;
        return true;
      });

      if (visibleContracts.length > 0) {
        // Cek apakah contract yang sedang dipilih masih ada di daftar terbaru YANG SEDANG TAMPIL
        const isCurrentSelectedStillValid = visibleContracts.some(d => d.id === selectedContractId);
        
        let targetId = visibleContracts[0].id;
        if (queryContractId && visibleContracts.some(d => d.id === Number(queryContractId))) {
          targetId = Number(queryContractId);
        } else if (selectedContractId && isCurrentSelectedStillValid) {
          targetId = selectedContractId;
        }

        setSelectedContractId(targetId);
        startPdfGenerationAndPolling(targetId, rawData);
      } else {
        setSelectedContractId(undefined);
      }
    } catch (err: any) {
      if (!isSoftRefresh) {
        setPendingContracts([]);
      }
    } finally {
      if (!isSoftRefresh) setLoadingContracts(false);
    }
  };

  const startPdfGenerationAndPolling = async (id: number, overrideRawData?: any[]) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    setIsPolling(false);
    setPdfReady(false);
    setLoadError(false);

    const dataSource = overrideRawData || rawContractsData;
    const rawContract = dataSource.find((c: any) => c.id === id);

    console.log('📄 [LEGAL] URL file yang akan ditampilkan:', rawContract?.spk_file_url);

    // PRIORITAS 1: Cek apakah contract sudah punya spk_file_url di database
    if (rawContract?.spk_file_url) {
      console.log('✅ [Legal] SPK URL dari DB ditemukan:', rawContract.spk_file_url);
      setIsPolling(false);
      setS3Url(rawContract.spk_file_url);
      return;
    }

    // PRIORITAS 2: Coba ambil langsung dari API contract via LegalService
    try {
      const contractData = await LegalService.getContract(id);
      console.log('📄 [LEGAL] URL file dari API contract:', contractData?.spk_file_url);

      if (contractData?.spk_file_url) {
        console.log('✅ [Legal] SPK URL dari API contract:', contractData.spk_file_url);
        setIsPolling(false);
        setS3Url(contractData.spk_file_url);
        return;
      }
    } catch (err) {
      // API contract detail 404 / tidak tersedia
    }

    // Jika spk_file_url null/undefined, tandai bahwa SPK belum diupload
    console.warn('⚠️ [Legal] SPK belum diupload untuk contract ID:', id);
    setIsPolling(false);
    setS3Url(null);
  };

  const pollJobStatus = (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 2;

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      try {
        const statusData = await LegalService.getPdfStatus(selectedContractId!);

        if (statusData.status === 'COMPLETED' && statusData.downloadUrl) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setIsPolling(false);
          setS3Url(statusData.downloadUrl);
        } else if (statusData.status === 'FAILED' || attempts >= maxAttempts) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          useFallbackSamplePdf();
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          useFallbackSamplePdf();
        }
      }
    }, 1000);
  };

  const useFallbackSamplePdf = () => {
    setIsPolling(false);
    setLoadError(true);
    message.warning('Dokumen SPK belum diupload atau tidak ditemukan. Silakan Marketing upload SPK terlebih dahulu.');
    setS3Url('/uploads/proposals/sample_contract_clean.pdf');
  };

  const isFormValid = () => {
    return (
      checklist.nominal &&
      checklist.paymentTerm &&
      checklist.penalty &&
      checklist.currency &&
      checklist.sla &&
      checklist.jurisdiction &&
      checklist.signature &&
      checklist.scope &&
      checklist.deliverables &&
      checklist.complianceCert
    );
  };

  const handleChecklistChange = (key: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: checked }));
    setAutosaveStatus('dirty');
  };

  // Action Handlers
  const handleSaveDraft = () => {
    setAutosaveStatus('saving');
    setTimeout(() => {
      setAutosaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      message.success('Draft peninjauan legal berhasil disimpan!');
    }, 500);
  };

  const handleApprove = async () => {
    if (!isFormValid()) {
      message.warning('Harap selesaikan seluruh 10 item checklist kepatuhan komersial, hukum, dan operasional terlebih dahulu!');
      return;
    }

    Modal.confirm({
      title: '📋 Konfirmasi Rilis Clearance Legal',
      content: `Apakah Anda yakin ingin menyetujui & merilis kontrak "${selectedContractObj?.contractNumber}"? Dokumen akan diteruskan ke Tim PMO untuk inisiasi proyek.`,
      okText: 'Setujui & Rilis ke PMO',
      cancelText: 'Batal',
      okButtonProps: { style: { backgroundColor: '#00b578', borderColor: '#00b578' } },
      onOk: async () => {
        const approvedCharterData = {
          id: Date.now(),
          tender_id: selectedContractObj?.id || selectedContractId || 101,
          project_code: selectedContractObj?.contractNumber || `PRJ-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          project_name: selectedContractObj?.projectName || selectedContractObj?.contractNumber || 'Pengadaan Server EPMS',
          customerName: selectedContractObj?.customerName || 'J&T Express',
          contract_total_value: selectedContractObj?.nominal || 50000000,
          marketingName: 'Anita Wijaya',
          status: 'PENDING_KICKOFF',
          created_at: new Date().toISOString(),
        };

        // PMO akan membaca dari API (GET /contracts?status=APPROVED)
        // localStorage.setItem dihapus.

        const uuid = crypto.randomUUID();
        const idempotencyKey = `idempotency:contract:${selectedContractId}:${uuid}`;
        
        // 1. Optimistic UI Update (LANGSUNG dieksekusi)
        setPendingContracts((prev) =>
          prev.map((c) => (c.id === selectedContractId ? { ...c, status: 'APPROVED', legalStatusText: 'VERIFIED' } : c))
        );
        router.push('/legal/review?tab=APPROVED', { scroll: false });

        // 2. Show Handover Modal immediately (Optimistic)
        Modal.success({
          title: '🚀 Handover ke PMO Berhasil!',
          content: (
            <div>
              <p>Kontrak <strong>#{approvedCharterData.project_code}</strong> telah disahkan oleh tim Legal.</p>
              <p style={{ color: '#059669', fontWeight: 600 }}>Dokumen telah diteruskan ke Antrean Inisiasi SPK di modul Project Operational.</p>
            </div>
          ),
          okText: 'Tutup',
          onOk: () => {
             // Opsional: Lakukan refresh jika diinginkan saat modal ditutup
          }
        });

        // 3. Panggil API secara Asinkron di Latar Belakang via LegalService
        LegalService.submitReview({
          contractId: selectedContractId!,
          action: 'APPROVED',
          notes: 'Legal Clearance Approved & Released to PMO'
        }, { idempotencyKey }).then(() => {
          // Jika sukses di backend, sinkronisasi data (Soft Re-fetch)
          const ac = new AbortController();
          fetchPendingContracts(true, ac.signal);
        }).catch((err) => {
          // Jika gagal, TAMPILKAN TOAST tapi JANGAN batalkan state UI (Optimistic Resilience)
          message.error('Gagal memproses persetujuan kontrak. Server mengembalikan pesan error (Data Mock Staging dipertahankan).');
        });
      }
    });
  };

  const handleApproveWithNotes = () => message.info('Membuka modal Setujui dengan Catatan Khusus');
  const handleRequestRevision = () => {
    setRevisionNotes('');
    setIsRevisionModalVisible(true);
  };

  const handleSubmitRevision = async () => {
    if (!revisionNotes || revisionNotes.trim().length < 20) {
      message.error('Alasan revisi wajib diisi secara rinci minimal 20 karakter!');
      return;
    }

    setIsSubmittingRevision(true);
    const uuid = crypto.randomUUID();
    const idempotencyKey = `idempotency:contract:${selectedContractId}:${uuid}`;
    
    // 1. Optimistic UI Update untuk Revisi
    setPendingContracts((prev) =>
      prev.map((c) => (c.id === selectedContractId ? { ...c, status: 'REVISION', legalStatusText: 'REVISION' } : c))
    );
    message.success('Catatan revisi berhasil dikirim ke tim Marketing!');
    setIsRevisionModalVisible(false);

    // 2. Lakukan request ke server via LegalService tanpa memblokir UI
    LegalService.submitReview({
      contractId: selectedContractId!,
      action: 'REVISION_REQUESTED',
      notes: revisionNotes
    }, { idempotencyKey }).then(() => {
      const ac = new AbortController();
      fetchPendingContracts(true, ac.signal);
    }).catch((err) => {
      message.error('Gagal memproses permintaan revisi. Server mengembalikan pesan error (Data Mock Staging dipertahankan).');
    }).finally(() => {
      setIsSubmittingRevision(false);
    });
  };

  const handleEscalate = () => message.warning('Membuka modal Eskalasi ke Direksi');
  const handleForward = () => message.info('Membuka modal Teruskan ke Senior Legal');
  const handleCancel = () => message.info('Peninjauan dibatalkan');

  const selectedContractObj = pendingContracts.find((c) => c.id === selectedContractId);
  const selectedRawContract = rawContractsData.find((c: any) => c.id === selectedContractId);
  const pdfUrl = selectedRawContract?.spk_file_url || s3Url;
  console.log('📄 [LEGAL] Memuat PDF dari URL:', pdfUrl);


  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL', 'DIRECTOR']}>
      <MainLayout>
        <div style={{ padding: '16px 24px', height: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#f4f6f9' }}>
          
          {/* Clean Modern Header */}
          <div style={{ marginBottom: 24, paddingBottom: 8 }}>
            <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Legal Review
            </Title>
            <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4, display: 'block' }}>
              Review dokumen kontrak sebelum proses persetujuan dan rilis.
            </Text>
          </div>

          <div style={{ display: 'flex', gap: '16px', flex: 1, overflow: 'hidden' }}>
            
            <aside style={{ width: '22%', flexShrink: 0, height: '100%', overflowY: 'auto', paddingRight: 4 }}>
              <LegalTaskQueue
                contracts={pendingContracts}
                selectedContractId={selectedContractId}
                onSelectContract={(id) => setSelectedContractId(id)}
                loading={loadingContracts}
              />
            </aside>

            <main style={{ width: '53%', flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
              
              {!selectedContractId ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  
                  <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)' }}>
                    <AuditOutlined style={{ fontSize: 36, color: '#0284c7' }} />
                  </div>

                  <Title level={4} style={{ color: '#0f172a', margin: '0 0 8px 0', fontWeight: 600 }}>
                    📄 Belum Ada Kontrak untuk Direview
                  </Title>

                  <Text style={{ fontSize: 14, color: '#64748b', maxWidth: 480, display: 'block', marginBottom: 28, lineHeight: 1.7 }}>
                    Silakan pilih kontrak dari antrean di sebelah kiri untuk menampilkannya di sini.
                  </Text>
                </div>
              ) : (

                <Card
                  title={
                    <Space>
                      <FilePdfOutlined style={{ color: '#ff4d4f' }} />
                      <Text strong style={{ fontSize: 13, color: '#1f2937' }}>
                        Pratinjau PDF — {selectedContractObj?.contractNumber || `CONT-${String(selectedContractId || 1).padStart(4, '0')}`}
                      </Text>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Tooltip title="Zoom Out"><Button size="small" icon={<ZoomOutOutlined />} /></Tooltip>
                      <Tooltip title="Zoom In"><Button size="small" icon={<ZoomInOutlined />} /></Tooltip>
                      <Tooltip title="Fit Width"><Button size="small" icon={<ExpandAltOutlined />} /></Tooltip>
                      <Tooltip title="Fullscreen"><Button size="small" icon={<FullscreenOutlined />} /></Tooltip>
                      {pdfReady ? (
                        <Tag color="success" icon={<CheckCircleOutlined />}>PDF Ready</Tag>
                      ) : (
                        <Tag color="processing" icon={<FileSyncOutlined spin />}>Generating...</Tag>
                      )}
                    </Space>
                  }
                  style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
                  bodyStyle={{ padding: 0, flex: 1, overflow: 'hidden', backgroundColor: '#ffffff', position: 'relative' }}
                >
                  {isPolling && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' }}>
                      <Spin size="large" tip="Memuat dokumen PDF..." />
                    </div>
                  )}

                  {loadError ? (
                    <div style={{ padding: 30, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                      <Alert
                        message="Gagal memuat dokumen"
                        description="Dokumen PDF tidak dapat dimuat atau terjadi batas waktu koneksi (timeout)."
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                      <Button icon={<ReloadOutlined />} type="primary" onClick={() => selectedContractId && startPdfGenerationAndPolling(selectedContractId)}>
                        Coba Muat Ulang
                      </Button>
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      title="PDF Viewer"
                      width="100%"
                      height="100%"
                      style={{ border: 'none' }}
                      className="border rounded-lg"
                      onLoad={() => {
                        setPdfReady(true);
                        console.log('✅ [LEGAL] PDF berhasil dimuat');
                      }}
                      onError={(e) => {
                        console.error('❌ [LEGAL] Gagal memuat PDF:', pdfUrl);
                        setLoadError(true);
                        setPdfReady(false);
                      }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fffbe6', padding: 24, textAlign: 'center' }}>
                      <FilePdfOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
                      <Title level={5} style={{ margin: 0, color: '#d48800' }}>⚠️ SPK belum diupload untuk kontrak ini.</Title>
                      <Text type="secondary" style={{ fontSize: 13, marginTop: 8, maxWidth: 360 }}>
                        Dokumen SPK untuk kontrak ini belum diunggah oleh tim Marketing.
                      </Text>
                    </div>
                  )}
                </Card>
              )}
            </main>

            <aside style={{ width: '25%', flexShrink: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: 4 }}>
              {selectedContractId && (
                <>
                  <LegalWorkstationHeader
                    contractNumber={selectedContractObj?.contractNumber || `CONT-${String(selectedContractId || 1).padStart(4, '0')}`}
                    customerName={selectedContractObj?.customerName || '-'}
                    projectName={selectedContractObj?.projectName || '-'}
                    nominal={selectedContractObj?.nominal || 0}
                    priority={selectedContractObj?.priority || 'MEDIUM'}
                    slaDeadline={selectedContractObj?.slaDeadline || 'SLA: 24 Jam Sisa'}
                    status={selectedContractObj?.status || 'WAITING'}
                    isFormValid={isFormValid()}
                    autosaveStatus={autosaveStatus}
                    lastSavedTime={lastSavedTime}
                    onSaveDraft={handleSaveDraft}
                    onApprove={handleApprove}
                    onApproveWithNotes={handleApproveWithNotes}
                    onRequestRevision={handleRequestRevision}
                    onEscalate={handleEscalate}
                    onForward={handleForward}
                    onCancel={handleCancel}
                  />

                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                    <GroupedLegalChecklist
                      checklist={checklist}
                      onChangeChecklist={handleChecklistChange}
                    />
                  </div>

                  <Collapse style={{ borderRadius: 8, backgroundColor: '#ffffff', border: '1px solid #dee0e3' }}>
                    <Collapse.Panel header={<Text strong style={{ fontSize: 13 }}>Diskusi & Riwayat (Chat-Ops)</Text>} key="1">
                      <Tabs
                        defaultActiveKey="discussion"
                        size="small"
                        items={[
                          {
                            key: 'discussion',
                            label: 'Diskusi',
                            children: <LegalActivityCommentThread contractId={selectedContractId} />,
                          },
                          {
                            key: 'versions',
                            label: 'Lampiran',
                            children: <LegalVersionHistoryAttachments contractId={selectedContractId} />,
                          },
                        ]}
                      />
                    </Collapse.Panel>
                  </Collapse>
                </>
              )}
            </aside>
          </div>
        </div>

        <Modal
          title={
            <Space>
              <Text strong style={{ color: '#d97706', fontSize: 15 }}>⚠️ Permintaan Revisi Kontrak ke Marketing</Text>
            </Space>
          }
          open={isRevisionModalVisible}
          onOk={handleSubmitRevision}
          onCancel={() => setIsRevisionModalVisible(false)}
          okText="Kirim Catatan Revisi"
          cancelText="Batal"
          confirmLoading={isSubmittingRevision}
          okButtonProps={{ style: { backgroundColor: '#d97706', borderColor: '#d97706' } }}
        >
          <div style={{ padding: '8px 0' }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Tuliskan alasan revisi secara spesifik (pasal/klausul yang perlu diperbaiki oleh tim Marketing):
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="Contoh: Klausul denda keterlambatan pada pasal 4 ayat 2 belum mencantumkan besaran 1‰ per hari. Harap perbaiki sebelum rilis."
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              maxLength={500}
              showCount
            />
            {revisionNotes && revisionNotes.trim().length < 20 && (
              <Text type="danger" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                ⚠️ Catatan revisi minimal 20 karakter ({revisionNotes.trim().length}/20).
              </Text>
            )}
          </div>
        </Modal>
      </MainLayout>
    </ProtectedRoute>
  );
}
