'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Typography,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Space,
  message,
  Empty,
  Tooltip,
  Modal,
  Alert,
  Tabs,
  Input,
  Select,
  Badge,
} from 'antd';
import {
  FileDoneOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  ClockCircleFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
  SendOutlined,
  RollbackOutlined,
  FilterOutlined,
  ReloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProcurementService,
  ProcurementPackage,
  ProcurementPackageStatus,
  RfqRecord,
} from '@/services/procurement.service';
import { useAuth } from '@/context/AuthContext';
import {
  PrApprovalWorkflow,
  PrStatusBadge,
  PrApprovalStatus,
} from '@/components/procurement/PrApprovalWorkflow';
import {
  CreateRfqModal,
} from '@/components/procurement/CreateRfqModal';
import {
  PurchaseOrderModal,
  PurchaseOrderPrototypeRecord,
} from '@/components/procurement/PurchaseOrderModal';
import {
  GoodsReceiptModal,
  GoodsReceiptRecord,
} from '@/components/procurement/GoodsReceiptModal';
import {
  ProcurementPackageDetailDrawer,
  getPackageStatusTag,
} from '@/components/procurement/ProcurementPackageDetailDrawer';
import { ReconciliationTab } from '@/components/procurement/ReconciliationTab';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const ProcurementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isProcurement, isFinance, isDirector, isSuperAdmin, isProjectManager, isHeadOfOperations } = useAuth();
  const userRoles = (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  const isPurchasing = userRoles.includes('PURCHASING');
  const canPerformProcurementAction = isProcurement || isSuperAdmin || isPurchasing;

  const canReceiveGoods =
    isProcurement ||
    isSuperAdmin ||
    isProjectManager ||
    isHeadOfOperations ||
    userRoles.includes('PMO') ||
    userRoles.includes('ADMIN');

  // Authorized GET roles for reconciliation matching backend: PROCUREMENT, PURCHASING, PROJECT_MANAGER, SUPER_ADMIN, ADMIN
  const canReadReconciliation =
    isProcurement ||
    isSuperAdmin ||
    isProjectManager ||
    userRoles.includes('PURCHASING') ||
    userRoles.includes('ADMIN');

  // Workstation Tab
  const [activeTabKey, setActiveTabKey] = useState<string>('packages');

  // Package Intake Filters
  const [statusFilter, setStatusFilter] = useState<string>('SUBMITTED');

  // Package Drawer & Modals
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [isPackageDrawerOpen, setIsPackageDrawerOpen] = useState<boolean>(false);

  // Return Package Modal
  const [returnModalOpen, setReturnModalOpen] = useState<boolean>(false);
  const [packageToReturn, setPackageToReturn] = useState<ProcurementPackage | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);

  // Create PR Submitting state
  const [createPrLoadingId, setCreatePrLoadingId] = useState<number | null>(null);

  // Existing PR, PO & GR Workflow Modal States
  const [selectedPrForApproval, setSelectedPrForApproval] = useState<any | null>(null);
  const [isPrApprovalModalOpen, setIsPrApprovalModalOpen] = useState<boolean>(false);
  const [prVersion, setPrVersion] = useState<number>(0);

  const [selectedPrForRfq, setSelectedPrForRfq] = useState<any | null>(null);
  const [isCreateRfqModalOpen, setIsCreateRfqModalOpen] = useState<boolean>(false);
  const [rfqVersion, setRfqVersion] = useState<number>(0);

  const [selectedPoForView, setSelectedPoForView] = useState<PurchaseOrderPrototypeRecord | null>(null);
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);
  const [poVersion, setPoVersion] = useState<number>(0);

  const [selectedPoForGr, setSelectedPoForGr] = useState<PurchaseOrderPrototypeRecord | null>(null);
  const [selectedGrForView, setSelectedGrForView] = useState<GoodsReceiptRecord | null>(null);
  const [isGrModalOpen, setIsGrModalOpen] = useState<boolean>(false);
  const [grVersion, setGrVersion] = useState<number>(0);

  // 1. CANONICAL INTAKE: GET /procurement/packages
  const packageQueryFilters = useMemo(() => {
    const q: { status?: ProcurementPackageStatus } = {};
    if (statusFilter && statusFilter !== 'ALL') {
      q.status = statusFilter as ProcurementPackageStatus;
    }
    return q;
  }, [statusFilter]);

  const {
    data: packages = [],
    isLoading: packagesLoading,
    isError: packagesError,
    error: packagesFetchError,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ['procurement-packages', packageQueryFilters],
    queryFn: () => ProcurementService.getPackages(packageQueryFilters),
    staleTime: 30 * 1000,
  });

  // Query for unresolved reconciliations count badge (only for authorized roles)
  const { data: unresolvedReconciliations = [], refetch: refetchReconciliations } = useQuery({
    queryKey: ['procurement-reconciliations'],
    queryFn: () => ProcurementService.getUnresolvedReconciliations(),
    enabled: Boolean(user && canReadReconciliation),
    staleTime: 60 * 1000,
  });

  const submittedPackagesCount = useMemo(() => {
    if (statusFilter === 'SUBMITTED') return packages.length;
    return packages.filter((p) => p.status === 'SUBMITTED').length;
  }, [packages, statusFilter]);

  // 2. Existing Downstream PR, PO & GR Queries
  const { data: procurementData, isLoading: loadingPrPo, refetch: refetchPrPo } = useQuery({
    queryKey: ['procurement-prs-pos', user?.sub, prVersion, rfqVersion, poVersion, grVersion],
    enabled: Boolean(user),
    queryFn: async () => {
      try {
        const [prData, rfqData, poData, grData] = await Promise.all([
          ProcurementService.getPurchaseRequests().catch((e) => {
            console.warn('Failed to load purchase requests:', e);
            return [];
          }),
          ProcurementService.getRfqs().catch((e) => {
            console.warn('Failed to load RFQs:', e);
            return [];
          }),
          ProcurementService.getPurchaseOrders().catch((e) => {
            console.warn('Failed to load purchase orders:', e);
            return [];
          }),
          ProcurementService.getGoodsReceipts().catch((e) => {
            console.warn('Failed to load goods receipts:', e);
            return [];
          }),
        ]);
        return {
          prs: Array.isArray(prData) ? prData : [],
          rfqs: Array.isArray(rfqData) ? rfqData : [],
          pos: Array.isArray(poData) ? poData : [],
          grs: Array.isArray(grData) ? grData : [],
        };
      } catch (error: any) {
        if (error.response?.status === 401) {
          message.warning('Anda belum login. Beberapa data mungkin tidak tampil.');
        } else {
          message.error('Gagal mengambil data downstream Procurement');
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const prs = useMemo(() => procurementData?.prs || [], [procurementData]);
  const rfqs = useMemo(() => procurementData?.rfqs || [], [procurementData]);
  const pos = useMemo(() => procurementData?.pos || [], [procurementData]);

  const rfqMapByPrId = useMemo(() => {
    const map: Record<string, RfqRecord> = {};
    for (const r of rfqs) {
      if (r.prId) map[String(r.prId)] = r;
      if (r.purchaseRequest?.prNumber) map[String(r.purchaseRequest.prNumber)] = r;
    }
    return map;
  }, [rfqs]);

  const existingPoForSelectedPr = useMemo(() => {
    if (!selectedPrForRfq) return null;
    const prId = Number(selectedPrForRfq.id);
    return (
      pos.find((p: any) => {
        const pPrId = Number(p.purchaseRequestId || p.purchaseRequest?.id || p.prId);
        if (prId && pPrId === prId) return true;
        if (selectedPrForRfq.prNumber && p.purchaseRequest?.prNumber === selectedPrForRfq.prNumber) return true;
        return false;
      }) || null
    );
  }, [selectedPrForRfq, pos]);

  const handleOpenPrApproval = (pr: any) => {
    setSelectedPrForApproval(pr);
    setIsPrApprovalModalOpen(true);
  };

  // 3. ACTION HANDLERS FOR PROCUREMENT PACKAGE

  const handleOpenDetail = (pkgId: number) => {
    setSelectedPackageId(pkgId);
    setIsPackageDrawerOpen(true);
  };

  const handleOpenReturnModal = (pkg: ProcurementPackage) => {
    setPackageToReturn(pkg);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!packageToReturn) return;
    const trimmed = returnReason.trim();
    if (!trimmed) {
      message.error('Alasan pengembalian paket wajib diisi');
      return;
    }

    setReturnSubmitting(true);
    try {
      await ProcurementService.returnPackage(packageToReturn.id, { reason: trimmed });
      message.success(`Paket pengadaan ${packageToReturn.packageNumber} berhasil dikembalikan ke PM.`);
      queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-package', packageToReturn.id] });
      setReturnModalOpen(false);
      setPackageToReturn(null);
      setReturnReason('');
      if (isPackageDrawerOpen) {
        setIsPackageDrawerOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to return package:', err);
      message.error(err.response?.data?.message || 'Gagal mengembalikan paket ke PM');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleCreatePr = async (pkg: ProcurementPackage) => {
    setCreatePrLoadingId(pkg.id);
    try {
      const result = await ProcurementService.createPrFromPackage(pkg.id);
      message.success(
        `Purchase Request ${result.purchaseRequest?.prNumber || (result as any).prNumber || ''} berhasil dibuat dari paket pengadaan!`
      );
      queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-package', pkg.id] });
      queryClient.invalidateQueries({ queryKey: ['procurement-prs-pos'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-prs'] });
      refetchPrPo();
      if (isPackageDrawerOpen) {
        setIsPackageDrawerOpen(false);
      }
    } catch (err: any) {
      console.error('Failed to create PR from package:', err);
      const status = err.response?.status;
      const errorMsg = err.response?.data?.message || err.message || 'Gagal membuat Purchase Request';

      if (status === 409) {
        message.warning('Purchase Request sudah pernah dibuat untuk paket pengadaan ini.');
        queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
        queryClient.invalidateQueries({ queryKey: ['procurement-package', pkg.id] });
      } else if (status === 422) {
        // Safety Gate active: unresolved reconciliation items exist for this project
        Modal.warning({
          title: 'Safety Gate Aktif — Rekonsiliasi Belum Selesai',
          centered: true,
          width: 520,
          content: (
            <div style={{ marginTop: 8 }}>
              <Paragraph style={{ color: '#0f172a', fontSize: 13 }}>
                {errorMsg}
              </Paragraph>
              <Alert
                type="warning"
                showIcon
                message="Tindakan Diperlukan"
                description="Terdapat item PR legacy atau ad-hoc pada proyek ini yang belum direkonsiliasi dengan WBS RAB. Selesaikan rekonsiliasi atau eksklusi item terlebih dahulu untuk mencegah duplikasi pengadaan barang/jasa."
                style={{ marginTop: 12 }}
              />
            </div>
          ),
          okText: 'Buka Tab Rekonsiliasi',
          cancelText: 'Tutup',
          okButtonProps: { style: { backgroundColor: '#1d4ed8' } },
          onOk: () => {
            setActiveTabKey('reconciliation');
          },
        });
      } else if (status === 403) {
        message.error('Akses ditolak. Anda tidak memiliki otoritas untuk memproses paket ini.');
      } else if (status === 404) {
        message.error('Paket pengadaan tidak ditemukan di database.');
        queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
      } else {
        message.error(errorMsg);
      }
    } finally {
      setCreatePrLoadingId(null);
    }
  };

  const handleViewLinkedPr = (linkedPrOrPackage: any) => {
    const linkedPr = linkedPrOrPackage?.purchaseRequest || linkedPrOrPackage;
    if (!linkedPr) {
      message.info('Informasi Purchase Request tidak tersedia');
      return;
    }
    // Check if we can find full PR record from prs list
    const found = prs.find(
      (p: any) =>
        String(p.id) === String(linkedPr.id) ||
        (linkedPr.prNumber && p.prNumber === linkedPr.prNumber)
    );
    setSelectedPrForApproval(found || linkedPr);
    setIsPrApprovalModalOpen(true);
  };

  // 4. COLUMNS DEFINITIONS

  const packageColumns = useMemo(
    () => [
      {
        title: 'Nomor Paket & Judul',
        key: 'packageNumber',
        width: 240,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8', fontFamily: 'monospace' }}>
              {r.packageNumber || `PKG-${r.id}`}
            </div>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0f172a', marginTop: 2 }}>
              {r.title}
            </div>
            <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
              Ref ID: #{r.id}
            </div>
          </div>
        ),
      },
      {
        title: 'Proyek',
        key: 'project',
        width: 220,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>
              {r.project?.name || 'Tanpa Nama Proyek'}
            </div>
            <Space size={4} style={{ marginTop: 2 }}>
              <Tag color="blue" style={{ margin: 0, fontFamily: 'monospace', fontSize: 10.5 }}>
                {r.project?.code || `ID-${r.projectId}`}
              </Tag>
            </Space>
          </div>
        ),
      },
      {
        title: 'Pembuat (PM)',
        key: 'requester',
        width: 160,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div style={{ fontWeight: 500, fontSize: 12, color: '#0f172a' }}>
              {r.requester?.fullName || r.requester?.email || '—'}
            </div>
            {r.submittedAt && (
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                Diajukan: {dayjs(r.submittedAt).format('DD/MM/YYYY HH:mm')}
              </div>
            )}
          </div>
        ),
      },
      {
        title: 'Target Dibutuhkan',
        dataIndex: 'requiredDate',
        key: 'requiredDate',
        width: 140,
        render: (date: string) => (
          <span style={{ fontSize: 12, color: date ? '#0f172a' : '#94a3b8' }}>
            {date ? dayjs(date).format('DD MMM YYYY') : '—'}
          </span>
        ),
      },
      {
        title: 'Item & Estimasi Total',
        key: 'itemsTotal',
        width: 170,
        render: (_: any, r: ProcurementPackage) => (
          <div>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: '#059669' }}>
              Rp {Number(r.totalEstimatedAmount || 0).toLocaleString('id-ID')}
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {(r.items || []).length} Item RAB
            </span>
          </div>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 130,
        render: (status: ProcurementPackageStatus) => getPackageStatusTag(status),
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 220,
        align: 'center' as const,
        render: (_: any, r: ProcurementPackage) => {
          const isSubmitted = r.status === 'SUBMITTED';
          const isPrCreated = r.status === 'PR_CREATED';
          const isReturned = r.status === 'RETURNED';

          return (
            <Space size={6} wrap>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleOpenDetail(r.id)}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11.5,
                  borderColor: '#93c5fd',
                  color: '#1d4ed8',
                  background: '#eff6ff',
                }}
              >
                Detail
              </Button>

              {isSubmitted && canPerformProcurementAction && (
                <>
                  <Button
                    type="primary"
                    size="small"
                    icon={<SendOutlined />}
                    loading={createPrLoadingId === r.id}
                    onClick={() => handleCreatePr(r)}
                    style={{
                      backgroundColor: '#059669',
                      borderColor: '#059669',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 11.5,
                    }}
                  >
                    Buat PR
                  </Button>
                  <Button
                    danger
                    size="small"
                    icon={<RollbackOutlined />}
                    onClick={() => handleOpenReturnModal(r)}
                    style={{
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 11.5,
                    }}
                  >
                    Kembalikan
                  </Button>
                </>
              )}

              {isPrCreated && (
                <Button
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => handleViewLinkedPr(r)}
                  style={{
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11.5,
                    borderColor: '#86efac',
                    color: '#15803d',
                    background: '#f0fdf4',
                  }}
                >
                  Lihat PR
                </Button>
              )}

              {isReturned && (
                <Tooltip title={r.rejectionReason || 'Paket dikembalikan ke PM untuk revisi'}>
                  <Tag color="volcano" style={{ fontSize: 10, margin: 0 }}>
                    Dalam Revisi PM
                  </Tag>
                </Tooltip>
              )}
            </Space>
          );
        },
      },
    ],
    [canPerformProcurementAction, createPrLoadingId]
  );

  const prColumns = useMemo(
    () => [
      {
        title: 'Nomor PR',
        dataIndex: 'prNumber',
        key: 'prNumber',
        render: (val: string, r: any) => {
          const effectiveStatus = r.status || 'SUBMITTED';
          const isApproved = effectiveStatus === 'APPROVED';
          const hasCanonicalApproved = prs.some(
            (otherPr) =>
              String(otherPr.projectId) === String(r.projectId) &&
              String(otherPr.id) !== String(r.id) &&
              otherPr.status === 'APPROVED'
          );
          const isDuplicate = hasCanonicalApproved && !isApproved;

          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{val || `PR-${r.id}`}</span>
                {isDuplicate && (
                  <Tag color="volcano" style={{ fontSize: 9.5, fontWeight: 700, margin: 0, padding: '0 4px', borderRadius: 3 }}>
                    DUPLICATE
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>Ref ID: #{r.id}</div>
            </div>
          );
        },
      },
      {
        title: 'Estimasi Total',
        dataIndex: 'totalEstimatedAmount',
        key: 'totalEstimatedAmount',
        render: (val: number) => (
          <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
            Rp {Number(val || 0).toLocaleString('id-ID')}
          </span>
        ),
      },
      {
        title: 'Status Alur Approval',
        key: 'approvalStatus',
        render: (_: any, r: any) => {
          const effectiveStatus: PrApprovalStatus = (r.status as PrApprovalStatus) || 'SUBMITTED';
          return <PrStatusBadge status={effectiveStatus} />;
        },
      },
      {
        title: 'Status RFQ',
        key: 'rfqStatus',
        render: (_: any, r: any) => {
          const rfq = rfqMapByPrId[String(r.id)] || (r.prNumber ? rfqMapByPrId[String(r.prNumber)] : undefined);
          if (!rfq) return <span style={{ color: '#94a3b8' }}>—</span>;
          return (
            <Space direction="vertical" size={2}>
              <Tag color="geekblue" style={{ fontWeight: 700, margin: 0, borderRadius: 4, fontSize: 11 }}>
                {rfq.rfqNumber}
              </Tag>
              <Tag color={rfq.status === 'EVALUATED' ? 'purple' : 'green'} style={{ fontSize: 9.5, margin: 0, padding: '0 4px', borderRadius: 3, fontWeight: 600 }}>
                ● {rfq.status}
              </Tag>
              {rfq.comparison?.selectedWinnerVendorName && (
                <span style={{ fontSize: 9.5, color: '#6b21a8', fontWeight: 600 }}>
                  🏆 {rfq.comparison.selectedWinnerVendorName}
                </span>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Tanggal Dibuat',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) => (date ? dayjs(date).format('DD MMM YYYY HH:mm') : '—'),
      },
      {
        title: 'Aksi',
        key: 'approvalAction',
        align: 'center' as const,
        render: (_: any, r: any) => {
          const effectiveStatus = r.status || 'SUBMITTED';
          const isApproved = effectiveStatus === 'APPROVED';
          const rfq = rfqMapByPrId[String(r.id)] || (r.prNumber ? rfqMapByPrId[String(r.prNumber)] : undefined);
          const canCreateRfq = isProcurement || isSuperAdmin;

          return (
            <Space size={6} wrap>
              <Button
                size="small"
                icon={<AuditOutlined />}
                onClick={() => handleOpenPrApproval(r)}
                style={{
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11.5,
                  borderColor: '#93c5fd',
                  color: '#1d4ed8',
                  background: '#eff6ff',
                }}
              >
                Alur Approval
              </Button>

              {isApproved && canCreateRfq && (
                !rfq ? (
                  <Button
                    type="primary"
                    size="small"
                    icon={<SendOutlined />}
                    onClick={() => {
                      setSelectedPrForRfq(r);
                      setIsCreateRfqModalOpen(true);
                    }}
                    style={{
                      backgroundColor: '#059669',
                      borderColor: '#059669',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 11.5,
                    }}
                  >
                    Buat RFQ
                  </Button>
                ) : (
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setSelectedPrForRfq(r);
                      setIsCreateRfqModalOpen(true);
                    }}
                    style={{
                      borderColor: '#0284c7',
                      color: '#0284c7',
                      background: '#f0f9ff',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 11.5,
                    }}
                  >
                    Lihat RFQ
                  </Button>
                )
              )}
            </Space>
          );
        },
      },
    ],
    [prVersion, rfqVersion, isProcurement, isSuperAdmin, prs, rfqMapByPrId]
  );

  const allGoodsReceipts: GoodsReceiptRecord[] = useMemo(() => {
    const rawGrs = procurementData?.grs || [];
    return rawGrs.map((g: any) => {
      const items = Array.isArray(g.items) ? g.items : [];
      const totalQty = items.reduce((sum: number, it: any) => sum + Number(it.receivedQuantity || 0), 0);
      return {
        grId: String(g.id),
        grNumber: g.grNumber || `GR-${g.id}`,
        poId: String(g.poId || g.purchaseOrder?.id || ''),
        poNumber: g.purchaseOrder?.poNumber || (g.poId ? `PO-${g.poId}` : '-'),
        prId: g.purchaseOrder?.purchaseRequest?.id || g.purchaseOrder?.purchaseRequestId || '',
        prNumber: g.purchaseOrder?.purchaseRequest?.prNumber || '',
        projectId: g.purchaseOrder?.purchaseRequest?.project?.id || g.purchaseOrder?.purchaseRequest?.projectId || '',
        projectName: g.purchaseOrder?.purchaseRequest?.project?.name || g.purchaseOrder?.purchaseRequest?.projectName || '',
        vendorId: g.purchaseOrder?.vendor?.id || g.purchaseOrder?.vendorId || 0,
        vendorCode: g.purchaseOrder?.vendor?.code || g.purchaseOrder?.vendor?.vendorCode || '',
        vendorName: g.purchaseOrder?.vendor?.name || g.purchaseOrder?.vendorName || '—',
        receiptDate: g.receiptDate,
        deliveryNoteNumber: g.deliveryNoteNumber,
        remarks: g.remarks,
        status: (g.purchaseOrder?.status === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL') as 'COMPLETED' | 'PARTIAL',
        createdAt: g.createdAt,
        createdBy: g.createdBy ? `User #${g.createdBy}` : 'Petugas Logistik',
        totalItemsCount: items.length,
        totalQtyReceivedInGr: totalQty,
        items: items,
      };
    });
  }, [procurementData, grVersion]);

  const poColumns = useMemo(
    () => [
      {
        title: 'Nomor PO',
        dataIndex: 'poNumber',
        key: 'poNumber',
        render: (poNum: string) => (
          <span style={{ fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>
            {poNum}
          </span>
        ),
      },
      {
        title: 'Vendor Pemenang',
        key: 'vendor',
        render: (_: any, r: any) => {
          const vName = r.vendor?.name || r.vendorName || '—';
          const vCode = r.vendor?.code || r.vendorCode;
          return (
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{vName}</div>
              {vCode && (
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                  {vCode}
                </Tag>
              )}
            </div>
          );
        },
      },
      {
        title: 'Total Pembelian',
        dataIndex: 'totalAmount',
        key: 'totalAmount',
        align: 'right' as const,
        render: (val: number) => (
          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#059669' }}>
            Rp {Number(val || 0).toLocaleString('id-ID')}
          </span>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        align: 'center' as const,
        render: (status: string) => {
          const color =
            status === 'COMPLETED'
              ? 'green'
              : status === 'PARTIALLY_FULFILLED'
              ? 'gold'
              : 'blue';
          return (
            <Tag color={color} style={{ fontWeight: 700 }}>
              ● {status}
            </Tag>
          );
        },
      },
      {
        title: 'Tanggal Terbit',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) => (date ? dayjs(date).format('DD MMM YYYY HH:mm') : '—'),
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 250,
        align: 'center' as const,
        render: (_: any, r: any) => {
          const poRecord: PurchaseOrderPrototypeRecord = r.rawRecord || r;
          const poGrs = allGoodsReceipts.filter(
            (g) =>
              String(g.poId) === String(poRecord.poId || (poRecord as any).id) ||
              String(g.poNumber) === String(poRecord.poNumber)
          );
          const isEligibleForGr =
            (r.status === 'ISSUED' || r.status === 'PARTIALLY_FULFILLED') && canReceiveGoods;
          const isCompleted = r.status === 'COMPLETED';

          return (
            <Space size={6} wrap>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedPoForView(poRecord);
                  setIsPoModalOpen(true);
                }}
                style={{
                  borderColor: '#0284c7',
                  color: '#0284c7',
                  background: '#f0f9ff',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                Lihat PO
              </Button>

              {isEligibleForGr && (
                <Button
                  size="small"
                  icon={<InboxOutlined />}
                  onClick={() => {
                    setSelectedPoForGr(poRecord);
                    setSelectedGrForView(null);
                    setIsGrModalOpen(true);
                  }}
                  style={{
                    borderColor: '#0d9488',
                    color: '#0d9488',
                    background: '#f0fdfa',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  Terima Barang
                </Button>
              )}

              {isCompleted && (
                <Tag color="green" style={{ fontWeight: 700, margin: 0, padding: '2px 6px', fontSize: 10.5 }}>
                  ✅ Selesai Diterima
                </Tag>
              )}

              {poGrs.length > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedGrForView(poGrs[0]);
                    setSelectedPoForGr(null);
                    setIsGrModalOpen(true);
                  }}
                  style={{
                    borderColor: '#d97706',
                    color: '#b45309',
                    background: '#fffbeb',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  Riwayat GR ({poGrs.length})
                </Button>
              )}
            </Space>
          );
        },
      },
    ],
    [canReceiveGoods, grVersion, poVersion, allGoodsReceipts]
  );

  const grColumns = useMemo(
    () => [
      {
        title: 'Nomor GR',
        dataIndex: 'grNumber',
        key: 'grNumber',
        render: (grNum: string) => (
          <span style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>
            {grNum}
          </span>
        ),
      },
      {
        title: 'Nomor PO',
        dataIndex: 'poNumber',
        key: 'poNumber',
        render: (poNum: string) => (
          <span style={{ fontWeight: 600, color: '#1d4ed8', fontFamily: 'monospace' }}>
            {poNum}
          </span>
        ),
      },
      {
        title: 'Vendor',
        key: 'vendor',
        render: (_: any, r: GoodsReceiptRecord) => (
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{r.vendorName}</div>
            <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
              {r.vendorCode}
            </Tag>
          </div>
        ),
      },
      {
        title: 'Tanggal Terima',
        dataIndex: 'receiptDate',
        key: 'receiptDate',
        render: (date: string) => (date ? dayjs(date).format('DD MMM YYYY') : '—'),
      },
      {
        title: 'No. Surat Jalan / DO',
        dataIndex: 'deliveryNoteNumber',
        key: 'deliveryNoteNumber',
        render: (val: string) => <span style={{ fontSize: 11.5 }}>{val || '—'}</span>,
      },
      {
        title: 'Total Item Diterima',
        key: 'totalReceived',
        align: 'center' as const,
        render: (_: any, r: GoodsReceiptRecord) => (
          <Tag color="teal" style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
            {r.totalQtyReceivedInGr} Unit ({r.totalItemsCount} Item)
          </Tag>
        ),
      },
      {
        title: 'Status Pemenuhan',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        align: 'center' as const,
        render: (status: string) => (
          <Tag color={status === 'COMPLETED' ? 'green' : 'gold'} style={{ fontWeight: 700 }}>
            ● {status === 'COMPLETED' ? 'COMPLETED' : 'PARTIAL'}
          </Tag>
        ),
      },
      {
        title: 'Penerima',
        dataIndex: 'createdBy',
        key: 'createdBy',
        render: (val: string) => <span style={{ fontSize: 11.5, color: '#64748b' }}>{val || '—'}</span>,
      },
      {
        title: 'Aksi',
        key: 'action',
        width: 100,
        align: 'center' as const,
        render: (_: any, r: GoodsReceiptRecord) => (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedGrForView(r);
              setSelectedPoForGr(null);
              setIsGrModalOpen(true);
            }}
            style={{
              borderColor: '#0d9488',
              color: '#0d9488',
              background: '#f0fdfa',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            Lihat GR
          </Button>
        ),
      },
    ],
    []
  );

  // 5. TABS ITEMS
  const tabItems = [
    {
      key: 'packages',
      label: (
        <span>
          <InboxOutlined style={{ marginRight: 6 }} />
          Paket Pengadaan
          {submittedPackagesCount > 0 && (
            <Badge
              count={submittedPackagesCount}
              style={{ marginLeft: 8, backgroundColor: '#f59e0b' }}
            />
          )}
        </span>
      ),
      children: (
        <div>
          {/* Package Filter & Refresh Toolbar */}
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <Space size={12} wrap align="center">
                <span style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                  <FilterOutlined style={{ marginRight: 6 }} />
                  Filter Status Paket:
                </span>
                <Select
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  style={{ width: 180 }}
                  options={[
                    { label: 'SUBMITTED (Antrean)', value: 'SUBMITTED' },
                    { label: 'RETURNED (Revisi PM)', value: 'RETURNED' },
                    { label: 'PR_CREATED (Terbit PR)', value: 'PR_CREATED' },
                    { label: 'CANCELLED (Dibatalkan)', value: 'CANCELLED' },
                    { label: 'CLOSED (Selesai)', value: 'CLOSED' },
                    { label: 'Semua Status (ALL)', value: 'ALL' },
                  ]}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Menampilkan {packages.length} paket
                </Text>
              </Space>

              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => refetchPackages()}
                loading={packagesLoading}
                style={{ fontSize: 12 }}
              >
                Segarkan Antrean
              </Button>
            </div>
          </Card>

          {/* Package Table */}
          <Card
            size="small"
            style={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              columns={packageColumns}
              dataSource={packages}
              rowKey="id"
              loading={packagesLoading}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                          Tidak ada paket pengadaan dengan filter ini
                        </div>
                        <Text type="secondary" style={{ fontSize: 11.5 }}>
                          Paket pengadaan dibuat oleh Project Manager pada proyek berstatus IN_PROGRESS.
                        </Text>
                      </div>
                    }
                  />
                ),
              }}
            />
          </Card>
        </div>
      ),
    },
    ...(canReadReconciliation
      ? [
          {
            key: 'reconciliation',
            label: (
              <span>
                <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                Rekonsiliasi
                {unresolvedReconciliations.length > 0 && (
                  <Badge
                    count={unresolvedReconciliations.length}
                    style={{ marginLeft: 8, backgroundColor: '#ef4444' }}
                  />
                )}
              </span>
            ),
            children: (
              <ReconciliationTab
                onReconciliationChanged={() => {
                  queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
                  queryClient.invalidateQueries({ queryKey: ['procurement-reconciliations'] });
                  refetchReconciliations();
                }}
              />
            ),
          },
        ]
      : []),
    {
      key: 'pr',
      label: (
        <span>
          <FileDoneOutlined style={{ marginRight: 6 }} />
          Purchase Request ({prs.length})
        </span>
      ),
      children: (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Space size={8}>
                <FileDoneOutlined style={{ color: '#2563eb' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  Daftar Purchase Request (PR) &amp; Status Approval
                </span>
              </Space>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                Alur 2-Level: Procurement (Maker) → Finance (Reviewer) → Director (Final Approval)
              </span>
            </div>
          }
          size="small"
          style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          <Table
            columns={prColumns}
            dataSource={prs}
            rowKey="id"
            loading={loadingPrPo}
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                        Belum ada Purchase Request
                      </div>
                      <Text type="secondary" style={{ fontSize: 11.5 }}>
                        Buat PR dari Paket Pengadaan berstatus SUBMITTED di tab &ldquo;Paket Pengadaan&rdquo;.
                      </Text>
                    </div>
                  }
                />
              ),
            }}
          />
        </Card>
      ),
    },
    {
      key: 'po',
      label: (
        <span>
          <ShoppingCartOutlined style={{ marginRight: 6 }} />
          Purchase Order ({pos.length})
        </span>
      ),
      children: (
        <Card
          title="Daftar Purchase Order (PO)"
          size="small"
          style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        >
          <Table
            columns={poColumns}
            dataSource={pos}
            rowKey="id"
            loading={loadingPrPo}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
    {
      key: 'gr',
      label: (
        <span>
          <InboxOutlined style={{ marginRight: 6 }} />
          Goods Receipt ({allGoodsReceipts.length})
        </span>
      ),
      children: (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Space size={8}>
                <InboxOutlined style={{ color: '#0d9488', fontSize: 16 }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  Daftar Goods Receipt (GR) &amp; Riwayat Penerimaan Fisik Barang
                </span>
                <Tag color="teal" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                  {allGoodsReceipts.length} Penerimaan Tercatat
                </Tag>
              </Space>
              <span style={{ fontSize: 11.5, color: '#64748b' }}>
                Bukti Penerimaan Fisik di Gudang/Site dengan Validasi Anti Over-Receipt
              </span>
            </div>
          }
          size="small"
          style={{ borderRadius: 8, border: '1px solid #ccfbf1', background: '#ffffff' }}
        >
          <Table
            columns={grColumns}
            dataSource={allGoodsReceipts}
            rowKey="grId"
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#475569' }}>
                        Belum ada Goods Receipt yang diterbitkan
                      </div>
                      <Text type="secondary" style={{ fontSize: 11.5 }}>
                        Klik tombol &ldquo;Terima Barang&rdquo; pada PO berstatus ISSUED untuk memproses penerimaan barang fisik.
                      </Text>
                    </div>
                  }
                />
              ),
            }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Workstation Header */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          Procurement Workstation
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Antrean Paket Pengadaan (Intake), Rekonsiliasi Item Legacy/Ad-hoc, Purchase Request (PR), dan Purchase Order (PO)
        </Text>
      </div>

      {/* Summary Statistic Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={canReadReconciliation ? 6 : 8}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #fed7aa', background: '#fffbeb' }}>
            <Statistic
              title="Antrean Paket (SUBMITTED)"
              value={submittedPackagesCount}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
            />
          </Card>
        </Col>
        {canReadReconciliation && (
          <Col xs={24} sm={6}>
            <Card size="small" style={{ borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2' }}>
              <Statistic
                title="Perlu Rekonsiliasi"
                value={unresolvedReconciliations.length}
                prefix={<SafetyCertificateOutlined />}
                valueStyle={{ color: '#dc2626', fontWeight: 700 }}
              />
            </Card>
          </Col>
        )}
        <Col xs={24} sm={canReadReconciliation ? 6 : 8}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Total Purchase Request"
              value={prs.length}
              prefix={<FileDoneOutlined />}
              valueStyle={{ color: '#2563eb', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={canReadReconciliation ? 6 : 8}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Statistic
              title="Total Purchase Order"
              value={pos.length}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#059669', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTabKey}
        onChange={(k) => setActiveTabKey(k)}
        items={tabItems}
        type="card"
      />

      {/* PACKAGE DETAIL DRAWER */}
      <ProcurementPackageDetailDrawer
        open={isPackageDrawerOpen}
        onClose={() => {
          setIsPackageDrawerOpen(false);
          setSelectedPackageId(null);
        }}
        packageId={selectedPackageId}
        onReturnClick={(pkg) => handleOpenReturnModal(pkg)}
        onCreatePrClick={(pkg) => handleCreatePr(pkg)}
        onViewLinkedPrClick={(pr) => handleViewLinkedPr(pr)}
      />

      {/* RETURN PACKAGE MODAL */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#dc2626' }} />
            <span>Kembalikan Paket Pengadaan ke PM</span>
          </Space>
        }
        open={returnModalOpen}
        onCancel={() => {
          if (!returnSubmitting) {
            setReturnModalOpen(false);
            setPackageToReturn(null);
            setReturnReason('');
          }
        }}
        onOk={handleConfirmReturn}
        okText="Konfirmasi Kembalikan"
        cancelText="Batal"
        confirmLoading={returnSubmitting}
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        {packageToReturn && (
          <div style={{ marginTop: 8 }}>
            <Paragraph style={{ fontSize: 13, color: '#334155' }}>
              Anda akan mengembalikan paket <strong>{packageToReturn.packageNumber}</strong> ({packageToReturn.title}) kepada Project Manager untuk perbaikan/revisi.
            </Paragraph>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12.5 }}>
                Alasan Pengembalian / Catatan Revisi <span style={{ color: '#dc2626' }}>*</span>:
              </Text>
              <TextArea
                rows={4}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Contoh: Estimasi harga satuan untuk kabel NYY terlalu tinggi dibanding harga pasar, mohon verifikasi ulang kuantitas pipa."
                style={{ marginTop: 6 }}
                maxLength={500}
                showCount
              />
            </div>
          </div>
        )}
      </Modal>

      {/* PR APPROVAL WORKFLOW MODAL */}
      <Modal
        open={isPrApprovalModalOpen}
        onCancel={() => {
          setIsPrApprovalModalOpen(false);
          setSelectedPrForApproval(null);
        }}
        footer={null}
        width="min(880px, 94vw)"
        centered
        destroyOnClose
        title={null}
        styles={{ body: { padding: 0 } }}
      >
        {selectedPrForApproval && (
          <div style={{ padding: '8px 4px' }}>
            <PrApprovalWorkflow
              prId={selectedPrForApproval.id}
              prNumber={selectedPrForApproval.prNumber || `PR-${selectedPrForApproval.id}`}
              projectId={selectedPrForApproval.projectId || selectedPrForApproval.id}
              projectName={
                (selectedPrForApproval as any).project?.name ||
                selectedPrForApproval.projectName ||
                selectedPrForApproval.project_name ||
                '[Proyek Tidak Terdefinisi]'
              }
              totalAmount={Number(selectedPrForApproval.totalEstimatedAmount || 0)}
              customerName={selectedPrForApproval.customerName || selectedPrForApproval.customer_name || '-'}
              budgetAllocation={Number(selectedPrForApproval.totalEstimatedAmount || 0)}
              wbsTaskName={selectedPrForApproval.wbsTaskName || 'WBS Pengadaan Material & Peralatan'}
              opPlanRef={selectedPrForApproval.opPlanRef || (selectedPrForApproval.projectId ? `OP-${selectedPrForApproval.projectId}` : `PR-${selectedPrForApproval.id}`)}
              items={selectedPrForApproval.items || []}
              initialStatus={(selectedPrForApproval.status as PrApprovalStatus) || 'SUBMITTED'}
              isProcurement={isProcurement}
              isFinance={isFinance}
              isDirector={isDirector}
              isSuperAdmin={isSuperAdmin}
              currentUserName={user?.fullName || user?.email || 'User'}
              onStatusChange={() => {
                setPrVersion((v) => v + 1);
                refetchPrPo();
              }}
              onCreateRfqClick={() => {
                setIsPrApprovalModalOpen(false);
                setSelectedPrForRfq(selectedPrForApproval);
                setIsCreateRfqModalOpen(true);
              }}
            />
          </div>
        )}
      </Modal>

      {/* CREATE & VIEW RFQ MODAL */}
      {selectedPrForRfq && (
        <CreateRfqModal
          open={isCreateRfqModalOpen}
          onClose={() => {
            setIsCreateRfqModalOpen(false);
            setSelectedPrForRfq(null);
          }}
          pr={selectedPrForRfq}
          existingRfq={
            selectedPrForRfq
              ? rfqMapByPrId[String(selectedPrForRfq.id)] ||
                rfqMapByPrId[String(selectedPrForRfq.prNumber)] ||
                null
              : null
          }
          existingPo={existingPoForSelectedPr}
          onRfqCreated={() => {
            setRfqVersion((v) => v + 1);
            setPrVersion((v) => v + 1);
            setPoVersion((v) => v + 1);
            refetchPrPo();
          }}
          onPoCreated={() => {
            setPoVersion((v) => v + 1);
            refetchPrPo();
          }}
          currentUserName={user?.fullName || user?.email || 'Procurement Team'}
        />
      )}

      {/* PURCHASE ORDER VIEW MODAL */}
      {selectedPoForView && (
        <PurchaseOrderModal
          open={isPoModalOpen}
          onClose={() => {
            setIsPoModalOpen(false);
            setSelectedPoForView(null);
          }}
          comparison={null}
          rfq={null}
          existingPo={selectedPoForView}
          viewOnly={true}
          canReceiveGoods={canReceiveGoods}
          currentUserName={user?.fullName || user?.email || 'Procurement Team'}
          onOpenGoodsReceipt={(targetPoRecord) => {
            setIsPoModalOpen(false);
            setSelectedPoForView(null);
            setSelectedPoForGr(targetPoRecord);
            setSelectedGrForView(null);
            setIsGrModalOpen(true);
          }}
        />
      )}

      {/* GOODS RECEIPT MODAL (CREATE & VIEW) */}
      {(selectedPoForGr || selectedGrForView) && (
        <GoodsReceiptModal
          open={isGrModalOpen}
          onClose={() => {
            setIsGrModalOpen(false);
            setSelectedPoForGr(null);
            setSelectedGrForView(null);
          }}
          po={selectedPoForGr}
          existingGr={selectedGrForView}
          viewOnly={Boolean(selectedGrForView)}
          canReceiveGoods={canReceiveGoods}
          currentUserName={user?.fullName || user?.email || 'Petugas Logistik'}
          onGrCreated={(savedGr, updatedPo) => {
            setGrVersion((v) => v + 1);
            setPoVersion((v) => v + 1);
            refetchPrPo();
          }}
        />
      )}
    </div>
  );
};
