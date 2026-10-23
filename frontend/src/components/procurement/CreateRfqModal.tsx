"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal,
  Button,
  DatePicker,
  Form,
  Input,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Divider,
  Alert,
  message,
  Descriptions,
} from 'antd';
import {
  SendOutlined,
  FileDoneOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  InboxOutlined,
  ShopOutlined,
  PlusOutlined,
  EyeOutlined,
  DollarCircleOutlined,
  SlidersOutlined,
  TrophyOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { ProcurementService, RfqRecord, MasterVendor } from '@/services/procurement.service';
import { useAuth } from '@/context/AuthContext';
import {
  VendorQuotationModal,
  VendorQuotationRecord,
} from '@/components/procurement/VendorQuotationModal';
import {
  VendorComparisonModal,
  VendorComparisonResult,
} from '@/components/procurement/VendorComparisonModal';
import {
  PurchaseOrderPrototypeRecord,
} from '@/components/procurement/PurchaseOrderModal';

const { Text, Title } = Typography;

/**
 * Canonical check: can the current user cancel an RFQ?
 * Strictly limited to PURCHASING and PROCUREMENT roles.
 * Explicitly barred for PROJECT_MANAGER, DIRECTOR, HEAD_OF_OPERATIONS, ADMIN, SUPER_ADMIN.
 */
export const canUserCancelRfq = (roles: string[] = []): boolean => {
  const normalized = (roles || []).map((r) => String(r).toUpperCase());
  const isProcurementActor = normalized.includes('PURCHASING') || normalized.includes('PROCUREMENT');
  const isBlockedRole = normalized.some((r) =>
    ['PROJECT_MANAGER', 'DIRECTOR', 'HEAD_OF_OPERATIONS', 'ADMIN', 'SUPER_ADMIN'].includes(r)
  );
  return isProcurementActor && !isBlockedRole;
};

/**
 * Visibility predicate for "Batalkan RFQ" button:
 * Must be OPEN and user must have permitted Procurement role.
 */
export const isRfqCancelActionVisible = (rfqStatus?: string, roles: string[] = []): boolean => {
  return rfqStatus === 'OPEN' && canUserCancelRfq(roles);
};

/**
 * Direct Service PO unlock predicate:
 * Sourcing strategy switch from competitive RFQ to direct PO for SERVICE PR.
 * Enabled only if PR is Service and RFQ is either non-existent or CANCELLED.
 */
export const isDirectServicePoUnlocked = (
  isServicePr: boolean,
  rfqStatus?: string,
): boolean => {
  if (!isServicePr) return false;
  return !rfqStatus || rfqStatus === 'CANCELLED';
};

/**
 * Helper to determine the number of rendered "Batalkan RFQ" buttons
 * Guarantees exactly 1 when OPEN and authorized (in footer), exactly 0 when CANCELLED or unauthorized.
 */
export const countRfqCancelButtons = (
  isViewMode: boolean,
  rfqStatus?: string,
  roles: string[] = [],
): number => {
  if (!isViewMode) return 0;
  if (!isRfqCancelActionVisible(rfqStatus, roles)) return 0;
  return 1;
};

/**
 * Canonical helper for resolving PR action CTA:
 * PR + no RFQ -> 'Buat RFQ'
 * PR + active RFQ (OPEN / EVALUATED / CLOSED) -> 'Kelola RFQ'
 * PR + CANCELLED RFQ -> 'Buat RFQ Baru'
 */
export function resolvePrRfqAction(
  pr: any,
  activeRfq?: any,
  latestRfq?: any,
  po?: any,
  canActOnPr: boolean = true,
): 'Lihat PO' | 'Kelola RFQ' | 'Buat RFQ Baru' | 'Buat RFQ' | 'Alur Approval' {
  if (po) return 'Lihat PO';
  if (activeRfq && activeRfq.status !== 'CANCELLED') return 'Kelola RFQ';
  const effectiveStatus = pr?.status || 'SUBMITTED';
  const isApproved = effectiveStatus === 'APPROVED';
  if (isApproved && canActOnPr) {
    if (latestRfq && latestRfq.status === 'CANCELLED') {
      return 'Buat RFQ Baru';
    }
    return 'Buat RFQ';
  }
  return 'Alur Approval';
}

/**
 * Canonical helper for resolving CreateRfqModal display mode:
 * Active RFQ -> isViewMode = true
 * Cancelled RFQ -> isViewMode = false, hasCancelledRfq = true (reissue mode)
 */
export function resolveCreateRfqModalMode(
  viewOnly: boolean = false,
  activeRfq?: any,
): {
  isViewMode: boolean;
  hasActiveNonCancelledRfq: boolean;
  hasCancelledRfq: boolean;
  isReissueMode: boolean;
} {
  const hasActiveNonCancelledRfq = Boolean(activeRfq && activeRfq.status !== 'CANCELLED');
  const hasCancelledRfq = Boolean(activeRfq && activeRfq.status === 'CANCELLED');
  const isViewMode = viewOnly || hasActiveNonCancelledRfq;
  const isReissueMode = !isViewMode && hasCancelledRfq;
  return {
    isViewMode,
    hasActiveNonCancelledRfq,
    hasCancelledRfq,
    isReissueMode,
  };
}

export interface RfqPrototypeRecord {
  rfqId: string;
  rfqNumber: string;
  purchaseRequestId: number | string;
  prId: number | string;
  prNumber: string;
  projectId: number | string;
  projectName: string;
  totalAmount: number;
  closingDate: string;
  status: 'OPEN' | 'CLOSED' | 'AWARDED' | 'CANCELLED' | string;
  items: any[];
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface CreateRfqModalProps {
  open: boolean;
  onClose: () => void;
  pr: any | null;
  existingRfq?: RfqRecord | RfqPrototypeRecord | any | null;
  existingPo?: PurchaseOrderPrototypeRecord | any | null;
  onRfqCreated?: (rfq: RfqRecord | RfqPrototypeRecord | any) => void;
  onRfqCancelled?: (rfq: RfqRecord | RfqPrototypeRecord | any) => void;
  onPoCreated?: (po: PurchaseOrderPrototypeRecord | any) => void;
  currentUserName?: string;
  viewOnly?: boolean;
}

const mapBackendQuotationToRecord = (q: any, rfqObj: any): VendorQuotationRecord => {
  return {
    quotationId: String(q.id),
    quotationNumber: q.quotationNumber || q.quotation_number || undefined,
    rfqId: q.rfqId,
    rfqNumber: q.rfq?.rfqNumber || rfqObj?.rfqNumber || 'RFQ-N/A',
    projectId: rfqObj?.purchaseRequest?.project?.id || rfqObj?.purchaseRequest?.projectId || rfqObj?.projectId || rfqObj?.project_id || 0,
    projectName: rfqObj?.purchaseRequest?.project?.name || rfqObj?.projectName || rfqObj?.project_name || 'Proyek Tanpa Nama',
    vendorId: q.vendorId || q.vendor?.id,
    vendorCode: q.vendor?.code || `VEN-${q.vendorId}`,
    vendorName: q.vendor?.name || 'Vendor',
    budgetCeiling:
      Number(rfqObj?.totalAmount || 0) ||
      Number(rfqObj?.budgetCeiling || 0) ||
      Number(rfqObj?.purchaseRequest?.totalEstimatedAmount || 0) ||
      Number((rfqObj?.purchaseRequest as any)?.total_estimated_amount || 0) ||
      (Array.isArray(rfqObj?.purchaseRequest?.items)
        ? rfqObj.purchaseRequest.items.reduce(
            (sum: number, it: any) =>
              sum +
              Number(it.quantity || 0) *
                Number(it.estimatedUnitPrice || it.estimated_unit_price || it.unitPrice || 0),
            0,
          )
        : 0),
    totalOfferedAmount: Number(q.totalAmount || 0),
    leadTimeDays:
      q.leadTimeDays != null && !isNaN(Number(q.leadTimeDays))
        ? Number(q.leadTimeDays)
        : q.lead_time_days != null && !isNaN(Number(q.lead_time_days))
        ? Number(q.lead_time_days)
        : undefined,
    vendorNotes: q.notes || '',
    status: 'SUBMITTED',
    submittedAt: q.createdAt || new Date().toISOString(),
    items: Array.isArray(q.items)
      ? q.items.map((it: any, idx: number) => ({
          key: it.rabItemKey || (it.prItemId ? `item_pr_${it.prItemId}` : `item_${it.id || idx}`),
          categoryName: it.categoryName || 'Material & Peralatan',
          itemName: it.itemName,
          quantity: Number(it.quantity || 0),
          uom: it.uom || 'Unit',
          estimatedUnitPrice: Number(it.estimatedUnitPrice || 0),
          offeredUnitPrice: Number(it.unitPrice || 0),
          subtotal: Number(it.totalAmount || 0),
          prItemId: it.prItemId,
        }))
      : [],
  };
};

export const CreateRfqModal: React.FC<CreateRfqModalProps> = ({
  open,
  onClose,
  pr,
  existingRfq,
  existingPo = null,
  onRfqCreated,
  onRfqCancelled,
  onPoCreated,
  currentUserName = 'Procurement Team',
  viewOnly = false,
}) => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVendorQuoteModalOpen, setIsVendorQuoteModalOpen] = useState(false);
  const [selectedQuoteForView, setSelectedQuoteForView] = useState<VendorQuotationRecord | null>(null);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [comparisonVersion, setComparisonVersion] = useState(0);

  // Cancellation state
  const [localRfq, setLocalRfq] = useState<any>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [masterVendors, setMasterVendors] = useState<MasterVendor[]>([]);

  useEffect(() => {
    let isMounted = true;
    ProcurementService.getVendors()
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setMasterVendors(data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch vendors from API:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setLocalRfq(null);
    setCancelReason('');
    setCancelError(null);
    setIsCancelModalOpen(false);
  }, [open, existingRfq]);

  const activeRfq = useMemo(() => {
    if (localRfq) return localRfq;
    if (existingRfq) return existingRfq;
    return null;
  }, [localRfq, existingRfq, open]);

  const canCancelRfq = useMemo(() => {
    return canUserCancelRfq(user?.roles || []);
  }, [user]);

  const handleOpenCancelModal = () => {
    setCancelReason('');
    setCancelError(null);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelRfq = async () => {
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      message.error('Alasan pembatalan wajib diisi.');
      return;
    }

    const rfqIdNum = Number(activeRfq?.id || (activeRfq as any)?.rfqId);
    if (!rfqIdNum) {
      message.error('ID RFQ tidak valid.');
      return;
    }

    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await ProcurementService.cancelRfq(rfqIdNum, trimmedReason);
      message.success(`RFQ #${activeRfq?.rfqNumber || rfqIdNum} berhasil dibatalkan.`);
      setIsCancelModalOpen(false);
      setCancelReason('');

      const updatedRfq = {
        ...activeRfq,
        ...(res || {}),
        status: 'CANCELLED',
      };
      setLocalRfq(updatedRfq);

      onRfqCancelled?.(updatedRfq);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Gagal membatalkan RFQ. Terjadi kesalahan pada server.';
      setCancelError(errorMsg);
      message.error(errorMsg);
    } finally {
      setIsCancelling(false);
    }
  };

  const { hasActiveNonCancelledRfq, hasCancelledRfq, isViewMode } = resolveCreateRfqModalMode(
    viewOnly,
    activeRfq,
  );

  // Canonical Project Identity: RFQ -> PR -> Project
  const projectName = useMemo(() => {
    return (
      activeRfq?.purchaseRequest?.project?.name ||
      pr?.project?.name ||
      activeRfq?.projectName ||
      (activeRfq as any)?.project_name ||
      pr?.projectName ||
      (pr as any)?.project_name ||
      'Proyek Tanpa Nama'
    );
  }, [activeRfq, pr]);

  const projectCode = useMemo(() => {
    return (
      activeRfq?.purchaseRequest?.project?.code ||
      pr?.project?.code ||
      activeRfq?.projectCode ||
      (activeRfq as any)?.project_code ||
      pr?.projectCode ||
      (pr as any)?.project_code ||
      ''
    );
  }, [activeRfq, pr]);

  const prNumber = useMemo(() => {
    return (
      activeRfq?.purchaseRequest?.prNumber ||
      (activeRfq?.purchaseRequest as any)?.pr_number ||
      pr?.prNumber ||
      (pr as any)?.pr_number ||
      (activeRfq?.prId ? `PR-${activeRfq.prId}` : undefined) ||
      (pr?.id ? `PR-${pr.id}` : undefined) ||
      'PR-N/A'
    );
  }, [activeRfq, pr]);

  const effectiveProjectId = useMemo(() => {
    return (
      activeRfq?.purchaseRequest?.project?.id ||
      pr?.project?.id ||
      activeRfq?.purchaseRequest?.projectId ||
      pr?.projectId ||
      (pr as any)?.project_id ||
      pr?.id ||
      null
    );
  }, [activeRfq, pr]);

  // Canonical Presentation for Publisher Identity (nama user + role, atau email + role)
  const publisherDisplay = useMemo(() => {
    if (!activeRfq) return '';

    // 1. If backend returned joined creator identity
    const creatorObj = activeRfq.creator || (activeRfq as any).createdByUser;
    if (creatorObj) {
      const name = creatorObj.fullName || (creatorObj as any).name || creatorObj.email;
      const roleOrEmail = creatorObj.role || (creatorObj as any).roles?.[0] || (creatorObj.fullName ? creatorObj.email : null);
      if (name && roleOrEmail) {
        return `${name} (${roleOrEmail})`;
      }
      if (name) {
        return name;
      }
    }

    // 2. Match with authenticated user from AuthContext SSOT if ID matches
    if (user && activeRfq.createdBy && (Number(activeRfq.createdBy) === user.sub || String(activeRfq.createdBy) === String(user.sub))) {
      const name = user.fullName || user.email;
      const role = user.roles?.[0];
      return role ? `${name} (${role})` : name;
    }

    // 3. If textual createdBy is provided and non-numeric
    if (activeRfq.createdBy && typeof activeRfq.createdBy === 'string' && isNaN(Number(activeRfq.createdBy))) {
      return activeRfq.createdBy;
    }

    // 4. Backward compatibility fallback when creator is not available
    return 'Actor tidak tersedia';
  }, [activeRfq, user]);

  const [quotations, setQuotations] = useState<VendorQuotationRecord[]>([]);
  const [existingComparison, setExistingComparison] = useState<VendorComparisonResult | null>(null);

  const fetchQuotations = React.useCallback(async () => {
    const rfqIdNum = Number(activeRfq?.id || (activeRfq as any)?.rfqId);
    if (!rfqIdNum) {
      setQuotations([]);
      return;
    }
    try {
      const res = await ProcurementService.getQuotationsByRfq(rfqIdNum);
      const rawList = Array.isArray(res) ? res : (res as any)?.data || [];
      const mapped = rawList.map((q: any) => mapBackendQuotationToRecord(q, activeRfq));
      setQuotations(mapped);
    } catch (err) {
      console.error('Failed to load quotations from backend:', err);
    }
  }, [activeRfq]);

  useEffect(() => {
    if (open) {
      if (isViewMode && (activeRfq?.id || (activeRfq as any)?.rfqId)) {
        fetchQuotations();
      } else {
        setQuotations([]);
      }
      setExistingComparison(isViewMode ? ((activeRfq as any)?.comparison || null) : null);
    }
  }, [open, isViewMode, activeRfq?.id, (activeRfq as any)?.rfqId, fetchQuotations]);

  const isEvaluated = activeRfq?.status === 'EVALUATED' || Boolean(existingComparison);
  const isRfqOpen = activeRfq?.status === 'OPEN';
  const isRfqExpired = Boolean(
    activeRfq?.closingDate && dayjs().isAfter(dayjs(activeRfq.closingDate).endOf('day'))
  );
  const effectiveWinnerName =
    existingComparison?.selectedWinnerVendorName ||
    (activeRfq as any)?.comparison?.selectedWinnerVendorName ||
    'Pemenang tidak tersedia';

  // Unique vendor evaluation metrics
  const totalMasterVendorsCount = masterVendors.length;

  const uniqueVendorIds = useMemo(() => {
    return Array.from(new Set(quotations.map((q) => String(q.vendorId || q.vendorCode))));
  }, [quotations]);

  const uniqueVendorCount = uniqueVendorIds.length;
  const isEvaluationReady = uniqueVendorCount >= 3;
  const hasAvailableVendors = uniqueVendorCount < totalMasterVendorsCount;

  // Items from Approved PR snapshot or active RFQ
  const prItems = useMemo(() => {
    const rawItems = (pr?.items && Array.isArray(pr.items) && pr.items.length > 0)
      ? pr.items
      : (activeRfq?.purchaseRequest?.items && Array.isArray(activeRfq.purchaseRequest.items))
      ? activeRfq.purchaseRequest.items
      : [];
    return rawItems.map((it: any, idx: number) => ({
      key: it.rabItemKey || (it.id ? `item_pr_${it.id}` : (it.prItemId ? `item_pr_${it.prItemId}` : it.key || `item_${idx}`)),
      categoryName: it.categoryName || 'Material & Peralatan',
      itemName: it.itemName || it.item_name || 'Item Pengadaan',
      quantity: Number(it.quantity || 1),
      uom: it.uom || 'Unit',
      unitPrice: Number(it.estimatedUnitPrice || it.estimated_unit_price || it.unitPrice || 0),
      subtotal: Number(
        it.subtotal || it.totalPrice || it.total_price || Number(it.quantity || 1) * Number(it.estimatedUnitPrice || it.unitPrice || 0),
      ),
      wbsNodeId: it.wbsNodeId,
      prItemId: Number(it.id || it.prItemId || 0) || undefined,
    }));
  }, [pr, activeRfq]);

  const totalAmount = useMemo(() => {
    return (
      prItems.reduce((sum, item) => sum + item.subtotal, 0) ||
      Number(pr?.totalEstimatedAmount || pr?.total_estimated_amount || pr?.totalAmount || 0) ||
      Number(activeRfq?.purchaseRequest?.totalEstimatedAmount || (activeRfq?.purchaseRequest as any)?.total_estimated_amount || 0)
    );
  }, [prItems, pr, activeRfq]);

  const handleSubmit = async (values: any) => {
    if (!pr) {
      message.error('Data Purchase Request tidak valid.');
      return;
    }

    // 1. Eligibility Check: PR MUST BE APPROVED
    if (pr.status !== 'APPROVED') {
      message.error('Hanya Purchase Request dengan status APPROVED yang dapat diterbitkan menjadi RFQ.');
      return;
    }

    setIsSubmitting(true);
    try {
      const closingDateVal: Dayjs | undefined = values.closingDate;
      const closingDateIso = closingDateVal ? closingDateVal.toISOString() : undefined;

      const res = await ProcurementService.createRfq({
        purchaseRequestId: Number(pr.id),
        closingDate: closingDateIso,
      });

      const savedRfq = (res as any)?.data || res;
      message.success(`Request for Quotation (${savedRfq?.rfqNumber || 'Baru'}) berhasil diterbitkan!`);
      onRfqCreated?.(savedRfq);
      onClose();
    } catch (err: any) {
      console.error('Failed to create RFQ:', err);
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal menerbitkan RFQ';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = () => {
    form.validateFields().then((values) => {
      Modal.confirm({
        title: 'Konfirmasi Penerbitan RFQ',
        icon: <SendOutlined style={{ color: '#059669' }} />,
        content: (
          <div style={{ fontSize: 13, color: '#334155' }}>
            <p style={{ marginBottom: 8 }}>
              <strong>RFQ akan dibuat dari Purchase Request yang telah disetujui.</strong>
            </p>
            <ul style={{ paddingLeft: 18, margin: '4px 0 10px 0', fontSize: 12, color: '#64748b' }}>
              <li>Nilai / scope mengikuti PR Approved (<strong>{pr?.prNumber || `PR-${pr?.id}`}</strong>)</li>
              <li>Nomor RFQ akan dibuat oleh sistem secara atomik</li>
              <li>Status RFQ akan menjadi <strong>OPEN</strong></li>
            </ul>
          </div>
        ),
        okText: 'Terbitkan RFQ',
        cancelText: 'Batal',
        okButtonProps: { style: { backgroundColor: '#059669', borderColor: '#059669' } },
        onOk: () => handleSubmit(values),
      });
    }).catch(() => {
      // Form validation error
    });
  };

  if (!pr) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(980px, 95vw)"
      centered
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
          <Space size={6}>
            <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 15 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Sumber: <strong>PR Disetujui ({pr.prNumber || `PR-${pr.id}`})</strong>
            </Text>
          </Space>

          <Space size={8}>
            <Button onClick={onClose} style={{ borderRadius: 6 }}>
              {isViewMode ? 'Tutup' : 'Batal'}
            </Button>
            {isViewMode && isRfqOpen && canCancelRfq && (
              <Button
                danger
                onClick={handleOpenCancelModal}
                icon={<CloseCircleOutlined />}
                style={{ borderRadius: 6, fontWeight: 500 }}
              >
                Batalkan RFQ
              </Button>
            )}
            {!isViewMode && (
              <Button
                type="primary"
                loading={isSubmitting}
                onClick={handleConfirmSubmit}
                icon={<SendOutlined />}
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                Terbitkan RFQ
              </Button>
            )}
          </Space>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#ecfdf5', borderRadius: 8, color: '#059669' }}>
            <ShopOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {isViewMode
                ? `Rincian Request for Quotation — ${activeRfq?.rfqNumber}`
                : hasCancelledRfq
                ? 'Buat Request for Quotation (RFQ) Baru'
                : 'Buat Request for Quotation (RFQ)'}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              {isViewMode
                ? 'Paket penawaran harga pengadaan material & jasa untuk vendor terdaftar'
                : hasCancelledRfq
                ? 'Terbitkan RFQ baru untuk Purchase Request ini setelah RFQ sebelumnya dibatalkan'
                : 'Terbitkan permintaan penawaran harga kepada vendor berdasarkan Purchase Request yang telah disetujui'}
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Previous Cancelled RFQ Reference Strip (Reissue Context) */}
        {!isViewMode && hasCancelledRfq && (
          <Alert
            type="warning"
            showIcon
            icon={<CloseCircleOutlined style={{ color: '#d97706' }} />}
            message={
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                RFQ Sebelumnya Dibatalkan — Siap Terbitkan RFQ Baru
              </span>
            }
            description={
              <div style={{ fontSize: 11.5, marginTop: 2 }}>
                RFQ sebelumnya <strong>{activeRfq?.rfqNumber || `RFQ #${activeRfq?.id}`}</strong> telah dibatalkan ({activeRfq?.status}). 
                Riwayat pembatalan tetap tersimpan sebagai audit trail. Formulir di bawah ini akan menerbitkan <strong>RFQ baru</strong> dengan nomor dan pencatatan baru untuk Purchase Request yang sama.
              </div>
            }
            style={{ borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb' }}
          />
        )}

        {/* Active RFQ Notification in View Mode */}
        {isViewMode && activeRfq && (
          <Alert
            type="info"
            showIcon
            icon={<InboxOutlined style={{ color: '#0284c7' }} />}
            message={
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>
                Status RFQ: <Tag color="geekblue" style={{ fontWeight: 700, margin: '0 4px' }}>{activeRfq.rfqNumber}</Tag> — <Tag color={activeRfq.status === 'EVALUATED' ? 'purple' : 'green'} style={{ fontWeight: 700, margin: 0 }}>● {activeRfq.status}</Tag>
              </span>
            }
            description={
              <div style={{ fontSize: 11.5, marginTop: 2 }}>
                Diterbitkan pada {dayjs(activeRfq.createdAt).format('DD MMMM YYYY HH:mm')} oleh <strong>{publisherDisplay}</strong>.
                Batas penyerahan penawaran (Closing Date): <strong>{dayjs(activeRfq.closingDate).format('DD MMMM YYYY')}</strong>.
              </div>
            }
            style={{ borderRadius: 8, border: '1px solid #bae6fd', background: '#f0f9ff' }}
          />
        )}

        {/* PR & Project Context Reference Strip */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={8}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{projectName}</div>
              <Space size={4} wrap style={{ marginTop: 2 }}>
                {projectCode && (
                  <Tag color="cyan" style={{ fontSize: 10, margin: 0, fontWeight: 700, fontFamily: 'monospace' }}>
                    {projectCode}
                  </Tag>
                )}
                {effectiveProjectId && (
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                    Project ID #{effectiveProjectId}
                  </Tag>
                )}
              </Space>
            </Col>
            <Col xs={24} sm={8}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>REFERENSI PURCHASE REQUEST:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8' }}>{pr.prNumber || `PR-${pr.id}`}</div>
              <Tag color="success" style={{ fontSize: 10, fontWeight: 700, margin: 0, marginTop: 2 }}>
                PR APPROVED
              </Tag>
            </Col>
            <Col xs={24} sm={8}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PLAFON ANGGARAN PENGADAAN:</Text>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>
                Rp {totalAmount.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{prItems.length} Item Material / Jasa</div>
            </Col>
          </Row>
        </div>

        {/* RFQ Submission Parameters Form */}
        {!isViewMode ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              closingDate: dayjs().add(14, 'day'),
            }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Batas Waktu Penawaran (Closing Date)</span>}
                  name="closingDate"
                  rules={[{ required: true, message: 'Closing Date wajib ditentukan' }]}
                  extra={<span style={{ fontSize: 10.5, color: '#64748b' }}>Batas akhir vendor menyerahkan quotation (harga penawaran).</span>}
                >
                  <DatePicker
                    style={{ width: '100%', borderRadius: 6 }}
                    format="DD MMMM YYYY"
                    disabledDate={(current) => current && current < dayjs().endOf('day')}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan / Instruksi Pengadaan (Opsional)</span>}
                  name="notes"
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="Contoh: Pengiriman ke lokasi proyek, Franco Gudang, Term of Payment 30 hari."
                    style={{ borderRadius: 6, fontSize: 11.5 }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        ) : (
          activeRfq?.notes && (
            <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 11.5 }}>
              <strong>Instruksi Pengadaan:</strong> {activeRfq.notes}
            </div>
          )
        )}

        {/* ── Vendor Quotations Section in View Mode ── */}
        {isViewMode && activeRfq && (
          <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
            <div
              style={{
                padding: '10px 14px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                  Daftar Penawaran Vendor (Quotation)
                </span>
                {isEvaluated ? (
                  <Tag color="purple" style={{ fontSize: 11, margin: 0, borderRadius: 4, fontWeight: 700 }}>
                    EVALUATED — Pemenang: {effectiveWinnerName}
                  </Tag>
                ) : (
                  <>
                    {uniqueVendorCount === 0 && (
                      <Tag color="default" style={{ fontSize: 11, margin: 0, borderRadius: 4 }}>
                        Menunggu Penawaran Vendor (0/3)
                      </Tag>
                    )}
                    {uniqueVendorCount === 1 && (
                      <Tag color="blue" style={{ fontSize: 11, margin: 0, borderRadius: 4, fontWeight: 600 }}>
                        1/3 Penawaran Diterima
                      </Tag>
                    )}
                    {uniqueVendorCount === 2 && (
                      <Tag color="orange" style={{ fontSize: 11, margin: 0, borderRadius: 4, fontWeight: 600 }}>
                        2/3 Penawaran Diterima (Kurang 1 Vendor)
                      </Tag>
                    )}
                    {uniqueVendorCount >= 3 && uniqueVendorCount < totalMasterVendorsCount && (
                      <Tag color="success" style={{ fontSize: 11, margin: 0, borderRadius: 4, fontWeight: 700 }}>
                        {uniqueVendorCount} Vendor — Siap Evaluasi Vendor
                      </Tag>
                    )}
                    {uniqueVendorCount >= totalMasterVendorsCount && (
                      <Tag color="success" style={{ fontSize: 11, margin: 0, borderRadius: 4, fontWeight: 700 }}>
                        Semua Vendor ({uniqueVendorCount}/{totalMasterVendorsCount}) — Siap Evaluasi Vendor
                      </Tag>
                    )}
                  </>
                )}
              </div>

              {/* State-Driven Action Buttons */}
              {isEvaluated ? (
                <Button
                  type="primary"
                  size="small"
                  icon={<TrophyOutlined />}
                  onClick={() => setIsComparisonModalOpen(true)}
                  style={{
                    backgroundColor: '#7c3aed',
                    borderColor: '#7c3aed',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11.5,
                  }}
                >
                  Lihat Hasil Evaluasi
                </Button>
              ) : !isRfqOpen ? (
                <Tag
                  color={
                    activeRfq?.status === 'CANCELLED'
                      ? 'error'
                      : activeRfq?.status === 'CLOSED'
                      ? 'default'
                      : 'default'
                  }
                  style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600 }}
                >
                  ● {activeRfq?.status === 'CLOSED' ? 'RFQ Ditutup (Read-Only)' : activeRfq?.status === 'CANCELLED' ? 'RFQ Dibatalkan (Read-Only)' : `RFQ ${activeRfq?.status || 'Non-Aktif'}`}
                </Tag>
              ) : isRfqExpired ? (
                <Tag color="warning" style={{ padding: '3px 8px', fontSize: 11, fontWeight: 600 }}>
                  ● Batas Waktu Berakhir (Read-Only)
                </Tag>
              ) : !isEvaluationReady ? (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedQuoteForView(null);
                    setIsVendorQuoteModalOpen(true);
                  }}
                  style={{
                    backgroundColor: '#059669',
                    borderColor: '#059669',
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 11.5,
                  }}
                >
                  Input Penawaran Vendor
                </Button>
              ) : (
                <Space size={8} wrap>
                  {hasAvailableVendors && (
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setSelectedQuoteForView(null);
                        setIsVendorQuoteModalOpen(true);
                      }}
                      style={{
                        borderColor: '#059669',
                        color: '#059669',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 11.5,
                      }}
                    >
                      Tambah Vendor
                    </Button>
                  )}
                  <Button
                    type="primary"
                    size="small"
                    icon={<SlidersOutlined />}
                    onClick={() => {
                      setIsComparisonModalOpen(true);
                    }}
                    style={{
                      backgroundColor: '#1d4ed8',
                      borderColor: '#1d4ed8',
                      borderRadius: 6,
                      fontWeight: 600,
                      fontSize: 11.5,
                    }}
                  >
                    Evaluasi Vendor
                  </Button>
                </Space>
              )}
            </div>

            {quotations.length > 0 ? (
              <Table
                size="small"
                rowKey="quotationId"
                dataSource={quotations}
                pagination={false}
                columns={[
                  {
                    title: 'Vendor',
                    key: 'vendor',
                    render: (_: any, q: VendorQuotationRecord) => (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{q.vendorName}</div>
                        <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                          {q.vendorCode}
                        </Tag>
                      </div>
                    ),
                  },
                  {
                    title: 'Total Penawaran',
                    dataIndex: 'totalOfferedAmount',
                    key: 'totalOfferedAmount',
                    align: 'right' as const,
                    render: (val: number, q: VendorQuotationRecord) => {
                      const diff = val - q.budgetCeiling;
                      return (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#1d4ed8' }}>
                            Rp {val.toLocaleString('id-ID')}
                          </div>
                          {diff <= 0 ? (
                            <span style={{ fontSize: 10, color: '#059669' }}>
                              - Rp {Math.abs(diff).toLocaleString('id-ID')} (Hemat)
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: '#e11d48' }}>
                              + Rp {diff.toLocaleString('id-ID')} (Di Atas Plafon)
                            </span>
                          )}
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Lead Time Vendor',
                    dataIndex: 'leadTimeDays',
                    key: 'leadTimeDays',
                    width: 140,
                    align: 'center' as const,
                    render: (days: any) => {
                      const num = days != null && !isNaN(Number(days)) && Number(days) > 0 ? Number(days) : null;
                      if (num !== null) {
                        return <span>{num} hari</span>;
                      }
                      return <span style={{ color: '#94a3b8', fontSize: 11 }}>Tidak tersedia</span>;
                    },
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 110,
                    align: 'center' as const,
                    render: (st: string) => (
                      <Tag color="green" style={{ fontWeight: 600, fontSize: 10, margin: 0 }}>
                        ● {st}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Tanggal Masuk',
                    dataIndex: 'submittedAt',
                    key: 'submittedAt',
                    width: 140,
                    render: (dt: string) => (
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {dt ? dayjs(dt).format('DD MMM YYYY HH:mm') : '—'}
                      </span>
                    ),
                  },
                  {
                    title: 'Aksi',
                    key: 'action',
                    width: 120,
                    align: 'center' as const,
                    render: (_: any, q: VendorQuotationRecord) => (
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setSelectedQuoteForView(q);
                          setIsVendorQuoteModalOpen(true);
                        }}
                        style={{ fontSize: 11, borderRadius: 4 }}
                      >
                        Detail
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <div style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                Belum ada penawaran vendor yang dimasukkan untuk RFQ ini. Klik <strong>Input Penawaran Vendor</strong> untuk mencatat penawaran dari master vendor.
              </div>
            )}

            {/* Contextual Helper Strip */}
            {uniqueVendorCount < 3 && (
              <div style={{ padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#64748b' }}>
                Perbandingan vendor membutuhkan minimal 3 penawaran vendor terdaftar.
              </div>
            )}
            {uniqueVendorCount >= totalMasterVendorsCount && (
              <div style={{ padding: '6px 14px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0', fontSize: 11, color: '#15803d' }}>
                <CheckCircleOutlined style={{ marginRight: 4 }} />
                Seluruh {totalMasterVendorsCount} vendor terdaftar pada direktori master telah memberikan penawaran harga.
              </div>
            )}
          </div>
        )}

        {/* Read-Only Item Breakdown Table */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#334155' }}>
              Daftar Item RFQ ({prItems.length} Item Terkunci dari PR Approved)
            </span>
            <Tag color="cyan" style={{ fontSize: 10.5, margin: 0 }}>READ-ONLY SNAPSHOT</Tag>
          </div>
          <Table
            size="small"
            rowKey="key"
            dataSource={prItems}
            pagination={false}
            scroll={{ y: 220 }}
            columns={[
              {
                title: 'Kategori',
                dataIndex: 'categoryName',
                key: 'categoryName',
                width: 160,
                render: (cat: string) => <Tag color="blue" style={{ fontSize: 10.5, borderRadius: 4, margin: 0 }}>{cat}</Tag>,
              },
              {
                title: 'Nama Item',
                dataIndex: 'itemName',
                key: 'itemName',
                render: (name: string, it: any) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>{name}</div>
                    {it.wbsNodeId && (
                      <Tag color="geekblue" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>
                        WBS #{it.wbsNodeId}
                      </Tag>
                    )}
                  </div>
                ),
              },
              {
                title: 'Qty',
                dataIndex: 'quantity',
                key: 'quantity',
                width: 60,
                align: 'center' as const,
                render: (qty: number) => <span style={{ fontWeight: 600 }}>{qty}</span>,
              },
              {
                title: 'Satuan',
                dataIndex: 'uom',
                key: 'uom',
                width: 70,
                align: 'center' as const,
                render: (uom: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{uom}</span>,
              },
              {
                title: 'Estimasi Harga Satuan',
                dataIndex: 'unitPrice',
                key: 'unitPrice',
                width: 140,
                align: 'right' as const,
                render: (price: number) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>Rp {price.toLocaleString('id-ID')}</span>,
              },
              {
                title: 'Subtotal Plafon',
                dataIndex: 'subtotal',
                key: 'subtotal',
                width: 140,
                align: 'right' as const,
                render: (subtotal: number) => (
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#059669' }}>
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* Vendor Quotation Input Modal */}
      {activeRfq && (
        <VendorQuotationModal
          open={isVendorQuoteModalOpen}
          onClose={() => {
            setIsVendorQuoteModalOpen(false);
            setSelectedQuoteForView(null);
          }}
          rfq={{
            ...activeRfq,
            prNumber,
            projectName,
            projectCode,
            projectId: effectiveProjectId,
            totalAmount,
            items: prItems,
            purchaseRequest: activeRfq?.purchaseRequest || pr,
          }}
          existingQuotation={selectedQuoteForView}
          existingQuotations={quotations}
          onQuotationSaved={(_savedQuote) => {
            fetchQuotations();
            setQuoteVersion((v) => v + 1);
          }}
          currentUserName={currentUserName}
        />
      )}

      {/* Vendor Comparison Evaluation Modal */}
      {activeRfq && (
        <VendorComparisonModal
          open={isComparisonModalOpen}
          onClose={() => setIsComparisonModalOpen(false)}
          rfq={{
            ...activeRfq,
            prNumber,
            projectName,
            projectCode,
            projectId: effectiveProjectId,
            totalAmount,
            items: prItems,
            purchaseRequest: activeRfq?.purchaseRequest || pr,
          }}
          quotations={quotations}
          existingComparison={existingComparison || (activeRfq as any)?.comparison || null}
          existingPo={existingPo}
          onComparisonSaved={(result) => {
            setExistingComparison(result);
            setComparisonVersion((v) => v + 1);
          }}
          onPoCreated={(newPo) => {
            onPoCreated?.(newPo);
          }}
          currentUserName={currentUserName}
        />
      )}

      {/* CONFIRMATION MODAL: BATALKAN RFQ */}
      <Modal
        open={isCancelModalOpen}
        title="Batalkan RFQ"
        onCancel={() => {
          if (!isCancelling) {
            setIsCancelModalOpen(false);
            setCancelReason('');
            setCancelError(null);
          }
        }}
        centered
        destroyOnClose
        zIndex={1100}
        footer={[
          <Button
            key="back"
            onClick={() => {
              setIsCancelModalOpen(false);
              setCancelReason('');
              setCancelError(null);
            }}
            disabled={isCancelling}
            style={{ borderRadius: 6 }}
          >
            Kembali
          </Button>,
          <Button
            key="submit"
            type="primary"
            danger
            loading={isCancelling}
            disabled={!cancelReason.trim()}
            onClick={handleConfirmCancelRfq}
            style={{ borderRadius: 6, fontWeight: 600 }}
          >
            Ya, Batalkan RFQ
          </Button>,
        ]}
      >
        <div style={{ padding: '8px 0' }}>
          <Alert
            type="warning"
            showIcon
            message="Perhatian Pembatalan RFQ"
            description={
              <div>
                Anda akan membatalkan RFQ <strong>{activeRfq?.rfqNumber || `RFQ #${activeRfq?.id}`}</strong>. 
                Tindakan ini tidak dapat dibatalkan. Riwayat RFQ akan tetap tersimpan dan Purchase Request terkait akan tetap dalam status APPROVED.
              </div>
            }
            style={{ marginBottom: 16 }}
          />

          {cancelError && (
            <Alert
              type="error"
              showIcon
              message="Gagal Membatalkan RFQ"
              description={cancelError}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form layout="vertical">
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>Alasan Pembatalan <span style={{ color: '#ef4444' }}>*</span></span>}
              required
              help={!cancelReason.trim() ? 'Alasan pembatalan wajib diisi.' : undefined}
              validateStatus={!cancelReason.trim() ? 'warning' : 'success'}
            >
              <Input.TextArea
                rows={4}
                placeholder="Masukkan alasan pembatalan RFQ (misal: beralih ke Direct Service PO, perubahan spesifikasi teknis, dll)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={isCancelling}
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </Modal>
  );
};
