"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
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
  Tooltip,
} from 'antd';
import {
  FileDoneOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  CalendarOutlined,
  CarOutlined,
  DollarCircleOutlined,
  TrophyOutlined,
  InboxOutlined,
  PlusOutlined,
  DeleteOutlined,
  AuditOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import {
  ProcurementService,
  CreatePOPayload,
  PaymentTermType,
  PoPaymentTermRecord,
} from '@/services/procurement.service';
import { VendorComparisonResult } from '@/components/procurement/VendorComparisonModal';
import { VendorQuotationRecord } from '@/components/procurement/VendorQuotationModal';

const { Text, Title } = Typography;

export type { PaymentTermType };

export interface PaymentTermForm {
  sequence: number;
  term_name: string;
  term_type: PaymentTermType;
  percentage: number;
  trigger_condition?: string;
  is_retention?: boolean;
  retention_days?: number;
}

export type PresetType = '30-30-30-10' | '20-40-30-10' | '100';

export const PRESET_DEFINITIONS: Record<PresetType, PaymentTermForm[]> = {
  '30-30-30-10': [
    {
      sequence: 1,
      term_name: 'Uang Muka / DP',
      term_type: 'DOWN_PAYMENT',
      percentage: 30,
      trigger_condition: 'PO Diterbitkan',
      is_retention: false,
    },
    {
      sequence: 2,
      term_name: 'Progress Tahap 1',
      term_type: 'PROGRESS',
      percentage: 30,
      trigger_condition: 'BAST Progress 1',
      is_retention: false,
    },
    {
      sequence: 3,
      term_name: 'Progress Tahap 2',
      term_type: 'PROGRESS',
      percentage: 30,
      trigger_condition: 'BAST Progress 2',
      is_retention: false,
    },
    {
      sequence: 4,
      term_name: 'Retensi Pemeliharaan',
      term_type: 'RETENTION',
      percentage: 10,
      trigger_condition: 'Masa Pemeliharaan Selesai',
      is_retention: true,
      retention_days: 90,
    },
  ],
  '20-40-30-10': [
    {
      sequence: 1,
      term_name: 'Uang Muka / DP',
      term_type: 'DOWN_PAYMENT',
      percentage: 20,
      trigger_condition: 'PO Diterbitkan',
      is_retention: false,
    },
    {
      sequence: 2,
      term_name: 'Progress Tahap 1',
      term_type: 'PROGRESS',
      percentage: 40,
      trigger_condition: 'BAST Progress 1',
      is_retention: false,
    },
    {
      sequence: 3,
      term_name: 'Progress Tahap 2',
      term_type: 'PROGRESS',
      percentage: 30,
      trigger_condition: 'BAST Progress 2',
      is_retention: false,
    },
    {
      sequence: 4,
      term_name: 'Retensi Pemeliharaan',
      term_type: 'RETENTION',
      percentage: 10,
      trigger_condition: 'Masa Pemeliharaan Selesai',
      is_retention: true,
      retention_days: 90,
    },
  ],
  '100': [
    {
      sequence: 1,
      term_name: 'Pelunasan Penuh',
      term_type: 'FINAL_DELIVERY',
      percentage: 100,
      trigger_condition: 'Barang Diterima Lengkap & BAST Disetujui',
      is_retention: false,
    },
  ],
};

export interface PurchaseOrderItemRecord {
  key: string;
  categoryName: string;
  itemName: string;
  quantity: number;
  receivedQuantity?: number;
  uom: string;
  unitPrice: number;
  subtotal: number;
  totalPrice?: number;
  wbsNodeId?: string;
  rabItemKey?: string;
}

export interface PurchaseOrderPrototypeRecord {
  poId: string;
  poNumber: string;
  comparisonId: string;
  rfqId: string | number;
  rfqNumber: string;
  prId: string | number;
  prNumber: string;
  projectId: string | number;
  projectName: string;
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  totalAmount: number;
  budgetCeiling: number;
  status: 'ISSUED' | 'PARTIALLY_FULFILLED' | 'COMPLETED' | 'DRAFT' | 'CANCELLED';
  issuedAt: string;
  issuedBy: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  paymentTerms?: any;
  notes?: string;
  items: PurchaseOrderItemRecord[];
}

export interface PurchaseOrderModalProps {
  open: boolean;
  onClose: () => void;
  comparison: VendorComparisonResult | null;
  rfq: any | null;
  winningQuotation?: VendorQuotationRecord | null;
  existingPo?: PurchaseOrderPrototypeRecord | null;
  onPoCreated?: (po: PurchaseOrderPrototypeRecord) => void;
  onOpenGoodsReceipt?: (po: PurchaseOrderPrototypeRecord) => void;
  currentUserName?: string;
  isProcurement?: boolean;
  isSuperAdmin?: boolean;
  viewOnly?: boolean;
  canReceiveGoods?: boolean;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  open,
  onClose,
  comparison,
  rfq,
  winningQuotation,
  existingPo,
  onPoCreated,
  onOpenGoodsReceipt,
  currentUserName = 'Procurement Team',
  isProcurement = true,
  isSuperAdmin = false,
  viewOnly = false,
  canReceiveGoods = true,
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active PO detection
  const activePo = useMemo(() => {
    if (existingPo) return existingPo;
    return null;
  }, [existingPo]);

  const isViewMode = viewOnly || Boolean(activePo);

  // Derive PO items from winning quotation snapshot or existing PO
  const poItems: PurchaseOrderItemRecord[] = useMemo(() => {
    if (activePo?.items && Array.isArray(activePo.items)) {
      return activePo.items.map((it: any, idx: number) => {
        const qty = Number(it.quantity || 0);
        const price = Number(it.unitPrice || 0);
        // Authoritative item total from backend PurchaseOrderItem (totalPrice)
        const total =
          it.totalPrice !== undefined && it.totalPrice !== null
            ? Number(it.totalPrice)
            : it.subtotal !== undefined && it.subtotal !== null
            ? Number(it.subtotal)
            : qty * price;
        return {
          key: it.key || String(it.id || idx),
          categoryName: it.categoryName || 'Material',
          itemName: it.itemName || `Item #${idx + 1}`,
          quantity: qty,
          receivedQuantity: Number(it.receivedQuantity || 0),
          uom: it.uom || 'Unit',
          unitPrice: price,
          subtotal: total,
          totalPrice: total,
          wbsNodeId: it.wbsNodeId,
          rabItemKey: it.rabItemKey,
        };
      });
    }
    if (winningQuotation?.items && Array.isArray(winningQuotation.items)) {
      return winningQuotation.items.map((it, idx) => {
        const unitPrice = Number(it.offeredUnitPrice ?? (it as any).unitPrice ?? 0);
        const quantity = Number(it.quantity || 1);
        const subtotal = Number(it.subtotal || (it as any).totalPrice || quantity * unitPrice);
        return {
          key: it.key || `item_${idx}`,
          categoryName: it.categoryName || 'Material',
          itemName: it.itemName || 'Item Pengadaan',
          quantity,
          uom: it.uom || 'Unit',
          unitPrice,
          subtotal,
          totalPrice: subtotal,
          wbsNodeId: it.wbsNodeId,
          rabItemKey: it.rabItemKey,
        };
      });
    }
    return [];
  }, [activePo, winningQuotation]);

  const effectiveLeadTimeDays = useMemo(() => {
    const rawLt = winningQuotation?.leadTimeDays ?? comparison?.winnerLeadTimeDays;
    const num = Number(rawLt);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [winningQuotation, comparison]);

  const isLeadTimeValid = effectiveLeadTimeDays !== null && effectiveLeadTimeDays > 0;

  const totalPoAmount = useMemo(() => {
    if (activePo) return Number(activePo.totalAmount || 0);
    if (winningQuotation) return Number(winningQuotation.totalOfferedAmount || 0);
    if (comparison) return Number(comparison.winnerTotalOfferedAmount || 0);
    return poItems.reduce((sum, it) => sum + it.subtotal, 0);
  }, [activePo, winningQuotation, comparison, poItems]);

  const budgetCeiling =
    comparison?.budgetCeiling ||
    Number(rfq?.totalAmount || 0) ||
    Number((activePo as any)?.purchaseRequest?.totalEstimatedAmount || 0) ||
    Number((activePo as any)?.budgetCeiling || 0);

  // Dynamic Payment Terms Builder state (default starts with 1 blank row, fully customizable by Procurement)
  const [paymentTerms, setPaymentTerms] = useState<PaymentTermForm[]>([
    {
      sequence: 1,
      term_name: '',
      term_type: 'DOWN_PAYMENT',
      percentage: 0,
      trigger_condition: '',
      is_retention: false,
    },
  ]);

  const [highlightedSeq, setHighlightedSeq] = useState<number[]>([]);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Detect whether the form currently has user-entered data
  const hasExistingData = useMemo(() => {
    if (paymentTerms.length === 0) return false;
    if (
      paymentTerms.length === 1 &&
      (!paymentTerms[0].term_name || !paymentTerms[0].term_name.trim()) &&
      (Number(paymentTerms[0].percentage) === 0 || !paymentTerms[0].percentage) &&
      (!paymentTerms[0].trigger_condition || !paymentTerms[0].trigger_condition.trim())
    ) {
      return false;
    }
    return true;
  }, [paymentTerms]);

  // Compute active preset / custom state reactively
  const activePresetInfo = useMemo(() => {
    if (!hasExistingData) {
      return { type: null, label: 'Belum Dipilih' };
    }

    for (const [key, presetTerms] of Object.entries(PRESET_DEFINITIONS)) {
      if (presetTerms.length === paymentTerms.length) {
        const matches = presetTerms.every((pt, idx) => {
          const t = paymentTerms[idx];
          return (
            t &&
            Number(t.percentage) === Number(pt.percentage) &&
            t.term_type === pt.term_type &&
            t.term_name.trim() === pt.term_name.trim() &&
            Boolean(t.is_retention) === Boolean(pt.is_retention) &&
            (pt.is_retention ? Number(t.retention_days) === Number(pt.retention_days) : true)
          );
        });
        if (matches) {
          const labelMap: Record<PresetType, string> = {
            '30-30-30-10': 'Preset A',
            '20-40-30-10': 'Preset B',
            '100': 'Preset C',
          };
          return { type: key as PresetType, label: labelMap[key as PresetType] };
        }
      }
    }

    return { type: 'custom' as const, label: 'Custom' };
  }, [paymentTerms, hasExistingData]);

  const handleAddTerm = () => {
    setPresetFeedback(null);
    setPaymentTerms((prev) => [
      ...prev,
      {
        sequence: prev.length + 1,
        term_name: '',
        term_type: prev.length === 0 ? 'DOWN_PAYMENT' : 'PROGRESS',
        percentage: 0,
        trigger_condition: '',
        is_retention: false,
      },
    ]);
  };

  const handleRemoveTerm = (indexToRemove: number) => {
    setPresetFeedback(null);
    setPaymentTerms((prev) =>
      prev
        .filter((_, idx) => idx !== indexToRemove)
        .map((t, idx) => ({ ...t, sequence: idx + 1 })),
    );
  };

  const handleUpdateTerm = (index: number, field: keyof PaymentTermForm, value: any) => {
    setPresetFeedback(null);
    setPaymentTerms((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleTermTypeChange = (index: number, newType: PaymentTermType) => {
    setPresetFeedback(null);
    setPaymentTerms((prev) => {
      const next = [...prev];
      const isRet = newType === 'RETENTION';
      next[index] = {
        ...next[index],
        term_type: newType,
        is_retention: isRet,
        retention_days: isRet ? next[index].retention_days : undefined,
      };
      return next;
    });
  };

  const doApplyPreset = (presetType: PresetType) => {
    const targetTerms = PRESET_DEFINITIONS[presetType];
    if (!targetTerms) return;

    // Detect sequences that changed compared to previous configuration
    const changedSeqs: number[] = [];
    targetTerms.forEach((newTerm, idx) => {
      const oldTerm = paymentTerms[idx];
      if (
        !oldTerm ||
        Number(oldTerm.percentage) !== Number(newTerm.percentage) ||
        oldTerm.term_name.trim() !== newTerm.term_name.trim() ||
        oldTerm.term_type !== newTerm.term_type ||
        Boolean(oldTerm.is_retention) !== Boolean(newTerm.is_retention)
      ) {
        changedSeqs.push(newTerm.sequence);
      }
    });

    const seqsToHighlight = changedSeqs.length > 0 ? changedSeqs : targetTerms.map((t) => t.sequence);

    // Apply new terms
    setPaymentTerms(targetTerms.map((t) => ({ ...t })));

    // Subtle temporary highlight for 250ms (no layout reflow)
    setHighlightedSeq(seqsToHighlight);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedSeq([]);
    }, 250);

    // Subtle inline feedback without blocking header
    const labelMap: Record<PresetType, string> = {
      '30-30-30-10': 'Preset A',
      '20-40-30-10': 'Preset B',
      '100': 'Preset C',
    };
    setPresetFeedback(`${labelMap[presetType]} diterapkan — Anda masih dapat mengubah detail termin.`);
  };

  const handlePresetClick = (presetType: PresetType) => {
    if (activePresetInfo.type === presetType) return;

    if (!hasExistingData) {
      doApplyPreset(presetType);
      return;
    }

    Modal.confirm({
      title: 'Gunakan template ini?',
      content: 'Konfigurasi termin saat ini akan diganti.',
      okText: 'Terapkan',
      cancelText: 'Batal',
      centered: true,
      okButtonProps: {
        style: { backgroundColor: '#059669', borderColor: '#059669', fontWeight: 600 },
      },
      onOk: () => {
        doApplyPreset(presetType);
      },
    });
  };

  const totalPercentage = useMemo(() => {
    const sum = paymentTerms.reduce((acc, t) => acc + (Number(t.percentage) || 0), 0);
    return Math.round(sum * 100) / 100;
  }, [paymentTerms]);

  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.001;

  const isTermsStructureValid = useMemo(() => {
    if (paymentTerms.length === 0) return false;
    for (const t of paymentTerms) {
      if (!t.term_name || !t.term_name.trim()) return false;
      const pct = Number(t.percentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return false;
      const isRet = t.term_type === 'RETENTION' || Boolean(t.is_retention);
      if (isRet) {
        const rDays = Number(t.retention_days);
        if (!Number.isFinite(rDays) || rDays <= 0 || !Number.isInteger(rDays)) return false;
      }
    }
    return true;
  }, [paymentTerms]);

  const isPaymentScheduleValid = isPercentageValid && isTermsStructureValid;

  const percentageStatus = useMemo(() => {
    const diff = Math.round((totalPercentage - 100) * 100) / 100;
    if (Math.abs(diff) < 0.001) {
      return {
        status: 'success' as const,
        color: '#059669',
        text: 'Total Termin: 100.00% — Valid',
        alertType: 'success' as const,
      };
    }
    if (diff < 0) {
      const remaining = Math.abs(diff).toFixed(2);
      return {
        status: 'warning' as const,
        color: '#d97706',
        text: `Total Termin: ${totalPercentage.toFixed(2)}% — Kurang ${remaining}%`,
        alertType: 'warning' as const,
      };
    }
    const excess = diff.toFixed(2);
    return {
      status: 'error' as const,
      color: '#dc2626',
      text: `Total Termin: ${totalPercentage.toFixed(2)}% — Melebihi ${excess}%`,
      alertType: 'error' as const,
    };
  }, [totalPercentage]);

  // Estimated nominal calculation for display only (Server is SSOT)
  const estimatedAllocation = useMemo(() => {
    return paymentTerms.map((t) => {
      const pct = Number(t.percentage) || 0;
      const estAmount = Math.round((totalPoAmount * pct) / 100);
      return {
        ...t,
        estimatedAmount: estAmount,
      };
    });
  }, [paymentTerms, totalPoAmount]);

  const totalEstimatedAmount = useMemo(() => {
    return estimatedAllocation.reduce((acc, t) => acc + (t.estimatedAmount || 0), 0);
  }, [estimatedAllocation]);

  const builderColumns = [
    {
      title: 'No',
      dataIndex: 'sequence',
      key: 'sequence',
      width: 48,
      align: 'center' as const,
      render: (seq: number) => <span style={{ fontWeight: 700, color: '#64748b' }}>{seq}</span>,
    },
    {
      title: 'Nama Termin',
      dataIndex: 'term_name',
      key: 'term_name',
      width: 210,
      render: (name: string, rec: any, idx: number) => {
        const isHighlighted = highlightedSeq.includes(rec.sequence);
        return (
          <Input
            value={name}
            placeholder="Nama termin (wajib)..."
            status={!name.trim() ? 'error' : ''}
            onChange={(e) => handleUpdateTerm(idx, 'term_name', e.target.value)}
            className={isHighlighted ? 'term-input-pulse' : ''}
            style={{
              borderRadius: 6,
              fontSize: 11.5,
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
              backgroundColor: isHighlighted ? '#ecfdf5' : undefined,
            }}
          />
        );
      },
    },
    {
      title: 'Tipe',
      dataIndex: 'term_type',
      key: 'term_type',
      width: 175,
      render: (type: PaymentTermType, _: any, idx: number) => (
        <Select
          value={type}
          onChange={(val) => handleTermTypeChange(idx, val)}
          style={{ width: '100%', fontSize: 11.5 }}
          options={[
            { value: 'DOWN_PAYMENT', label: 'Uang Muka / DP' },
            { value: 'PROGRESS', label: 'Progress' },
            { value: 'FINAL_DELIVERY', label: 'Pelunasan / Final Delivery' },
            { value: 'RETENTION', label: 'Retensi' },
          ]}
        />
      ),
    },
    {
      title: 'Persentase',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 130,
      align: 'right' as const,
      render: (pct: number, rec: any, idx: number) => {
        const isHighlighted = highlightedSeq.includes(rec.sequence);
        return (
          <InputNumber
            min={0.01}
            max={100}
            step={1}
            precision={2}
            value={pct}
            status={pct <= 0 || pct > 100 ? 'error' : ''}
            addonAfter="%"
            onChange={(val) => handleUpdateTerm(idx, 'percentage', val ?? 0)}
            className={isHighlighted ? 'term-input-pulse' : ''}
            style={{
              width: '100%',
              fontSize: 11.5,
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
              backgroundColor: isHighlighted ? '#ecfdf5' : undefined,
            }}
          />
        );
      },
    },
    {
      title: 'Estimasi Nominal',
      key: 'estimatedAmount',
      width: 150,
      align: 'right' as const,
      render: (_: any, rec: any) => {
        const isHighlighted = highlightedSeq.includes(rec.sequence);
        return (
          <div
            style={{
              textAlign: 'right',
              transition: 'background-color 0.25s ease',
              borderRadius: 4,
              padding: '2px 4px',
              backgroundColor: isHighlighted ? '#ecfdf5' : 'transparent',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: 11.5,
                color: '#059669',
                transition: 'color 0.2s ease',
              }}
            >
              Rp {Number(rec.estimatedAmount || 0).toLocaleString('id-ID')}
            </span>
            <div style={{ fontSize: 9.5, color: '#94a3b8' }}>(Estimasi Display)</div>
          </div>
        );
      },
    },
    {
      title: 'Trigger / Syarat',
      dataIndex: 'trigger_condition',
      key: 'trigger_condition',
      render: (trig: string, _: any, idx: number) => (
        <Input
          value={trig}
          placeholder="Contoh: PO Diterbitkan / BAST 1"
          onChange={(e) => handleUpdateTerm(idx, 'trigger_condition', e.target.value)}
          style={{ borderRadius: 6, fontSize: 11.5 }}
        />
      ),
    },
    {
      title: 'Retensi',
      key: 'retention',
      width: 140,
      align: 'center' as const,
      render: (_: any, rec: any, idx: number) => {
        const isRet = rec.term_type === 'RETENTION' || Boolean(rec.is_retention);
        if (!isRet) return <span style={{ color: '#94a3b8' }}>-</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>Retensi</Tag>
            <InputNumber
              min={1}
              precision={0}
              value={rec.retention_days}
              status={!rec.retention_days || rec.retention_days <= 0 ? 'error' : ''}
              addonAfter="hari"
              placeholder="Masa Retensi"
              onChange={(val) => handleUpdateTerm(idx, 'retention_days', val ?? undefined)}
              style={{ width: 120, fontSize: 11.5 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 50,
      align: 'center' as const,
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveTerm(idx)}
          style={{ padding: 4 }}
        />
      ),
    },
  ];

  const handleSubmit = async (values: any) => {
    if (!comparison) {
      message.error('Data Vendor Comparison tidak ditemukan.');
      return;
    }

    if (comparison.status !== 'EVALUATED') {
      message.error('Purchase Order hanya dapat diterbitkan dari Vendor Comparison dengan status EVALUATED.');
      return;
    }

    if (!comparison.selectedWinnerVendorId) {
      message.error('Vendor pemenang belum ditetapkan pada evaluasi vendor.');
      return;
    }

    if (!isLeadTimeValid) {
      message.error('Lead Time Vendor wajib dilengkapi sebelum Purchase Order diterbitkan.');
      return;
    }

    if (!isPaymentScheduleValid) {
      if (!isPercentageValid) {
        message.error(`Total persentase payment terms harus tepat 100.00% (saat ini: ${totalPercentage.toFixed(2)}%).`);
      } else {
        message.error('Lengkapi semua nama termin, persentase (> 0%), dan masa retensi sebelum menerbitkan PO.');
      }
      return;
    }

    if (poItems.length === 0) {
      message.error('Daftar item penawaran vendor pemenang tidak ditemukan.');
      return;
    }

    if (existingPo) {
      message.error(`Purchase Order (${existingPo.poNumber}) sudah pernah diterbitkan.`);
      return;
    }

    // GAP M-1 Fix: Resolve purchase_request_id strictly from authoritative PR fields (NEVER fallback to rfq.id)
    const rawPrId =
      rfq?.purchaseRequestId ??
      rfq?.prId ??
      rfq?.purchaseRequest?.id ??
      (comparison as any)?.purchaseRequestId ??
      (comparison as any)?.prId;
    const prId = Number(rawPrId);

    if (!Number.isFinite(prId) || prId <= 0) {
      message.error('ID Purchase Request (PR) tidak valid atau tidak ditemukan. Penerbitan PO dibatalkan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePOPayload = {
        purchase_request_id: prId,
        vendor_id: comparison.selectedWinnerVendorId,
        payment_terms: paymentTerms.map((t) => ({
          sequence: Number(t.sequence),
          term_name: t.term_name.trim(),
          term_type: t.term_type,
          percentage: Number(t.percentage),
          trigger_condition: t.trigger_condition?.trim() || undefined,
          is_retention: t.term_type === 'RETENTION' || Boolean(t.is_retention),
          retention_days:
            t.term_type === 'RETENTION' || Boolean(t.is_retention)
              ? Number(t.retention_days)
              : undefined,
        })),
        delivery_location: values.deliveryLocation?.trim() || undefined,
        delivery_date: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
        notes: values.notes?.trim() || undefined,
        po_items: poItems.map((item) => ({
          item_name: item.itemName,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unitPrice || 0),
          total_price: Number(item.subtotal || item.unitPrice * item.quantity || 0),
        })),
      };

      const res = await ProcurementService.createPurchaseOrder(payload);

      // Invalidate React Query cache explicitly with canonical key so PO list updates immediately without full reload
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });

      const newPo: PurchaseOrderPrototypeRecord = {
        poId: String(res.id),
        poNumber: res.poNumber,
        comparisonId: comparison.comparisonId,
        rfqId: comparison.rfqId,
        rfqNumber: comparison.rfqNumber,
        prId,
        prNumber: rfq?.prNumber || (comparison as any)?.prNumber || 'PR-N/A',
        projectId: comparison.projectId,
        projectName: comparison.projectName || 'Proyek Tanpa Nama',
        vendorId: comparison.selectedWinnerVendorId,
        vendorCode: comparison.selectedWinnerVendorCode,
        vendorName: comparison.selectedWinnerVendorName,
        totalAmount: Number(res.totalAmount || totalPoAmount),
        budgetCeiling,
        status: (res.status as any) || 'ISSUED',
        issuedAt: res.createdAt || new Date().toISOString(),
        issuedBy: currentUserName,
        deliveryDate: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
        deliveryLocation: values.deliveryLocation || 'Lokasi Gudang Proyek',
        paymentTerms: res.paymentTerms || paymentTerms,
        notes: values.notes || '',
        items: poItems,
      };

      message.success(`Purchase Order (${res.poNumber}) berhasil diterbitkan melalui Server SSOT!`);
      onPoCreated?.(newPo);
      onClose();
    } catch (err: any) {
      console.error('Failed to create PO via Server SSOT:', err);
      const backendMsg = err.response?.data?.message || err.message || 'Gagal menerbitkan Purchase Order.';
      message.error(backendMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!comparison && !activePo) return null;

  const vendorName =
    (activePo as any)?.vendor?.name ||
    activePo?.vendorName ||
    comparison?.selectedWinnerVendorName ||
    (comparison as any)?.winnerVendorName ||
    '—';

  const vendorCode =
    (activePo as any)?.vendor?.code ||
    (activePo as any)?.vendor?.vendorCode ||
    activePo?.vendorCode ||
    comparison?.selectedWinnerVendorCode ||
    (comparison as any)?.winnerVendorCode ||
    '';

  const projectName =
    (activePo as any)?.purchaseRequest?.project?.name ||
    activePo?.projectName ||
    comparison?.projectName ||
    (comparison as any)?.project_name ||
    'Proyek Tidak Tersedia';

  const projectCode =
    (activePo as any)?.purchaseRequest?.project?.code ||
    (activePo as any)?.projectCode ||
    (comparison as any)?.projectCode ||
    '';

  const currentProjectId =
    (activePo as any)?.purchaseRequest?.project?.id ||
    (activePo as any)?.purchaseRequest?.projectId ||
    activePo?.projectId ||
    comparison?.projectId;

  const prNumber =
    (activePo as any)?.purchaseRequest?.prNumber ||
    activePo?.prNumber ||
    rfq?.prNumber ||
    rfq?.purchaseRequest?.prNumber ||
    (rfq?.purchaseRequest as any)?.pr_number ||
    (comparison as any)?.prNumber ||
    (rfq?.prId ? `PR-${rfq.prId}` : undefined) ||
    'PR-N/A';

  const rfqNumber = activePo?.rfqNumber || comparison?.rfqNumber || (rfq as any)?.rfqNumber || '—';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1120px, 96vw)"
      centered
      destroyOnClose
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 16 }} />
            <Text style={{ fontSize: 12 }}>
              {isViewMode ? (
                <span>
                  Nomor PO: <strong>{activePo?.poNumber}</strong> — Status:{' '}
                  <Tag
                    color={
                      activePo?.status === 'COMPLETED'
                        ? 'green'
                        : activePo?.status === 'PARTIALLY_FULFILLED'
                        ? 'gold'
                        : 'blue'
                    }
                    style={{ margin: '0 4px', fontWeight: 700 }}
                  >
                    ● {activePo?.status || 'ISSUED'}
                  </Tag>
                </span>
              ) : (
                <span>
                  Vendor Pemenang Terpilih: <strong>{vendorName}</strong> ({vendorCode})
                </span>
              )}
            </Text>
          </div>

          <Space size={8}>
            <Button onClick={onClose} style={{ borderRadius: 6 }}>
              {isViewMode ? 'Tutup' : 'Batal'}
            </Button>
            {isViewMode &&
              activePo &&
              (activePo.status === 'ISSUED' || activePo.status === 'PARTIALLY_FULFILLED') &&
              canReceiveGoods && (
                <Button
                  type="primary"
                  icon={<InboxOutlined />}
                  onClick={() => {
                    onClose();
                    onOpenGoodsReceipt?.(activePo);
                  }}
                  style={{
                    backgroundColor: '#0d9488',
                    borderColor: '#0d9488',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  Proses Penerimaan Barang (GR)
                </Button>
              )}
            {!isViewMode && (
              <Button
                type="primary"
                loading={isSubmitting}
                disabled={!isLeadTimeValid || !isPaymentScheduleValid}
                onClick={() => form.submit()}
                icon={<SendOutlined />}
                style={{
                  backgroundColor: !isLeadTimeValid || !isPaymentScheduleValid ? '#94a3b8' : '#059669',
                  borderColor: !isLeadTimeValid || !isPaymentScheduleValid ? '#94a3b8' : '#059669',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                Terbitkan Purchase Order (PO)
              </Button>
            )}
          </Space>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#ecfdf5', borderRadius: 8, color: '#059669' }}>
            <FileDoneOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {isViewMode
                ? `Rincian Purchase Order — ${activePo?.poNumber}`
                : 'Penerbitan Purchase Order (PO) ke Vendor Pemenang'}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              {isViewMode
                ? 'Surat Perintah Pembelian resmi yang telah diterbitkan kepada vendor pemenang'
                : 'Dokumen komitmen pengadaan resmi yang diterbitkan berdasarkan hasil evaluasi vendor comparison'}
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Lead Time Gate Warning */}
        {!isViewMode && !isLeadTimeValid && (
          <Alert
            type="warning"
            showIcon
            message="Lead Time Vendor Belum Valid"
            description="Lead Time Vendor wajib dilengkapi sebelum Purchase Order diterbitkan."
            style={{ borderRadius: 8, border: '1px solid #fde047', background: '#fefce8' }}
          />
        )}

        {/* Active PO Notification if in View Mode */}
        {isViewMode && activePo && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined style={{ color: '#059669', fontSize: 18 }} />}
            message={
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                Purchase Order Telah Diterbitkan: {activePo.poNumber} — Status:{' '}
                <Tag
                  color={
                    activePo.status === 'COMPLETED'
                      ? 'green'
                      : activePo.status === 'PARTIALLY_FULFILLED'
                      ? 'gold'
                      : 'blue'
                  }
                  style={{ fontWeight: 700, margin: '0 4px' }}
                >
                  ● {activePo.status}
                </Tag>
              </span>
            }
            description={
              <div style={{ fontSize: 11.5, marginTop: 4 }}>
                Diterbitkan pada{' '}
                {dayjs(activePo.issuedAt || (activePo as any).createdAt).isValid()
                  ? dayjs(activePo.issuedAt || (activePo as any).createdAt).format('DD MMMM YYYY HH:mm')
                  : '—'}{' '}
                oleh <strong>{activePo.issuedBy || 'Purchasing'}</strong> kepada{' '}
                <strong>{vendorName}</strong>. Total Nilai Kontrak PO:{' '}
                <strong>Rp {Number(activePo.totalAmount || 0).toLocaleString('id-ID')}</strong> (
                {activePo.items?.length || poItems.length} Item Pengadaan).
              </div>
            }
            style={{ borderRadius: 8, border: '1px solid #86efac', background: '#f0fdf4' }}
          />
        )}

        {/* PO Reference & Vendor Context Strip */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{projectName}</div>
              {currentProjectId ? (
                <Tag color="blue" style={{ fontSize: 10, margin: 0, marginTop: 2 }}>
                  {projectCode ? `${projectCode} • ` : ''}Project #{currentProjectId}
                </Tag>
              ) : (
                <Tag style={{ fontSize: 10, margin: 0, marginTop: 2 }}>Project ID Tidak Tersedia</Tag>
              )}
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>REFERENSI EVALUASI:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8' }}>{prNumber}</div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{rfqNumber !== '—' ? `${rfqNumber} (EVALUATED)` : '—'}</div>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PEMENANG:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#047857' }}>
                <TrophyOutlined style={{ marginRight: 4, color: '#d97706' }} />
                {vendorName}
              </div>
              {vendorCode && (
                <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>
              )}
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>TOTAL NILAI PO (KONTRAK):</Text>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>
                Rp {totalPoAmount.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>
                {budgetCeiling > 0 ? `Plafon: Rp ${budgetCeiling.toLocaleString('id-ID')}` : 'Plafon: —'}
              </div>
            </Col>
          </Row>
        </div>

        {/* PO Delivery & Notes Parameters */}
        {!isViewMode ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              deliveryLocation: (comparison as any)?.deliveryLocation || (comparison as any)?.address || (comparison as any)?.siteName || (comparison as any)?.city || 'Lokasi Gudang Proyek',
              deliveryDate: effectiveLeadTimeDays ? dayjs().add(effectiveLeadTimeDays, 'day') : undefined,
            }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Estimasi Tanggal Pengiriman</span>}
                  name="deliveryDate"
                  rules={[{ required: true, message: 'Tanggal pengiriman wajib diisi' }]}
                >
                  <DatePicker style={{ width: '100%', borderRadius: 6 }} format="DD MMMM YYYY" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Lokasi Pengiriman (Franco)</span>}
                  name="deliveryLocation"
                  rules={[{ required: true, message: 'Lokasi pengiriman wajib diisi' }]}
                >
                  <Input placeholder="Lokasi gudang proyek..." style={{ borderRadius: 6, fontSize: 11.5 }} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Instruksi / Catatan Khusus PO</span>}
                  name="notes"
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="Contoh: Pengiriman harap menyertakan Certificate of Origin (COO), Surat Jalan, dan faktur pajak."
                    style={{ borderRadius: 6, fontSize: 11.5 }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        ) : (
          <Descriptions
            size="small"
            bordered
            column={{ xs: 1, sm: 2 }}
            style={{ borderRadius: 6, overflow: 'hidden' }}
          >
            <Descriptions.Item label="Lokasi Pengiriman">
              {activePo?.deliveryLocation || 'Lokasi Belum Ditentukan'}
            </Descriptions.Item>
            <Descriptions.Item label="Target Pengiriman">
              {activePo?.deliveryDate
                ? dayjs(activePo.deliveryDate).format('DD MMMM YYYY')
                : effectiveLeadTimeDays
                ? `${effectiveLeadTimeDays} Hari`
                : 'Tidak tersedia'}
            </Descriptions.Item>
            {activePo?.notes && (
              <Descriptions.Item label="Catatan PO" span={2}>
                {activePo.notes}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}

        {/* Syarat & Termin Pembayaran Section */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
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
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AuditOutlined style={{ color: '#2563eb', fontSize: 16 }} />
                <span>SYARAT & TERMIN PEMBAYARAN</span>
              </div>
              <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                {isViewMode
                  ? 'Jadwal dan ketentuan termin pembayaran resmi yang tercatat di sistem (SSOT Database)'
                  : 'Konfigurasi termin pembayaran berdasarkan nilai PO'}
              </Text>
            </div>

            {!isViewMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Template:</Text>
                  <Tag
                    color={
                      activePresetInfo.type && activePresetInfo.type !== 'custom'
                        ? 'blue'
                        : activePresetInfo.type === 'custom'
                        ? 'cyan'
                        : 'default'
                    }
                    style={{ fontWeight: 600, fontSize: 10.5, margin: 0, padding: '1px 8px', borderRadius: 4 }}
                  >
                    {activePresetInfo.type && activePresetInfo.type !== 'custom'
                      ? `Template aktif: ${activePresetInfo.label}`
                      : activePresetInfo.type === 'custom'
                      ? 'Template: Custom'
                      : 'Belum Dipilih'}
                  </Tag>
                </div>

                <Space size={4}>
                  <Button
                    size="small"
                    type={activePresetInfo.type === '30-30-30-10' ? 'primary' : 'default'}
                    icon={activePresetInfo.type === '30-30-30-10' ? <CheckOutlined /> : undefined}
                    onClick={() => handlePresetClick('30-30-30-10')}
                    style={{
                      fontSize: 10.5,
                      borderRadius: 5,
                      fontWeight: activePresetInfo.type === '30-30-30-10' ? 600 : 400,
                      backgroundColor: activePresetInfo.type === '30-30-30-10' ? '#2563eb' : undefined,
                      borderColor: activePresetInfo.type === '30-30-30-10' ? '#2563eb' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Preset A (30/30/30/10)
                  </Button>
                  <Button
                    size="small"
                    type={activePresetInfo.type === '20-40-30-10' ? 'primary' : 'default'}
                    icon={activePresetInfo.type === '20-40-30-10' ? <CheckOutlined /> : undefined}
                    onClick={() => handlePresetClick('20-40-30-10')}
                    style={{
                      fontSize: 10.5,
                      borderRadius: 5,
                      fontWeight: activePresetInfo.type === '20-40-30-10' ? 600 : 400,
                      backgroundColor: activePresetInfo.type === '20-40-30-10' ? '#2563eb' : undefined,
                      borderColor: activePresetInfo.type === '20-40-30-10' ? '#2563eb' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Preset B (20/40/30/10)
                  </Button>
                  <Button
                    size="small"
                    type={activePresetInfo.type === '100' ? 'primary' : 'default'}
                    icon={activePresetInfo.type === '100' ? <CheckOutlined /> : undefined}
                    onClick={() => handlePresetClick('100')}
                    style={{
                      fontSize: 10.5,
                      borderRadius: 5,
                      fontWeight: activePresetInfo.type === '100' ? 600 : 400,
                      backgroundColor: activePresetInfo.type === '100' ? '#2563eb' : undefined,
                      borderColor: activePresetInfo.type === '100' ? '#2563eb' : undefined,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Preset C (100%)
                  </Button>
                </Space>

                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddTerm}
                  style={{
                    borderRadius: 5,
                    fontWeight: 600,
                    color: '#059669',
                    borderColor: '#059669',
                    fontSize: 11,
                  }}
                >
                  + Tambah Termin
                </Button>

                {presetFeedback && (
                  <span
                    style={{
                      fontSize: 11,
                      color: '#047857',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      padding: '2px 8px',
                      borderRadius: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    <CheckCircleOutlined style={{ fontSize: 11, color: '#059669' }} />
                    <span>{presetFeedback}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {!isViewMode ? (
            <div>
              <style>{`
                .term-table-stable .ant-table-body {
                  min-height: 190px !important;
                  max-height: 190px !important;
                  overflow-y: auto !important;
                }
                .term-table-stable .ant-table-placeholder .ant-table-cell {
                  height: 190px !important;
                }
                @keyframes termHighlightFade {
                  0% { background-color: #ecfdf5; }
                  100% { background-color: transparent; }
                }
                @keyframes termInputGlow {
                  0% { box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.4); background-color: #ecfdf5; }
                  100% { box-shadow: none; background-color: transparent; }
                }
                .term-row-highlight > td {
                  animation: termHighlightFade 0.25s ease-out !important;
                }
                .term-input-pulse {
                  animation: termInputGlow 0.25s ease-out !important;
                }
                .term-table-stable .ant-table-tbody > tr > td {
                  transition: background-color 0.2s ease;
                }
              `}</style>
              <div style={{ height: 232, minHeight: 232, maxHeight: 232, overflow: 'hidden' }}>
                <Table
                  size="small"
                  rowKey="sequence"
                  dataSource={estimatedAllocation}
                  pagination={false}
                  columns={builderColumns}
                  scroll={{ y: 190 }}
                  className="term-table-stable"
                  rowClassName={(record) =>
                    highlightedSeq.includes(record.sequence) ? 'term-row-highlight' : ''
                  }
                  locale={{
                    emptyText: (
                      <div style={{ padding: '36px 0', color: '#94a3b8', fontSize: 12 }}>
                        Belum ada termin pembayaran. Klik "+ Tambah Termin" atau gunakan template di atas untuk memulai.
                      </div>
                    ),
                  }}
                />
              </div>

              {/* Summary Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>TOTAL PO:</Text>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', fontFamily: 'monospace' }}>
                      Rp {totalPoAmount.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>TOTAL PERSENTASE:</Text>
                    <div style={{ fontWeight: 800, fontSize: 13, color: percentageStatus.color, fontFamily: 'monospace' }}>
                      {totalPercentage.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>ESTIMASI TOTAL TERMIN:</Text>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#059669', fontFamily: 'monospace' }}>
                      Rp {totalEstimatedAmount.toLocaleString('id-ID')}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#94a3b8' }}>Total Alokasi (Display)</div>
                  </div>
                </div>

                <div>
                  <Tag
                    color={
                      percentageStatus.alertType === 'success'
                        ? 'success'
                        : percentageStatus.alertType === 'warning'
                        ? 'warning'
                        : 'error'
                    }
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}
                  >
                    {percentageStatus.text}
                  </Tag>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {Array.isArray(activePo?.paymentTerms) && activePo.paymentTerms.length > 0 ? (
                <div style={{ height: 232, minHeight: 232, maxHeight: 232, overflow: 'hidden' }}>
                  <Table
                    size="small"
                    rowKey={(rec, idx) => String((rec as any).id || (rec as any).sequence || idx)}
                    dataSource={activePo.paymentTerms as any[]}
                    pagination={false}
                    scroll={{ y: 190 }}
                    className="term-table-stable"
                    columns={[
                      {
                        title: 'No',
                        dataIndex: 'sequence',
                        key: 'sequence',
                        width: 50,
                        align: 'center' as const,
                        render: (seq, _, idx) => <span style={{ fontWeight: 600, color: '#64748b' }}>{seq || idx + 1}</span>,
                      },
                      {
                        title: 'Nama Termin',
                        dataIndex: 'termName',
                        key: 'termName',
                        render: (name, rec: any) => <strong>{name || rec.term_name || `Termin ${rec.sequence}`}</strong>,
                      },
                      {
                        title: 'Tipe',
                        dataIndex: 'termType',
                        key: 'termType',
                        width: 150,
                        render: (type, rec: any) => {
                          const t = type || rec.term_type;
                          const map: Record<string, { label: string; color: string }> = {
                            DOWN_PAYMENT: { label: 'Uang Muka / DP', color: 'blue' },
                            PROGRESS: { label: 'Progress', color: 'orange' },
                            FINAL_DELIVERY: { label: 'Pelunasan / Final', color: 'green' },
                            RETENTION: { label: 'Retensi', color: 'purple' },
                          };
                          const config = map[t] || { label: t, color: 'default' };
                          return <Tag color={config.color}>{config.label}</Tag>;
                        },
                      },
                      {
                        title: 'Persentase',
                        dataIndex: 'percentage',
                        key: 'percentage',
                        width: 100,
                        align: 'right' as const,
                        render: (pct) => <strong>{Number(pct).toFixed(2)}%</strong>,
                      },
                      {
                        title: 'Nominal Kontrak',
                        dataIndex: 'amount',
                        key: 'amount',
                        width: 160,
                        align: 'right' as const,
                        render: (amt, rec: any) => {
                          const val = Number(amt ?? rec.amount ?? 0);
                          return (
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>
                              Rp {val.toLocaleString('id-ID')}
                            </span>
                          );
                        },
                      },
                      {
                        title: 'Syarat / Trigger',
                        dataIndex: 'triggerCondition',
                        key: 'triggerCondition',
                        render: (cond, rec: any) => cond || rec.trigger_condition || '-',
                      },
                      {
                        title: 'Masa Retensi',
                        key: 'retention',
                        width: 110,
                        align: 'center' as const,
                        render: (_, rec: any) => {
                          const isRet = rec.isRetention || rec.is_retention || rec.termType === 'RETENTION' || rec.term_type === 'RETENTION';
                          const days = rec.retentionDays || rec.retention_days;
                          return isRet && days ? <Tag color="purple">{days} Hari</Tag> : <span style={{ color: '#94a3b8' }}>-</span>;
                        },
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: 100,
                        align: 'center' as const,
                        render: (st) => <Tag color={st === 'PAID' ? 'green' : 'gold'}>{st || 'PENDING'}</Tag>,
                      },
                    ]}
                  />
                </div>
              ) : (
                <div style={{ height: 232, minHeight: 232, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', color: '#475569', fontSize: 12 }}>
                  {typeof activePo?.paymentTerms === 'string'
                    ? activePo.paymentTerms
                    : 'Termin pembayaran tidak tersedia.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items Locked Breakdown Table */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 12px',
              background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>
              Daftar {poItems.length} Item Pembelian (Terkunci Sesuai Penawaran Pemenang: {vendorName})
            </span>
            <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>
              HARGA & KUANTITAS TERKUNCI (READ-ONLY)
            </Tag>
          </div>
          <Table
            size="small"
            rowKey="key"
            dataSource={poItems}
            pagination={false}
            scroll={{ y: 220 }}
            columns={[
              {
                title: 'No',
                key: 'index',
                width: 45,
                align: 'center' as const,
                render: (_: any, __: any, index: number) => (
                  <span style={{ color: '#64748b', fontSize: 11 }}>{index + 1}</span>
                ),
              },
              {
                title: 'Kategori',
                dataIndex: 'categoryName',
                key: 'categoryName',
                width: 140,
                render: (cat: string) => (
                  <Tag color="blue" style={{ fontSize: 10, borderRadius: 4, margin: 0 }}>
                    {cat}
                  </Tag>
                ),
              },
              {
                title: 'Nama Item & Spesifikasi',
                dataIndex: 'itemName',
                key: 'itemName',
                render: (name: string, it: PurchaseOrderItemRecord) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>{name}</div>
                    {it.wbsNodeId && (
                      <Tag color="geekblue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', marginTop: 2 }}>
                        WBS #{it.wbsNodeId}
                      </Tag>
                    )}
                  </div>
                ),
              },
              {
                title: 'Qty Dipesan',
                dataIndex: 'quantity',
                key: 'quantity',
                width: 80,
                align: 'center' as const,
                render: (qty: number) => <span style={{ fontWeight: 600 }}>{Number(qty || 0)}</span>,
              },
              ...(isViewMode
                ? [
                    {
                      title: 'Sudah Diterima',
                      dataIndex: 'receivedQuantity',
                      key: 'receivedQuantity',
                      width: 95,
                      align: 'center' as const,
                      render: (rec: number) => (
                        <span style={{ color: Number(rec || 0) > 0 ? '#059669' : '#64748b', fontWeight: 600 }}>
                          {Number(rec || 0)}
                        </span>
                      ),
                    },
                    {
                      title: 'Sisa',
                      key: 'remaining',
                      width: 75,
                      align: 'center' as const,
                      render: (_: any, it: PurchaseOrderItemRecord) => {
                        const rem = Math.max(0, Number(it.quantity || 0) - Number(it.receivedQuantity || 0));
                        return (
                          <Tag color={rem > 0 ? 'orange' : 'green'} style={{ fontWeight: 700, margin: 0 }}>
                            {rem}
                          </Tag>
                        );
                      },
                    },
                  ]
                : []),
              {
                title: 'Satuan',
                dataIndex: 'uom',
                key: 'uom',
                width: 65,
                align: 'center' as const,
                render: (uom: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{uom || 'Unit'}</span>,
              },
              {
                title: 'Harga Satuan Disetujui',
                dataIndex: 'unitPrice',
                key: 'unitPrice',
                width: 150,
                align: 'right' as const,
                render: (price: number) => (
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f172a', fontWeight: 600 }}>
                    Rp {Number(price || 0).toLocaleString('id-ID')}
                  </span>
                ),
              },
              {
                title: 'Subtotal Kontrak',
                dataIndex: 'subtotal',
                key: 'subtotal',
                width: 150,
                align: 'right' as const,
                render: (subtotal: number, r: PurchaseOrderItemRecord) => {
                  const val =
                    subtotal !== undefined && subtotal !== null
                      ? Number(subtotal)
                      : r.totalPrice !== undefined && r.totalPrice !== null
                      ? Number(r.totalPrice)
                      : Number(r.quantity || 0) * Number(r.unitPrice || 0);
                  return (
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#059669' }}>
                      Rp {val.toLocaleString('id-ID')}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      </div>
    </Modal>
  );
};

export default PurchaseOrderModal;
