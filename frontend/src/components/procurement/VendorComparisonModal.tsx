"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Radio,
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
  Card,
  Tooltip,
} from 'antd';
import {
  SlidersOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  FileDoneOutlined,
  InfoCircleOutlined,
  SendOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { ProcurementService } from '@/services/procurement.service';
import { VendorQuotationRecord } from '@/components/procurement/VendorQuotationModal';
import {
  PurchaseOrderModal,
  PurchaseOrderPrototypeRecord,
} from '@/components/procurement/PurchaseOrderModal';

const { Text, Title, Paragraph } = Typography;

export interface VendorComparisonResult {
  comparisonId: string;
  rfqId: string | number;
  rfqNumber: string;
  prNumber?: string;
  projectId: string | number;
  projectName: string;
  budgetCeiling: number;
  quotationIds: string[];
  vendorIds: number[];
  selectedWinnerVendorId: number;
  selectedWinnerVendorCode: string;
  selectedWinnerVendorName: string;
  winnerTotalOfferedAmount: number;
  winnerLeadTimeDays?: number;
  winnerVarianceAmount: number;
  evaluationNotes?: string;
  comparedAt: string;
  comparedBy: string;
  status: 'EVALUATED';
}

export interface VendorComparisonModalProps {
  open: boolean;
  onClose: () => void;
  rfq: any | null;
  quotations: VendorQuotationRecord[];
  existingComparison?: VendorComparisonResult | null;
  existingPo?: PurchaseOrderPrototypeRecord | null;
  onComparisonSaved?: (result: VendorComparisonResult) => void;
  onPoCreated?: (po: PurchaseOrderPrototypeRecord) => void;
  currentUserName?: string;
  isProcurement?: boolean;
  isSuperAdmin?: boolean;
}

export const VendorComparisonModal: React.FC<VendorComparisonModalProps> = ({
  open,
  onClose,
  rfq,
  quotations = [],
  existingComparison = null,
  existingPo = null,
  onComparisonSaved,
  onPoCreated,
  currentUserName = 'Procurement Team',
  isProcurement = true,
  isSuperAdmin = false,
}) => {
  const queryClient = useQueryClient();
  const [selectedWinnerId, setSelectedWinnerId] = useState<number | null>(null);
  const [evaluationNotes, setEvaluationNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPoModalOpen, setIsPoModalOpen] = useState<boolean>(false);
  const [poVersion, setPoVersion] = useState<number>(0);

  const effectiveOpen = open;
  const effectiveRfq = rfq;
  const effectiveQuotations = quotations || [];
  const effectiveExistingPo = existingPo;

  // Local authoritative PO state (P7.4-D Hardened)
  const [currentPo, setCurrentPo] = useState<PurchaseOrderPrototypeRecord | null>(effectiveExistingPo || null);

  useEffect(() => {
    if (effectiveExistingPo) {
      setCurrentPo(effectiveExistingPo);
    }
  }, [effectiveExistingPo]);

  useEffect(() => {
    if (effectiveOpen) {
      setCurrentPo(effectiveExistingPo || null);
    }
  }, [effectiveOpen, effectiveRfq?.id, effectiveRfq?.rfqNumber]);

  const isEvaluated = Boolean(existingComparison);
  const isPoIssued = Boolean(currentPo);

  useEffect(() => {
    if (effectiveOpen) {
      if (existingComparison) {
        setSelectedWinnerId(existingComparison.selectedWinnerVendorId);
        setEvaluationNotes(existingComparison.evaluationNotes || '');
      } else {
        setSelectedWinnerId(null);
        setEvaluationNotes('');
      }
    }
  }, [effectiveOpen, existingComparison]);

  // Unique valid quotations
  const uniqueQuotations = useMemo(() => {
    const map = new Map<number | string, VendorQuotationRecord>();
    effectiveQuotations.forEach((q: any) => {
      const vendorId = Number(q.vendorId || q.vendor?.id);
      const vendorCode = q.vendorCode || q.vendor?.code || (vendorId ? `VEN-${vendorId}` : 'VEN-N/A');
      const vendorName = q.vendorName || q.vendor?.name || (vendorId ? `Vendor #${vendorId}` : 'Vendor');
      const totalOfferedAmount = Number(q.totalOfferedAmount ?? q.totalAmount ?? 0);
      const quotationId = q.quotationId ? String(q.quotationId) : String(q.id || '');
      const leadTimeDays = q.leadTimeDays != null && !isNaN(Number(q.leadTimeDays)) ? Number(q.leadTimeDays) : undefined;
      const notes = q.notes || '';
      const items = Array.isArray(q.items) ? q.items : [];
      const key = vendorId || vendorCode;
      map.set(key, {
        ...q,
        quotationId,
        vendorId,
        vendorCode,
        vendorName,
        totalOfferedAmount,
        leadTimeDays,
        notes,
        items,
      });
    });
    return Array.from(map.values());
  }, [effectiveQuotations]);

  const prTotalEstimatedAmount = useMemo(() => {
    return (
      Number(effectiveRfq?.purchaseRequest?.totalEstimatedAmount || 0) ||
      Number((effectiveRfq?.purchaseRequest as any)?.total_estimated_amount || 0) ||
      Number(effectiveRfq?.totalAmount || 0) ||
      Number(effectiveRfq?.budgetCeiling || 0) ||
      0
    );
  }, [effectiveRfq]);

  const validQuotationCount = uniqueQuotations.length;
  const isHighValue = prTotalEstimatedAmount > 1000000;
  const isEligible = isHighValue ? validQuotationCount >= 3 : validQuotationCount >= 1;

  // Identify Informational Recommendations with Tie-Aware Ranking
  const {
    lowestPriceQuotes,
    minPrice,
    isPriceTie,
    fastestLeadTimeQuotes,
    minLeadTime,
    isLeadTimeTie,
  } = useMemo(() => {
    if (uniqueQuotations.length === 0) {
      return {
        lowestPriceQuotes: [],
        minPrice: 0,
        isPriceTie: false,
        fastestLeadTimeQuotes: [],
        minLeadTime: 0,
        isLeadTimeTie: false,
      };
    }

    // 1. Minimum price calculation (tie-aware)
    const prices = uniqueQuotations.map((q) => Number(q.totalOfferedAmount));
    const minPrice = Math.min(...prices);
    const lowestPriceQuotes = uniqueQuotations.filter(
      (q) => Math.abs(Number(q.totalOfferedAmount) - minPrice) < 0.01,
    );
    const isPriceTie = lowestPriceQuotes.length > 1;

    // 2. Minimum lead time calculation (tie-aware)
    const leadTimes = uniqueQuotations
      .map((q) => (q.leadTimeDays != null && !isNaN(Number(q.leadTimeDays)) ? Number(q.leadTimeDays) : null))
      .filter((d): d is number => d !== null && d > 0);
    const minLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes) : 0;
    const fastestLeadTimeQuotes =
      minLeadTime > 0 ? uniqueQuotations.filter((q) => Number(q.leadTimeDays) === minLeadTime) : [];
    const isLeadTimeTie = fastestLeadTimeQuotes.length > 1;

    return {
      lowestPriceQuotes,
      minPrice,
      isPriceTie,
      fastestLeadTimeQuotes,
      minLeadTime,
      isLeadTimeTie,
    };
  }, [uniqueQuotations]);

  // Canonical comparison dataset from RFQ Scope / Approved PR
  const itemComparisonRows = useMemo(() => {
    const rawItems = Array.isArray(effectiveRfq?.items) && effectiveRfq.items.length > 0
      ? effectiveRfq.items
      : Array.isArray(effectiveRfq?.purchaseRequest?.items)
      ? effectiveRfq.purchaseRequest.items
      : [];

    if (rawItems.length === 0) return [];

    return rawItems.map((it: any, idx: number) => {
      const prId = it.prItemId || it.id || (effectiveRfq?.purchaseRequest?.items?.[idx]?.id);
      const itemKey = it.rabItemKey || (prId ? `item_pr_${prId}` : it.key || `item_${idx}`);
      const quantity = Number(it.quantity || 1);
      const estUnitPrice = Number(it.estimatedUnitPrice || it.estimated_unit_price || it.unitPrice || 0);

      // Extract each vendor's offered unit price for this item
      const vendorPrices: Record<number, number> = {};
      let minPriceInRow = Infinity;

      uniqueQuotations.forEach((q) => {
        const matchingItem = Array.isArray(q.items)
          ? q.items.find(
              (qi) =>
                qi.key === itemKey ||
                (qi.prItemId && prId && Number(qi.prItemId) === Number(prId)) ||
                qi.itemName === (it.itemName || it.item_name),
            )
          : undefined;
        const price = matchingItem ? matchingItem.offeredUnitPrice : estUnitPrice;
        vendorPrices[q.vendorId] = price;
        if (price > 0 && price < minPriceInRow) {
          minPriceInRow = price;
        }
      });

      return {
        key: itemKey,
        itemName: it.itemName || it.item_name || 'Item Pengadaan',
        categoryName: it.categoryName || 'Material',
        wbsNodeId: it.wbsNodeId,
        quantity,
        uom: it.uom || 'Unit',
        estUnitPrice,
        vendorPrices,
        minPriceInRow: minPriceInRow === Infinity ? estUnitPrice : minPriceInRow,
      };
    });
  }, [effectiveRfq, uniqueQuotations]);

  const budgetCeiling = useMemo(() => {
    return (
      Number(effectiveRfq?.totalAmount || 0) ||
      Number(effectiveRfq?.budgetCeiling || 0) ||
      Number(effectiveRfq?.purchaseRequest?.totalEstimatedAmount || 0) ||
      Number((effectiveRfq?.purchaseRequest as any)?.total_estimated_amount || 0) ||
      itemComparisonRows.reduce((sum, it) => sum + (it.quantity * it.estUnitPrice), 0)
    );
  }, [effectiveRfq, itemComparisonRows]);

  const prNumber = useMemo(() => {
    return (
      effectiveRfq?.purchaseRequest?.prNumber ||
      (effectiveRfq?.purchaseRequest as any)?.pr_number ||
      effectiveRfq?.prNumber ||
      (effectiveRfq as any)?.pr_number ||
      (effectiveRfq?.prId ? `PR-${effectiveRfq.prId}` : undefined) ||
      (effectiveRfq?.purchaseRequestId ? `PR-${effectiveRfq.purchaseRequestId}` : undefined) ||
      'PR-N/A'
    );
  }, [effectiveRfq]);

  const handleSaveComparison = async () => {
    if (!effectiveRfq) {
      message.error('Data RFQ tidak ditemukan.');
      return;
    }

    if (!isEligible) {
      message.error(
        isHighValue
          ? 'Perbandingan vendor membutuhkan minimal 3 penawaran vendor untuk pengadaan di atas Rp 1.000.000.'
          : 'Perbandingan vendor membutuhkan minimal 1 penawaran vendor valid.',
      );
      return;
    }

    if (!selectedWinnerId) {
      message.error('Wajib memilih tepat satu vendor pemenang evaluasi.');
      return;
    }

    const winnerQuote = uniqueQuotations.find((q) => q.vendorId === selectedWinnerId);
    if (!winnerQuote) {
      message.error('Vendor pemenang yang dipilih tidak valid.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rfqIdNum = Number(effectiveRfq.id || effectiveRfq.rfqId);
      if (!rfqIdNum || isNaN(rfqIdNum)) {
        message.error('ID RFQ tidak valid untuk pengiriman evaluasi vendor.');
        return;
      }

      const vendorsPayload = uniqueQuotations.map((q) => ({
        vendorId: Number(q.vendorId),
        offeredAmount: Number(q.totalOfferedAmount),
        isWinner: Number(q.vendorId) === Number(selectedWinnerId),
      }));

      const res = await ProcurementService.submitVendorComparison({
        rfqId: rfqIdNum,
        vendors: vendorsPayload,
        remarks: evaluationNotes.trim() ? evaluationNotes.trim() : undefined,
      });

      const savedComparisons: any[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : [];
      const winnerRecord = savedComparisons.find((c: any) => c.isWinner) || savedComparisons[0];
      const backendComparisonId = winnerRecord?.id ? String(winnerRecord.id) : String(rfqIdNum);
      const comparedAt = winnerRecord?.createdAt
        ? new Date(winnerRecord.createdAt).toISOString()
        : new Date().toISOString();
      const winnerTotalOfferedAmount = Number(winnerRecord?.offeredAmount ?? winnerQuote.totalOfferedAmount);
      const varianceAmount = winnerTotalOfferedAmount - budgetCeiling;

      const result: VendorComparisonResult = {
        comparisonId: backendComparisonId,
        rfqId: rfqIdNum,
        rfqNumber: effectiveRfq.rfqNumber || `RFQ-${rfqIdNum}`,
        prNumber,
        projectId: Number(effectiveRfq.purchaseRequest?.project?.id || effectiveRfq.projectId || (effectiveRfq as any).id || 0),
        projectName: effectiveRfq.purchaseRequest?.project?.name || effectiveRfq.projectName || (effectiveRfq as any).project_name || 'Proyek Tanpa Nama',
        budgetCeiling,
        quotationIds: uniqueQuotations.map((q) => q.quotationId),
        vendorIds: uniqueQuotations.map((q) => q.vendorId),
        selectedWinnerVendorId: Number(winnerRecord?.vendorId ?? winnerQuote.vendorId),
        selectedWinnerVendorCode: winnerQuote.vendorCode,
        selectedWinnerVendorName: winnerQuote.vendorName,
        winnerTotalOfferedAmount,
        winnerLeadTimeDays:
          winnerQuote.leadTimeDays != null && !isNaN(Number(winnerQuote.leadTimeDays)) && Number(winnerQuote.leadTimeDays) > 0
            ? Number(winnerQuote.leadTimeDays)
            : undefined,
        winnerVarianceAmount: varianceAmount,
        evaluationNotes,
        comparedAt,
        comparedBy: currentUserName,
        status: 'EVALUATED',
      };

      await queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
      message.success(`Evaluasi Vendor berhasil disimpan melalui Server SSOT. Pemenang terpilih: ${winnerQuote.vendorName}`);
      onComparisonSaved?.(result);
      onClose();
    } catch (err: any) {
      console.error('Failed to save vendor comparison via Server SSOT:', err);
      const rawMsg = err?.response?.data?.message;
      const errMsg = Array.isArray(rawMsg)
        ? rawMsg.join(', ')
        : (rawMsg || err?.message || 'Gagal menyimpan hasil evaluasi vendor.');
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!effectiveRfq) return null;

  return (
    <Modal
      open={effectiveOpen}
      onCancel={onClose}
      width="min(1180px, 96vw)"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SafetyCertificateOutlined style={{ color: '#059669', fontSize: 16 }} />
            <Text style={{ fontSize: 12 }}>
              {isEvaluated ? (
                <span>
                  Hasil Evaluasi Tersimpan — Pemenang: <strong>{existingComparison?.selectedWinnerVendorName}</strong>
                </span>
              ) : selectedWinnerId ? (
                <span>
                  Vendor Terpilih:{' '}
                  <strong>{uniqueQuotations.find((q) => q.vendorId === selectedWinnerId)?.vendorName}</strong>
                </span>
              ) : (
                <span style={{ color: '#e11d48' }}>Pilih tepat 1 vendor pemenang sebelum menyimpan evaluasi</span>
              )}
            </Text>
          </div>

          <Space size={8}>
            <Button onClick={onClose} style={{ borderRadius: 6 }}>
              {isEvaluated ? 'Tutup' : 'Batal'}
            </Button>
            {isEvaluated && existingComparison && (
              !isPoIssued ? (
                (isProcurement || isSuperAdmin) && (
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => setIsPoModalOpen(true)}
                    style={{
                      backgroundColor: '#059669',
                      borderColor: '#059669',
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    Buat Purchase Order (PO)
                  </Button>
                )
              ) : (
                <Button
                  icon={<EyeOutlined />}
                  onClick={() => setIsPoModalOpen(true)}
                  style={{
                    borderColor: '#0284c7',
                    color: '#0284c7',
                    background: '#f0f9ff',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                >
                  Lihat Purchase Order ({currentPo?.poNumber})
                </Button>
              )
            )}
            {!isEvaluated && (
              <Button
                type="primary"
                loading={isSubmitting}
                disabled={!isEligible || !selectedWinnerId}
                onClick={handleSaveComparison}
                icon={<TrophyOutlined />}
                style={{
                  backgroundColor: isEligible && selectedWinnerId ? '#1d4ed8' : undefined,
                  borderColor: isEligible && selectedWinnerId ? '#1d4ed8' : undefined,
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                Tetapkan Pemenang Evaluasi
              </Button>
            )}
          </Space>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 8, color: '#1d4ed8' }}>
            <SlidersOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Evaluasi & Perbandingan Vendor — {effectiveRfq.rfqNumber}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              Komparasi komersial dan lead time untuk penetapan satu vendor pemenang pengadaan
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Evaluated Result Banner */}
        {isEvaluated && existingComparison && (
          <Alert
            type="success"
            showIcon
            icon={<TrophyOutlined style={{ color: '#059669', fontSize: 18 }} />}
            message={
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                Vendor Comparison Selesai — Pemenang Terpilih: {existingComparison.selectedWinnerVendorName} ({existingComparison.selectedWinnerVendorCode})
              </span>
            }
            description={
              <div style={{ fontSize: 11.5, marginTop: 4 }}>
                Dievaluasi pada {dayjs(existingComparison.comparedAt).format('DD MMMM YYYY HH:mm')} oleh{' '}
                <strong>Rp {existingComparison.winnerTotalOfferedAmount.toLocaleString('id-ID')}</strong> (
                {existingComparison.winnerLeadTimeDays != null &&
                !isNaN(Number(existingComparison.winnerLeadTimeDays)) &&
                Number(existingComparison.winnerLeadTimeDays) > 0
                  ? `Lead Time Vendor: ${existingComparison.winnerLeadTimeDays} hari`
                  : 'Lead Time Vendor: Tidak tersedia'}
                ).
                {isPoIssued && currentPo ? (
                  <div style={{ marginTop: 4, color: '#1d4ed8', fontWeight: 600 }}>
                    Purchase Order ({currentPo.poNumber}) telah diterbitkan kepada {currentPo.vendorName}.
                  </div>
                ) : (
                  <div style={{ marginTop: 4, color: '#047857', fontWeight: 600 }}>
                    Status: EVALUATED — Siap untuk proses penerbitan Purchase Order (PO).
                  </div>
                )}
              </div>
            }
            style={{ borderRadius: 8, border: '1px solid #86efac', background: '#f0fdf4' }}
          />
        )}

        {/* Header Project & Plafon Reference Context */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                {effectiveRfq.purchaseRequest?.project?.name || effectiveRfq.projectName || (effectiveRfq as any).project_name || 'Proyek Tanpa Nama'}
              </div>
              <Space size={4} wrap style={{ marginTop: 2 }}>
                {(effectiveRfq.purchaseRequest?.project?.code || effectiveRfq.projectCode || (effectiveRfq as any).project_code) && (
                  <Tag color="cyan" style={{ fontSize: 10, margin: 0, fontWeight: 700, fontFamily: 'monospace' }}>
                    {effectiveRfq.purchaseRequest?.project?.code || effectiveRfq.projectCode || (effectiveRfq as any).project_code}
                  </Tag>
                )}
                {(effectiveRfq.purchaseRequest?.project?.id || effectiveRfq.projectId || effectiveRfq.id || effectiveRfq.rfqId) && (
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                    Project ID #{effectiveRfq.purchaseRequest?.project?.id || effectiveRfq.projectId || effectiveRfq.id || effectiveRfq.rfqId}
                  </Tag>
                )}
              </Space>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>REFERENSI PR & RFQ:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8' }}>
                {prNumber}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{effectiveRfq.rfqNumber || 'RFQ-N/A'} (Status: {effectiveRfq.status || 'OPEN'})</div>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PLAFON ANGGARAN PR:</Text>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>
                Rp {budgetCeiling.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{itemComparisonRows.length} Item Material / Jasa</div>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PARTICIPATION:</Text>
              <div>
                <Tag color={isEligible ? 'green' : 'volcano'} style={{ fontWeight: 700, fontSize: 11, margin: 0 }}>
                  {validQuotationCount} Vendor Partisipan
                </Tag>
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                {isHighValue
                  ? (isEligible ? 'Memenuhi syarat min. 3 vendor' : 'Kurang dari batas min. 3 vendor')
                  : (isEligible ? 'Memenuhi syarat min. 1 vendor' : 'Belum ada vendor partisipan')}
              </div>
            </Col>
          </Row>
        </div>

        {/* Informational Recommendation Strip */}
        {isEligible && (
          <div style={{ background: '#f0fdf4', padding: '8px 12px', borderRadius: 6, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 11.5, color: '#166534' }}>
                Indikator Rekomendasi Sistem:
              </span>
              {lowestPriceQuotes.length > 0 && (
                <Tag color="green" icon={<DollarCircleOutlined />} style={{ fontSize: 10.5, margin: 0, padding: '2px 6px' }}>
                  {isPriceTie ? (
                    <span>
                      Harga Terendah Sama: <strong>{lowestPriceQuotes.map((q) => q.vendorName).join(', ')}</strong> (Rp {minPrice.toLocaleString('id-ID')})
                    </span>
                  ) : (
                    <span>
                      Harga Terendah: <strong>{lowestPriceQuotes[0].vendorName}</strong> (Rp {minPrice.toLocaleString('id-ID')})
                    </span>
                  )}
                </Tag>
              )}
              {fastestLeadTimeQuotes.length > 0 && isFinite(minLeadTime) && minLeadTime > 0 && (
                <Tag color="blue" icon={<ClockCircleOutlined />} style={{ fontSize: 10.5, margin: 0, padding: '2px 6px' }}>
                  {isLeadTimeTie ? (
                    <span>
                      {fastestLeadTimeQuotes.length === uniqueQuotations.length
                        ? `Lead Time Vendor Sama — ${minLeadTime} hari`
                        : `Lead Time Vendor Tercepat: ${fastestLeadTimeQuotes.map((q) => q.vendorName).join(', ')} (${minLeadTime} hari)`}
                    </span>
                  ) : (
                    <span>
                      Lead Time Vendor Tercepat: <strong>{fastestLeadTimeQuotes[0].vendorName}</strong> ({minLeadTime} hari)
                    </span>
                  )}
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 10.5, color: '#15803d' }}>
              *Rekomendasi bersifat informatif. Keputusan pemenang manual oleh Tim Pengadaan.
            </Text>
          </div>
        )}

        {/* Warning Banner when ineligible */}
        {!isEligible && !isEvaluated && (
          <Alert
            type="warning"
            showIcon
            message={
              isHighValue
                ? `Plafon Anggaran PR > Rp 1.000.000 mewajibkan perbandingan minimal 3 vendor dengan penawaran valid (SUBMITTED). Saat ini terdapat ${validQuotationCount} vendor.`
                : `Evaluasi vendor membutuhkan minimal 1 vendor dengan penawaran valid (SUBMITTED). Saat ini belum ada penawaran valid.`
            }
            style={{ borderRadius: 6 }}
          />
        )}

        {/* SECTION 1: Summary Comparison Table with Winner Selection */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>
              1. Ringkasan Komparasi Penawaran & Penetapan Pemenang (Pilih Tepat 1)
            </span>
            <Tag color="geekblue" style={{ fontSize: 10, margin: 0 }}>
              SINGLE WINNER POLICY
            </Tag>
          </div>
          <Table
            size="small"
            rowKey="vendorId"
            dataSource={uniqueQuotations}
            pagination={false}
            columns={[
              {
                title: 'Pilih Pemenang',
                key: 'selection',
                width: 110,
                align: 'center' as const,
                render: (_: any, q: VendorQuotationRecord) => {
                  const isSelected = selectedWinnerId === q.vendorId;
                  return (
                    <Radio
                      checked={isSelected}
                      disabled={isEvaluated}
                      onChange={() => setSelectedWinnerId(q.vendorId)}
                    >
                      {isSelected ? <strong style={{ color: '#1d4ed8' }}>Pemenang</strong> : 'Pilih'}
                    </Radio>
                  );
                },
              },
              {
                title: 'Vendor Terdaftar',
                key: 'vendor',
                render: (_: any, q: VendorQuotationRecord) => {
                  const isLowest = lowestPriceQuotes.some((l) => l.vendorId === q.vendorId);
                  const isFastest = fastestLeadTimeQuotes.some((f) => f.vendorId === q.vendorId);
                  return (
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{q.vendorName}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                        <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px' }}>
                          {q.vendorCode}
                        </Tag>
                        {isLowest && (
                          <Tag color="green" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                            {isPriceTie ? 'Harga Terendah (Sama)' : 'Harga Terendah'}
                          </Tag>
                        )}
                        {isFastest && (
                          <Tag color="cyan" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                            {isLeadTimeTie ? `Tie Lead Time (${minLeadTime} hari)` : `Tercepat (${minLeadTime} hari)`}
                          </Tag>
                        )}
                      </div>
                    </div>
                  );
                },
              },
              {
                title: 'Total Penawaran',
                dataIndex: 'totalOfferedAmount',
                key: 'totalOfferedAmount',
                width: 170,
                align: 'right' as const,
                render: (val: number) => (
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12.5, color: '#0f172a' }}>
                    Rp {val.toLocaleString('id-ID')}
                  </span>
                ),
              },
              {
                title: 'Penghematan vs Plafon',
                key: 'variance',
                width: 170,
                align: 'right' as const,
                render: (_: any, q: VendorQuotationRecord) => {
                  const diff = budgetCeiling - q.totalOfferedAmount;
                  if (diff > 0) {
                    return (
                      <span style={{ fontWeight: 600, fontSize: 11.5, color: '#059669' }}>
                        Rp {diff.toLocaleString('id-ID')} Hemat
                      </span>
                    );
                  } else if (diff === 0) {
                    return <span style={{ fontSize: 11.5, color: '#64748b' }}>Rp 0</span>;
                  } else {
                    return (
                      <span style={{ fontWeight: 600, fontSize: 11.5, color: '#e11d48' }}>
                        Rp {Math.abs(diff).toLocaleString('id-ID')} Over Budget
                      </span>
                    );
                  }
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
                    return <span style={{ fontWeight: 600 }}>{num} hari</span>;
                  }
                  return <span style={{ color: '#94a3b8', fontSize: 11 }}>Tidak tersedia</span>;
                },
              },
              {
                title: 'Catatan / Syarat Vendor',
                dataIndex: 'vendorNotes',
                key: 'vendorNotes',
                render: (notes: string) => (
                  <span style={{ fontSize: 11, color: '#64748b' }}>{notes || '—'}</span>
                ),
              },
            ]}
          />
        </div>

        {/* SECTION 2: 24 Item-Level Price Breakdown Matrix */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>
              2. Matriks Harga Satuan Per Item ({itemComparisonRows.length} Item Pengadaan)
            </span>
            <Tag color="cyan" style={{ fontSize: 10, margin: 0 }}>
              HIJAU = HARGA PENAWARAN TERENDAH
            </Tag>
          </div>
          <Table
            size="small"
            rowKey="key"
            dataSource={itemComparisonRows}
            pagination={false}
            scroll={{ x: 880 + uniqueQuotations.length * 130, y: 220 }}
            columns={[
              {
                title: 'No',
                key: 'idx',
                width: 40,
                align: 'center' as const,
                render: (_: any, __: any, index: number) => (
                  <span style={{ fontSize: 10.5, color: '#64748b' }}>{index + 1}</span>
                ),
              },
              {
                title: 'Nama Item & Spesifikasi',
                dataIndex: 'itemName',
                key: 'itemName',
                width: 220,
                fixed: 'left' as const,
                render: (name: string, it: any) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11, color: '#0f172a' }}>{name}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 1 }}>
                      <Tag color="blue" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>
                        {it.categoryName}
                      </Tag>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Qty',
                dataIndex: 'quantity',
                key: 'quantity',
                width: 50,
                align: 'center' as const,
                render: (qty: number) => <span style={{ fontWeight: 600 }}>{qty}</span>,
              },
              {
                title: 'Satuan',
                dataIndex: 'uom',
                key: 'uom',
                width: 60,
                align: 'center' as const,
                render: (uom: string) => <span style={{ fontSize: 10.5, color: '#64748b' }}>{uom}</span>,
              },
              {
                title: 'Plafon Unit',
                dataIndex: 'estUnitPrice',
                key: 'estUnitPrice',
                width: 110,
                align: 'right' as const,
                render: (price: number) => (
                  <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#64748b' }}>
                    Rp {price.toLocaleString('id-ID')}
                  </span>
                ),
              },
              // Dynamically inject a column for each participating vendor
              ...uniqueQuotations.map((q) => ({
                title: (
                  <div style={{ textAlign: 'right', fontSize: 10.5 }}>
                    <div><strong>{q.vendorCode}</strong></div>
                    <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 'normal' }}>
                      {q.vendorName.length > 15 ? `${q.vendorName.substring(0, 15)}...` : q.vendorName}
                    </div>
                  </div>
                ),
                key: `vendor_${q.vendorId}`,
                width: 130,
                align: 'right' as const,
                render: (_: any, row: any) => {
                  const price = row.vendorPrices[q.vendorId] || 0;
                  const isLowestInRow = price > 0 && price === row.minPriceInRow;
                  return (
                    <div
                      style={{
                        padding: '2px 4px',
                        borderRadius: 4,
                        background: isLowestInRow ? '#ecfdf5' : 'transparent',
                        fontFamily: 'monospace',
                        fontWeight: isLowestInRow ? 700 : 500,
                        fontSize: 11,
                        color: isLowestInRow ? '#059669' : '#0f172a',
                      }}
                    >
                      Rp {price.toLocaleString('id-ID')}
                    </div>
                  );
                },
              })),
            ]}
          />
        </div>

        {/* SECTION 3: Evaluation Notes */}
        <div>
          <Text style={{ fontWeight: 600, fontSize: 12 }}>
            Catatan / Justifikasi Evaluasi Pengadaan (Opsional):
          </Text>
          <Input.TextArea
            rows={2}
            value={evaluationNotes}
            disabled={isEvaluated}
            onChange={(e) => setEvaluationNotes(e.target.value)}
            placeholder="Contoh: Vendor terpilih memenuhi kriteria teknis spesifikasi terbaik dengan harga hemat dan lead time sesuai target kickoff."
            style={{ marginTop: 4, borderRadius: 6, fontSize: 11.5 }}
          />
        </div>
      </div>

      {/* Purchase Order Modal */}
      {isPoModalOpen && (
        <PurchaseOrderModal
          open={isPoModalOpen}
          onClose={() => setIsPoModalOpen(false)}
          comparison={
            existingComparison
              ? {
                  ...existingComparison,
                  selectedWinnerVendorId: Number(existingComparison.selectedWinnerVendorId),
                }
              : null
          }
          rfq={rfq}
          winningQuotation={
            uniqueQuotations.find(
              (q) =>
                Number(q.vendorId) ===
                Number(
                  existingComparison?.selectedWinnerVendorId || selectedWinnerId
                )
            ) || null
          }
          existingPo={currentPo}
          onPoCreated={(newPo) => {
            setCurrentPo(newPo);
            setPoVersion((v) => v + 1);
            queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'] });
            onPoCreated?.(newPo);
          }}
          currentUserName={currentUserName}
          isProcurement={isProcurement}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </Modal>
  );
};
