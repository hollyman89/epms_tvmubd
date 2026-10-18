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
  FileTextOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import {
  ProcurementService,
  CreatePOPayload,
  PaymentTermType,
  PoPaymentTermRecord,
  PurchaseOrderType,
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
  orderType?: PurchaseOrderType;
  status: 'ISSUED' | 'PARTIALLY_FULFILLED' | 'COMPLETED' | 'DRAFT' | 'CANCELLED';
  issuedAt: string;
  issuedBy: string;
  deliveryDate?: string;
  deliveryLocation?: string;
  paymentTerms?: any;
  notes?: string;
  items: PurchaseOrderItemRecord[];
  serviceOrders?: any[];
  vendor?: any;
  purchaseRequest?: any;
}

export const renderPoTypeTag = (orderType?: PurchaseOrderType | string) => {
  switch (orderType) {
    case 'SERVICE':
      return <Tag color="cyan" style={{ fontWeight: 600 }}>Jasa / Subcon</Tag>;
    case 'LEGACY_MIXED':
      return <Tag color="orange" style={{ fontWeight: 600 }}>Legacy Campuran</Tag>;
    case 'MATERIAL':
    default:
      return <Tag color="blue" style={{ fontWeight: 600 }}>Material</Tag>;
  }
};

export interface PurchaseOrderModalProps {
  open: boolean;
  onClose: () => void;
  comparison: VendorComparisonResult | null;
  rfq: any | null;
  targetPr?: any | null;
  winningQuotation?: VendorQuotationRecord | null;
  existingPo?: PurchaseOrderPrototypeRecord | null;
  onPoCreated?: (po: PurchaseOrderPrototypeRecord) => void;
  onOpenGoodsReceipt?: (po: PurchaseOrderPrototypeRecord) => void;
  onOpenServiceOrder?: (po: PurchaseOrderPrototypeRecord) => void;
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
  targetPr,
  winningQuotation,
  existingPo,
  onPoCreated,
  onOpenGoodsReceipt,
  onOpenServiceOrder,
  currentUserName = 'Procurement Team',
  isProcurement = true,
  isSuperAdmin = false,
  viewOnly = false,
  canReceiveGoods = true,
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Direct Service PR Mode
  const isDirectService = Boolean(targetPr && !comparison);

  // Active PO detection
  const activePo = useMemo(() => {
    if (existingPo) return existingPo;
    return null;
  }, [existingPo]);

  const isViewMode = viewOnly || Boolean(activePo);

  // Fetch vendors for direct service PO selection
  const [rawVendors, setRawVendors] = useState<any[]>([]);
  useEffect(() => {
    if (isDirectService && !isViewMode) {
      let isMounted = true;
      ProcurementService.getVendors()
        .then((data) => {
          if (isMounted && Array.isArray(data)) {
            setRawVendors(data);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch vendors:', err);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isDirectService, isViewMode]);

  // Derive PO items from winning quotation snapshot, target PR items, or existing PO
  const poItems: PurchaseOrderItemRecord[] = useMemo(() => {
    if (activePo?.items && Array.isArray(activePo.items)) {
      return activePo.items.map((it: any, idx: number) => {
        const qty = Number(it.quantity || 0);
        const price = Number(it.unitPrice || 0);
        const total =
          it.totalPrice !== undefined && it.totalPrice !== null
            ? Number(it.totalPrice)
            : it.subtotal !== undefined && it.subtotal !== null
            ? Number(it.subtotal)
            : qty * price;
        const rawCat =
          it.costItem?.categoryKey ||
          it.costItem?.category_key ||
          it.categoryKey ||
          it.category_key ||
          it.categoryName ||
          it.category_name ||
          (activePo?.orderType === 'SERVICE' ? 'SUBCONTRACTOR' : 'MATERIAL');
        return {
          key: it.key || String(it.id || idx),
          categoryName: rawCat,
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
        const rawQuoteCat =
          it.categoryName ||
          (it as any).categoryKey ||
          (it as any).category_key ||
          (it as any).costItem?.categoryKey ||
          'MATERIAL';
        return {
          key: it.key || `item_${idx}`,
          categoryName: rawQuoteCat,
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
    if (targetPr?.items && Array.isArray(targetPr.items)) {
      return targetPr.items.map((it: any, idx: number) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.estimatedUnitPrice || 0);
        const total = Number(it.estimatedTotalPrice || qty * price);
        const rawPrCat =
          it.costItem?.categoryKey ||
          it.costItem?.category_key ||
          it.categoryKey ||
          it.category_key ||
          'SUBCONTRACTOR';
        return {
          key: String(it.id || idx),
          categoryName: rawPrCat,
          itemName: it.itemName || `Item Jasa #${idx + 1}`,
          quantity: qty,
          receivedQuantity: 0,
          uom: it.uom || 'Unit',
          unitPrice: price,
          subtotal: total,
          totalPrice: total,
          wbsNodeId: it.wbsNodeId,
          rabItemKey: it.rabItemKey,
        };
      });
    }
    return [];
  }, [activePo, winningQuotation, targetPr]);

  const effectiveLeadTimeDays = useMemo(() => {
    const rawLt = winningQuotation?.leadTimeDays ?? comparison?.winnerLeadTimeDays;
    const num = Number(rawLt);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [winningQuotation, comparison]);

  const isLeadTimeValid = isDirectService || (effectiveLeadTimeDays !== null && effectiveLeadTimeDays > 0);

  const totalPoAmount = useMemo(() => {
    if (activePo) return Number(activePo.totalAmount || 0);
    if (winningQuotation) return Number(winningQuotation.totalOfferedAmount || 0);
    if (comparison) return Number(comparison.winnerTotalOfferedAmount || 0);
    if (targetPr?.totalEstimatedAmount) return Number(targetPr.totalEstimatedAmount);
    return poItems.reduce((sum, it) => sum + it.subtotal, 0);
  }, [activePo, winningQuotation, comparison, targetPr, poItems]);

  const budgetCeiling =
    comparison?.budgetCeiling ||
    Number(rfq?.totalAmount || 0) ||
    Number(targetPr?.totalEstimatedAmount || 0) ||
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
      width: 56,
      align: 'center' as const,
      render: (seq: number) => <span style={{ fontWeight: 600, color: '#64748b', fontSize: 12 }}>{seq}</span>,
    },
    {
      title: 'Nama Termin',
      dataIndex: 'term_name',
      key: 'term_name',
      width: 240,
      render: (name: string, rec: any, idx: number) => {
        const isHighlighted = highlightedSeq.includes(rec.sequence);
        return (
          <Input
            value={name}
            placeholder="Nama termin (wajib)..."
            status={!name?.trim() ? 'error' : ''}
            onChange={(e) => handleUpdateTerm(idx, 'term_name', e.target.value)}
            className={isHighlighted ? 'term-input-pulse' : ''}
            style={{
              borderRadius: 6,
              height: 38,
              fontSize: 12.5,
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
              backgroundColor: isHighlighted ? '#ecfdf5' : '#ffffff',
            }}
          />
        );
      },
    },
    {
      title: 'Tipe',
      dataIndex: 'term_type',
      key: 'term_type',
      width: 200,
      render: (type: PaymentTermType, _: any, idx: number) => (
        <Select
          value={type}
          onChange={(val) => handleTermTypeChange(idx, val)}
          style={{ width: '100%', height: 38, fontSize: 12.5 }}
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
      width: 155,
      align: 'center' as const,
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
              height: 38,
              fontSize: 12.5,
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
              backgroundColor: isHighlighted ? '#ecfdf5' : '#ffffff',
            }}
          />
        );
      },
    },
    {
      title: 'Estimasi Nominal',
      key: 'estimatedAmount',
      width: 190,
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
                fontSize: 13,
                color: '#059669',
                transition: 'color 0.2s ease',
              }}
            >
              Rp {Number(rec.estimatedAmount || 0).toLocaleString('id-ID')}
            </span>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>(Estimasi Display)</div>
          </div>
        );
      },
    },
    {
      title: 'Trigger / Syarat',
      dataIndex: 'trigger_condition',
      key: 'trigger_condition',
      width: 210,
      render: (trig: string, _: any, idx: number) => (
        <Input
          value={trig}
          placeholder="Contoh: PO Diterbitkan / BAST 1"
          onChange={(e) => handleUpdateTerm(idx, 'trigger_condition', e.target.value)}
          style={{ borderRadius: 6, height: 38, fontSize: 12.5 }}
        />
      ),
    },
    {
      title: 'Retensi',
      key: 'retention',
      width: 130,
      align: 'center' as const,
      render: (_: any, rec: any, idx: number) => {
        const isRet = rec.term_type === 'RETENTION' || Boolean(rec.is_retention);
        if (!isRet) return <span style={{ color: '#94a3b8' }}>-</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>Retensi</Tag>
            <InputNumber
              min={1}
              precision={0}
              value={rec.retention_days}
              status={!rec.retention_days || rec.retention_days <= 0 ? 'error' : ''}
              addonAfter="hari"
              placeholder="Masa Retensi"
              onChange={(val) => handleUpdateTerm(idx, 'retention_days', val ?? undefined)}
              style={{ width: 110, fontSize: 11.5 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: any, idx: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined style={{ fontSize: 16 }} />}
          onClick={() => handleRemoveTerm(idx)}
          style={{ padding: 4 }}
        />
      ),
    },
  ];

  const handleSubmit = async (values: any) => {
    if (isDirectService) {
      if (!values.vendor_id) {
        message.error('Vendor / Subkontraktor pelaksana jasa wajib dipilih.');
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
        message.error('Daftar item PR Jasa tidak ditemukan.');
        return;
      }
      const prId = Number(targetPr.id);
      setIsSubmitting(true);
      try {
        const payload: CreatePOPayload = {
          purchase_request_id: prId,
          vendor_id: Number(values.vendor_id),
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
          delivery_location: values.deliveryLocation?.trim() || 'Lokasi Proyek / Lapangan',
          delivery_date: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
          notes: values.notes?.trim() || '[Pengadaan Jasa - Penunjukan Langsung]',
          po_items: poItems.map((item) => ({
            item_name: item.itemName,
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unitPrice || 0),
            total_price: Number(item.subtotal || item.unitPrice * item.quantity || 0),
          })),
        };

        const res = await ProcurementService.createPurchaseOrder(payload);

        await queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
        await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
        await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-requests'] });

        const selectedVendorObj = rawVendors.find((v: any) => Number(v.id) === Number(values.vendor_id));

        const newPo: PurchaseOrderPrototypeRecord = {
          poId: String(res.id),
          poNumber: res.poNumber,
          comparisonId: '0',
          rfqId: 0,
          rfqNumber: '—',
          prId,
          prNumber: targetPr.prNumber || `PR-${targetPr.id}`,
          projectId: targetPr.projectId || targetPr.project?.id || 0,
          projectName: targetPr.project?.name || 'Proyek Tanpa Nama',
          vendorId: Number(values.vendor_id),
          vendorCode: selectedVendorObj?.code || '',
          vendorName: selectedVendorObj?.name || 'Vendor Jasa',
          orderType: 'SERVICE',
          totalAmount: Number(res.totalAmount || totalPoAmount),
          budgetCeiling,
          status: (res.status as any) || 'ISSUED',
          issuedAt: res.createdAt || new Date().toISOString(),
          issuedBy: currentUserName,
          deliveryDate: values.deliveryDate ? values.deliveryDate.toISOString() : undefined,
          deliveryLocation: values.deliveryLocation || 'Lokasi Proyek / Lapangan',
          paymentTerms: res.paymentTerms || paymentTerms,
          notes: values.notes || '',
          items: poItems,
        };

        message.success(`Service Purchase Order (${res.poNumber}) berhasil diterbitkan!`);
        onPoCreated?.(newPo);
        onClose();
        return;
      } catch (err: any) {
        console.error('Failed to create Service PO:', err);
        const backendMsg = err.response?.data?.message || err.message || 'Gagal menerbitkan Service Purchase Order.';
        message.error(backendMsg);
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

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
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'purchase-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });

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

  if (!comparison && !activePo && !targetPr) return null;

  const vendorName =
    (activePo as any)?.vendor?.name ||
    activePo?.vendorName ||
    comparison?.selectedWinnerVendorName ||
    (comparison as any)?.winnerVendorName ||
    (isDirectService ? 'Pilih Vendor / Subkontraktor' : '—');

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
    targetPr?.project?.name ||
    'Proyek Tidak Tersedia';

  const projectCode =
    (activePo as any)?.purchaseRequest?.project?.code ||
    (activePo as any)?.projectCode ||
    (comparison as any)?.projectCode ||
    targetPr?.project?.code ||
    '';

  const currentProjectId =
    (activePo as any)?.purchaseRequest?.project?.id ||
    (activePo as any)?.purchaseRequest?.projectId ||
    activePo?.projectId ||
    comparison?.projectId ||
    targetPr?.projectId ||
    targetPr?.project?.id;

  const prNumber =
    (activePo as any)?.purchaseRequest?.prNumber ||
    activePo?.prNumber ||
    rfq?.prNumber ||
    rfq?.purchaseRequest?.prNumber ||
    (rfq?.purchaseRequest as any)?.pr_number ||
    (comparison as any)?.prNumber ||
    targetPr?.prNumber ||
    (targetPr?.id ? `PR-${targetPr.id}` : undefined) ||
    (rfq?.prId ? `PR-${rfq.prId}` : undefined) ||
    'PR-N/A';

  const rfqNumber =
    activePo?.rfqNumber ||
    comparison?.rfqNumber ||
    (rfq as any)?.rfqNumber ||
    (isDirectService ? 'Tidak Memerlukan RFQ (Penunjukan Langsung)' : '—');

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1340px, calc(100vw - 48px))"
      centered
      destroyOnClose
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 140px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 22px',
        },
      }}
      bodyStyle={{
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '16px 22px',
      }}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            flexWrap: 'wrap',
            gap: 12,
            padding: '4px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 16 }} />
            <Text style={{ fontSize: 12, color: '#334155' }}>
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

          <Space size={10}>
            <Button
              onClick={onClose}
              style={{
                borderRadius: 6,
                height: 38,
                padding: '0 20px',
                fontWeight: 500,
              }}
            >
              {isViewMode ? 'Tutup' : 'Batal'}
            </Button>
            {isViewMode &&
              activePo &&
              (activePo.orderType === 'SERVICE' ? (
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={() => {
                    onClose();
                    onOpenServiceOrder?.(activePo);
                  }}
                  style={{
                    backgroundColor: '#0284c7',
                    borderColor: '#0284c7',
                    borderRadius: 6,
                    height: 38,
                    fontWeight: 600,
                  }}
                >
                  Kelola SPK / Work Order
                </Button>
              ) : (
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
                      height: 38,
                      fontWeight: 600,
                    }}
                  >
                    Proses Penerimaan Barang (GR)
                  </Button>
                )
              ))}
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
                  height: 38,
                  padding: '0 22px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingRight: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0,
            }}
          >
            <FileDoneOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                lineHeight: 1.3,
              }}
            >
              <span>
                {isViewMode
                  ? `Rincian Purchase Order — ${activePo?.poNumber}`
                  : 'Penerbitan Purchase Order (PO) ke Vendor Pemenang'}
              </span>
              {isViewMode && activePo && renderPoTypeTag(activePo.orderType)}
            </div>
            <Text type="secondary" style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginTop: 2 }}>
              {isViewMode
                ? 'Surat Perintah Pembelian resmi yang telah diterbitkan kepada vendor pemenang'
                : 'Dokumen komitmen pengadaan resmi yang diterbitkan berdasarkan hasil evaluasi vendor comparison'}
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{`
          .po-modal-navy-table .ant-table-thead > tr > th {
            background: #0f233a !important;
            color: #ffffff !important;
            font-weight: 600 !important;
            font-size: 11.5px !important;
            border-bottom: 1px solid #1e3a5f !important;
            padding: 9px 12px !important;
          }
          .po-modal-navy-table .ant-table-thead > tr > th::before {
            background-color: rgba(255, 255, 255, 0.15) !important;
          }
          .po-modal-navy-table .ant-table-tbody > tr > td {
            padding: 8px 12px !important;
            font-size: 12px !important;
          }
          .po-modal-navy-table .ant-table-tbody > tr:hover > td {
            background: #f8fafc !important;
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
          .po-summary-col {
            padding: 12px 16px;
            border-right: 1px solid #e2e8f0;
          }
          @media (max-width: 768px) {
            .po-summary-col {
              border-right: none;
              border-bottom: 1px solid #e2e8f0;
            }
          }
        `}</style>

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

        {/* PO Order Type Specific Alerts */}
        {isViewMode && activePo?.orderType === 'SERVICE' && (
          <Alert
            type="info"
            showIcon
            message="PO Layanan Jasa / Subkon (Non-Material)"
            description="Penerimaan hasil kerja jasa tidak menggunakan Goods Receipt (GR). Pelaksanaan fisik dikelola melalui SPK / Work Order dan diverifikasi pada Klaim Jasa."
            style={{ borderRadius: 8, border: '1px solid #bae6fd', background: '#f0f9ff' }}
          />
        )}
        {isViewMode && activePo?.orderType === 'LEGACY_MIXED' && (
          <Alert
            type="warning"
            showIcon
            message="PO Campuran Historis (Legacy)"
            description="PO historis ini memiliki kombinasi item Material dan Jasa. Goods Receipt hanya diperbolehkan untuk item kategori Material. Penerimaan item jasa diblokir sistem."
            style={{ borderRadius: 8, border: '1px solid #fed7aa', background: '#fffbeb' }}
          />
        )}

        {/* PO Reference & Vendor Context Strip */}
        <div
          style={{
            background: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          <Row gutter={0} align="middle">
            <Col xs={24} sm={12} md={6} className="po-summary-col">
              <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 4 }}>
                PROYEK:
              </Text>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', lineHeight: 1.35, minHeight: 34 }}>
                {projectName}
              </div>
              <div style={{ marginTop: 4 }}>
                {currentProjectId ? (
                  <Tag color="blue" style={{ fontSize: 10, fontWeight: 600, margin: 0, borderRadius: 4, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                    {projectCode ? `${projectCode} • ` : ''}Project #{currentProjectId}
                  </Tag>
                ) : (
                  <Tag style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>Project ID Tidak Tersedia</Tag>
                )}
              </div>
            </Col>

            <Col xs={24} sm={12} md={6} className="po-summary-col">
              <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 4 }}>
                REFERENSI EVALUASI:
              </Text>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1d4ed8', lineHeight: 1.35 }}>
                {prNumber}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.3 }}>
                {rfqNumber !== '—' ? `${rfqNumber} (EVALUATED)` : '—'}
              </div>
            </Col>

            <Col xs={24} sm={12} md={6} className="po-summary-col">
              <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 4 }}>
                VENDOR PEMENANG:
              </Text>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#047857', display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.35 }}>
                <TrophyOutlined style={{ color: '#d97706', fontSize: 14 }} />
                <span>{vendorName}</span>
              </div>
              {vendorCode && (
                <div style={{ marginTop: 4 }}>
                  <Tag color="cyan" style={{ fontSize: 10, fontWeight: 600, margin: 0, borderRadius: 4 }}>
                    {vendorCode}
                  </Tag>
                </div>
              )}
            </Col>

            <Col xs={24} sm={12} md={6} style={{ padding: '12px 16px' }}>
              <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 4 }}>
                TOTAL NILAI PO (KONTRAK):
              </Text>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#059669', fontFamily: 'monospace', lineHeight: 1.3 }}>
                Rp {totalPoAmount.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
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
              deliveryLocation: isDirectService
                ? 'Lokasi Proyek / Lapangan'
                : (comparison as any)?.deliveryLocation || (comparison as any)?.address || (comparison as any)?.siteName || (comparison as any)?.city || 'Lokasi Gudang Proyek',
              deliveryDate: dayjs().add(effectiveLeadTimeDays || 14, 'day'),
            }}
            style={{ marginBottom: 0 }}
          >
            <Row gutter={[16, 0]}>
              {isDirectService && (
                <Col xs={24}>
                  <Form.Item
                    label={
                      <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                        Vendor / Subkontraktor Pelaksana Jasa
                      </span>
                    }
                    name="vendor_id"
                    rules={[{ required: true, message: 'Vendor / Subkontraktor pelaksana jasa wajib dipilih' }]}
                    style={{ marginBottom: 14 }}
                  >
                    <Select
                      placeholder="Pilih vendor atau subkontraktor pelaksana jasa..."
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={rawVendors.map((v: any) => ({
                        value: v.id,
                        label: `${v.code} — ${v.name} (${v.vendorType || 'Vendor'})`,
                      }))}
                      style={{ width: '100%', height: 38, borderRadius: 6 }}
                    />
                  </Form.Item>
                </Col>
              )}
              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                      {isDirectService ? 'Target Tanggal Pelaksanaan' : 'Estimasi Tanggal Pengiriman'}
                    </span>
                  }
                  name="deliveryDate"
                  rules={[{ required: true, message: `${isDirectService ? 'Target tanggal pelaksanaan' : 'Tanggal pengiriman'} wajib diisi` }]}
                  style={{ marginBottom: 14 }}
                >
                  <DatePicker style={{ width: '100%', height: 38, borderRadius: 6 }} format="DD MMMM YYYY" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                      {isDirectService ? 'Lokasi Pelaksanaan Pekerjaan (Site)' : 'Lokasi Pengiriman (Franco)'}
                    </span>
                  }
                  name="deliveryLocation"
                  rules={[{ required: true, message: `${isDirectService ? 'Lokasi pelaksanaan' : 'Lokasi pengiriman'} wajib diisi` }]}
                  style={{ marginBottom: 14 }}
                >
                  <Input
                    placeholder={isDirectService ? 'Lokasi pekerjaan site / lapangan...' : 'Lokasi gudang proyek...'}
                    style={{ height: 38, borderRadius: 6, fontSize: 12 }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  label={
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>
                      Instruksi / Catatan Khusus PO
                    </span>
                  }
                  name="notes"
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea
                    rows={2}
                    placeholder={
                      isDirectService
                        ? 'Contoh: Pelaksanaan mengacu pada SPK dan spesifikasi teknis penunjukan langsung.'
                        : 'Contoh: Pengiriman harap menyertakan Certificate of Origin (COO), Surat Jalan, dan faktur pajak.'
                    }
                    style={{ borderRadius: 6, fontSize: 12 }}
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
                      fontSize: 11,
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
                      fontSize: 11,
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
                      fontSize: 11,
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
                    fontSize: 11.5,
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
              <div style={{ overflowX: 'auto' }}>
                <Table
                  size="small"
                  rowKey="sequence"
                  dataSource={estimatedAllocation}
                  pagination={false}
                  columns={builderColumns}
                  scroll={{ x: 1060, y: estimatedAllocation.length > 5 ? 260 : undefined }}
                  className="po-modal-navy-table"
                  rowClassName={(record) =>
                    highlightedSeq.includes(record.sequence) ? 'term-row-highlight' : ''
                  }
                  locale={{
                    emptyText: (
                      <div style={{ padding: '24px 0', color: '#94a3b8', fontSize: 12 }}>
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
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 2 }}>TOTAL PO:</Text>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a', fontFamily: 'monospace' }}>
                      Rp {totalPoAmount.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 2 }}>TOTAL PERSENTASE:</Text>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: percentageStatus.color, fontFamily: 'monospace' }}>
                      {totalPercentage.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: 2 }}>ESTIMASI TOTAL TERMIN:</Text>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: '#059669', fontFamily: 'monospace' }}>
                      Rp {totalEstimatedAmount.toLocaleString('id-ID')}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>Total Alokasi (Display)</div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      background: percentageStatus.alertType === 'success' ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${percentageStatus.alertType === 'success' ? '#a7f3d0' : '#fde68a'}`,
                      color: percentageStatus.alertType === 'success' ? '#047857' : '#b45309',
                    }}
                  >
                    {percentageStatus.alertType === 'success' ? (
                      <CheckCircleOutlined style={{ color: '#059669', fontSize: 13 }} />
                    ) : (
                      <ExclamationCircleOutlined style={{ color: '#d97706', fontSize: 13 }} />
                    )}
                    <span>{percentageStatus.text}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {Array.isArray(activePo?.paymentTerms) && activePo.paymentTerms.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <Table
                    size="small"
                    rowKey={(rec, idx) => String((rec as any).id || (rec as any).sequence || idx)}
                    dataSource={activePo.paymentTerms as any[]}
                    pagination={false}
                    scroll={{ x: 1000, y: (activePo.paymentTerms as any[]).length > 5 ? 260 : undefined }}
                    className="po-modal-navy-table"
                    columns={[
                      {
                        title: 'No',
                        dataIndex: 'sequence',
                        key: 'sequence',
                        width: 56,
                        align: 'center' as const,
                        render: (seq, _, idx) => <span style={{ fontWeight: 600, color: '#64748b' }}>{seq || idx + 1}</span>,
                      },
                      {
                        title: 'Nama Termin',
                        dataIndex: 'termName',
                        key: 'termName',
                        width: 220,
                        render: (name, rec: any) => <strong>{name || rec.term_name || `Termin ${rec.sequence}`}</strong>,
                      },
                      {
                        title: 'Tipe',
                        dataIndex: 'termType',
                        key: 'termType',
                        width: 170,
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
                        width: 110,
                        align: 'right' as const,
                        render: (pct) => <strong>{Number(pct).toFixed(2)}%</strong>,
                      },
                      {
                        title: 'Nominal Kontrak',
                        dataIndex: 'amount',
                        key: 'amount',
                        width: 170,
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
                        width: 120,
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', color: '#475569', fontSize: 12 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCartOutlined style={{ color: '#2563eb', fontSize: 16 }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                Daftar {poItems.length} Item Pembelian (Terkunci Sesuai Penawaran Pemenang: {vendorName})
              </span>
            </div>
            <Tag
              color="cyan"
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                margin: 0,
                borderRadius: 4,
                padding: '2px 8px',
                background: '#ecfeff',
                borderColor: '#67e8f9',
                color: '#0891b2',
              }}
            >
              HARGA & KUANTITAS TERKUNCI (READ-ONLY)
            </Tag>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <Table
              size="small"
              rowKey="key"
              dataSource={poItems}
              pagination={false}
              scroll={{ x: 950, y: poItems.length > 5 ? 240 : undefined }}
              className="po-modal-navy-table"
              columns={[
                {
                  title: 'No',
                  key: 'index',
                  width: 56,
                  align: 'center' as const,
                  render: (_: any, __: any, index: number) => (
                    <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>{index + 1}</span>
                  ),
                },
                {
                  title: 'Kategori',
                  dataIndex: 'categoryName',
                  key: 'categoryName',
                  width: 130,
                  render: (cat: string) => {
                    const upper = (cat || '').toUpperCase();
                    const color =
                      upper === 'MATERIAL' ? 'blue' :
                      upper === 'SUBCONTRACTOR' ? 'cyan' :
                      upper === 'EQUIPMENT' ? 'purple' :
                      upper === 'OPERATIONAL' ? 'geekblue' : 'default';
                    const label =
                      upper === 'MATERIAL' ? 'Material' :
                      upper === 'SUBCONTRACTOR' ? 'Subkontraktor' :
                      upper === 'EQUIPMENT' ? 'Peralatan' :
                      upper === 'OPERATIONAL' ? 'Operasional' : cat || 'Material';
                    return (
                      <Tag color={color} style={{ fontSize: 10.5, borderRadius: 4, margin: 0, fontWeight: 600 }}>
                        {label}
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Nama Item & Spesifikasi',
                  dataIndex: 'itemName',
                  key: 'itemName',
                  render: (name: string, it: PurchaseOrderItemRecord) => (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{name}</div>
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
                  width: 100,
                  align: 'center' as const,
                  render: (qty: number) => <span style={{ fontWeight: 600, fontSize: 12 }}>{Number(qty || 0)}</span>,
                },
                ...(isViewMode
                  ? [
                      {
                        title: 'Sudah Diterima',
                        dataIndex: 'receivedQuantity',
                        key: 'receivedQuantity',
                        width: 100,
                        align: 'center' as const,
                        render: (rec: number) => (
                          <span style={{ color: Number(rec || 0) > 0 ? '#059669' : '#64748b', fontWeight: 600, fontSize: 12 }}>
                            {Number(rec || 0)}
                          </span>
                        ),
                      },
                      {
                        title: 'Sisa',
                        key: 'remaining',
                        width: 80,
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
                  width: 80,
                  align: 'center' as const,
                  render: (uom: string) => <span style={{ fontSize: 11.5, color: '#64748b' }}>{uom || 'Unit'}</span>,
                },
                {
                  title: 'Harga Satuan Disetujui',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 180,
                  align: 'right' as const,
                  render: (price: number) => (
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
                      Rp {Number(price || 0).toLocaleString('id-ID')}
                    </span>
                  ),
                },
                {
                  title: 'Subtotal Kontrak',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  width: 180,
                  align: 'right' as const,
                  render: (subtotal: number, r: PurchaseOrderItemRecord) => {
                    const val =
                      subtotal !== undefined && subtotal !== null
                        ? Number(subtotal)
                        : r.totalPrice !== undefined && r.totalPrice !== null
                        ? Number(r.totalPrice)
                        : Number(r.quantity || 0) * Number(r.unitPrice || 0);
                    return (
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#059669' }}>
                        Rp {val.toLocaleString('id-ID')}
                      </span>
                    );
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PurchaseOrderModal;
