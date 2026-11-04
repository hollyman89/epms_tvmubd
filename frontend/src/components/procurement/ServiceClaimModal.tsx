"use client";

import React, { useState, useEffect, useMemo } from 'react';
import styles from './ServiceClaimModal.module.css';
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Alert,
  message,
  Descriptions,
  Spin,
  Popconfirm,
  Table,
  Empty,
  Card,
  Divider,
} from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  StopOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  RollbackOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import {
  ProcurementService,
  ServiceClaimRecord,
  ServiceClaimItemRecord,
  PoServiceClaimBalance,
  CreateServiceClaimPayload,
  UpdateServiceClaimPayload,
  ServiceOrder,
} from '@/services/procurement.service';
import { AuthService } from '@/services/auth.service';
import type { PurchaseOrderPrototypeRecord } from '@/components/procurement/PurchaseOrderModal';
import { formatCurrency, formatNumber } from '@/lib/formatters';

const { Text, Title } = Typography;
const { TextArea } = Input;

export interface ServiceClaimModalProps {
  open: boolean;
  onClose: () => void;
  po: PurchaseOrderPrototypeRecord | null;
  onClaimUpdated?: () => void;
  userRole?: string;
  userId?: number;
  initialClaimId?: number;
}

export const CLAIM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  SUBMITTED: { label: 'Diajukan', color: 'processing' },
  NEEDS_REVISION: { label: 'Perlu Revisi', color: 'warning' },
  PM_VERIFIED: { label: 'Terverifikasi Teknis', color: 'blue' },
  APPROVED_FOR_INVOICE: { label: 'Disetujui untuk Invoice', color: 'success' },
  REJECTED: { label: 'Ditolak', color: 'error' },
  CANCELLED: { label: 'Dibatalkan', color: 'default' },
};

export const ServiceClaimModal: React.FC<ServiceClaimModalProps> = ({
  open,
  onClose,
  po,
  onClaimUpdated,
  userRole = 'PROCUREMENT',
  userId,
  initialClaimId,
}) => {
  const [form] = Form.useForm();
  const [decisionForm] = Form.useForm();
  const [returnForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [techReturnForm] = Form.useForm();
  const [techRejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // P1 Role Predicates using existing userRole & userId props (with AuthService fallback)
  const sessionUser = typeof window !== 'undefined' ? AuthService.getUser() : null;
  const rawRole = userRole || sessionUser?.roles?.[0] || 'PROCUREMENT';
  const effectiveUserId = userId ?? sessionUser?.sub ?? sessionUser?.id;

  const normalizedRole = String(rawRole).trim().toUpperCase();
  const isSuperAdmin = normalizedRole === 'SUPER_ADMIN';
  const isPurchasingOrProcurement = ['PROCUREMENT', 'PURCHASING'].includes(normalizedRole) || isSuperAdmin;
  const isProjectManager = normalizedRole === 'PROJECT_MANAGER';

  // Explicit action capabilities (P1 Gating)
  // Purchasing/Procurement: create/edit/submit/cancel and commercial verification when status permits
  // PM: must not see create/edit/submit, commercial verification, or cancellation
  const canManageClaims = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);
  const canVerifyCommercial = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);
  const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);

  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [claims, setClaims] = useState<ServiceClaimRecord[]>([]);
  const [balance, setBalance] = useState<PoServiceClaimBalance | null>(null);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ServiceClaimRecord | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL' | 'CREATE' | 'EDIT' | 'VERIFY_COMMERCIAL' | 'VERIFY_TECHNICAL'>('LIST');
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'RETURN' | 'REJECT'>('APPROVE');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [isTechApproveModalOpen, setIsTechApproveModalOpen] = useState<boolean>(false);
  const [isTechReturnModalOpen, setIsTechReturnModalOpen] = useState<boolean>(false);
  const [isTechRejectModalOpen, setIsTechRejectModalOpen] = useState<boolean>(false);

  // Local draft items state for editing quantities
  const [draftItems, setDraftItems] = useState<Array<{
    poItemId: number;
    itemName: string;
    uom: string;
    contractQuantity: number;
    contractUnitPrice: number;
    contractTotalPrice: number;
    approvedQuantity: number;
    remainingQuantity: number;
    currentClaimQuantity: number;
    workLocation: string;
    notes: string;
  }>>([]);

  const poId = po?.poId || (po as any)?.id;

  const loadData = async (): Promise<ServiceClaimRecord[]> => {
    if (!poId) return [];
    setLoading(true);
    try {
      const [fetchedClaims, fetchedBalance, fetchedOrders] = await Promise.all([
        ProcurementService.getServiceClaims({ poId: Number(poId) }),
        ProcurementService.getPoServiceClaimBalance(Number(poId)).catch(() => null),
        ProcurementService.getServiceOrdersByPo(Number(poId)).catch(() => []),
      ]);
      const validClaims = fetchedClaims || [];
      setClaims(validClaims);
      setBalance(fetchedBalance);
      setServiceOrders((fetchedOrders || []).filter((so: ServiceOrder) => so.status === 'ISSUED'));
      return validClaims;
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memuat data klaim jasa.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && poId) {
      loadData().then((validClaims) => {
        if (initialClaimId && Array.isArray(validClaims) && validClaims.length > 0) {
          const target = validClaims.find((c) => Number(c.id) === Number(initialClaimId));
          if (target) {
            setSelectedClaim(target);
            if (target.status === 'PM_VERIFIED' && canVerifyCommercial) {
              setIsApproveModalOpen(false);
              setIsReturnModalOpen(false);
              setIsRejectModalOpen(false);
              returnForm.resetFields();
              rejectForm.resetFields();
              setViewMode('VERIFY_COMMERCIAL');
            } else if (target.status === 'SUBMITTED' && canVerifyTechnical) {
              decisionForm.resetFields();
              setDecisionAction('APPROVE');
              setViewMode('VERIFY_TECHNICAL');
            } else {
              setViewMode('DETAIL');
            }
            return;
          }
        }
        setViewMode('LIST');
        setSelectedClaim(null);
      });
    }
  }, [open, poId, initialClaimId]);

  // Initialize draft items from balance or po.items
  const initDraftItems = (existingClaim?: ServiceClaimRecord | null) => {
    if (!po) return;
    const balanceItemsMap = new Map<number, any>();
    if (balance?.items) {
      balance.items.forEach(b => balanceItemsMap.set(Number(b.poItemId), b));
    }

    const items = (po.items || []).map((poi: any) => {
      const bItem = balanceItemsMap.get(Number(poi.id));
      const existingItem = existingClaim?.items?.find(ci => Number(ci.poItemId) === Number(poi.id));

      const contractQty = bItem ? Number(bItem.contractQuantity) : Number(poi.quantity || 0);
      const contractUnitPrice = bItem
        ? Number(bItem.contractUnitRate ?? bItem.contractUnitPrice ?? poi.unitPrice ?? 0)
        : Number(poi.unitPrice || 0);
      const contractTotalPrice = bItem
        ? Number(bItem.contractValue ?? bItem.contractTotalPrice ?? poi.totalPrice ?? (contractQty * contractUnitPrice))
        : Number(poi.totalPrice || contractQty * contractUnitPrice);
      const approvedQty = bItem ? Number(bItem.approvedQuantity) : 0;
      const remainingQty = bItem ? Number(bItem.remainingQuantity) : Math.max(0, contractQty - approvedQty);

      return {
        poItemId: Number(poi.id),
        itemName: poi.itemName || poi.item_name || 'Item Jasa',
        uom: poi.uom || bItem?.uom || 'LS',
        contractQuantity: contractQty,
        contractUnitPrice,
        contractTotalPrice,
        approvedQuantity: approvedQty,
        remainingQuantity: remainingQty,
        currentClaimQuantity: existingItem ? Number(existingItem.currentClaimQuantity) : 0,
        workLocation: existingItem?.workLocation || '',
        notes: existingItem?.notes || '',
      };
    });

    setDraftItems(items);
  };

  const handleStartCreate = () => {
    if (!canManageClaims) {
      message.warning('Anda tidak memiliki hak akses untuk membuat klaim jasa.');
      return;
    }
    initDraftItems(null);
    form.resetFields();
    setViewMode('CREATE');
  };

  const handleStartEdit = (claim: ServiceClaimRecord) => {
    if (!canManageClaims) {
      message.warning('Anda tidak memiliki hak akses untuk mengubah draft klaim jasa.');
      return;
    }
    setSelectedClaim(claim);
    initDraftItems(claim);
    form.setFieldsValue({
      serviceOrderId: claim.serviceOrderId || undefined,
      claimPeriod: claim.claimPeriodStart && claim.claimPeriodEnd ? [dayjs(claim.claimPeriodStart), dayjs(claim.claimPeriodEnd)] : undefined,
      acceptanceType: claim.acceptanceType || undefined,
      acceptanceReference: claim.acceptanceReference || '',
      acceptanceDate: claim.acceptanceDate ? dayjs(claim.acceptanceDate) : undefined,
      notes: claim.notes || '',
    });
    setViewMode('EDIT');
  };

  const handleItemQtyChange = (poItemId: number, val: number | null) => {
    setDraftItems(prev => prev.map(item => {
      if (item.poItemId === poItemId) {
        return { ...item, currentClaimQuantity: val || 0 };
      }
      return item;
    }));
  };

  const handleItemLocationChange = (poItemId: number, val: string) => {
    setDraftItems(prev => prev.map(item => {
      if (item.poItemId === poItemId) {
        return { ...item, workLocation: val };
      }
      return item;
    }));
  };

  const handleItemNotesChange = (poItemId: number, val: string) => {
    setDraftItems(prev => prev.map(item => {
      if (item.poItemId === poItemId) {
        return { ...item, notes: val };
      }
      return item;
    }));
  };

  // Calculate live summary
  const calculatedTotalClaim = useMemo(() => {
    return draftItems.reduce((sum, item) => {
      return sum + (Number(item.currentClaimQuantity || 0) * Number(item.contractUnitPrice || 0));
    }, 0);
  }, [draftItems]);

  const handleSaveDraft = async () => {
    if (!canManageClaims) {
      message.warning('Anda tidak memiliki hak akses untuk menyimpan klaim jasa.');
      return;
    }
    console.log('[DEBUG handleSaveDraft] triggered. poId:', poId, 'draftItems:', draftItems);
    try {
      const values = await form.validateFields();
      console.log('[DEBUG handleSaveDraft] form values:', values);
      const validItems = draftItems.filter(i => Number(i.currentClaimQuantity) > 0);
      console.log('[DEBUG handleSaveDraft] validItems:', validItems);

      if (validItems.length === 0) {
        console.warn('[DEBUG handleSaveDraft] No valid items (> 0)');
        message.error('Masukkan kuantitas klaim (> 0) minimal untuk 1 item.');
        return;
      }

      // Client guard: cumulativeQty cannot exceed contractQuantity
      for (const item of validItems) {
        const potentialCumulative = Number(item.approvedQuantity || 0) + Number(item.currentClaimQuantity);
        if (potentialCumulative > Number(item.contractQuantity) + 0.001) {
          console.warn('[DEBUG handleSaveDraft] Overclaim:', item);
          message.error(`Kuantitas klaim untuk ${item.itemName} (${item.currentClaimQuantity}) melebihi sisa kontrak (${item.remainingQuantity}).`);
          return;
        }
      }

      setIsSubmitting(true);
      const period = values.claimPeriod;

      const payload: CreateServiceClaimPayload = {
        purchaseOrderId: Number(poId),
        poId: Number(poId),
        serviceOrderId: values.serviceOrderId ? Number(values.serviceOrderId) : undefined,
        claimPeriodStart: period && period[0] ? period[0].format('YYYY-MM-DD') : undefined,
        claimPeriodEnd: period && period[1] ? period[1].format('YYYY-MM-DD') : undefined,
        acceptanceType: values.acceptanceType || undefined,
        acceptanceReference: values.acceptanceReference || undefined,
        acceptanceDate: values.acceptanceDate ? values.acceptanceDate.format('YYYY-MM-DD') : undefined,
        notes: values.notes || undefined,
        items: validItems.map(i => ({
          poItemId: i.poItemId,
          currentClaimQuantity: Number(i.currentClaimQuantity),
          workLocation: i.workLocation || undefined,
          notes: i.notes || undefined,
        })),
      };
      console.log('[DEBUG handleSaveDraft] sending payload:', payload);

      if (viewMode === 'CREATE') {
        const res = await ProcurementService.createServiceClaim(payload);
        console.log('[DEBUG handleSaveDraft] create response:', res);
        message.success(`Klaim Jasa draft ${res.claimNumber} berhasil dibuat.`);
      } else if (viewMode === 'EDIT' && selectedClaim) {
        const { purchaseOrderId, poId, ...updatePayload } = payload;
        const res = await ProcurementService.updateServiceClaim(selectedClaim.id, updatePayload as UpdateServiceClaimPayload);
        message.success(`Klaim Jasa draft ${res.claimNumber} berhasil diperbarui.`);
      }

      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      console.error('[DEBUG handleSaveDraft] ERROR:', err);
      message.error(err?.response?.data?.message || 'Gagal menyimpan draft klaim jasa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitClaim = async (claimId: number) => {
    if (!canManageClaims) {
      message.warning('Anda tidak memiliki hak akses untuk mengajukan klaim jasa.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await ProcurementService.submitServiceClaim(claimId);
      message.success(`Klaim Jasa ${res.claimNumber} berhasil diajukan.`);
      await loadData();
      if (selectedClaim && selectedClaim.id === claimId) {
        setSelectedClaim(res);
      }
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal mengajukan klaim jasa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelClaim = async (claimId: number) => {
    if (!canManageClaims) {
      message.warning('Anda tidak memiliki hak akses untuk membatalkan klaim.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await ProcurementService.cancelServiceClaim(claimId, { reason: 'Dibatalkan oleh user' });
      message.success(`Klaim Jasa ${res.claimNumber} berhasil dibatalkan.`);
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal membatalkan klaim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCommercialApprove = async () => {
    if (!canVerifyCommercial) {
      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi komersial.');
      return;
    }
    if (!selectedClaim || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const res = await ProcurementService.verifyCommercialServiceClaim(selectedClaim.id, {
        decision: 'APPROVE',
      });
      message.success(`Klaim Jasa ${res.claimNumber} berhasil disetujui secara komersial (Disetujui untuk Invoice).`);
      setIsApproveModalOpen(false);
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses persetujuan komersial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCommercialReturn = async () => {
    if (!canVerifyCommercial) {
      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi komersial.');
      return;
    }
    if (!selectedClaim || isSubmitting) return;
    try {
      const values = await returnForm.validateFields();
      setIsSubmitting(true);
      const res = await ProcurementService.verifyCommercialServiceClaim(selectedClaim.id, {
        decision: 'RETURN',
        revisionNotes: values.revisionNotes,
      });
      message.success(`Klaim Jasa ${res.claimNumber} dikembalikan untuk revisi.`);
      setIsReturnModalOpen(false);
      returnForm.resetFields();
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses permintaan revisi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCommercialReject = async () => {
    if (!canVerifyCommercial) {
      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi komersial.');
      return;
    }
    if (!selectedClaim || isSubmitting) return;
    try {
      const values = await rejectForm.validateFields();
      setIsSubmitting(true);
      const res = await ProcurementService.verifyCommercialServiceClaim(selectedClaim.id, {
        decision: 'REJECT',
        rejectionReason: values.rejectionReason,
      });
      message.success(`Klaim Jasa ${res.claimNumber} ditolak.`);
      setIsRejectModalOpen(false);
      rejectForm.resetFields();
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses penolakan klaim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmTechnicalApprove = async () => {
    if (!canVerifyTechnical) {
      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi teknis.');
      return;
    }
    if (!selectedClaim || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await ProcurementService.verifyTechnicalServiceClaim(selectedClaim.id, {
        decision: 'APPROVE',
      });
      message.success(`Klaim Jasa ${res.claimNumber} berhasil diverifikasi teknis.`);
      setIsTechApproveModalOpen(false);
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses verifikasi teknis.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmTechnicalReturn = async () => {
    if (!canVerifyTechnical) {
      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi teknis.');
      return;
    }
    if (!selectedClaim || isSubmitting) return;
    try {
      const values = await techReturnForm.validateFields();
      setIsSubmitting(true);
      const res = await ProcurementService.verifyTechnicalServiceClaim(selectedClaim.id, {
        decision: 'RETURN',
        revisionNotes: values.revisionNotes.trim(),
      });
      message.success(`Klaim Jasa ${res.claimNumber} dikembalikan untuk revisi.`);
      setIsTechReturnModalOpen(false);
      techReturnForm.resetFields();
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses pengembalian revisi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmTechnicalReject = async () => {
    if (!canVerifyTechnical) {
      message.warning('Anda tidak memiliki hak akses untuk melakukan verifikasi teknis.');
      return;
    }
    if (!selectedClaim || isSubmitting) return;
    try {
      const values = await techRejectForm.validateFields();
      setIsSubmitting(true);
      const res = await ProcurementService.verifyTechnicalServiceClaim(selectedClaim.id, {
        decision: 'REJECT',
        rejectionReason: values.rejectionReason.trim(),
      });
      message.success(`Klaim Jasa ${res.claimNumber} ditolak.`);
      setIsTechRejectModalOpen(false);
      techRejectForm.resetFields();
      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses penolakan klaim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Columns for claim list
  const claimColumns = [
    {
      title: 'NOMOR KLAIM',
      dataIndex: 'claimNumber',
      key: 'claimNumber',
      render: (val: string, r: ServiceClaimRecord) => (
        <a
          onClick={() => {
            setSelectedClaim(r);
            setViewMode('DETAIL');
          }}
          style={{ fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace' }}
        >
          {val}
        </a>
      ),
    },
    {
      title: 'PERIODE',
      key: 'period',
      render: (_: any, r: ServiceClaimRecord) => (
        <span style={{ fontSize: 12 }}>
          {r.claimPeriodStart && r.claimPeriodEnd
            ? `${dayjs(r.claimPeriodStart).format('DD/MM/YYYY')} - ${dayjs(r.claimPeriodEnd).format('DD/MM/YYYY')}`
            : '—'}
        </span>
      ),
    },
    {
      title: 'NILAI KLAIM',
      dataIndex: 'totalClaimAmount',
      key: 'totalClaimAmount',
      align: 'right' as const,
      render: (val: number, r: ServiceClaimRecord) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0F172A' }}>{formatCurrency(val)}</div>
          {Number(r.approvedClaimAmount) > 0 && r.status === 'APPROVED_FOR_INVOICE' && (
            <div style={{ fontSize: 11, color: '#059669' }}>
              Disetujui: {formatCurrency(r.approvedClaimAmount)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        const meta = CLAIM_STATUS_MAP[val] || { label: val, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'AKSI',
      key: 'action',
      align: 'center' as const,
      render: (_: any, r: ServiceClaimRecord) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedClaim(r);
              setViewMode('DETAIL');
            }}
          >
            Detail
          </Button>
          {(r.status === 'DRAFT' || r.status === 'NEEDS_REVISION') && canManageClaims && (
            <>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleStartEdit(r)}
              >
                Ubah
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                onClick={() => handleSubmitClaim(r.id)}
                loading={isSubmitting}
              >
                Submit
              </Button>
            </>
          )}
          {r.status === 'PM_VERIFIED' && canVerifyCommercial && (
            <Button
              size="small"
              type="primary"
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
              onClick={() => {
                setSelectedClaim(r);
                setIsApproveModalOpen(false);
                setIsReturnModalOpen(false);
                setIsRejectModalOpen(false);
                returnForm.resetFields();
                rejectForm.resetFields();
                setViewMode('VERIFY_COMMERCIAL');
              }}
            >
              Verifikasi Komersial
            </Button>
          )}
          {r.status === 'SUBMITTED' && canVerifyTechnical && (
            <Button
              size="small"
              type="primary"
              style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
              onClick={() => {
                setSelectedClaim(r);
                decisionForm.resetFields();
                setDecisionAction('APPROVE');
                setViewMode('VERIFY_TECHNICAL');
              }}
            >
              Verifikasi Teknis
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1100}
      className={styles.serviceClaimModal}
      style={{ maxWidth: 'calc(100vw - 16px)', top: 16 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SafetyCertificateOutlined style={{ color: '#0F766E', fontSize: 20 }} />
          <span>Klaim Jasa (Service Claim) — {po?.poNumber}</span>
        </div>
      }
      footer={null}
      destroyOnClose
    >
      <div className={styles.modalBody}>
        <Spin spinning={loading}>
          {/* SECTION A: HEADER CONTEXT */}
          <div className={styles.headerContext}>
            <Row gutter={[12, 10]}>
              <Col xs={24} sm={12} md={6} className={styles.contextCol}>
                <span className={styles.contextLabel}>NOMOR PO</span>
                <div className={styles.contextValuePo}>{po?.poNumber}</div>
              </Col>
              <Col xs={24} sm={12} md={6} className={styles.contextCol}>
                <span className={styles.contextLabel}>PROYEK</span>
                <div className={styles.contextValueText}>{po?.projectName || (po as any)?.purchaseRequest?.project?.name || (po as any)?.project?.name || '—'}</div>
              </Col>
              <Col xs={24} sm={12} md={6} className={styles.contextCol}>
                <span className={styles.contextLabel}>VENDOR</span>
                <div className={styles.contextValueText}>{po?.vendorName || (po as any)?.vendor?.name || '—'}</div>
              </Col>
              <Col xs={24} sm={12} md={6} className={styles.contextCol}>
                <span className={styles.contextLabel}>NILAI KONTRAK PO</span>
                <div className={styles.contextValueHighlight}>{formatCurrency(po?.totalAmount || 0)}</div>
              </Col>
            </Row>
          </div>

          {/* SECTION B: BALANCE OVERVIEW */}
          {balance && viewMode === 'LIST' && (
            <Row gutter={[10, 10]} className={styles.balanceOverviewGrid}>
              <Col xs={12} sm={12} md={6}>
                <Card size="small" className={styles.metricCard} style={{ borderLeft: '4px solid #3B82F6' }}>
                  <span className={styles.metricLabel}>Total Kontrak PO</span>
                  <div className={styles.metricValue} style={{ color: '#1E293B' }}>
                    {formatCurrency(balance.contractTotalAmount)}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card size="small" className={styles.metricCard} style={{ borderLeft: '4px solid #10B981' }}>
                  <span className={styles.metricLabel}>Total Disetujui (Kumulatif)</span>
                  <div className={styles.metricValue} style={{ color: '#059669' }}>
                    {formatCurrency(balance.totalApprovedClaimAmount)}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card size="small" className={styles.metricCard} style={{ borderLeft: '4px solid #F59E0B' }}>
                  <span className={styles.metricLabel}>Sisa Nilai Kontrak</span>
                  <div className={styles.metricValue} style={{ color: '#D97706' }}>
                    {formatCurrency(balance.remainingContractValue)}
                  </div>
                </Card>
              </Col>
              <Col xs={12} sm={12} md={6}>
                <Card size="small" className={styles.metricCard} style={{ borderLeft: '4px solid #6366F1' }}>
                  <span className={styles.metricLabel}>Jumlah Klaim</span>
                  <div className={styles.metricValue} style={{ color: '#4F46E5' }}>
                    {claims.length} Dokumen
                  </div>
                </Card>
              </Col>
            </Row>
          )}

        {/* VIEW MODE: LIST */}
        {viewMode === 'LIST' && (
          <div>
            <div className={styles.viewTopBar}>
              <Title level={5} className={styles.viewTitle}>Daftar Klaim Jasa</Title>
              {canManageClaims && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleStartCreate}
                  style={{ borderRadius: 6 }}
                >
                  Buat Klaim Jasa Baru
                </Button>
              )}
            </div>

            <div className={styles.desktopTableView}>
              <Table
                columns={claimColumns}
                dataSource={claims}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                locale={{
                  emptyText: (
                    <Empty
                      description="Belum ada klaim jasa untuk Purchase Order ini."
                      style={{ padding: '24px 0' }}
                    />
                  ),
                }}
              />
            </div>

            <div className={styles.mobileCardsView}>
              {claims.length === 0 ? (
                <Empty
                  description="Belum ada klaim jasa untuk Purchase Order ini."
                  style={{ padding: '24px 0' }}
                />
              ) : (
                claims.map((claim) => (
                  <div key={claim.id} className={styles.claimCard}>
                    <div className={styles.claimCardHeader}>
                      <span
                        className={styles.claimCardNumber}
                        onClick={() => {
                          setSelectedClaim(claim);
                          setViewMode('DETAIL');
                        }}
                      >
                        {claim.claimNumber}
                      </span>
                      <Tag color={CLAIM_STATUS_MAP[claim.status]?.color || 'default'}>
                        {CLAIM_STATUS_MAP[claim.status]?.label || claim.status}
                      </Tag>
                    </div>

                    <div className={styles.claimCardGrid}>
                      <div>
                        <span className={styles.itemCardFieldLabel}>Periode</span>
                        <div style={{ fontWeight: 600 }}>
                          {claim.claimPeriodStart && claim.claimPeriodEnd
                            ? `${dayjs(claim.claimPeriodStart).format('DD/MM/YYYY')} - ${dayjs(claim.claimPeriodEnd).format('DD/MM/YYYY')}`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <span className={styles.itemCardFieldLabel}>Nilai Klaim</span>
                        <div style={{ fontWeight: 700, color: '#0F766E' }}>
                          {formatCurrency(claim.totalClaimAmount)}
                        </div>
                        {Number(claim.approvedClaimAmount) > 0 && claim.status === 'APPROVED_FOR_INVOICE' && (
                          <div style={{ fontSize: 11, color: '#059669' }}>
                            Disetujui: {formatCurrency(claim.approvedClaimAmount)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.claimCardActions}>
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setSelectedClaim(claim);
                          setViewMode('DETAIL');
                        }}
                      >
                        Detail
                      </Button>
                      {(claim.status === 'DRAFT' || claim.status === 'NEEDS_REVISION') && canManageClaims && (
                        <>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleStartEdit(claim)}
                          >
                            Ubah
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={() => handleSubmitClaim(claim.id)}
                            loading={isSubmitting}
                          >
                            Submit
                          </Button>
                        </>
                      )}
                      {claim.status === 'PM_VERIFIED' && canVerifyCommercial && (
                        <Button
                          size="small"
                          type="primary"
                          style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                          onClick={() => {
                            setSelectedClaim(claim);
                            setIsApproveModalOpen(false);
                            setIsReturnModalOpen(false);
                            setIsRejectModalOpen(false);
                            returnForm.resetFields();
                            rejectForm.resetFields();
                            setViewMode('VERIFY_COMMERCIAL');
                          }}
                        >
                          Verifikasi Komersial
                        </Button>
                      )}
                      {claim.status === 'SUBMITTED' && canVerifyTechnical && (
                        <Button
                          size="small"
                          type="primary"
                          style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                          onClick={() => {
                            setSelectedClaim(claim);
                            decisionForm.resetFields();
                            setDecisionAction('APPROVE');
                            setViewMode('VERIFY_TECHNICAL');
                          }}
                        >
                          Verifikasi Teknis
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW MODE: CREATE OR EDIT */}
        {(viewMode === 'CREATE' || viewMode === 'EDIT') && canManageClaims && (
          <div>
            <div className={styles.viewTopBar}>
              <div className={styles.viewTopBarLeft}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setViewMode('LIST')}
                  size="small"
                >
                  Kembali ke Daftar
                </Button>
                <Title level={5} className={styles.viewTitle}>
                  {viewMode === 'CREATE' ? 'Buat Draft Klaim Jasa Baru' : `Edit Draft Klaim — ${selectedClaim?.claimNumber}`}
                </Title>
              </div>
            </div>

            <Form form={form} layout="vertical">
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="serviceOrderId"
                    label="Referensi SPK / Work Order (Opsional)"
                  >
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Pilih SPK jika relevan"
                      allowClear
                      options={serviceOrders.map(so => ({
                        value: so.id,
                        label: `${so.serviceOrderNumber || (so as any).documentNumber || `SPK #${so.id}`} (${so.scopeOfWork || 'SPK Jasa'})`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="claimPeriod"
                    label="Periode Klaim Pelaksanaan"
                  >
                    <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="acceptanceType"
                    label="Jenis Bukti Penerimaan / Pengesahan"
                  >
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Pilih jenis dokumen bukti"
                      options={[
                        { value: 'BAST', label: 'BAST (Berita Acara Serah Terima)' },
                        { value: 'PROGRESS_CERTIFICATE', label: 'Progress Certificate' },
                        { value: 'MEASUREMENT_SHEET', label: 'Measurement Sheet / Opname' },
                        { value: 'COMPLETION_REPORT', label: 'Completion Report' },
                        { value: 'OTHER', label: 'Lainnya' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="acceptanceReference"
                    label="Nomor Referensi Bukti (Opsional)"
                  >
                    <Input placeholder="Contoh: BAST-001/X/2026 atau OPNAME-02" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="acceptanceDate"
                    label="Tanggal Dokumen Bukti"
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="notes"
                    label="Catatan Klaim"
                  >
                    <Input placeholder="Keterangan tambahan kemajuan jasa" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />

              <Title level={5} style={{ marginBottom: 12 }}>Rincian Item Jasa yang Diklaim</Title>
              
              {/* Desktop Table View */}
              <div className={styles.desktopTableView} style={{ marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', textAlign: 'left', borderBottom: '2px solid #CBD5E1' }}>
                      <th style={{ padding: '8px 6px' }}>Item Jasa</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Kontrak</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Disetujui Sblmnya</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Sisa Qty</th>
                      <th style={{ padding: '8px 6px', width: 140 }}>Klaim Saat Ini</th>
                      <th style={{ padding: '8px 6px' }}>Satuan</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Tarif Kontrak</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>Nilai Klaim</th>
                      <th style={{ padding: '8px 6px', width: 160 }}>Lokasi Pekerjaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((item) => {
                      const itemClaimAmount = Number(item.currentClaimQuantity || 0) * Number(item.contractUnitPrice || 0);
                      const isOver = (Number(item.approvedQuantity || 0) + Number(item.currentClaimQuantity || 0)) > Number(item.contractQuantity);

                      return (
                        <tr key={item.poItemId} style={{ borderBottom: '1px solid #E2E8F0', background: isOver ? '#FEF2F2' : 'transparent' }}>
                          <td style={{ padding: '8px 6px', fontWeight: 600 }}>{item.itemName}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatNumber(item.contractQuantity)}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>{formatNumber(item.approvedQuantity)}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#D97706' }}>
                            {formatNumber(item.remainingQuantity)}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <InputNumber
                              min={0}
                              step={0.1}
                              style={{ width: '100%' }}
                              value={item.currentClaimQuantity}
                              onChange={(val) => handleItemQtyChange(item.poItemId, val)}
                            />
                            {isOver && (
                              <div style={{ color: '#DC2626', fontSize: 10, marginTop: 2 }}>Melebihi sisa kontrak!</div>
                            )}
                          </td>
                          <td style={{ padding: '8px 6px', color: '#64748B' }}>{item.uom}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right' }}>{formatCurrency(item.contractUnitPrice)}</td>
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: '#1E293B' }}>
                            {formatCurrency(itemClaimAmount)}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <Input
                              placeholder="Lokasi / Ruang"
                              size="small"
                              value={item.workLocation}
                              onChange={(e) => handleItemLocationChange(item.poItemId, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className={styles.mobileCardsView} style={{ marginBottom: 16 }}>
                {draftItems.map((item) => {
                  const itemClaimAmount = Number(item.currentClaimQuantity || 0) * Number(item.contractUnitPrice || 0);
                  const isOver = (Number(item.approvedQuantity || 0) + Number(item.currentClaimQuantity || 0)) > Number(item.contractQuantity);

                    return (
                      <div key={item.poItemId} className={styles.itemCard} style={isOver ? { borderColor: '#FCA5A5', background: '#FEF2F2' } : {}}>
                        <div className={styles.itemCardTitle}>{item.itemName}</div>
                        <div className={styles.itemCardGrid}>
                          <div className={styles.itemCardField}>
                            <span className={styles.itemCardFieldLabel}>Kontrak:</span>
                            <span className={styles.itemCardFieldValue}>{formatNumber(item.contractQuantity)} {item.uom}</span>
                          </div>
                          <div className={styles.itemCardField}>
                            <span className={styles.itemCardFieldLabel}>Disetujui Sblm:</span>
                            <span className={styles.itemCardFieldValue} style={{ color: '#059669' }}>{formatNumber(item.approvedQuantity)} {item.uom}</span>
                          </div>
                          <div className={styles.itemCardField}>
                            <span className={styles.itemCardFieldLabel}>Sisa Kontrak:</span>
                            <span className={styles.itemCardFieldValue} style={{ color: '#D97706', fontWeight: 700 }}>{formatNumber(item.remainingQuantity)} {item.uom}</span>
                          </div>
                          <div className={styles.itemCardField}>
                            <span className={styles.itemCardFieldLabel}>Tarif Kontrak:</span>
                            <span className={styles.itemCardFieldValue}>{formatCurrency(item.contractUnitPrice)}</span>
                          </div>
                        </div>

                        <div className={styles.itemCardInputGroup}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                              Kuantitas Klaim Saat Ini ({item.uom})
                            </div>
                            <InputNumber
                              min={0}
                              step={0.1}
                              style={{ width: '100%' }}
                              value={item.currentClaimQuantity}
                              onChange={(val) => handleItemQtyChange(item.poItemId, val)}
                            />
                            {isOver && (
                              <div style={{ color: '#DC2626', fontSize: 10, marginTop: 2 }}>Melebihi sisa kontrak!</div>
                            )}
                          </div>

                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                              Lokasi Pekerjaan
                            </div>
                            <Input
                              placeholder="Contoh: Lantai 2 / Ruang Server"
                              value={item.workLocation}
                              onChange={(e) => handleItemLocationChange(item.poItemId, e.target.value)}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                            <span style={{ fontSize: 11.5, color: '#64748B' }}>Nilai Klaim Item:</span>
                            <span style={{ fontWeight: 700, color: '#0F766E', fontSize: 13 }}>{formatCurrency(itemClaimAmount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.totalBanner}>
                  <span className={styles.totalBannerLabel}>Total Nilai Klaim Saat Ini:</span>
                  <span className={styles.totalBannerValue}>
                    {formatCurrency(calculatedTotalClaim)}
                  </span>
                </div>

                <div className={styles.modalFooterActions}>
                  <Button onClick={() => setViewMode('LIST')}>Batal</Button>
                  <Button type="primary" onClick={handleSaveDraft} loading={isSubmitting}>
                    Simpan Draft Klaim
                  </Button>
                </div>
              </Form>
          </div>
        )}

        {/* VIEW MODE: DETAIL */}
        {viewMode === 'DETAIL' && selectedClaim && (
          <div>
            <div className={styles.viewTopBar}>
              <div className={styles.viewTopBarLeft}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setViewMode('LIST')}
                  size="small"
                >
                  Kembali ke Daftar
                </Button>
                <Tag color={CLAIM_STATUS_MAP[selectedClaim.status]?.color || 'default'} style={{ fontSize: 13, padding: '4px 10px', margin: 0 }}>
                  {CLAIM_STATUS_MAP[selectedClaim.status]?.label || selectedClaim.status}
                </Tag>
              </div>
              <div className={styles.detailActionGroup}>
                {(selectedClaim.status === 'DRAFT' || selectedClaim.status === 'NEEDS_REVISION') && canManageClaims && (
                  <>
                    <Button icon={<EditOutlined />} onClick={() => handleStartEdit(selectedClaim)}>
                      Edit Draft
                    </Button>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={() => handleSubmitClaim(selectedClaim.id)}
                      loading={isSubmitting}
                    >
                      Ajukan Klaim (Submit)
                    </Button>
                    <Popconfirm
                      title="Batalkan klaim jasa ini?"
                      onConfirm={() => handleCancelClaim(selectedClaim.id)}
                    >
                      <Button danger icon={<StopOutlined />}>
                        Batalkan
                      </Button>
                    </Popconfirm>
                  </>
                )}
                {selectedClaim.status === 'SUBMITTED' && canVerifyTechnical && (
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#2563EB', borderColor: '#2563EB' }}
                    onClick={() => {
                      decisionForm.resetFields();
                      setDecisionAction('APPROVE');
                      setViewMode('VERIFY_TECHNICAL');
                    }}
                  >
                    Verifikasi Teknis
                  </Button>
                )}
                {selectedClaim.status === 'PM_VERIFIED' && canVerifyCommercial && (
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                    onClick={() => {
                      setIsApproveModalOpen(false);
                      setIsReturnModalOpen(false);
                      setIsRejectModalOpen(false);
                      returnForm.resetFields();
                      rejectForm.resetFields();
                      setViewMode('VERIFY_COMMERCIAL');
                    }}
                  >
                    Verifikasi Komersial
                  </Button>
                )}
              </div>
            </div>

            {selectedClaim.revisionNotes && (
              <Alert
                type="warning"
                message="Catatan Revisi dari Verifikator"
                description={selectedClaim.revisionNotes}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            {selectedClaim.rejectionReason && (
              <Alert
                type="error"
                message="Alasan Penolakan Klaim"
                description={selectedClaim.rejectionReason}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nomor Klaim">{selectedClaim.claimNumber}</Descriptions.Item>
              <Descriptions.Item label="Status Klaim">
                <Tag color={CLAIM_STATUS_MAP[selectedClaim.status]?.color}>
                  {CLAIM_STATUS_MAP[selectedClaim.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Periode Pelaksanaan">
                {selectedClaim.claimPeriodStart && selectedClaim.claimPeriodEnd
                  ? `${dayjs(selectedClaim.claimPeriodStart).format('DD/MM/YYYY')} - ${dayjs(selectedClaim.claimPeriodEnd).format('DD/MM/YYYY')}`
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Referensi SPK/WO">
                {selectedClaim.serviceOrder?.documentNumber || (selectedClaim.serviceOrderId ? `SPK #${selectedClaim.serviceOrderId}` : 'Tanpa SPK (Langsung PO)')}
              </Descriptions.Item>
              <Descriptions.Item label="Jenis Bukti">
                {selectedClaim.acceptanceType || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Nomor Dokumen Bukti">
                {selectedClaim.acceptanceReference || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tanggal Dokumen Bukti">
                {selectedClaim.acceptanceDate ? dayjs(selectedClaim.acceptanceDate).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Nilai Klaim">
                <Text strong style={{ color: '#0F766E' }}>{formatCurrency(selectedClaim.totalClaimAmount)}</Text>
              </Descriptions.Item>
              {selectedClaim.pmVerifiedAt && (
                <Descriptions.Item label="Verifikasi Teknis PM">
                  {dayjs(selectedClaim.pmVerifiedAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              )}
              {selectedClaim.commercialVerifiedAt && (
                <Descriptions.Item label="Verifikasi Komersial">
                  {dayjs(selectedClaim.commercialVerifiedAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>Rincian Item Klaim</Title>
            
            {/* Desktop Table View */}
            <div className={styles.desktopTableView}>
              <Table
                size="small"
                dataSource={selectedClaim.items || []}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'Item Jasa', dataIndex: 'itemNameSnapshot', key: 'itemNameSnapshot' },
                  { title: 'Qty Kontrak', dataIndex: 'contractQuantitySnapshot', key: 'contractQuantitySnapshot', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Qty Sblmnya', dataIndex: 'previousApprovedQuantity', key: 'previousApprovedQuantity', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Qty Diklaim', dataIndex: 'currentClaimQuantity', key: 'currentClaimQuantity', align: 'right', render: (val: any) => <Text strong>{formatNumber(val)}</Text> },
                  { title: 'Qty Kumulatif', dataIndex: 'cumulativeApprovedQuantity', key: 'cumulativeApprovedQuantity', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Sisa Qty', dataIndex: 'remainingQuantity', key: 'remainingQuantity', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Satuan', dataIndex: 'uomSnapshot', key: 'uomSnapshot' },
                  { title: 'Tarif Kontrak', dataIndex: 'contractUnitRateSnapshot', key: 'contractUnitRateSnapshot', align: 'right', render: (v: any) => formatCurrency(v) },
                  { title: 'Nilai Klaim', dataIndex: 'currentClaimAmount', key: 'currentClaimAmount', align: 'right', render: (val: any) => <Text strong style={{ color: '#0F766E' }}>{formatCurrency(val)}</Text> },
                  { title: 'Lokasi Kerja', dataIndex: 'workLocation', key: 'workLocation', render: (v: any) => v || '—' },
                ]}
              />
            </div>

            {/* Mobile Cards View */}
            <div className={styles.mobileCardsView}>
              {(selectedClaim.items || []).map((item, idx) => (
                <div key={item.id || idx} className={styles.itemCard}>
                  <div className={styles.itemCardTitle}>{item.itemNameSnapshot}</div>
                  <div className={styles.itemCardGrid}>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Qty Kontrak:</span>
                      <span className={styles.itemCardFieldValue}>{formatNumber(item.contractQuantitySnapshot)} {item.uomSnapshot}</span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Qty Sblmnya:</span>
                      <span className={styles.itemCardFieldValue}>{formatNumber(item.previousApprovedQuantity)} {item.uomSnapshot}</span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Qty Diklaim:</span>
                      <span className={styles.itemCardFieldValue} style={{ color: '#1D4ED8', fontWeight: 700 }}>
                        {formatNumber(item.currentClaimQuantity)} {item.uomSnapshot}
                      </span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Sisa Qty:</span>
                      <span className={styles.itemCardFieldValue} style={{ color: '#D97706' }}>
                        {formatNumber(item.remainingQuantity)} {item.uomSnapshot}
                      </span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Tarif Kontrak:</span>
                      <span className={styles.itemCardFieldValue}>{formatCurrency(item.contractUnitRateSnapshot)}</span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Nilai Klaim:</span>
                      <span className={styles.itemCardFieldValue} style={{ color: '#0F766E', fontWeight: 700 }}>
                        {formatCurrency(item.currentClaimAmount)}
                      </span>
                    </div>
                  </div>
                  {item.workLocation && (
                    <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                      <EnvironmentOutlined style={{ color: '#0F766E' }} />
                      <span>Lokasi: {item.workLocation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW MODE: VERIFY COMMERCIAL */}
        {viewMode === 'VERIFY_COMMERCIAL' && selectedClaim && canVerifyCommercial && (
          <div>
            <div className={styles.viewTopBar}>
              <div className={styles.viewTopBarLeft}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setViewMode('DETAIL')}
                  size="small"
                >
                  Kembali ke Detail
                </Button>
                <Title level={5} className={styles.viewTitle}>
                  Verifikasi Komersial — {selectedClaim.claimNumber}
                </Title>
              </div>
            </div>

            <Alert
              type="info"
              message="Pemeriksaan Komersial Procurement"
              description="Pastikan kuantitas kumulatif, nilai kontrak, bukti penerimaan, dan verifikasi teknis PM telah sesuai sebelum memberikan persetujuan komersial. Persetujuan komersial akan membuka gerbang penagihan (Invoice) di Finance."
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nomor Klaim">{selectedClaim.claimNumber}</Descriptions.Item>
              <Descriptions.Item label="Total Nilai Klaim">
                <Text strong style={{ color: '#0F766E' }}>{formatCurrency(selectedClaim.totalClaimAmount)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Jenis Bukti">{selectedClaim.acceptanceType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Nomor Bukti">{selectedClaim.acceptanceReference || '—'}</Descriptions.Item>
              <Descriptions.Item label="Verifikasi Teknis PM">
                <Tag color="green">Terverifikasi</Tag> {selectedClaim.pmVerifiedAt ? dayjs(selectedClaim.pmVerifiedAt).format('DD/MM/YYYY HH:mm') : ''}
              </Descriptions.Item>
            </Descriptions>

            {/* Direct Commercial Verification Action Buttons */}
            <div className={styles.modalFooterActions} style={{ marginTop: 24 }}>
              <div className={styles.decisionActionGroup}>
                <Button
                  onClick={() => setViewMode('DETAIL')}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    rejectForm.resetFields();
                    setIsRejectModalOpen(true);
                  }}
                  disabled={isSubmitting}
                  id="btn-commercial-reject"
                >
                  Tolak Klaim
                </Button>
                <Button
                  style={{ borderColor: '#D97706', color: '#D97706' }}
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    returnForm.resetFields();
                    setIsReturnModalOpen(true);
                  }}
                  disabled={isSubmitting}
                  id="btn-commercial-return"
                >
                  Minta Revisi
                </Button>
                <Button
                  type="primary"
                  style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                  icon={<CheckCircleOutlined />}
                  onClick={() => setIsApproveModalOpen(true)}
                  disabled={isSubmitting}
                  id="btn-commercial-approve"
                >
                  Setujui Komersial
                </Button>
              </div>
            </div>

            {/* Direct Action Dialogs for Commercial Verification */}
            <Modal
              title="Konfirmasi Persetujuan Komersial"
              open={isApproveModalOpen}
              onCancel={() => !isSubmitting && setIsApproveModalOpen(false)}
              onOk={handleConfirmCommercialApprove}
              okText="Ya, Setujui Komersial"
              cancelText="Batal"
              confirmLoading={isSubmitting}
              okButtonProps={{ style: { backgroundColor: '#059669', borderColor: '#059669' } }}
              cancelButtonProps={{ disabled: isSubmitting }}
              zIndex={1100}
              destroyOnClose
            >
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Persetujuan Komersial Klaim Jasa"
                  description={`Apakah Anda yakin ingin menyetujui klaim jasa ${selectedClaim.claimNumber} senilai ${formatCurrency(selectedClaim.totalClaimAmount)}? Persetujuan komersial akan membuka gerbang penagihan (Invoice) di Finance.`}
                  style={{ marginBottom: 16 }}
                />
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item label="Nomor Klaim">{selectedClaim.claimNumber}</Descriptions.Item>
                  <Descriptions.Item label="Total Nilai">{formatCurrency(selectedClaim.totalClaimAmount)}</Descriptions.Item>
                  <Descriptions.Item label="Verifikasi Teknis PM">
                    <Tag color="green">Terverifikasi</Tag> {selectedClaim.pmVerifiedAt ? dayjs(selectedClaim.pmVerifiedAt).format('DD/MM/YYYY HH:mm') : '—'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Modal>

            <Modal
              title={`Minta Revisi Klaim Jasa — ${selectedClaim.claimNumber}`}
              open={isReturnModalOpen}
              onCancel={() => {
                if (!isSubmitting) {
                  setIsReturnModalOpen(false);
                  returnForm.resetFields();
                }
              }}
              onOk={handleConfirmCommercialReturn}
              okText="Kirim Permintaan Revisi"
              cancelText="Batal"
              confirmLoading={isSubmitting}
              okButtonProps={{ style: { backgroundColor: '#D97706', borderColor: '#D97706' } }}
              cancelButtonProps={{ disabled: isSubmitting }}
              zIndex={1100}
              destroyOnClose
            >
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Permintaan Revisi Klaim"
                  description="Klaim akan dikembalikan ke status revisi agar pembuat klaim dapat memperbaiki volume atau kelengkapan dokumen."
                  style={{ marginBottom: 16 }}
                />
                <Form form={returnForm} layout="vertical">
                  <Form.Item
                    name="revisionNotes"
                    label="Catatan Permintaan Revisi (Wajib)"
                    rules={[
                      { required: true, whitespace: true, message: 'Catatan revisi wajib diisi!' },
                    ]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="Sebutkan bagian atau volume klaim yang perlu diperbaiki..."
                      disabled={isSubmitting}
                    />
                  </Form.Item>
                </Form>
              </div>
            </Modal>

            <Modal
              title={`Tolak Klaim Jasa — ${selectedClaim.claimNumber}`}
              open={isRejectModalOpen}
              onCancel={() => {
                if (!isSubmitting) {
                  setIsRejectModalOpen(false);
                  rejectForm.resetFields();
                }
              }}
              onOk={handleConfirmCommercialReject}
              okText="Tolak Klaim"
              cancelText="Batal"
              confirmLoading={isSubmitting}
              okButtonProps={{ danger: true }}
              cancelButtonProps={{ disabled: isSubmitting }}
              zIndex={1100}
              destroyOnClose
            >
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="error"
                  showIcon
                  message="Penolakan Klaim Jasa"
                  description="Penolakan klaim bersifat permanen. Pastikan alasan penolakan dijelaskan secara rinci."
                  style={{ marginBottom: 16 }}
                />
                <Form form={rejectForm} layout="vertical">
                  <Form.Item
                    name="rejectionReason"
                    label="Alasan Penolakan (Wajib)"
                    rules={[
                      { required: true, whitespace: true, message: 'Alasan penolakan wajib diisi!' },
                    ]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="Sebutkan alasan penolakan klaim jasa..."
                      disabled={isSubmitting}
                    />
                  </Form.Item>
                </Form>
              </div>
            </Modal>
          </div>
        )}

        {/* VIEW MODE: VERIFY TECHNICAL (PM) */}
        {viewMode === 'VERIFY_TECHNICAL' && selectedClaim && canVerifyTechnical && (
          <div>
            <div className={styles.viewTopBar}>
              <div className={styles.viewTopBarLeft}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => setViewMode('DETAIL')}
                  size="small"
                >
                  Kembali ke Detail
                </Button>
                <Title level={5} className={styles.viewTitle}>
                  Verifikasi Teknis Project Manager — {selectedClaim.claimNumber}
                </Title>
              </div>
            </div>

            <Alert
              type="info"
              message="Verifikasi Fisik & Teknis Lapangan"
              description="Verifikasi kesesuaian volume fisik jasa yang terlaksana di lapangan dan kelengkapan bukti opname/BAST. Verifikasi teknis TIDAK mengubah progress fisik S-Curve atau task project."
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered size="small" column={{ xs: 1, sm: 1, md: 2 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nomor Klaim">{selectedClaim.claimNumber}</Descriptions.Item>
              <Descriptions.Item label="PO & Proyek">{po?.poNumber} — {po?.projectName}</Descriptions.Item>
              <Descriptions.Item label="Vendor">{po?.vendorName}</Descriptions.Item>
              <Descriptions.Item label="Referensi SPK/WO">{selectedClaim.serviceOrder?.documentNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="Jenis Bukti">{selectedClaim.acceptanceType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Nomor Bukti">{selectedClaim.acceptanceReference || '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>Rincian Volume yang Diverifikasi</Title>
            
            {/* Desktop Table View */}
            <div className={styles.desktopTableView} style={{ marginBottom: 16 }}>
              <Table
                size="small"
                dataSource={selectedClaim.items || []}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'Item Jasa', dataIndex: 'itemNameSnapshot', key: 'itemNameSnapshot' },
                  { title: 'Qty Kontrak', dataIndex: 'contractQuantitySnapshot', key: 'contractQuantitySnapshot', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Disetujui Sblmnya', dataIndex: 'previousApprovedQuantity', key: 'previousApprovedQuantity', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Klaim Saat Ini', dataIndex: 'currentClaimQuantity', key: 'currentClaimQuantity', align: 'right', render: (v: any) => <Text strong style={{ color: '#1D4ED8' }}>{formatNumber(v)}</Text> },
                  { title: 'Kumulatif', dataIndex: 'cumulativeApprovedQuantity', key: 'cumulativeApprovedQuantity', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Sisa Qty', dataIndex: 'remainingQuantity', key: 'remainingQuantity', align: 'right', render: (v: any) => formatNumber(v) },
                  { title: 'Satuan', dataIndex: 'uomSnapshot', key: 'uomSnapshot' },
                  { title: 'Lokasi Kerja', dataIndex: 'workLocation', key: 'workLocation', render: (v: any) => v || '—' },
                ]}
              />
            </div>

            {/* Mobile Cards View */}
            <div className={styles.mobileCardsView} style={{ marginBottom: 16 }}>
              {(selectedClaim.items || []).map((item, idx) => (
                <div key={item.id || idx} className={styles.itemCard}>
                  <div className={styles.itemCardTitle}>{item.itemNameSnapshot}</div>
                  <div className={styles.itemCardGrid}>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Qty Kontrak:</span>
                      <span className={styles.itemCardFieldValue}>{formatNumber(item.contractQuantitySnapshot)} {item.uomSnapshot}</span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Disetujui Sblm:</span>
                      <span className={styles.itemCardFieldValue}>{formatNumber(item.previousApprovedQuantity)} {item.uomSnapshot}</span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Klaim Saat Ini:</span>
                      <span className={styles.itemCardFieldValue} style={{ color: '#1D4ED8', fontWeight: 700 }}>
                        {formatNumber(item.currentClaimQuantity)} {item.uomSnapshot}
                      </span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Kumulatif:</span>
                      <span className={styles.itemCardFieldValue}>{formatNumber(item.cumulativeApprovedQuantity)} {item.uomSnapshot}</span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Sisa Qty:</span>
                      <span className={styles.itemCardFieldValue} style={{ color: '#D97706' }}>
                        {formatNumber(item.remainingQuantity)} {item.uomSnapshot}
                      </span>
                    </div>
                    <div className={styles.itemCardField}>
                      <span className={styles.itemCardFieldLabel}>Satuan:</span>
                      <span className={styles.itemCardFieldValue}>{item.uomSnapshot}</span>
                    </div>
                  </div>
                  {item.workLocation && (
                    <div style={{ fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                      <EnvironmentOutlined style={{ color: '#0F766E' }} />
                      <span>Lokasi: {item.workLocation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.modalFooterActions} style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <Button onClick={() => setViewMode('DETAIL')} disabled={isSubmitting}>
                Batal
              </Button>
              <Button
                id="btn-pm-technical-reject-sec"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  techRejectForm.resetFields();
                  setIsTechRejectModalOpen(true);
                }}
                disabled={isSubmitting}
              >
                Tolak Klaim
              </Button>
              <Button
                id="btn-pm-technical-return-sec"
                style={{ borderColor: '#D97706', color: '#D97706' }}
                icon={<RollbackOutlined />}
                onClick={() => {
                  techReturnForm.resetFields();
                  setIsTechReturnModalOpen(true);
                }}
                disabled={isSubmitting}
              >
                Minta Revisi
              </Button>
              <Button
                id="btn-pm-technical-approve-sec"
                type="primary"
                style={{ backgroundColor: '#16A34A', borderColor: '#16A34A' }}
                icon={<CheckCircleOutlined />}
                onClick={() => setIsTechApproveModalOpen(true)}
                disabled={isSubmitting}
              >
                Setujui Teknis
              </Button>
            </div>

            {/* 1. Modal Konfirmasi Setujui Teknis (PM Secondary) */}
            <Modal
              title={`Konfirmasi Verifikasi Teknis — ${selectedClaim.claimNumber}`}
              open={isTechApproveModalOpen}
              onCancel={() => {
                if (!isSubmitting) setIsTechApproveModalOpen(false);
              }}
              onOk={handleConfirmTechnicalApprove}
              okText="Ya, Setujui Teknis"
              cancelText="Batal"
              confirmLoading={isSubmitting}
              okButtonProps={{ style: { backgroundColor: '#16A34A', borderColor: '#16A34A' } }}
              cancelButtonProps={{ disabled: isSubmitting }}
              zIndex={1100}
              destroyOnClose
            >
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="warning"
                  showIcon
                  message="Persetujuan Volume Fisik Lapangan"
                  description={`Apakah Anda yakin ingin menyetujui verifikasi teknis klaim jasa ${selectedClaim.claimNumber} senilai ${formatCurrency(selectedClaim.totalClaimAmount || 0)}? Persetujuan teknis menyatakan kesesuaian volume fisik jasa di lapangan dan akan meneruskan klaim ke Pengadaan untuk Verifikasi Komersial.`}
                  style={{ marginBottom: 16 }}
                />
                <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.6 }}>
                  <div><strong>Nomor Klaim:</strong> {selectedClaim.claimNumber}</div>
                  <div><strong>Total Nilai Diajukan:</strong> {formatCurrency(selectedClaim.totalClaimAmount || 0)}</div>
                  <div><strong>Status Saat Ini:</strong> {selectedClaim.status}</div>
                </div>
              </div>
            </Modal>

            {/* 2. Modal Minta Revisi Teknis (PM Secondary) */}
            <Modal
              title={`Minta Revisi Klaim Jasa — ${selectedClaim.claimNumber}`}
              open={isTechReturnModalOpen}
              onCancel={() => {
                if (!isSubmitting) {
                  setIsTechReturnModalOpen(false);
                  techReturnForm.resetFields();
                }
              }}
              onOk={handleConfirmTechnicalReturn}
              okText="Kirim Permintaan Revisi"
              cancelText="Batal"
              confirmLoading={isSubmitting}
              okButtonProps={{ style: { backgroundColor: '#D97706', borderColor: '#D97706' } }}
              cancelButtonProps={{ disabled: isSubmitting }}
              zIndex={1100}
              destroyOnClose
            >
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Pengembalian untuk Koreksi Teknis"
                  description="Klaim akan dikembalikan ke status revisi agar pembuat klaim dapat memperbaiki volume fisik atau melengkapi dokumen opname."
                  style={{ marginBottom: 16 }}
                />
                <Form form={techReturnForm} layout="vertical">
                  <Form.Item
                    name="revisionNotes"
                    label="Catatan Permintaan Revisi (Wajib)"
                    rules={[
                      { required: true, whitespace: true, message: 'Catatan revisi wajib diisi!' },
                    ]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="Sebutkan rincian volume fisik atau dokumen opname yang perlu diperbaiki..."
                      disabled={isSubmitting}
                    />
                  </Form.Item>
                </Form>
              </div>
            </Modal>

            {/* 3. Modal Tolak Teknis (PM Secondary) */}
            <Modal
              title={`Tolak Klaim Jasa — ${selectedClaim.claimNumber}`}
              open={isTechRejectModalOpen}
              onCancel={() => {
                if (!isSubmitting) {
                  setIsTechRejectModalOpen(false);
                  techRejectForm.resetFields();
                }
              }}
              onOk={handleConfirmTechnicalReject}
              okText="Tolak Klaim"
              cancelText="Batal"
              confirmLoading={isSubmitting}
              okButtonProps={{ danger: true }}
              cancelButtonProps={{ disabled: isSubmitting }}
              zIndex={1100}
              destroyOnClose
            >
              <div style={{ marginTop: 8 }}>
                <Alert
                  type="error"
                  showIcon
                  message="Penolakan Klaim Jasa"
                  description="Penolakan klaim bersifat permanen. Pastikan alasan penolakan teknis dijelaskan secara rinci."
                  style={{ marginBottom: 16 }}
                />
                <Form form={techRejectForm} layout="vertical">
                  <Form.Item
                    name="rejectionReason"
                    label="Alasan Penolakan (Wajib)"
                    rules={[
                      { required: true, whitespace: true, message: 'Alasan penolakan wajib diisi!' },
                    ]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="Sebutkan alasan penolakan teknis klaim jasa..."
                      disabled={isSubmitting}
                    />
                  </Form.Item>
                </Form>
              </div>
            </Modal>
          </div>
        )}
      </Spin>
    </div>
  </Modal>
  );
};

export default ServiceClaimModal;
