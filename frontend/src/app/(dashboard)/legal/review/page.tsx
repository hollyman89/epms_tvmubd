'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Card, Typography, Spin, Tag, Space, Alert, Button, message, Tabs, Modal, Input, Collapse, Tooltip } from 'antd';

import { FilePdfOutlined, AuditOutlined, CheckCircleOutlined, FileSyncOutlined, ReloadOutlined, ZoomInOutlined, ZoomOutOutlined, FullscreenOutlined, ExpandAltOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

import { useSearchParams, useRouter } from 'next/navigation';
import { LegalService } from '@/services';
import { streamSecureContractSpk } from '@/lib/fileDelivery';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useSocket } from '@/context/SocketProvider';
import { LegalTaskQueue, TaskQueueItem } from '@/components/legal/LegalTaskQueue';
import { LegalWorkstationHeader } from '@/components/legal/LegalWorkstationHeader';
import { GroupedLegalChecklist, ChecklistState } from '@/components/legal/GroupedLegalChecklist';
import { LegalActivityCommentThread } from '@/components/legal/LegalActivityCommentThread';
import { LegalVersionHistoryAttachments } from '@/components/legal/LegalVersionHistoryAttachments';

const { Title, Text } = Typography;

function LegalReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryContractId = searchParams.get('contractId');
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'WAITING');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      if (['WAITING', 'REVISION', 'APPROVED', 'ALL'].includes(tabParam.toUpperCase())) {
        setActiveTab(tabParam.toUpperCase());
      }
      const cleanUrl = queryContractId ? `/legal/review?contractId=${queryContractId}` : '/legal/review';
      router.replace(cleanUrl, { scroll: false });
    }
  }, [searchParams, router, queryContractId]);

  const [isQueueCollapsed, setIsQueueCollapsed] = useState(false);
  const [pendingContracts, setPendingContracts] = useState<TaskQueueItem[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<number | undefined>(
    queryContractId ? Number(queryContractId) : undefined
  );
  
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
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

  const { notificationSocket } = useSocket();

  useEffect(() => {
    message.config({ maxCount: 1, duration: 3 });
    fetchPendingContracts();

    if (!notificationSocket) return;

    notificationSocket.emit('join-legal-room');

    const handleQueueUpdated = (payload: any) => {
      console.log('[LEGAL] Real-time update diterima:', payload);
      const ac = new AbortController();
      fetchPendingContracts(true, ac.signal);
    };

    notificationSocket.on('legal.queue.updated', handleQueueUpdated);

    return () => {
      notificationSocket.off('legal.queue.updated', handleQueueUpdated);
    };
  }, [notificationSocket]);

  useEffect(() => {
    if (selectedContractId) {
      startPdfGenerationAndPolling(selectedContractId);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl);
      }
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
        status: item.legal_status === 'APPROVED' ? 'APPROVED' : (['REVISION', 'REVISION_REQUESTED', 'REJECTED'].includes(item.legal_status) || item.status === 'REVISION_NEEDED') ? 'REVISION' : 'WAITING',
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
    setIsPolling(true);
    setPdfReady(false);
    setLoadError(false);

    // Revoke previous blob URL to prevent memory leaks
    if (pdfBlobUrl) {
      window.URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }

    try {
      console.log('[LEGAL] Memuat SPK via secure endpoint untuk contract ID:', id);
      const { objectUrl } = await streamSecureContractSpk(id);
      setPdfBlobUrl(objectUrl);
      setPdfReady(true);
      setIsPolling(false);
      console.log('[LEGAL] SPK berhasil dimuat via secure blob');
    } catch (err: any) {
      console.warn('[LEGAL] Dokumen SPK belum diunggah atau tidak ditemukan untuk contract ID:', id);
      setIsPolling(false);
      setLoadError(true);
      setPdfReady(false);
    }
  };

  const pollJobStatus = (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 2;

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      try {
        const statusData = await LegalService.getPdfStatus(selectedContractId!);

        if (statusData.status === 'COMPLETED' && selectedContractId) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          startPdfGenerationAndPolling(selectedContractId);
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
    if (selectedContractObj?.status === 'REVISION') {
      message.warning('Dokumen revisi belum diperbarui oleh Marketing.');
      return;
    }

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

        try {
          // 1. Panggil API secara Asinkron via LegalService terlebih dahulu
          await LegalService.submitReview({
            contractId: selectedContractId!,
            legalStatus: 'APPROVED',
            legalNotes: 'Legal Clearance Approved & Released to PMO'
          } as any, { idempotencyKey });

          // 2. Update UI State HANYA SETELAH API BERHASIL (HTTP 201 Success)
          setPendingContracts((prev) =>
            prev.map((c) => (c.id === selectedContractId ? { ...c, status: 'APPROVED', legalStatusText: 'VERIFIED' } : c))
          );
          router.push('/legal/review?tab=APPROVED', { scroll: false });

          // 3. Tampilkan Modal Sukses Handover
          Modal.success({
            title: '🚀 Handover ke PMO Berhasil!',
            content: (
              <div>
                <p>Kontrak <strong>#{approvedCharterData.project_code}</strong> telah disahkan oleh tim Legal.</p>
                <p style={{ color: '#059669', fontWeight: 600 }}>Dokumen telah diteruskan ke Antrean Inisiasi SPK di modul Project Operational.</p>
              </div>
            ),
            okText: 'Tutup',
            onOk: () => {}
          });

          const ac = new AbortController();
          fetchPendingContracts(true, ac.signal);
        } catch (err: any) {
          // 4. Jika API gagal, batalkan perpindahan state dan tampilkan pesan error
          const errMsg = err?.response?.data?.message || err?.message || 'Gagal memproses persetujuan kontrak.';
          message.error(`Gagal memproses persetujuan kontrak: ${Array.isArray(errMsg) ? errMsg.join(', ') : errMsg}`);
        }
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
      legalStatus: 'REVISION_REQUESTED',
      legalNotes: revisionNotes
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
  const pdfUrl = pdfBlobUrl;
  console.log('[LEGAL] Memuat PDF dari URL:', pdfUrl);


  const countWaiting = pendingContracts.filter((c) => c.status === 'WAITING').length;
  const countRevision = pendingContracts.filter((c) => c.status === 'REVISION').length;
  const countApproved = pendingContracts.filter((c) => c.status === 'APPROVED').length;

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'LEGAL', 'DIRECTOR']}>
      <div style={{ padding: '16px 24px', height: 'calc(100vh - 64px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: '#f4f6f9' }}>
        
        {/* Clean Modern Header with Live KPI Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Legal Review
            </Title>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 1, display: 'block' }}>
              Review dokumen kontrak sebelum proses persetujuan dan rilis.
            </Text>
          </div>

          {/* Real-time Dynamic KPI Summary Cards */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: '5px 12px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1677ff' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', color: '#64748b', lineHeight: 1.1 }}>
                  Menunggu Review
                </Text>
                <Text strong style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.2 }}>{countWaiting}</Text>
              </div>
            </div>

            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: '5px 12px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff8800' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', color: '#64748b', lineHeight: 1.1 }}>
                  Butuh Revisi
                </Text>
                <Text strong style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.2 }}>{countRevision}</Text>
              </div>
            </div>

            <div style={{ 
              background: '#ffffff', 
              border: '1px solid #e2e8f0', 
              borderRadius: 8, 
              padding: '5px 12px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b578' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', color: '#64748b', lineHeight: 1.1 }}>
                  Disetujui
                </Text>
                <Text strong style={{ fontSize: 15, color: '#0f172a', lineHeight: 1.2 }}>{countApproved}</Text>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: isQueueCollapsed ? '0px' : '16px', flex: 1, overflow: 'hidden', position: 'relative' }}>
          
          {isQueueCollapsed && (
            <Tooltip title="Tampilkan Antrean Legal" placement="right">
              <Button
                type="primary"
                shape="circle"
                icon={<MenuUnfoldOutlined style={{ fontSize: 16 }} />}
                onClick={() => setIsQueueCollapsed(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 40,
                  boxShadow: '0 4px 12px rgba(22, 119, 255, 0.35)',
                  backgroundColor: '#1677ff',
                  borderColor: '#1677ff',
                }}
              />
            </Tooltip>
          )}

          <aside style={{
            width: isQueueCollapsed ? '0px' : '310px',
            opacity: isQueueCollapsed ? 0 : 1,
            pointerEvents: isQueueCollapsed ? 'none' : 'auto',
            flexShrink: 0,
            height: '100%',
            overflowY: 'auto',
            paddingRight: isQueueCollapsed ? '0px' : '4px',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <LegalTaskQueue
              contracts={pendingContracts}
              selectedContractId={selectedContractId}
              onSelectContract={(id) => setSelectedContractId(id)}
              loading={loadingContracts}
              activeTab={activeTab}
              onTabChange={(key) => setActiveTab(key)}
              isCollapsed={isQueueCollapsed}
              onToggleCollapse={() => setIsQueueCollapsed((prev) => !prev)}
            />
          </aside>

          <main style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            
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
                    <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                      Pratinjau Dokumen — {selectedContractObj?.contractNumber || `CONT-${String(selectedContractId || 1).padStart(4, '0')}`}
                    </span>
                  </Space>
                }
                extra={
                  <Space size={6}>
                    <Tooltip title="Zoom Out"><Button size="small" icon={<ZoomOutOutlined />} /></Tooltip>
                    <Tooltip title="Zoom In"><Button size="small" icon={<ZoomInOutlined />} /></Tooltip>
                    <Tooltip title="Fit Width"><Button size="small" icon={<ExpandAltOutlined />} /></Tooltip>
                    <Tooltip title="Fullscreen"><Button size="small" icon={<FullscreenOutlined />} /></Tooltip>
                    {pdfReady ? (
                      <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontWeight: 600, borderRadius: 6 }}>PDF Ready</Tag>
                    ) : (
                      <Tag color="processing" icon={<FileSyncOutlined spin />} style={{ margin: 0, fontWeight: 600, borderRadius: 6 }}>Generating...</Tag>
                    )}
                  </Space>
                }
                headStyle={{
                  backgroundColor: '#ffffff',
                  padding: '10px 16px',
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  borderBottom: '1px solid #e2e8f0',
                  minHeight: 'auto'
                }}
                style={{ borderRadius: 10, border: '1px solid #dee0e3', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
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
                ) : pdfBlobUrl ? (
                  <iframe
                    src={pdfBlobUrl}
                    title="PDF Viewer"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    className="border rounded-lg"
                    onLoad={() => {
                      setPdfReady(true);
                      console.log('[LEGAL] PDF berhasil dimuat');
                    }}
                    onError={(e) => {
                      console.error('[LEGAL] Gagal memuat PDF');
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

          <aside style={{ width: '370px', flexShrink: 0, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingLeft: 4 }}>
            {selectedContractId && (
              <>
                {/* 1. RINGKASAN KONTRAK & 2. AKSI REVIEW */}
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

                {/* 3. CHECKLIST REVIEW */}
                <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #dee0e3', padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <GroupedLegalChecklist
                    checklist={checklist}
                    onChangeChecklist={handleChecklistChange}
                  />
                </div>

                {/* 4. DISKUSI & RIWAYAT */}
                <Collapse style={{ borderRadius: 10, backgroundColor: '#ffffff', border: '1px solid #dee0e3', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <Collapse.Panel header={<Text strong style={{ fontSize: 13, color: '#0f172a' }}>Diskusi & Riwayat (Chat-Ops)</Text>} key="1">
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
      </div>
    </ProtectedRoute>
  );
}

export default function LegalReviewPage() {
  return (
    <Suspense fallback={<Spin size="large" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }} />}>
      <LegalReviewContent />
    </Suspense>
  );
}
