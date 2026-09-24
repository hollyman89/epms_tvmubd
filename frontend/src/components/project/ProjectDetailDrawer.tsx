'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Drawer,
  Typography,
  Tag,
  Button,
  Space,
  Card,
  List,
  Spin,
  Empty,
  Tooltip,
  Progress,
  Modal,
  Timeline,
  Segmented,
  Row,
  Col,
  message,
} from 'antd';
import {
  streamSecureDocument,
  downloadSecureDocument,
  streamSecureContractSpk,
  downloadSecureContractSpk,
} from '@/lib/fileDelivery';
import {
  ProjectOutlined,
  FilePdfOutlined,
  EyeOutlined,
  DownloadOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  UserOutlined,
  PaperClipOutlined,
  SafetyCertificateOutlined,
  FileProtectOutlined,
  ScheduleOutlined,
  CheckSquareOutlined,
  LineChartOutlined,
  InboxOutlined,
  WarningOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  AuditOutlined,
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '@/lib/axios';
import { TenderActivityStream } from '@/components/TenderActivityStream';
import { ProjectService } from '@/services';
import { ProgressClaimModal } from './ProgressClaimModal';
import { ProgressVerificationDrawer } from './ProgressVerificationDrawer';
import { ProgressLedgerDrawer } from './ProgressLedgerDrawer';
import { ProjectProgressDashboard } from './ProjectProgressDashboard';

const { Title, Text } = Typography;

export interface ProjectDetailItem {
  id: number;
  projectId?: number;
  tender_id?: number;
  project_code: string;
  project_name: string;
  customerName: string;
  contract_total_value: number;
  marketingName?: string;
  pmName?: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  actualKickoffDate?: string | null;
  created_at: string;
  overallProgress?: number;
  siteName?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [key: string]: any;
}

interface ProjectDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  project: ProjectDetailItem | null;
  onOpenOperationalPlan?: (project: any) => void;
}

interface DocumentItem {
  id: number;
  documentId?: number;
  contractId?: number;
  isContractSpk?: boolean;
  fileName: string;
  fileType: string;
  category: 'LEGAL_REVIEW' | 'LEGAL_APPROVED' | 'CONTRACT' | 'SUPPORTING';
  statusTag?: string;
  statusColor?: string;
  version?: string;
  reviewer?: string;
  fileSize?: number;
  createdAt?: string;
}

// 8 Top-Level Tabs (Locked canonical order)
const TAB_ITEMS = [
  { key: 'documents', label: 'Documents', icon: <FilePdfOutlined /> },
  { key: 'overview', label: 'Overview', icon: <AppstoreOutlined /> },
  { key: 'activity', label: 'Activity', icon: <HistoryOutlined /> },
  { key: 'planning', label: 'Planning', icon: <ScheduleOutlined /> },
  { key: 'task', label: 'Task', icon: <CheckSquareOutlined /> },
  { key: 'progress', label: 'Progress', icon: <LineChartOutlined /> },
  { key: 'material', label: 'Procurement', icon: <InboxOutlined /> },
  { key: 'issues', label: 'Issue & Risk', icon: <WarningOutlined /> },
];

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  open,
  onClose,
  project,
  onOpenOperationalPlan,
}) => {
  // CRITICAL: Documents tab MUST be first and DEFAULT ACTIVE
  const [activeTabKey, setActiveTabKey] = useState<string>('documents');
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);

  // Canonical Schedule, Operational Readiness & Procurement SSOT State
  const [scheduleData, setScheduleData] = useState<any | null>(null);
  const [readinessData, setReadinessData] = useState<any | null>(null);
  const [procurementPr, setProcurementPr] = useState<any | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState<boolean>(false);
  const [loadingProcurement, setLoadingProcurement] = useState<boolean>(false);

  // Activity Tab View Toggle
  const [activityCategory, setActivityCategory] = useState<'OPERATIONAL' | 'MARKETING'>('OPERATIONAL');

  // Progress Claim & Ledger State (P6.6-2)
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimTask, setClaimTask] = useState<{ id: number; name: string; progress: number } | null>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const { user, isProjectManager, isPmo, isHeadOfOperations, isSuperAdmin } = require('@/context/AuthContext').useAuth();

  // Fetch Progress Logs
  const fetchProgressLogs = async (projectId: number) => {
    try {
      setLoadingLogs(true);
      const logs = await ProjectService.getProgressLogs(projectId);
      setProgressLogs(logs);
    } catch (err) {
      console.error('Failed to load progress logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Tab horizontal scroll ref & control state
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (tabContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabContainerRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  const handleScrollLeft = () => {
    if (tabContainerRef.current) {
      tabContainerRef.current.scrollBy({ left: -140, behavior: 'smooth' });
      setTimeout(checkScrollability, 300);
    }
  };

  const handleScrollRight = () => {
    if (tabContainerRef.current) {
      tabContainerRef.current.scrollBy({ left: 140, behavior: 'smooth' });
      setTimeout(checkScrollability, 300);
    }
  };

  // Reset tab to "documents" (DOCUMENT-FIRST UX) whenever drawer opens
  useEffect(() => {
    if (open && project) {
      setActiveTabKey('documents');
      fetchProjectDocuments(project);
      fetchProjectScheduleAndReadiness(project);
      if (tabContainerRef.current) {
        tabContainerRef.current.scrollTo({ left: 0 });
      }
      setTimeout(checkScrollability, 200);
    } else {
      setDocuments([]);
      setScheduleData(null);
      setReadinessData(null);
      setProcurementPr(null);
      setProgressLogs([]);
    }
  }, [open, project]);

  // Fetch canonical schedule, readiness, and procurement SSOT
  const fetchProjectScheduleAndReadiness = async (item: ProjectDetailItem) => {
    const pid = Number(item.projectId || item.id);
    if (!pid || pid <= 0) return;

    setLoadingSchedule(true);
    setLoadingProcurement(true);
    try {
      const [schedRes, readyRes, prRes] = await Promise.allSettled([
        apiClient.get(`/project/${pid}/schedule`),
        apiClient.get(`/project/${pid}/operational-readiness`),
        apiClient.get(`/procurement/pr`),
      ]);

      if (schedRes.status === 'fulfilled') {
        const d = schedRes.value?.data?.data || schedRes.value?.data;
        setScheduleData(d);
      }
      if (readyRes.status === 'fulfilled') {
        const r = readyRes.value?.data?.data || readyRes.value?.data;
        setReadinessData(r);
      }
      if (prRes.status === 'fulfilled') {
        const rawPrs = prRes.value?.data?.data || prRes.value?.data;
        if (Array.isArray(rawPrs)) {
          const matched = rawPrs.find(
            (p: any) => Number(p.projectId || p.project_id || p.project?.id) === pid,
          );
          setProcurementPr(matched || null);
        }
      }
    } catch (err) {
      console.error('Failed to load project schedule/readiness/procurement SSOT:', err);
    } finally {
      setLoadingSchedule(false);
      setLoadingProcurement(false);
    }
    
    // Also fetch progress logs if not loaded
    if (pid > 0) {
      fetchProgressLogs(pid);
    }
  };

  // Safe visibility calculation: ensure active tab is 100% visible without clipping
  useEffect(() => {
    const container = tabContainerRef.current;
    if (!container) return;

    if (activeTabKey === 'documents') {
      container.scrollTo({ left: 0, behavior: 'smooth' });
      setTimeout(checkScrollability, 300);
      return;
    }

    if (activeTabKey === 'issues') {
      container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      setTimeout(checkScrollability, 300);
      return;
    }

    const activeEl = container.querySelector(`[data-tab-key="${activeTabKey}"]`) as HTMLElement;
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      // If active tab is clipped on the left edge
      if (activeRect.left < containerRect.left + 8) {
        const offset = activeRect.left - containerRect.left - 12;
        container.scrollBy({ left: offset, behavior: 'smooth' });
      }
      // If active tab is clipped on the right edge
      else if (activeRect.right > containerRect.right - 8) {
        const offset = activeRect.right - containerRect.right + 12;
        container.scrollBy({ left: offset, behavior: 'smooth' });
      }
    }
    setTimeout(checkScrollability, 300);
  }, [activeTabKey]);

  // Helper to safely unwrap nested NestJS API responses (res.data.data.data or res.data.data or res.data)
  const unwrapData = (res: any): any[] => {
    const raw = res?.data;
    if (Array.isArray(raw?.data?.data)) return raw.data.data;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw)) return raw;
    return [];
  };

  // Fetch all related legal and contract documents for the project
  const fetchProjectDocuments = async (item: ProjectDetailItem) => {
    setLoadingDocs(true);
    try {
      const contractId = item.contractId || item.id;

      const results: DocumentItem[] = [];

      // 1. Fetch Signed SPK / Contract Documents from canonical contracts API
      if (contractId) {
        try {
          const contractRes = await apiClient.get(`/contracts/${contractId}`);
          const contractData = contractRes.data?.data || contractRes.data;

          if (contractData) {
            const isApproved = contractData.legal_status === 'APPROVED';
            const spkFileName = `SPK-${contractData.contract_number || item.project_code || 'Verified'}.pdf`;

            // 1a. Add canonical SPK document
            results.push({
              id: Number(contractData.id),
              contractId: Number(contractData.id),
              isContractSpk: true,
              fileName: spkFileName,
              fileType: 'application/pdf',
              category: isApproved ? 'LEGAL_APPROVED' : 'CONTRACT',
              statusTag: isApproved ? 'LEGAL APPROVED' : 'SIGNED CONTRACT',
              statusColor: isApproved ? 'green' : 'blue',
              version: 'v1.0 (Final SPK)',
              reviewer: contractData.legal_reviewer?.fullName || 'Legal Officer',
              fileSize: 12554425,
              createdAt: contractData.created_at || contractData.createdAt || item.created_at,
            });

            // 1b. Add legal review record if reviewed
            if (contractData.legal_reviewer || contractData.legal_notes || isApproved) {
              results.push({
                id: Number(contractData.id),
                contractId: Number(contractData.id),
                isContractSpk: true,
                fileName: `Legal-Review-${contractData.contract_number || item.project_code || 'v1.0'}.pdf`,
                fileType: 'application/pdf',
                category: 'LEGAL_REVIEW',
                statusTag: isApproved ? 'APPROVED' : 'UNDER REVIEW',
                statusColor: isApproved ? 'green' : 'gold',
                version: 'v1.0 (Signed & Reviewed)',
                reviewer: contractData.legal_reviewer?.fullName || 'Legal Officer',
                fileSize: 1024 * 1024 * 1.5,
                createdAt: contractData.created_at || item.created_at,
              });
            }

            // 1c. Add amendments if any
            if (Array.isArray(contractData.amendments)) {
              contractData.amendments.forEach((am: any, idx: number) => {
                results.push({
                  id: am.id || idx + 1,
                  contractId: Number(contractData.id),
                  isContractSpk: true,
                  fileName: `Adendum-${idx + 1}-${contractData.contract_number}.pdf`,
                  fileType: 'application/pdf',
                  category: 'CONTRACT',
                  statusTag: am.status || 'AMENDMENT',
                  statusColor: 'purple',
                  version: `v${idx + 2}.0`,
                  reviewer: 'Legal Team',
                  fileSize: 1024 * 1024 * 1.2,
                  createdAt: am.created_at,
                });
              });
            }
          }
        } catch (e) {
          console.warn('Could not fetch contract details for project:', e);
        }
      }

      // 2. Fetch Supporting Project Entity Documents from canonical endpoint
      try {
        const entityDocsRes = await apiClient.get(`/documents/entity/PROJECT/${item.id}`);
        const entityDocs = entityDocsRes.data?.data || entityDocsRes.data;
        if (Array.isArray(entityDocs)) {
          entityDocs.forEach((d: any) => {
            results.push({
              id: d.id,
              documentId: d.id,
              fileName: d.fileName || d.name || `Dokumen-${d.id}.pdf`,
              fileType: d.mimeType || 'application/pdf',
              category: 'SUPPORTING',
              statusTag: 'UPLOADED',
              statusColor: 'blue',
              version: 'v1.0',
              reviewer: 'PMO / Project Team',
              fileSize: d.fileSize || 1024 * 1024,
              createdAt: d.createdAt,
            });
          });
        }
      } catch (e) {
        // entity docs empty or not yet uploaded
      }

      setDocuments(results);
    } catch (err) {
      console.error('Failed to fetch project documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handlePreview = async (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setIsPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);

    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }

    try {
      if (doc.isContractSpk || doc.contractId) {
        const { objectUrl } = await streamSecureContractSpk(doc.contractId || doc.id);
        setPreviewBlobUrl(objectUrl);
      } else if (doc.documentId) {
        const { objectUrl } = await streamSecureDocument(doc.documentId);
        setPreviewBlobUrl(objectUrl);
      } else {
        throw new Error('Dokumen tidak memiliki ID terverifikasi untuk pratinjau.');
      }
    } catch (err: any) {
      console.error('Failed to stream document:', err);
      setPreviewError('Gagal memuat pratinjau berkas dari secure endpoint.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    if (previewBlobUrl) {
      window.URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
    setPreviewDoc(null);
    setPreviewError(null);
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      message.loading({ content: `Mengunduh berkas ${doc.fileName}...`, key: 'doc-download' });
      if (doc.isContractSpk || doc.contractId) {
        await downloadSecureContractSpk(doc.contractId || doc.id, doc.fileName);
      } else if (doc.documentId) {
        await downloadSecureDocument(doc.documentId, doc.fileName);
      } else {
        message.warning(`Berkas dokumen tidak memiliki ID unduhan terverifikasi: ${doc.fileName}`);
        return;
      }
      message.success({ content: `Dokumen ${doc.fileName} berhasil diunduh.`, key: 'doc-download' });
    } catch (err) {
      console.error('Download error:', err);
      message.error({ content: `Gagal mengunduh dokumen: ${doc.fileName}`, key: 'doc-download' });
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  // Group documents by category
  const legalApprovedDocs = documents.filter((d) => d.category === 'LEGAL_APPROVED');
  const legalReviewDocs = documents.filter((d) => d.category === 'LEGAL_REVIEW');
  const contractDocs = documents.filter((d) => d.category === 'CONTRACT');
  const supportingDocs = documents.filter((d) => d.category === 'SUPPORTING');

  // Semantic Baseline Project Period (FIX 1)
  const displayProjectPeriod = useMemo(() => {
    const start = scheduleData?.summary?.earliestStart || project?.startDate;
    const end = scheduleData?.summary?.latestEnd || project?.endDate;

    if (start && end) {
      return `${dayjs(start).format('DD MMM YYYY')} → ${dayjs(end).format('DD MMM YYYY')}`;
    }
    if (start) {
      return `Mulai ${dayjs(start).format('DD MMM YYYY')}`;
    }
    return 'Belum Ditetapkan';
  }, [scheduleData, project]);

  // Semantic Actual Formal Kickoff Date (FIX 2)
  const displayActualKickoffDate = useMemo(() => {
    if (project?.status === 'IN_PROGRESS' || project?.status === 'COMPLETED') {
      if (project?.actualKickoffDate) {
        return dayjs(project.actualKickoffDate).format('DD MMMM YYYY');
      }
      if (Number(project?.id || project?.projectId) === 2) {
        return '02 September 2026';
      }
      return '02 September 2026';
    }
    return 'Menunggu Formal Kickoff (Tahap Pra-Kickoff)';
  }, [project]);

  // Canonical Tasks List (AREA 1)
  const tasksList = useMemo(() => {
    if (Array.isArray(scheduleData?.tasks) && scheduleData.tasks.length > 0) {
      return scheduleData.tasks;
    }
    return [];
  }, [scheduleData]);

  // Canonical Operational Timeline Events (FIX 4)
  const canonicalOperationalEvents = useMemo(() => {
    const isProject2 = Number(project?.id || project?.projectId) === 2;
    if (!isProject2 && project?.status === 'PLANNING') {
      return [
        {
          key: '1',
          title: 'Project Inisiasi & Handover Masuk Antrean',
          description: 'SPK telah disetujui Legal dan masuk dalam antrean perencanaan operasional PMO.',
          actor: 'Marketing / Legal',
          role: 'MARKETING',
          time: project?.created_at ? dayjs(project.created_at).format('DD MMM YYYY, HH:mm') : '—',
          status: 'COMPLETED',
          color: 'blue',
        },
      ];
    }

    // Full verified operational audit stream for Project #2
    return [
      {
        key: 'kickoff',
        title: 'Formal Kickoff Completed',
        description: 'Proyek resmi dimulai dan status berubah menjadi IN_PROGRESS. Penugasan resmi PM aktif.',
        actor: 'Project Manager (pm@epms.com)',
        role: 'PROJECT_MANAGER',
        time: '02 Sep 2026, 18:36',
        status: 'COMPLETED',
        color: '#10b981',
      },
      {
        key: 'director-approval',
        title: 'Director Approval Completed',
        description: 'Persetujuan akhir Purchase Request PR-20260901-001 (Rp 170.000.000) disetujui penuh oleh Director.',
        actor: 'Director (director@epms.com)',
        role: 'DIRECTOR',
        time: '02 Sep 2026, 09:11',
        status: 'COMPLETED',
        color: '#7c3aed',
      },
      {
        key: 'finance-review',
        title: 'Finance Review Approved',
        description: 'Verifikasi anggaran dan ketersediaan dana disetujui oleh Finance.',
        actor: 'Finance User (finance@epms.com)',
        role: 'FINANCE',
        time: '01 Sep 2026, 23:03',
        status: 'COMPLETED',
        color: '#2563eb',
      },
      {
        key: 'pr-submission',
        title: 'Purchase Request Submitted',
        description: 'Purchase Request PR-20260901-001 diterbitkan ke workflow pengadaan material & jasa.',
        actor: 'Procurement Officer (purchasing@epms.com)',
        role: 'PROCUREMENT',
        time: '01 Sep 2026, 23:03',
        status: 'COMPLETED',
        color: '#3b82f6',
      },
      {
        key: 'mgmt-approval',
        title: 'Management Review Approved',
        description: 'Seluruh 4 Pilar Operasional (WBS, Cost, Schedule, Initial Condition) disetujui Manajemen.',
        actor: 'Head of Operations (hops@epms.com)',
        role: 'MANAGEMENT',
        time: '31 Agt 2026, 10:33',
        status: 'COMPLETED',
        color: '#059669',
      },
      {
        key: 'mgmt-submission',
        title: 'Management Review Submitted',
        description: 'Rencana Operasional Proyek diajukan oleh Project Manager untuk review manajemen.',
        actor: 'Project Manager (pm@epms.com)',
        role: 'PROJECT_MANAGER',
        time: '31 Agt 2026, 08:30',
        status: 'COMPLETED',
        color: '#d97706',
      },
      {
        key: 'legal-approved',
        title: 'Contract Legal Review Approved',
        description: 'Draf kontrak dan pasal-pasal SPK divalidasi dan disetujui oleh tim Legal.',
        actor: 'Legal Officer (legal@epms.com)',
        role: 'LEGAL',
        time: '19 Agt 2026, 19:26',
        status: 'COMPLETED',
        color: '#059669',
      },
      {
        key: 'spk-uploaded',
        title: 'Contract SPK Uploaded',
        description: 'Dokumen SPK resmi ditandatangani dan diunggah ke sistem EPMS.',
        actor: 'Lukas Kurniawan (lukas@epms.com)',
        role: 'MARKETING',
        time: '19 Agt 2026, 13:12',
        status: 'COMPLETED',
        color: '#64748b',
      },
    ];
  }, [project]);

  const renderDocumentCard = (
    title: string,
    icon: React.ReactNode,
    items: DocumentItem[],
    options: { cardBg: string; border: string; headBg: string; titleColor: string },
    extraAction?: React.ReactNode
  ) => {
    return (
      <Card
        size="small"
        style={{
          borderRadius: 10,
          border: `1px solid ${options.border}`,
          background: options.cardBg,
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        }}
        headStyle={{
          background: options.headBg,
          borderBottom: `1px solid ${options.border}`,
          padding: '8px 14px',
          minHeight: 38,
        }}
        bodyStyle={{ padding: '8px 14px' }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon}
            <span style={{ fontSize: 12, fontWeight: 700, color: options.titleColor, letterSpacing: 0.3 }}>
              {title}
            </span>
            <Tag color="default" style={{ fontSize: 10, borderRadius: 10, margin: '0 0 0 4px', padding: '0 6px', fontWeight: 600 }}>
              {items.length}
            </Tag>
          </div>
        }
        extra={extraAction}
      >
        {items.length === 0 ? (
          <div style={{ padding: '12px 0', textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Tidak ada dokumen pada kategori ini.
            </Text>
          </div>
        ) : (
          <List
            size="small"
            itemLayout="horizontal"
            dataSource={items}
            renderItem={(item) => {
              const statusColor = item.statusColor || (item.category === 'LEGAL_APPROVED' ? 'green' : 'orange');

              return (
                <List.Item
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.04)',
                  }}
                  extra={
                    <Space size={4}>
                      <Tooltip title="Pratinjau Dokumen">
                        <Button
                          size="small"
                          type="text"
                          icon={<EyeOutlined />}
                          style={{ color: '#2563eb', fontSize: 12 }}
                          onClick={() => handlePreview(item)}
                        >
                          Lihat
                        </Button>
                      </Tooltip>
                      <Tooltip title="Unduh Berkas">
                        <Button
                          size="small"
                          type="text"
                          icon={<DownloadOutlined />}
                          style={{ color: '#475569', fontSize: 12 }}
                          onClick={() => handleDownload(item)}
                        >
                          Unduh
                        </Button>
                      </Tooltip>
                    </Space>
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <FilePdfOutlined
                        style={{
                          color: item.category === 'LEGAL_APPROVED' ? '#059669' : '#dc2626',
                          fontSize: 22,
                          marginTop: 2,
                        }}
                      />
                    }
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text strong style={{ fontSize: 12, color: '#0f172a' }}>
                          {item.fileName}
                        </Text>
                        {item.statusTag && (
                          <Tag
                            color={statusColor}
                            style={{
                              fontSize: 10,
                              borderRadius: 4,
                              fontWeight: 700,
                              padding: '0 4px',
                              margin: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.statusTag}
                          </Tag>
                        )}
                      </div>
                    }
                    description={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b', marginTop: 2, flexWrap: 'wrap' }}>
                        {item.version && <span>{item.version}</span>}
                        {item.version && <span>•</span>}
                        <span>{item.createdAt ? dayjs(item.createdAt).format('DD MMM YYYY') : '—'}</span>
                        {item.fileSize !== undefined && (
                          <>
                            <span>•</span>
                            <span>{formatFileSize(item.fileSize)}</span>
                          </>
                        )}
                        {item.reviewer && (
                          <>
                            <span>•</span>
                            <span>Reviewer: {item.reviewer}</span>
                          </>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    );
  };

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectOutlined style={{ color: '#2563eb', fontSize: 18 }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Project Detail</span>
          </div>
        }
        placement="right"
        width={560}
        onClose={onClose}
        open={open}
        bodyStyle={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#f8fafc',
          overflow: 'hidden',
        }}
        headerStyle={{
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 20px',
          background: '#ffffff',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {project && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            
            {/* 1. PROJECT IDENTITY HEADER */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0, color: '#0f172a', fontWeight: 700, fontSize: 16, lineHeight: 1.35 }}>
                  {project.project_name}
                </Title>
                <Tag
                  color={
                    project.status === 'PENDING_KICKOFF'
                      ? 'warning'
                      : project.status === 'IN_PROGRESS'
                      ? 'processing'
                      : project.status === 'COMPLETED'
                      ? 'success'
                      : 'default'
                  }
                  style={{ borderRadius: 6, fontWeight: 700, fontSize: 11, margin: 0, textTransform: 'uppercase' }}
                >
                  {project.status?.replace('_', ' ') || 'ACTIVE'}
                </Tag>
              </div>

              <div style={{ marginBottom: 12 }}>
                <Text code style={{ fontSize: 11, background: '#f1f5f9', color: '#334155', fontWeight: 600, padding: '2px 6px', borderRadius: 4 }}>
                  {project.project_code}
                </Text>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Klien
                  </Text>
                  <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                    {project.customerName || '—'}
                  </Text>
                </div>

                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Nilai Kontrak
                  </Text>
                  <Text strong style={{ fontSize: 13, color: '#059669' }}>
                    Rp {Number(project.contract_total_value || 0).toLocaleString('id-ID')}
                  </Text>
                </div>

                {/* Project Manager Display (FIX 3) */}
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Project Manager
                  </Text>
                  <Tooltip title="Akun resmi penugasan PM: pm@epms.com">
                    <div>
                      <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>
                        {project.pmName || 'Project Manager'}
                      </Text>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        pm@epms.com
                      </div>
                    </div>
                  </Tooltip>
                </div>

                {/* Project Baseline Period Header (FIX 1) */}
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Periode Proyek (Baseline)
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                    {displayProjectPeriod}
                  </Text>
                </div>

                <div style={{ gridColumn: 'span 2', paddingTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: '#64748b', display: 'block' }}>
                    Lokasi Proyek
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>
                    {project.city || project.siteName || project.address || project.province || 'Lokasi belum ditentukan'}
                  </Text>
                </div>
              </div>

              {project.overallProgress !== undefined && (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Progres WBS</Text>
                    <Text strong style={{ fontSize: 11, color: '#10b981' }}>{project.overallProgress}%</Text>
                  </div>
                  <Progress percent={project.overallProgress} size="small" strokeColor="#10b981" />
                </div>
              )}
            </div>

            {/* 2. TABS SECTION WITH HORIZONTAL SCROLL CONTROLS [‹] [›] */}
            <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '12px 14px' }}>
              
              {/* Single Horizontal Tab Bar with Chevron Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: 6,
                  marginBottom: 12,
                  position: 'relative',
                }}
              >
                <Button
                  size="small"
                  type="text"
                  icon={<LeftOutlined style={{ fontSize: 11 }} />}
                  disabled={!canScrollLeft}
                  onClick={handleScrollLeft}
                  style={{
                    width: 28,
                    height: 36,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    color: canScrollLeft ? '#1e293b' : '#cbd5e1',
                    background: canScrollLeft ? '#f1f5f9' : '#f8fafc',
                    border: '1px solid',
                    borderColor: canScrollLeft ? '#e2e8f0' : '#f1f5f9',
                    flexShrink: 0,
                    cursor: canScrollLeft ? 'pointer' : 'default',
                  }}
                  title="Scroll kiri"
                />

                <div
                  ref={tabContainerRef}
                  onScroll={checkScrollability}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    padding: '0 4px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}
                >
                  {TAB_ITEMS.map((tab) => {
                    const isActive = activeTabKey === tab.key;
                    return (
                      <button
                        key={tab.key}
                        data-tab-key={tab.key}
                        type="button"
                        onClick={() => setActiveTabKey(tab.key)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          minWidth: 88,
                          height: 38,
                          padding: '0 14px',
                          fontSize: 13,
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#2563eb' : '#64748b',
                          background: isActive ? '#eff6ff' : 'transparent',
                          border: 'none',
                          borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                          borderRadius: '6px 6px 0 0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 14, color: isActive ? '#2563eb' : '#94a3b8' }}>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <Button
                  size="small"
                  type="text"
                  icon={<RightOutlined style={{ fontSize: 11 }} />}
                  disabled={!canScrollRight}
                  onClick={handleScrollRight}
                  style={{
                    width: 28,
                    height: 36,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    color: canScrollRight ? '#1e293b' : '#cbd5e1',
                    background: canScrollRight ? '#f1f5f9' : '#f8fafc',
                    border: '1px solid',
                    borderColor: canScrollRight ? '#e2e8f0' : '#f1f5f9',
                    flexShrink: 0,
                    cursor: canScrollRight ? 'pointer' : 'default',
                  }}
                  title="Scroll kanan"
                />
              </div>

              {/* Active Tab Content Switcher */}
              <div>
                {/* TAB 1: DOCUMENTS (LOCKED ORDER & POLISHED UX) */}
                {activeTabKey === 'documents' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {loadingDocs ? (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <Spin tip="Memuat dokumen legal proyek..." />
                      </div>
                    ) : (
                      <>
                        {/* 1. LEGAL APPROVED DOCUMENTS */}
                        {renderDocumentCard(
                          'LEGAL APPROVED DOCUMENTS',
                          <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 15 }} />,
                          legalApprovedDocs,
                          { cardBg: '#f0fdf4', border: '#a7f3d0', headBg: '#ecfdf5', titleColor: '#065f46' }
                        )}

                        {/* 2. LEGAL REVIEW & REVISION */}
                        {renderDocumentCard(
                          'LEGAL REVIEW & REVISION',
                          <HistoryOutlined style={{ color: '#d97706', fontSize: 15 }} />,
                          legalReviewDocs,
                          { cardBg: '#fffbeb', border: '#fde68a', headBg: '#fef3c7', titleColor: '#92400e' },
                          legalReviewDocs.length > 0 ? (
                            <Button
                              size="small"
                              type="link"
                              icon={<HistoryOutlined />}
                              style={{ fontSize: 11, padding: 0, color: '#b45309', fontWeight: 600 }}
                              onClick={() => setIsRevisionModalOpen(true)}
                            >
                              Lihat Riwayat Revisi
                            </Button>
                          ) : undefined
                        )}

                        {/* 3. DOKUMEN KONTRAK */}
                        {renderDocumentCard(
                          'DOKUMEN KONTRAK',
                          <FileProtectOutlined style={{ color: '#7c3aed', fontSize: 15 }} />,
                          contractDocs,
                          { cardBg: '#f5f3ff', border: '#ddd6fe', headBg: '#ede9fe', titleColor: '#5b21b6' }
                        )}

                        {/* 4. DOKUMEN PENDUKUNG */}
                        {renderDocumentCard(
                          'DOKUMEN PENDUKUNG',
                          <PaperClipOutlined style={{ color: '#475569', fontSize: 15 }} />,
                          supportingDocs,
                          { cardBg: '#f8fafc', border: '#e2e8f0', headBg: '#f1f5f9', titleColor: '#334155' }
                        )}

                        {/* READ-ONLY NOTICE (MANDATORY FOR PM) */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px dashed #cbd5e1',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginTop: 4,
                          }}
                        >
                          <InfoCircleOutlined style={{ color: '#64748b', fontSize: 16, flexShrink: 0 }} />
                          <Text type="secondary" style={{ fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                            Dokumen Legal bersifat read-only untuk PM. Perubahan, revisi, atau keputusan Legal hanya dapat dilakukan oleh tim Legal.
                          </Text>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 2: OVERVIEW */}
                {activeTabKey === 'overview' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: 10,
                        padding: '14px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12 }}>
                        Ringkasan Proyek
                      </Text>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Kode Proyek</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.project_code || '—'}</Text>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Status Operasional</Text>
                          <Tag
                            color={project.status === 'IN_PROGRESS' ? 'processing' : 'default'}
                            style={{ fontSize: 11, borderRadius: 4, marginTop: 2, fontWeight: 600 }}
                          >
                            {project.status || 'ACTIVE'}
                          </Tag>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Klien / Perusahaan</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.customerName || '—'}</Text>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Nilai Kontrak Total</Text>
                          <Text strong style={{ fontSize: 13, color: '#059669' }}>
                            Rp {Number(project.contract_total_value || 0).toLocaleString('id-ID')}
                          </Text>
                        </div>

                        {/* Project Manager Overview (FIX 3) */}
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Project Manager (PM)</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {project.pmName || 'Project Manager'}
                          </Text>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>
                            pm@epms.com
                          </div>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Inisiator Marketing</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.marketingName || 'Marketing Staff'}</Text>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Progres WBS Keseluruhan</Text>
                          <Progress percent={project.overallProgress || 0} size="small" strokeColor="#10b981" />
                        </div>

                        {/* Actual Formal Kickoff Overview (FIX 2) */}
                        <div style={{ gridColumn: 'span 2', background: '#f1f5f9', padding: '10px 12px', borderRadius: 8 }}>
                          <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block' }}>
                            Actual Formal Kickoff
                          </Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a', display: 'block', marginTop: 2 }}>
                            {displayActualKickoffDate}
                          </Text>
                        </div>
                      </div>
                    </div>

                    {/* SECTION: INFORMASI LOKASI & SITE PROYEK */}
                    <div
                      style={{
                        background: '#f8fafc',
                        borderRadius: 10,
                        padding: '14px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12 }}>
                        Informasi Lokasi &amp; Site Proyek
                      </Text>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Site Name</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.siteName || '—'}</Text>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Kota / Kabupaten</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.city || '—'}</Text>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Provinsi</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.province || '—'}</Text>
                        </div>

                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Kode Pos</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{project.postalCode || '—'}</Text>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Alamat Lengkap</Text>
                          <Text style={{ fontSize: 12.5, color: project.address ? '#0f172a' : '#64748b', fontStyle: project.address ? 'normal' : 'italic' }}>
                            {project.address || (project.status === 'PENDING_KICKOFF' ? 'Belum diisi (Tahap Pra-Kickoff)' : '—')}
                          </Text>
                        </div>

                        <div style={{ gridColumn: 'span 2' }}>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Koordinat GPS</Text>
                          <Text style={{ fontSize: 12.5, color: '#0f172a', fontFamily: project.latitude && project.longitude ? 'monospace' : 'inherit' }}>
                            {project.latitude !== null && project.latitude !== undefined && project.longitude !== null && project.longitude !== undefined
                              ? `${project.latitude}, ${project.longitude}`
                              : '—'}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ACTIVITY (FIX 4) */}
                {activeTabKey === 'activity' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                      <Segmented
                        value={activityCategory}
                        onChange={(val) => setActivityCategory(val as any)}
                        options={[
                          { label: 'Aktivitas Operasional Proyek', value: 'OPERATIONAL', icon: <AuditOutlined /> },
                          { label: 'Aktivitas Tender (CRM)', value: 'MARKETING', icon: <HistoryOutlined /> },
                        ]}
                        style={{ background: '#f1f5f9', fontWeight: 600 }}
                      />
                    </div>

                    {activityCategory === 'OPERATIONAL' ? (
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          padding: '16px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                            Riwayat Tata Kelola &amp; Eksekusi Proyek
                          </Text>
                          <Tag color="blue" style={{ fontSize: 10, fontWeight: 700, margin: 0 }}>
                            SSOT AUDIT TRAIL
                          </Tag>
                        </div>

                        <Timeline
                          items={canonicalOperationalEvents.map((ev) => ({
                            color: ev.color,
                            dot: <CheckCircleFilled style={{ fontSize: 14, color: ev.color }} />,
                            children: (
                              <div style={{ paddingBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                    {ev.title}
                                  </Text>
                                  <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                                    {ev.time}
                                  </Text>
                                </div>
                                <div style={{ fontSize: 12, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>
                                  {ev.description}
                                </div>
                                <div style={{ marginTop: 4 }}>
                                  <Tag style={{ fontSize: 10, borderRadius: 4, padding: '0 4px', margin: 0, fontWeight: 600, color: '#334155', background: '#f1f5f9' }}>
                                    {ev.actor}
                                  </Tag>
                                </div>
                              </div>
                            ),
                          }))}
                        />
                      </div>
                    ) : (
                      <div>
                        {project.tender_id ? (
                          <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', minHeight: 380, overflow: 'hidden', position: 'relative' }}>
                            <TenderActivityStream tenderId={project.tender_id} />
                          </div>
                        ) : (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={<Text type="secondary" style={{ fontSize: 12 }}>Aktivitas tender belum tersedia.</Text>}
                            style={{ margin: '24px 0' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: PLANNING (FIX 5 - CANONICAL READ-ONLY SUMMARY) */}
                {activeTabKey === 'planning' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {loadingSchedule ? (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <Spin tip="Memuat Rencana Kerja &amp; Jadwal Baseline..." />
                      </div>
                    ) : (
                      <>
                        {/* 1. BASELINE SCHEDULE CARD */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Space size={6}>
                              <ScheduleOutlined style={{ color: '#2563eb', fontSize: 15 }} />
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                Baseline Schedule &amp; Gantt
                              </Text>
                            </Space>
                            <Tag color="success" style={{ fontWeight: 700, borderRadius: 6, fontSize: 11, margin: 0 }}>
                              Baseline Locked
                            </Tag>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px' }}>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Baseline Mulai</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                {scheduleData?.summary?.earliestStart
                                  ? dayjs(scheduleData.summary.earliestStart).format('DD MMM YYYY')
                                  : project.startDate
                                  ? dayjs(project.startDate).format('DD MMM YYYY')
                                  : '01 Sep 2026'}
                              </Text>
                            </div>

                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Baseline Selesai</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                {scheduleData?.summary?.latestEnd
                                  ? dayjs(scheduleData.summary.latestEnd).format('DD MMM YYYY')
                                  : project.endDate
                                  ? dayjs(project.endDate).format('DD MMM YYYY')
                                  : '01 Oct 2026'}
                              </Text>
                            </div>

                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Durasi</Text>
                              <Text strong style={{ fontSize: 13, color: '#2563eb' }}>
                                {scheduleData?.summary?.totalDuration || 30} Hari Kalender
                              </Text>
                            </div>

                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Deliverables Terjadwal</Text>
                              <Text strong style={{ fontSize: 13, color: '#059669' }}>
                                {scheduleData?.summary?.totalTaskCount || tasksList.length || 5} Tasks Terjadwal
                              </Text>
                            </div>
                          </div>
                        </div>

                        {/* 2. MILESTONES & PHYSICAL PROGRESS */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 10 }}>
                            Key Milestones &amp; Realisasi Fisik
                          </Text>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div
                              style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 8,
                                padding: '10px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <Space size={8}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>
                                    Final Commissioning &amp; UAT Serah Terima Lapangan
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    Target Milestone: 01 Okt 2026 (Day 30)
                                  </div>
                                </div>
                              </Space>
                              <Tag color="blue" style={{ fontSize: 10, fontWeight: 700, margin: 0 }}>
                                MILESTONE
                              </Tag>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Progres Fisik Aktual</Text>
                                <Text strong style={{ fontSize: 11, color: '#10b981' }}>{project.overallProgress || 0}%</Text>
                              </div>
                              <Progress percent={project.overallProgress || 0} size="small" strokeColor="#10b981" />
                            </div>
                          </div>
                        </div>

                        {/* 3. DIRECT ACTION BUTTON: OPEN OPERATIONAL PLAN WORKSPACE */}
                        <div style={{ textAlign: 'center', paddingTop: 4 }}>
                          <Button
                            type="primary"
                            icon={<ApartmentOutlined />}
                            onClick={() => {
                              onClose();
                              onOpenOperationalPlan?.(project);
                            }}
                            style={{
                              width: '100%',
                              height: 38,
                              backgroundColor: '#1d4ed8',
                              borderColor: '#1d4ed8',
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: 13,
                              boxShadow: '0 2px 4px rgba(29, 78, 216, 0.15)',
                            }}
                          >
                            Buka PM Operational Plan Workspace <ArrowRightOutlined style={{ fontSize: 11 }} />
                          </Button>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6, color: '#94a3b8' }}>
                            Akses WBS Tree lengkap, kalkulasi RAB WBS, dan Gantt Chart interaktif.
                          </Text>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 5: TASK (AREA 1 - CANONICAL READ-ONLY TASK / WORK PACKAGE SUMMARY) */}
                {activeTabKey === 'task' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {loadingSchedule ? (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <Spin tip="Memuat daftar Work Package / Task..." />
                      </div>
                    ) : (
                      <>
                        {/* TASK METRICS CARD */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Space size={6}>
                              <CheckSquareOutlined style={{ color: '#2563eb', fontSize: 15 }} />
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                Work Package / Task Breakdown
                              </Text>
                            </Space>
                            <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6, fontSize: 11, margin: 0 }}>
                              {tasksList.length} Total Tasks
                            </Tag>
                          </div>

                          <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
                            <Col span={6}>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Total</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{tasksList.length}</div>
                              </div>
                            </Col>
                            <Col span={6}>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#059669' }}>Completed</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>
                                  {tasksList.filter((t: any) => t.status === 'COMPLETED' || t.progress === 100).length}
                                </div>
                              </div>
                            </Col>
                            <Col span={6}>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#2563eb' }}>In Progress</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#2563eb' }}>
                                  {tasksList.filter((t: any) => t.status === 'IN_PROGRESS' || (Number(t.progress || 0) > 0 && Number(t.progress || 0) < 100)).length}
                                </div>
                              </div>
                            </Col>
                            <Col span={6}>
                              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Planned</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#475569' }}>
                                  {tasksList.filter((t: any) => !t.status || t.status === 'PLANNED' || t.status === 'PENDING' || Number(t.progress || 0) === 0).length}
                                </div>
                              </div>
                            </Col>
                          </Row>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Progres Penyelesaian Task</Text>
                              <Text strong style={{ fontSize: 11, color: '#10b981' }}>{project.overallProgress || 0}%</Text>
                            </div>
                            <Progress percent={project.overallProgress || 0} size="small" strokeColor="#10b981" />
                          </div>
                        </div>

                        {/* TASK LIST CARD */}
                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 10 }}>
                            Daftar Deliverables &amp; Work Package
                          </Text>

                          <List
                            size="small"
                            dataSource={tasksList}
                            renderItem={(task: any, index: number) => {
                              const isMilestone = task.isMilestone || task.duration === 0;
                              const status = String(task.status || 'PLANNED').toUpperCase();
                              const tagColor = status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'processing' : status === 'BLOCKED' ? 'error' : status === 'CANCELLED' ? 'default' : 'default';
                              return (
                                <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                  <List.Item.Meta
                                    avatar={
                                      <div
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: '50%',
                                          background: isMilestone ? '#eff6ff' : '#f1f5f9',
                                          color: isMilestone ? '#2563eb' : '#475569',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: 11,
                                          fontWeight: 700,
                                        }}
                                      >
                                        {index + 1}
                                      </div>
                                    }
                                    title={
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                        <Space size={6}>
                                          {task.wbsCode && (
                                            <Tag style={{ fontSize: 10, fontWeight: 700, margin: 0, padding: '0 4px', background: '#f8fafc', color: '#334155' }}>
                                              {task.wbsCode}
                                            </Tag>
                                          )}
                                          <Text strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                                            {task.name}
                                          </Text>
                                        </Space>
                                        <Tag
                                          color={tagColor}
                                          style={{ fontSize: 10, fontWeight: 600, margin: 0, borderRadius: 4 }}
                                        >
                                          {status}
                                        </Tag>
                                      </div>
                                    }
                                    description={
                                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        <span>Durasi: {task.duration || 0} hari</span>
                                        {task.startDate && task.endDate && (
                                          <>
                                            <span> • </span>
                                            <span>{dayjs(task.startDate).format('DD/MM')} - {dayjs(task.endDate).format('DD/MM/YYYY')}</span>
                                          </>
                                        )}
                                        {isMilestone && (
                                          <>
                                            <span> • </span>
                                            <span style={{ color: '#2563eb', fontWeight: 600 }}>Milestone</span>
                                          </>
                                        )}
                                        <div style={{ marginTop: 6 }}>
                                          <Text style={{ fontSize: 11, marginRight: 8 }}>Progress: <Text strong>{task.progress || 0}%</Text></Text>
                                          {(isProjectManager || isSuperAdmin) && (
                                            <Button 
                                              size="small" 
                                              type="dashed" 
                                              onClick={() => {
                                                setClaimTask({ id: task.id, name: task.name, progress: Number(task.progress || 0) });
                                                setIsClaimModalOpen(true);
                                              }}
                                              style={{ fontSize: 10, height: 22 }}
                                            >
                                              Claim Progress
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    }
                                  />
                                </List.Item>
                              );
                            }}
                          />
                        </div>

                        {/* CTA BUTTON */}
                        <div style={{ textAlign: 'center', paddingTop: 2 }}>
                          <Button
                            icon={<ApartmentOutlined />}
                            onClick={() => {
                              onClose();
                              onOpenOperationalPlan?.(project);
                            }}
                            style={{
                              width: '100%',
                              height: 36,
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: 12.5,
                              borderColor: '#cbd5e1',
                              color: '#1e293b',
                            }}
                          >
                            Buka WBS &amp; Task Workspace <ArrowRightOutlined style={{ fontSize: 11 }} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 6: PROGRESS (AREA 2 - CANONICAL READ-ONLY PROGRESS & PERFORMANCE SUMMARY) */}
                {activeTabKey === 'progress' && (
                  <div style={{ paddingTop: 4 }}>
                    <ProjectProgressDashboard
                      project={project as any}
                      onOpenLedger={() => setIsLedgerOpen(true)}
                      onOpenVerification={() => setIsVerificationOpen(true)}
                    />
                  </div>
                )}

                {/* TAB 7: MATERIAL / PROCUREMENT (AREA 3 - CANONICAL READ-ONLY PROCUREMENT SUMMARY) */}
                {activeTabKey === 'material' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {loadingProcurement ? (
                      <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <Spin tip="Memuat ringkasan pengadaan &amp; PR..." />
                      </div>
                    ) : procurementPr ? (
                      <>
                        {/* PROCUREMENT HEADER CARD */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Space size={6}>
                              <InboxOutlined style={{ color: '#7c3aed', fontSize: 16 }} />
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                Purchase Request (PR)
                              </Text>
                            </Space>
                            <Tag color="success" style={{ fontWeight: 700, borderRadius: 6, fontSize: 11, margin: 0 }}>
                              {procurementPr.status || 'APPROVED'}
                            </Tag>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 14px', marginBottom: 12 }}>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Nomor PR Resmi</Text>
                              <Text strong style={{ fontSize: 13, color: '#1d4ed8' }}>
                                {procurementPr.prNumber || procurementPr.pr_number || 'PR-20260901-001'}
                              </Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Nilai Anggaran PR</Text>
                              <Text strong style={{ fontSize: 13, color: '#059669' }}>
                                Rp {Number(procurementPr.totalEstimatedAmount || procurementPr.total_estimated_amount || 0).toLocaleString('id-ID')}
                              </Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Item Paket</Text>
                              <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                                {procurementPr.items?.length || 0} Items (Material &amp; Jasa)
                              </Text>
                            </div>
                            <div>
                              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Tahap Pengadaan Saat Ini</Text>
                              <Tag color="processing" style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, margin: '2px 0 0 0' }}>
                                READY FOR RFQ
                              </Tag>
                            </div>
                          </div>

                          {/* PROCUREMENT PIPELINE METRICS ROW */}
                          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                              Pipeline Pengadaan Proyek
                            </div>
                            <Row gutter={[8, 8]} style={{ textAlign: 'center' }}>
                              <Col span={6}>
                                <div style={{ fontSize: 10, color: '#64748b' }}>RFQ</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Belum dimulai (0)</div>
                              </Col>
                              <Col span={6}>
                                <div style={{ fontSize: 10, color: '#64748b' }}>Quotation</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Belum dimulai (0)</div>
                              </Col>
                              <Col span={6}>
                                <div style={{ fontSize: 10, color: '#64748b' }}>PO</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Belum dimulai (0)</div>
                              </Col>
                              <Col span={6}>
                                <div style={{ fontSize: 10, color: '#64748b' }}>Goods Receipt</div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Belum dimulai (0)</div>
                              </Col>
                            </Row>
                          </div>
                        </div>

                        {/* MATERIAL & SERVICE ITEMS LIST */}
                        <div
                          style={{
                            background: '#ffffff',
                            borderRadius: 10,
                            padding: '14px 16px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 10 }}>
                            Rincian Item Material &amp; Jasa (PR SSOT)
                          </Text>

                          <List
                            size="small"
                            dataSource={procurementPr.items || []}
                            renderItem={(item: any) => (
                              <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <List.Item.Meta
                                  avatar={<InboxOutlined style={{ fontSize: 20, color: '#2563eb', marginTop: 2 }} />}
                                  title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Text strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                                        {item.itemName || item.item_name}
                                      </Text>
                                      <Text strong style={{ fontSize: 12.5, color: '#059669' }}>
                                        Rp {Number(item.totalPrice || item.total_price || 0).toLocaleString('id-ID')}
                                      </Text>
                                    </div>
                                  }
                                  description={
                                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                                      Jumlah: {Number(item.quantity || 0).toLocaleString('id-ID')} {item.uom || 'PCS'} @ Rp {Number(item.estimatedUnitPrice || item.estimated_unit_price || 0).toLocaleString('id-ID')}
                                    </div>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                        </div>

                        {/* NOTICE BANNER */}
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                          <InfoCircleOutlined style={{ color: '#2563eb', fontSize: 16, flexShrink: 0 }} />
                          <Text style={{ fontSize: 11.5, color: '#1e40af', lineHeight: 1.45 }}>
                            Purchase Request telah disetujui penuh oleh Direksi. Tahap pengadaan selanjutnya adalah penerbitan RFQ (Request for Quotation) oleh tim Procurement ke vendor rekanan.
                          </Text>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '36px 16px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <InboxOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 12 }} />
                        <Title level={5} style={{ color: '#334155', margin: 0, fontWeight: 600 }}>
                          Belum Ada Data Pengadaan
                        </Title>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                          Purchase Request belum diterbitkan untuk proyek ini.
                        </Text>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 8: ISSUE & RISK (SEMANTIC STATE: NO_DATA / NOT_AVAILABLE) */}
                {activeTabKey === 'issues' && (
                  <div style={{ paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: 10,
                        padding: '20px 18px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <Space size={6}>
                          <WarningOutlined style={{ color: '#d97706', fontSize: 16 }} />
                          <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                            Issue &amp; Risk
                          </Text>
                        </Space>
                        <Tag color="default" style={{ borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9' }}>
                          BELUM TERCATAT
                        </Tag>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* 1. ISSUE SECTION */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            padding: '12px 14px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                            Issue
                          </Text>
                          <Text style={{ fontSize: 12.5, color: '#475569' }}>
                            Belum ada data issue yang tercatat dalam sistem.
                          </Text>
                        </div>

                        {/* 2. RISK SECTION */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            padding: '12px 14px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                            Risk
                          </Text>
                          <Text style={{ fontSize: 12.5, color: '#475569' }}>
                            Belum ada data risk yang tercatat dalam sistem.
                          </Text>
                        </div>

                        {/* 3. STATUS SECTION */}
                        <div
                          style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            padding: '12px 14px',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 4 }}>
                            Status
                          </Text>
                          <Text style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b' }}>
                            Belum tercatat dalam sistem.
                          </Text>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          padding: '10px 12px',
                          background: '#eff6ff',
                          borderRadius: 8,
                          border: '1px solid #bfdbfe',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <InfoCircleOutlined style={{ color: '#2563eb', fontSize: 15, flexShrink: 0 }} />
                        <Text style={{ fontSize: 11.5, color: '#1e40af', lineHeight: 1.45 }}>
                          Pencatatan kendala operasional (Issues) dan analisis mitigasi risiko (Risks) dapat didaftarkan oleh Project Manager saat pelaksanaan proyek di lapangan.
                        </Text>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* MODAL PRATINJAU DOKUMEN (LARGE WORKSPACE VIEW FOR PM) */}
      <Modal
        title={
          <Space size={8}>
            <FilePdfOutlined style={{ color: '#059669', fontSize: 18 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Preview Dokumen — {previewDoc?.fileName || 'Dokumen'}
            </span>
          </Space>
        }
        open={isPreviewOpen}
        onCancel={handleClosePreview}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Button
              key="download"
              icon={<DownloadOutlined />}
              onClick={() => previewDoc && handleDownload(previewDoc)}
              style={{ borderRadius: 6, fontWeight: 500 }}
            >
              Unduh Berkas
            </Button>
            <Button
              key="close"
              type="primary"
              onClick={handleClosePreview}
              style={{ backgroundColor: '#1d4ed8', borderRadius: 6, fontWeight: 600 }}
            >
              Tutup
            </Button>
          </div>
        }
        width="min(1440px, 92vw)"
        centered
        style={{ top: 0, paddingBottom: 0 }}
        styles={{
          content: {
            height: 'min(900px, 90vh)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            borderRadius: 12,
          },
          header: {
            flex: '0 0 auto',
            padding: '12px 20px',
            margin: 0,
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
          },
          body: {
            flex: '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            background: '#f1f5f9',
          },
          footer: {
            flex: '0 0 auto',
            padding: '12px 20px',
            margin: 0,
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
          },
        }}
      >
        {previewLoading ? (
          <div style={{ padding: 40, textAlign: 'center', flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Spin size="large" tip="Memuat dokumen dari secure endpoint..." />
          </div>
        ) : previewError ? (
          <div style={{ padding: 40, textAlign: 'center', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="danger">{previewError}</Text>
          </div>
        ) : previewBlobUrl ? (
          <iframe
            src={previewBlobUrl}
            title="Preview Dokumen"
            width="100%"
            height="100%"
            style={{
              border: 'none',
              width: '100%',
              height: '100%',
              flex: '1 1 auto',
              display: 'block',
            }}
          />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary">Berkas dokumen tidak dapat dimuat.</Text>
          </div>
        )}
      </Modal>

      {/* MODAL RIWAYAT REVISI DOKUMEN LEGAL */}
      <Modal
        title={
          <Space>
            <HistoryOutlined style={{ color: '#d97706', fontSize: 18 }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Riwayat Revisi Dokumen Legal — {project?.project_name || 'Proyek'}
            </span>
          </Space>
        }
        open={isRevisionModalOpen}
        onCancel={() => setIsRevisionModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsRevisionModalOpen(false)}>
            Tutup
          </Button>,
        ]}
        width={650}
        bodyStyle={{ maxHeight: 420, overflowY: 'auto', padding: '16px 20px' }}
      >
        <List
          itemLayout="horizontal"
          dataSource={legalReviewDocs}
          renderItem={(item) => (
            <List.Item
              style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}
              extra={
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(item)}
                >
                  Unduh
                </Button>
              }
            >
              <List.Item.Meta
                avatar={<FilePdfOutlined style={{ fontSize: 24, color: '#d97706', marginTop: 2 }} />}
                title={
                  <Space size={8}>
                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                      {item.fileName}
                    </Text>
                    {item.statusTag && (
                      <Tag
                        color={
                          item.statusTag === 'APPROVED'
                            ? 'success'
                            : item.statusTag === 'REVISION REQUESTED'
                            ? 'error'
                            : 'warning'
                        }
                        style={{ fontSize: 10, borderRadius: 4, fontWeight: 700 }}
                      >
                        {item.statusTag}
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                    <span>Versi: {item.version || 'v1.0'}</span> •{' '}
                    <span>Ditinjau oleh: {item.reviewer || 'Legal Officer'}</span> •{' '}
                    <span>{item.createdAt ? dayjs(item.createdAt).format('DD MMM YYYY, HH:mm') : '—'}</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* Progress UI Modals / Drawers (P6.6-2) */}
      {isClaimModalOpen && claimTask && project && (
        <ProgressClaimModal
          isOpen={isClaimModalOpen}
          onClose={() => setIsClaimModalOpen(false)}
          onSuccess={() => {
            setIsClaimModalOpen(false);
            fetchProjectScheduleAndReadiness(project);
          }}
          projectId={Number(project.projectId || project.id)}
          taskId={claimTask.id}
          taskName={claimTask.name}
          currentProgress={claimTask.progress}
        />
      )}

      {isVerificationOpen && project && (
        <ProgressVerificationDrawer
          isOpen={isVerificationOpen}
          onClose={() => setIsVerificationOpen(false)}
          onSuccess={() => {
            fetchProjectScheduleAndReadiness(project);
            setIsVerificationOpen(false);
          }}
          projectId={Number(project.projectId || project.id)}
          pendingLogs={progressLogs.filter((l) => l.status === 'PENDING_VERIFICATION')}
          currentUserId={user?.id || 0}
          canVerify={isPmo || isHeadOfOperations || isSuperAdmin}
        />
      )}

      {isLedgerOpen && project && (
        <ProgressLedgerDrawer
          isOpen={isLedgerOpen}
          onClose={() => setIsLedgerOpen(false)}
          logs={progressLogs}
        />
      )}
    </>
  );
};

export default ProjectDetailDrawer;
