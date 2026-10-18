"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
}) => {
  const [form] = Form.useForm();
  const [decisionForm] = Form.useForm();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [claims, setClaims] = useState<ServiceClaimRecord[]>([]);
  const [balance, setBalance] = useState<PoServiceClaimBalance | null>(null);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ServiceClaimRecord | null>(null);
  const [viewMode, setViewMode] = useState<'LIST' | 'DETAIL' | 'CREATE' | 'EDIT' | 'VERIFY_COMMERCIAL' | 'VERIFY_TECHNICAL'>('LIST');
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'RETURN' | 'REJECT'>('APPROVE');

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

  const loadData = async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const [fetchedClaims, fetchedBalance, fetchedOrders] = await Promise.all([
        ProcurementService.getServiceClaims({ poId: Number(poId) }),
        ProcurementService.getPoServiceClaimBalance(Number(poId)).catch(() => null),
        ProcurementService.getServiceOrdersByPo(Number(poId)).catch(() => []),
      ]);
      setClaims(fetchedClaims || []);
      setBalance(fetchedBalance);
      setServiceOrders((fetchedOrders || []).filter((so: ServiceOrder) => so.status === 'ISSUED'));
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memuat data klaim jasa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && poId) {
      loadData();
      setViewMode('LIST');
      setSelectedClaim(null);
    }
  }, [open, poId]);

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
    initDraftItems(null);
    form.resetFields();
    setViewMode('CREATE');
  };

  const handleStartEdit = (claim: ServiceClaimRecord) => {
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

  const handleExecuteCommercialDecision = async () => {
    if (!selectedClaim) return;
    try {
      const values = await decisionForm.validateFields();
      setIsSubmitting(true);
      const res = await ProcurementService.verifyCommercialServiceClaim(selectedClaim.id, {
        decision: decisionAction,
        revisionNotes: decisionAction === 'RETURN' ? values.notes : undefined,
        rejectionReason: decisionAction === 'REJECT' ? values.notes : undefined,
      });

      if (decisionAction === 'APPROVE') {
        message.success(`Klaim Jasa ${res.claimNumber} berhasil disetujui secara komersial (Disetujui untuk Invoice).`);
      } else if (decisionAction === 'RETURN') {
        message.success(`Klaim Jasa ${res.claimNumber} dikembalikan untuk revisi.`);
      } else {
        message.success(`Klaim Jasa ${res.claimNumber} ditolak.`);
      }

      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses verifikasi komersial.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteTechnicalDecision = async () => {
    if (!selectedClaim) return;
    try {
      const values = await decisionForm.validateFields();
      setIsSubmitting(true);
      const res = await ProcurementService.verifyTechnicalServiceClaim(selectedClaim.id, {
        decision: decisionAction,
        revisionNotes: decisionAction === 'RETURN' ? values.notes : undefined,
        rejectionReason: decisionAction === 'REJECT' ? values.notes : undefined,
      });

      if (decisionAction === 'APPROVE') {
        message.success(`Klaim Jasa ${res.claimNumber} berhasil diverifikasi teknis.`);
      } else if (decisionAction === 'RETURN') {
        message.success(`Klaim Jasa ${res.claimNumber} dikembalikan untuk revisi.`);
      } else {
        message.success(`Klaim Jasa ${res.claimNumber} ditolak.`);
      }

      await loadData();
      setViewMode('LIST');
      if (onClaimUpdated) onClaimUpdated();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gagal memproses verifikasi teknis.');
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
          {(r.status === 'DRAFT' || r.status === 'NEEDS_REVISION') && (
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
          {r.status === 'PM_VERIFIED' && (
            <Button
              size="small"
              type="primary"
              style={{ backgroundColor: '#059669', borderColor: '#059669' }}
              onClick={() => {
                setSelectedClaim(r);
                decisionForm.resetFields();
                setDecisionAction('APPROVE');
                setViewMode('VERIFY_COMMERCIAL');
              }}
            >
              Verifikasi Komersial
            </Button>
          )}
          {r.status === 'SUBMITTED' && (
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
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SafetyCertificateOutlined style={{ color: '#0F766E', fontSize: 20 }} />
          <span>Klaim Jasa (Service Claim) — {po?.poNumber}</span>
        </div>
      }
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* SECTION A: HEADER CONTEXT */}
        <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #E2E8F0' }}>
          <Row gutter={[16, 8]}>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: 11 }}>NOMOR PO</Text>
              <div style={{ fontWeight: 700, color: '#1E293B', fontFamily: 'monospace' }}>{po?.poNumber}</div>
            </Col>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: 11 }}>PROYEK</Text>
              <div style={{ fontWeight: 600, color: '#1E293B' }}>{po?.projectName || (po as any)?.purchaseRequest?.project?.name || (po as any)?.project?.name || '—'}</div>
            </Col>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: 11 }}>VENDOR</Text>
              <div style={{ fontWeight: 600, color: '#1E293B' }}>{po?.vendorName || (po as any)?.vendor?.name || '—'}</div>
            </Col>
            <Col span={6}>
              <Text type="secondary" style={{ fontSize: 11 }}>NILAI KONTRAK PO</Text>
              <div style={{ fontWeight: 700, color: '#0F766E' }}>{formatCurrency(po?.totalAmount || 0)}</div>
            </Col>
          </Row>
        </div>

        {/* SECTION B: BALANCE OVERVIEW */}
        {balance && viewMode === 'LIST' && (
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #3B82F6' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Total Kontrak PO</Text>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1E293B' }}>
                  {formatCurrency(balance.contractTotalAmount)}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #10B981' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Total Disetujui (Kumulatif)</Text>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#059669' }}>
                  {formatCurrency(balance.totalApprovedClaimAmount)}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #F59E0B' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Sisa Nilai Kontrak</Text>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#D97706' }}>
                  {formatCurrency(balance.remainingContractValue)}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #6366F1' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Jumlah Klaim</Text>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#4F46E5' }}>
                  {claims.length} Dokumen
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* VIEW MODE: LIST */}
        {viewMode === 'LIST' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ margin: 0 }}>Daftar Klaim Jasa</Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleStartCreate}
                style={{ borderRadius: 6 }}
              >
                Buat Klaim Jasa Baru
              </Button>
            </div>

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
        )}

        {/* VIEW MODE: CREATE OR EDIT */}
        {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setViewMode('LIST')}
                size="small"
              >
                Kembali ke Daftar
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                {viewMode === 'CREATE' ? 'Buat Draft Klaim Jasa Baru' : `Edit Draft Klaim — ${selectedClaim?.claimNumber}`}
              </Title>
            </div>

            <Form form={form} layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="serviceOrderId"
                    label="Referensi SPK / Work Order (Opsional)"
                  >
                    <Select
                      placeholder="Pilih SPK jika relevan"
                      allowClear
                      options={serviceOrders.map(so => ({
                        value: so.id,
                        label: `${so.serviceOrderNumber || (so as any).documentNumber || `SPK #${so.id}`} (${so.scopeOfWork || 'SPK Jasa'})`,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="claimPeriod"
                    label="Periode Klaim Pelaksanaan"
                  >
                    <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="acceptanceType"
                    label="Jenis Bukti Penerimaan / Pengesahan"
                  >
                    <Select
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
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="acceptanceReference"
                    label="Nomor Referensi Bukti (Opsional)"
                  >
                    <Input placeholder="Contoh: BAST-001/X/2026 atau OPNAME-02" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="acceptanceDate"
                    label="Tanggal Dokumen Bukti"
                  >
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="notes"
                    label="Catatan Klaim"
                  >
                    <Input placeholder="Keterangan tambahan kemajuan jasa" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '12px 0' }} />

              <Title level={5}>Rincian Item Jasa yang Diklaim</Title>
              <div style={{ overflowX: 'auto', marginBottom: 16 }}>
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

              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'flex-end', gap: 24, alignItems: 'center', marginBottom: 16 }}>
                <Text type="secondary">Total Nilai Klaim Saat Ini:</Text>
                <Title level={4} style={{ margin: 0, color: '#0F766E' }}>
                  {formatCurrency(calculatedTotalClaim)}
                </Title>
              </div>

              <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={() => setViewMode('LIST')}>Batal</Button>
                <Button type="primary" onClick={handleSaveDraft} loading={isSubmitting}>
                  Simpan Draft Klaim
                </Button>
              </Space>
            </Form>
          </div>
        )}

        {/* VIEW MODE: DETAIL */}
        {viewMode === 'DETAIL' && selectedClaim && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setViewMode('LIST')}
                size="small"
              >
                Kembali ke Daftar
              </Button>
              <Space>
                <Tag color={CLAIM_STATUS_MAP[selectedClaim.status]?.color || 'default'} style={{ fontSize: 13, padding: '4px 10px' }}>
                  {CLAIM_STATUS_MAP[selectedClaim.status]?.label || selectedClaim.status}
                </Tag>
                {(selectedClaim.status === 'DRAFT' || selectedClaim.status === 'NEEDS_REVISION') && (
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
                {selectedClaim.status === 'SUBMITTED' && (
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
                {selectedClaim.status === 'PM_VERIFIED' && (
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                    onClick={() => {
                      decisionForm.resetFields();
                      setDecisionAction('APPROVE');
                      setViewMode('VERIFY_COMMERCIAL');
                    }}
                  >
                    Verifikasi Komersial
                  </Button>
                )}
              </Space>
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

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
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

            <Title level={5}>Rincian Item Klaim</Title>
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
        )}

        {/* VIEW MODE: VERIFY COMMERCIAL */}
        {viewMode === 'VERIFY_COMMERCIAL' && selectedClaim && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setViewMode('DETAIL')}
                size="small"
              >
                Kembali ke Detail
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                Verifikasi Komersial — {selectedClaim.claimNumber}
              </Title>
            </div>

            <Alert
              type="info"
              message="Pemeriksaan Komersial Procurement"
              description="Pastikan kuantitas kumulatif, nilai kontrak, bukti penerimaan, dan verifikasi teknis PM telah sesuai sebelum memberikan persetujuan komersial. Persetujuan komersial akan membuka gerbang penagihan (Invoice) di Finance."
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
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

            <Form form={decisionForm} layout="vertical">
              <Form.Item label="Keputusan Verifikasi Komersial">
                <Space>
                  <Button
                    type={decisionAction === 'APPROVE' ? 'primary' : 'default'}
                    style={decisionAction === 'APPROVE' ? { backgroundColor: '#059669', borderColor: '#059669' } : {}}
                    onClick={() => setDecisionAction('APPROVE')}
                    icon={<CheckCircleOutlined />}
                  >
                    Setujui Komersial
                  </Button>
                  <Button
                    type={decisionAction === 'RETURN' ? 'primary' : 'default'}
                    style={decisionAction === 'RETURN' ? { backgroundColor: '#D97706', borderColor: '#D97706' } : {}}
                    onClick={() => setDecisionAction('RETURN')}
                    icon={<RollbackOutlined />}
                  >
                    Minta Revisi
                  </Button>
                  <Button
                    danger
                    type={decisionAction === 'REJECT' ? 'primary' : 'default'}
                    onClick={() => setDecisionAction('REJECT')}
                    icon={<CloseCircleOutlined />}
                  >
                    Tolak Klaim
                  </Button>
                </Space>
              </Form.Item>

              {decisionAction !== 'APPROVE' && (
                <Form.Item
                  name="notes"
                  label={decisionAction === 'RETURN' ? 'Catatan Permintaan Revisi (Wajib)' : 'Alasan Penolakan (Wajib)'}
                  rules={[{ required: true, message: 'Alasan / catatan wajib diisi!' }]}
                >
                  <TextArea rows={3} placeholder={decisionAction === 'RETURN' ? 'Sebutkan bagian klaim yang perlu direvisi...' : 'Sebutkan alasan penolakan klaim...'} />
                </Form.Item>
              )}

              <Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button onClick={() => setViewMode('DETAIL')}>Batal</Button>
                <Button
                  type="primary"
                  onClick={handleExecuteCommercialDecision}
                  loading={isSubmitting}
                  style={decisionAction === 'APPROVE' ? { backgroundColor: '#059669', borderColor: '#059669' } : {}}
                >
                  Eksekusi Keputusan
                </Button>
              </Space>
            </Form>
          </div>
        )}

        {/* VIEW MODE: VERIFY TECHNICAL (PM) */}
        {viewMode === 'VERIFY_TECHNICAL' && selectedClaim && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => setViewMode('DETAIL')}
                size="small"
              >
                Kembali ke Detail
              </Button>
              <Title level={5} style={{ margin: 0 }}>
                Verifikasi Teknis Project Manager — {selectedClaim.claimNumber}
              </Title>
            </div>

            <Alert
              type="info"
              message="Verifikasi Fisik & Teknis Lapangan"
              description="Verifikasi kesesuaian volume fisik jasa yang terlaksana di lapangan dan kelengkapan bukti opname/BAST. Verifikasi teknis TIDAK mengubah progress fisik S-Curve atau task project."
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Nomor Klaim">{selectedClaim.claimNumber}</Descriptions.Item>
              <Descriptions.Item label="PO & Proyek">{po?.poNumber} — {po?.projectName}</Descriptions.Item>
              <Descriptions.Item label="Vendor">{po?.vendorName}</Descriptions.Item>
              <Descriptions.Item label="Referensi SPK/WO">{selectedClaim.serviceOrder?.documentNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="Jenis Bukti">{selectedClaim.acceptanceType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Nomor Bukti">{selectedClaim.acceptanceReference || '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>Rincian Volume yang Diverifikasi</Title>
            <Table
              size="small"
              dataSource={selectedClaim.items || []}
              rowKey="id"
              pagination={false}
              style={{ marginBottom: 16 }}
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

            <Form form={decisionForm} layout="vertical">
              <Form.Item label="Keputusan Verifikasi Teknis">
                <Space>
                  <Button
                    type={decisionAction === 'APPROVE' ? 'primary' : 'default'}
                    style={decisionAction === 'APPROVE' ? { backgroundColor: '#2563EB', borderColor: '#2563EB' } : {}}
                    onClick={() => setDecisionAction('APPROVE')}
                    icon={<CheckCircleOutlined />}
                  >
                    Setujui Teknis
                  </Button>
                  <Button
                    type={decisionAction === 'RETURN' ? 'primary' : 'default'}
                    style={decisionAction === 'RETURN' ? { backgroundColor: '#D97706', borderColor: '#D97706' } : {}}
                    onClick={() => setDecisionAction('RETURN')}
                    icon={<RollbackOutlined />}
                  >
                    Minta Revisi
                  </Button>
                  <Button
                    danger
                    type={decisionAction === 'REJECT' ? 'primary' : 'default'}
                    onClick={() => setDecisionAction('REJECT')}
                    icon={<CloseCircleOutlined />}
                  >
                    Tolak Klaim
                  </Button>
                </Space>
              </Form.Item>

              {decisionAction !== 'APPROVE' && (
                <Form.Item
                  name="notes"
                  label={decisionAction === 'RETURN' ? 'Catatan Permintaan Revisi (Wajib)' : 'Alasan Penolakan (Wajib)'}
                  rules={[{ required: true, message: 'Alasan / catatan wajib diisi!' }]}
                >
                  <TextArea rows={3} placeholder={decisionAction === 'RETURN' ? 'Sebutkan koreksi teknis yang diperlukan...' : 'Sebutkan alasan teknis penolakan...'} />
                </Form.Item>
              )}

              <Space style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button onClick={() => setViewMode('DETAIL')}>Batal</Button>
                <Button
                  type="primary"
                  onClick={handleExecuteTechnicalDecision}
                  loading={isSubmitting}
                >
                  Eksekusi Keputusan Teknis
                </Button>
              </Space>
            </Form>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default ServiceClaimModal;
