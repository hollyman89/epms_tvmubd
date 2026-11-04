"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Divider,
  Alert,
  message,
  Select,
  Card,
} from 'antd';
import {
  ShopOutlined,
  SaveOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { ProcurementService, MasterVendor } from '@/services/procurement.service';
import styles from './VendorQuotationModal.module.css';

const { Text, Title } = Typography;

export interface VendorQuotationItem {
  key: string;
  categoryName: string;
  itemName: string;
  quantity: number;
  uom: string;
  estimatedUnitPrice: number;
  offeredUnitPrice?: number;
  subtotal: number;
  wbsNodeId?: string;
  rabItemKey?: string;
  prItemId?: number;
  routeDetails?: string;
}

export interface VendorQuotationRecord {
  quotationId: string;
  quotationNumber?: string;
  rfqId: string | number;
  rfqNumber: string;
  projectId: string | number;
  projectName: string;
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  budgetCeiling: number;
  totalOfferedAmount: number;
  leadTimeDays?: number;
  vendorNotes?: string;
  status: 'SUBMITTED';
  submittedAt: string;
  items: VendorQuotationItem[];
}

export interface VendorQuotationModalProps {
  open: boolean;
  onClose: () => void;
  rfq: any | null;
  existingQuotation?: VendorQuotationRecord | null;
  existingQuotations?: VendorQuotationRecord[];
  onQuotationSaved?: (quotation: VendorQuotationRecord) => void;
  currentUserName?: string;
}

export const VendorQuotationModal: React.FC<VendorQuotationModalProps> = ({
  open,
  onClose,
  rfq,
  existingQuotation,
  existingQuotations = [],
  onQuotationSaved,
  currentUserName = 'Procurement Team',
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [selectedVendorId, setSelectedVendorId] = useState<number | undefined>(undefined);
  const [offeredPrices, setOfferedPrices] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [masterVendors, setMasterVendors] = useState<MasterVendor[]>([]);

  // RFQ Status and Expiry determinations
  const isRfqExpired = Boolean(
    rfq?.closingDate && dayjs().isAfter(dayjs(rfq.closingDate).endOf('day'))
  );
  const isRfqNotOpen = rfq?.status !== 'OPEN';
  const isExistingQuote = Boolean(existingQuotation);
  const isSelectedVendorSubmitted = Boolean(
    selectedVendorId && existingQuotations.some((q) => Number(q.vendorId) === Number(selectedVendorId))
  );

  // Authoritative read-only mode: existing quotation, non-OPEN RFQ, expired RFQ, or submitted vendor
  const isReadOnly = isExistingQuote || isRfqNotOpen || isRfqExpired || isSelectedVendorSubmitted;

  // Authoritative quotation number display
  const displayQuotationNumber = useMemo(() => {
    if (existingQuotation?.quotationNumber) return existingQuotation.quotationNumber;
    if (existingQuotation?.quotationId && String(existingQuotation.quotationId).startsWith('QT-')) {
      return existingQuotation.quotationId;
    }
    if (selectedVendorId) {
      const found = existingQuotations.find((q) => Number(q.vendorId) === Number(selectedVendorId));
      if (found?.quotationNumber) return found.quotationNumber;
      if (found?.quotationId && String(found.quotationId).startsWith('QT-')) return found.quotationId;
    }
    return undefined;
  }, [existingQuotation, selectedVendorId, existingQuotations]);

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

  // Initialize data when modal opens or existingQuotation changes
  useEffect(() => {
    if (!open || !rfq) return;

    if (existingQuotation) {
      const existingVendorId = Number(existingQuotation.vendorId);
      setSelectedVendorId(existingVendorId);
      form.setFieldsValue({
        vendorId: existingVendorId,
        leadTimeDays: existingQuotation.leadTimeDays || 14,
        vendorNotes: existingQuotation.vendorNotes || '',
      });
      const initialPrices: Record<string, number> = {};
      existingQuotation.items.forEach((it, idx) => {
        const prId = it.prItemId || (it as any).id;
        const directKey = it.key;
        const prKey = prId ? `item_pr_${prId}` : undefined;
        const nameKey = it.itemName ? `name_${it.itemName}` : undefined;
        const price = it.offeredUnitPrice !== undefined ? it.offeredUnitPrice : (it as any).unitPrice;
        if (directKey) initialPrices[directKey] = price;
        if (prKey) initialPrices[prKey] = price;
        if (nameKey) initialPrices[nameKey] = price;
        initialPrices[`item_${idx}`] = price;
      });
      setOfferedPrices(initialPrices);
    } else {
      setSelectedVendorId(undefined);
      form.resetFields();
      form.setFieldsValue({
        leadTimeDays: 14,
      });
      // Master Business Rule: PR estimated prices are read-only benchmarks.
      // Quotation BARU membuka field harga vendor dalam keadaan kosong / undefined (BUKAN prefill estimatedUnitPrice).
      setOfferedPrices({});
    }
  }, [open, rfq, existingQuotation, form]);

  // Handle vendor selection change
  const handleVendorSelect = (vendorId: number) => {
    const numericVendorId = Number(vendorId);
    setSelectedVendorId(numericVendorId);
    const found = existingQuotations.find((q) => Number(q.vendorId) === numericVendorId);
    if (found) {
      message.warning(`Vendor ${found.vendorName} sudah mengajukan penawaran. Penawaran vendor bersifat final dan terkunci.`);
    } else {
      setOfferedPrices({});
    }
  };

  // Canonical Items Snapshot from RFQ Scope / Approved PR
  const rawRfqItems = useMemo(() => {
    if (Array.isArray(rfq?.items) && rfq.items.length > 0) return rfq.items;
    if (Array.isArray(rfq?.purchaseRequest?.items) && rfq.purchaseRequest.items.length > 0) return rfq.purchaseRequest.items;
    return [];
  }, [rfq]);

  const itemsSnapshot: VendorQuotationItem[] = useMemo(() => {
    // If existing quotation is being viewed, display authoritative stored item values
    if (existingQuotation && Array.isArray(existingQuotation.items) && existingQuotation.items.length > 0) {
      return existingQuotation.items.map((it: any, idx: number) => {
        const prItemId = Number(it.prItemId || it.id || 0) || undefined;
        const key = it.key || it.rabItemKey || (prItemId ? `item_pr_${prItemId}` : `item_${idx}`);
        const quantity = Number(it.quantity || 1);
        const estimatedUnitPrice = Number(it.estimatedUnitPrice || 0);
        const offeredUnitPrice = it.offeredUnitPrice !== undefined ? Number(it.offeredUnitPrice) : Number(it.unitPrice || 0);
        const subtotal = it.subtotal !== undefined ? Number(it.subtotal) : (offeredUnitPrice * quantity);
        const routeDetails =
          it.routeDetails ||
          it.route_details ||
          it.rute ||
          it.description ||
          it.specifications ||
          undefined;

        return {
          key,
          categoryName: it.categoryName || 'Material & Peralatan',
          itemName: it.itemName || 'Item Pengadaan',
          quantity,
          uom: it.uom || 'Unit',
          estimatedUnitPrice,
          offeredUnitPrice,
          subtotal,
          wbsNodeId: it.wbsNodeId,
          rabItemKey: it.rabItemKey,
          prItemId,
          routeDetails,
        };
      });
    }

    if (!rawRfqItems || rawRfqItems.length === 0) return [];
    return rawRfqItems.map((it: any, idx: number) => {
      const prItemId = Number(it.prItemId || it.id || rfq.purchaseRequest?.items?.[idx]?.id || 0) || undefined;
      const key = it.rabItemKey || (prItemId ? `item_pr_${prItemId}` : it.key || `item_${idx}`);
      const quantity = Number(it.quantity || 1);
      const estimatedUnitPrice = Number(it.estimatedUnitPrice || it.estimated_unit_price || it.unitPrice || 0);
      const prItem = rfq.purchaseRequest?.items?.[idx] || rfq.items?.[idx];
      const routeDetails =
        it.routeDetails ||
        it.route_details ||
        it.rute ||
        it.description ||
        it.specifications ||
        prItem?.routeDetails ||
        prItem?.route_details ||
        prItem?.rute ||
        prItem?.description ||
        prItem?.specifications ||
        undefined;

      // Read vendor offered price strictly from state (DO NOT fallback to estimatedUnitPrice!)
      const offeredVal =
        offeredPrices[key] !== undefined
          ? offeredPrices[key]
          : prItemId && offeredPrices[`item_pr_${prItemId}`] !== undefined
          ? offeredPrices[`item_pr_${prItemId}`]
          : it.itemName && offeredPrices[`name_${it.itemName}`] !== undefined
          ? offeredPrices[`name_${it.itemName}`]
          : offeredPrices[`item_${idx}`];

      const offeredUnitPrice =
        offeredVal !== undefined && offeredVal !== null && !isNaN(Number(offeredVal))
          ? Number(offeredVal)
          : undefined;

      const subtotal = offeredUnitPrice !== undefined && offeredUnitPrice > 0 ? quantity * offeredUnitPrice : 0;

      return {
        key,
        categoryName: it.categoryName || 'Material & Peralatan',
        itemName: it.itemName || it.item_name || 'Item Pengadaan',
        quantity,
        uom: it.uom || 'Unit',
        estimatedUnitPrice,
        offeredUnitPrice,
        subtotal,
        wbsNodeId: it.wbsNodeId,
        rabItemKey: it.rabItemKey,
        prItemId,
        routeDetails,
      };
    });
  }, [rawRfqItems, offeredPrices, rfq, existingQuotation]);

  const totalBudgetCeiling = useMemo(() => {
    return (
      Number(rfq?.totalAmount || 0) ||
      Number(rfq?.budgetCeiling || 0) ||
      Number(rfq?.purchaseRequest?.totalEstimatedAmount || 0) ||
      Number((rfq?.purchaseRequest as any)?.total_estimated_amount || 0) ||
      itemsSnapshot.reduce((sum, it) => sum + (it.quantity * it.estimatedUnitPrice), 0)
    );
  }, [rfq, itemsSnapshot]);

  const totalOfferedAmount = useMemo(() => {
    if (existingQuotation && existingQuotation.totalOfferedAmount !== undefined && !isNaN(Number(existingQuotation.totalOfferedAmount))) {
      return Number(existingQuotation.totalOfferedAmount);
    }
    return itemsSnapshot.reduce((sum, it) => sum + it.subtotal, 0);
  }, [existingQuotation, itemsSnapshot]);

  const priceVariance = totalOfferedAmount - totalBudgetCeiling;
  const isOverBudget = priceVariance > 0;

  const handlePriceChange = (key: string, val: number | null) => {
    if (isReadOnly) return;
    setOfferedPrices((prev) => ({
      ...prev,
      [key]: val !== null && val !== undefined && !isNaN(Number(val)) ? Math.max(0, Number(val)) : undefined,
    }));
  };

  const handleSubmit = async (values: any) => {
    if (!rfq) {
      message.error('Data RFQ tidak ditemukan.');
      return;
    }

    // 0. Immutability Guard
    if (isReadOnly) {
      message.warning('Penawaran ini bersifat read-only dan tidak dapat diubah.');
      return;
    }

    // 1. RFQ Status & Closing Date Guard
    if (rfq.status !== 'OPEN') {
      message.error('Penawaran hanya dapat dimasukkan untuk RFQ dengan status OPEN.');
      return;
    }

    if (rfq.closingDate && dayjs().isAfter(dayjs(rfq.closingDate).endOf('day'))) {
      message.error('Batas waktu penawaran (Closing Date) RFQ telah berakhir.');
      return;
    }

    // 2. Vendor Selection Validation
    const numericVendorId = Number(values.vendorId);
    const vendor = masterVendors.find((v) => Number(v.id) === numericVendorId);
    if (!vendor || isNaN(numericVendorId) || numericVendorId <= 0) {
      message.error('Vendor harus dipilih dari master vendor.');
      return;
    }

    // Duplicate check in frontend session
    if (existingQuotations.some((q) => Number(q.vendorId) === numericVendorId)) {
      message.error('Vendor ini telah mengajukan penawaran sebelumnya. Penawaran vendor tidak dapat diubah.');
      return;
    }

    // 3. Item Price Validation (All items must have actual vendor offer price > 0)
    const invalidItems = itemsSnapshot.filter(
      (it) =>
        it.offeredUnitPrice === undefined ||
        it.offeredUnitPrice === null ||
        isNaN(it.offeredUnitPrice) ||
        it.offeredUnitPrice <= 0,
    );
    if (invalidItems.length > 0) {
      message.error(
        `Semua ${itemsSnapshot.length} item penawaran wajib memiliki harga penawaran aktual > Rp 0 (${invalidItems.length} item belum diisi).`,
      );
      return;
    }

    if (totalOfferedAmount <= 0) {
      message.error('Total penawaran vendor harus lebih besar dari Rp 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rfqIdNum = Number(rfq.id || rfq.rfqId);
      if (!rfqIdNum || isNaN(rfqIdNum) || rfqIdNum <= 0) {
        message.error('ID RFQ tidak valid untuk menyimpan penawaran.');
        return;
      }

      const vendorIdNum = Number(vendor.id || numericVendorId);
      if (!vendorIdNum || isNaN(vendorIdNum) || vendorIdNum <= 0) {
        message.error('ID Vendor tidak valid.');
        return;
      }

      const payload = {
        rfqId: rfqIdNum,
        vendorId: vendorIdNum,
        leadTimeDays: Number(values.leadTimeDays || 14),
        notes: values.vendorNotes || '',
        items: itemsSnapshot.map((it, idx) => {
          const prItemId = Number(it.prItemId || rfq.items?.[idx]?.id || rfq.purchaseRequest?.items?.[idx]?.id || (idx + 1));
          return {
            prItemId: Number(prItemId),
            itemName: it.itemName,
            quantity: Number(it.quantity),
            uom: it.uom,
            unitPrice: Number(it.offeredUnitPrice || 0),
          };
        }),
      };

      const res = await ProcurementService.createQuotation(payload);
      const savedQuotation = (res as any)?.data || res;

      if (!savedQuotation || !savedQuotation.id) {
        throw new Error('Gagal mendapatkan respon penawaran authoritative dari server.');
      }

      // Invalidate queries in React Query to guarantee SSOT sync across all components
      try {
        queryClient.invalidateQueries({ queryKey: ['quotations', rfqIdNum] });
        queryClient.invalidateQueries({ queryKey: ['rfqs'] });
        queryClient.invalidateQueries({ queryKey: ['rfq', rfqIdNum] });
      } catch (qErr) {
        console.warn('React Query cache invalidation skipped:', qErr);
      }

      const quotationRecord: VendorQuotationRecord = {
        quotationId: String(savedQuotation.id),
        quotationNumber: savedQuotation.quotationNumber,
        rfqId: rfqIdNum,
        rfqNumber: savedQuotation?.rfq?.rfqNumber || rfq.rfqNumber || 'RFQ-N/A',
        projectId: Number(rfq.purchaseRequest?.project?.id || rfq.projectId || (rfq as any).id || 0),
        projectName: rfq.purchaseRequest?.project?.name || rfq.projectName || (rfq as any).project_name || 'Proyek Tanpa Nama',
        vendorId: vendor.id,
        vendorCode: vendor.code,
        vendorName: vendor.name,
        budgetCeiling: totalBudgetCeiling,
        totalOfferedAmount: Number(savedQuotation.totalAmount),
        leadTimeDays: Number(savedQuotation.leadTimeDays || values.leadTimeDays || 14),
        vendorNotes: savedQuotation.notes || values.vendorNotes || '',
        status: 'SUBMITTED',
        submittedAt: savedQuotation.createdAt || new Date().toISOString(),
        items: itemsSnapshot,
      };

      message.success(`Penawaran resmi (${savedQuotation.quotationNumber}) dari ${vendor.name} berhasil disimpan ke Database SSOT!`);
      onQuotationSaved?.(quotationRecord);
      onClose();
    } catch (err: any) {
      console.error('Failed to save vendor quotation via Server SSOT:', err);
      const backendMsg = err.response?.data?.message || err.message || 'Gagal menyimpan penawaran vendor.';
      message.error(backendMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!rfq) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width="min(1040px, 96vw)"
      className={styles.quotationModal}
      rootClassName={styles.quotationModal}
      style={{ maxWidth: '100vw', top: 20 }}
      centered
      destroyOnClose
      data-testid="vendor-quotation-modal"
      footer={
        <div className={styles.footerContainer} data-testid="quotation-footer">
          <div className={styles.footerLeft}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Plafon: <strong>Rp {totalBudgetCeiling.toLocaleString('id-ID')}</strong>
            </Text>
            <Divider type="vertical" />
            <Text
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: totalOfferedAmount > 0 ? (isOverBudget ? '#e11d48' : '#059669') : '#64748b',
              }}
            >
              Total Penawaran: Rp {totalOfferedAmount.toLocaleString('id-ID')}
            </Text>
            {totalOfferedAmount > 0 &&
              (isOverBudget ? (
                <Tag color="volcano" style={{ fontSize: 10.5, margin: 0 }}>
                  + Rp {priceVariance.toLocaleString('id-ID')} Di Atas Plafon
                </Tag>
              ) : (
                <Tag color="success" style={{ fontSize: 10.5, margin: 0 }}>
                  - Rp {Math.abs(priceVariance).toLocaleString('id-ID')} Lebih Hemat
                </Tag>
              ))}
          </div>

          <div className={styles.footerRight}>
            {/* Contextual Status Badge in Footer */}
            {rfq.status === 'CLOSED' ? (
              <Tag color="default" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, margin: 0 }}>
                RFQ Ditutup (Read-Only)
              </Tag>
            ) : rfq.status === 'CANCELLED' ? (
              <Tag color="error" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, margin: 0 }}>
                RFQ Dibatalkan (Read-Only)
              </Tag>
            ) : rfq.status === 'EVALUATED' ? (
              <Tag color="purple" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, margin: 0 }}>
                RFQ Sudah Dievaluasi (Read-Only)
              </Tag>
            ) : isRfqExpired ? (
              <Tag color="warning" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, margin: 0 }}>
                Batas Waktu Berakhir (Read-Only)
              </Tag>
            ) : (isExistingQuote || isSelectedVendorSubmitted) ? (
              <Tag color="blue" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, margin: 0 }}>
                Penawaran Terkunci (Read-Only)
              </Tag>
            ) : rfq.status !== 'OPEN' ? (
              <Tag color="default" style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, margin: 0 }}>
                RFQ Non-Aktif (Read-Only)
              </Tag>
            ) : null}

            {/* Read-Only Mode: Show Tutup button only; Normal Open RFQ: Show Batal & Simpan */}
            <Button
              onClick={onClose}
              type={isReadOnly ? 'primary' : 'default'}
              style={{ borderRadius: 6 }}
              data-testid="btn-cancel-quotation"
            >
              {isReadOnly ? 'Tutup' : 'Batal'}
            </Button>

            {!isReadOnly && rfq.status === 'OPEN' && !isRfqExpired && (
              <Button
                type="primary"
                loading={isSubmitting}
                onClick={() => form.submit()}
                icon={<SaveOutlined />}
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
                data-testid="btn-submit-quotation"
              >
                Simpan Penawaran Vendor
              </Button>
            )}
          </div>
        </div>
      }
      title={
        <div className={styles.headerContainer}>
          <div
            className={`${styles.headerIcon} ${
              isReadOnly ? styles.headerIconReadOnly : styles.headerIconEditable
            }`}
          >
            <ShopOutlined style={{ fontSize: 18 }} />
          </div>
          <div className={styles.headerTextGroup}>
            <div className={styles.headerTitle}>
              {isExistingQuote || isSelectedVendorSubmitted
                ? `Detail Penawaran Vendor — ${displayQuotationNumber || rfq.rfqNumber}`
                : `Input Penawaran Vendor — ${rfq.rfqNumber}`}
            </div>
            <span className={styles.headerSubtitle}>
              {isReadOnly
                ? `Penawaran resmi terkunci dari vendor (${itemsSnapshot.length} item)`
                : `Pencatatan harga penawaran resmi dari vendor untuk paket pengadaan (${itemsSnapshot.length} item)`}
            </span>
          </div>
        </div>
      }
    >
      <div className={styles.modalBody} data-testid="quotation-modal-body">
        {/* Read-Only Informational Banner for Existing Quotation */}
        {(isExistingQuote || isSelectedVendorSubmitted) && (
          <Alert
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined style={{ color: '#0284c7' }} />}
            message={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span>
                  <strong>Penawaran Resmi Terkunci (Read-Only)</strong>
                  {displayQuotationNumber && (
                    <span style={{ marginLeft: 8 }}>
                      No: <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{displayQuotationNumber}</Tag>
                    </span>
                  )}
                </span>
                <Space size={6}>
                  <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>
                    ● SUBMITTED
                  </Tag>
                  <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
                    Imutabel (Tidak Dapat Diedit)
                  </Tag>
                </Space>
              </div>
            }
            description="Penawaran vendor yang telah dikirimkan tersimpan secara permanen dan tidak dapat diubah kembali demi menjaga integritas proses pengadaan."
            style={{ borderRadius: 8, background: '#f0f9ff', borderColor: '#bae6fd' }}
          />
        )}

        {/* Informational Banner for Non-OPEN RFQ Status */}
        {rfq.status !== 'OPEN' && (
          <Alert
            type={rfq.status === 'CANCELLED' ? 'error' : rfq.status === 'EVALUATED' ? 'info' : 'warning'}
            showIcon
            message={
              <strong>
                {rfq.status === 'CLOSED'
                  ? 'RFQ Ditutup (Read-Only)'
                  : rfq.status === 'CANCELLED'
                  ? 'RFQ Dibatalkan (Read-Only)'
                  : rfq.status === 'EVALUATED'
                  ? 'RFQ Sudah Dievaluasi (Read-Only)'
                  : `RFQ ${rfq.status} (Read-Only)`}
              </strong>
            }
            description={
              rfq.status === 'CLOSED'
                ? 'RFQ telah ditutup. Pengajuan penawaran baru tidak lagi diizinkan.'
                : rfq.status === 'CANCELLED'
                ? 'RFQ telah dibatalkan. Pengajuan penawaran baru tidak diizinkan.'
                : rfq.status === 'EVALUATED'
                ? 'RFQ telah dievaluasi. Data penawaran bersifat historis dan terkunci.'
                : 'Status RFQ saat ini tidak mengizinkan pengajuan penawaran baru.'
            }
            style={{ borderRadius: 8 }}
          />
        )}

        {/* Informational Banner for Expired RFQ */}
        {rfq.status === 'OPEN' && isRfqExpired && (
          <Alert
            type="warning"
            showIcon
            message={<strong>Batas Waktu Penawaran Telah Berakhir (Read-Only)</strong>}
            description={`Batas waktu penawaran (Closing Date: ${dayjs(rfq.closingDate).format('DD MMM YYYY')}) telah terlewati. Penawaran baru tidak dapat diajukan.`}
            style={{ borderRadius: 8 }}
          />
        )}

        {/* RFQ Reference & Plafon Strip */}
        <div className={styles.referenceStrip}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={8}>
              <div className={styles.referenceLabel}>PROYEK:</div>
              <div className={styles.referenceValue}>
                {rfq.purchaseRequest?.project?.name || rfq.projectName || (rfq as any).project_name || 'Proyek Tanpa Nama'}
              </div>
              <Space size={4} wrap style={{ marginTop: 2 }}>
                {(rfq.purchaseRequest?.project?.code || rfq.projectCode || (rfq as any).project_code) && (
                  <Tag color="cyan" style={{ fontSize: 10, margin: 0, fontWeight: 700, fontFamily: 'monospace' }}>
                    {rfq.purchaseRequest?.project?.code || rfq.projectCode || (rfq as any).project_code}
                  </Tag>
                )}
                {(rfq.purchaseRequest?.project?.id || rfq.projectId || rfq.id || rfq.rfqId) && (
                  <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                    Project ID #{rfq.purchaseRequest?.project?.id || rfq.projectId || rfq.id || rfq.rfqId}
                  </Tag>
                )}
              </Space>
            </Col>
            <Col xs={24} sm={8}>
              <div className={styles.referenceLabel}>REFERENSI RFQ:</div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8' }}>
                {rfq.rfqNumber || 'RFQ-20260826-001'}
              </div>
              <Tag
                color={
                  rfq.status === 'EVALUATED'
                    ? 'purple'
                    : rfq.status === 'CANCELLED'
                    ? 'error'
                    : rfq.status === 'CLOSED'
                    ? 'default'
                    : isRfqExpired
                    ? 'warning'
                    : 'green'
                }
                style={{ fontSize: 10, fontWeight: 700, margin: 0, marginTop: 2 }}
              >
                ● {rfq.status} (Batas: {rfq.closingDate ? dayjs(rfq.closingDate).format('DD MMM YYYY') : '—'})
              </Tag>
            </Col>
            <Col xs={24} sm={8}>
              <div className={styles.referenceLabel}>PLAFON ANGGARAN PR:</div>
              <div className={styles.plafonValue}>
                Rp {totalBudgetCeiling.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b' }}>{itemsSnapshot.length} Item Material / Jasa</div>
            </Col>
          </Row>
        </div>

        {/* Vendor Selection & Terms Form */}
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={[12, 8]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Pilih Vendor Terdaftar (Master Vendor)</span>}
                name="vendorId"
                rules={[{ required: true, message: 'Vendor wajib dipilih' }]}
              >
                <Select
                  placeholder="Pilih vendor dari direktori master..."
                  onChange={handleVendorSelect}
                  disabled={isReadOnly}
                  style={{ width: '100%', borderRadius: 6 }}
                  options={masterVendors.map((v) => {
                    const numericId = Number(v.id);
                    const isSubmitted = existingQuotations.some((q) => Number(q.vendorId) === numericId || q.vendorCode === v.code);
                    return {
                      value: numericId,
                      disabled: isSubmitted,
                      label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <strong>{v.code}</strong> — {v.name}
                            {isSubmitted && (
                              <Tag color="default" style={{ fontSize: 9.5, margin: '0 0 0 6px', padding: '0 4px' }}>
                                Sudah Mengajukan
                              </Tag>
                            )}
                          </span>
                          <Tag color="cyan" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                            {v.vendorType}
                          </Tag>
                        </div>
                      ),
                    };
                  })}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Waktu Pengiriman (Lead Time)</span>}
                name="leadTimeDays"
                rules={[{ required: true, message: 'Lead time wajib diisi' }]}
              >
                <InputNumber
                  min={1}
                  max={180}
                  addonAfter="Hari"
                  disabled={isReadOnly}
                  style={{ width: '100%', borderRadius: 6 }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan / Syarat Vendor</span>}
                name="vendorNotes"
              >
                <Input
                  placeholder={isReadOnly ? '—' : 'Franco Gudang Proyek, Garansi 1 Thn'}
                  disabled={isReadOnly}
                  style={{ borderRadius: 6, fontSize: 11.5 }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {/* Item Section Wrapper */}
        <div className={styles.itemSectionWrapper}>
          <div className={styles.itemSectionHeader}>
            <span className={styles.itemSectionTitle}>
              Daftar {itemsSnapshot.length} Item Penawaran Harga Satuan
            </span>
            <Tag color={isReadOnly ? 'default' : 'blue'} style={{ fontSize: 10.5, margin: 0 }}>
              {isReadOnly ? 'SELURUH DATA TERKUNCI (READ-ONLY)' : 'QTY & SPESIFIKASI TERKUNCI (READ-ONLY)'}
            </Tag>
          </div>

          {/* Desktop Table View (min-width: 641px) */}
          <div className={styles.desktopTableView} data-testid="quotation-desktop-table">
            <div className={styles.tableContainer}>
              <Table
                size="small"
                rowKey="key"
                dataSource={itemsSnapshot}
                pagination={false}
                scroll={{ x: 860, y: 320 }}
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
                    title: 'Nama Item & Spesifikasi',
                    dataIndex: 'itemName',
                    key: 'itemName',
                    width: 220,
                    render: (name: string, it: VendorQuotationItem) => (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>{name}</div>
                        {it.routeDetails && (
                          <div className={styles.desktopRouteDetails}>{it.routeDetails}</div>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          <Tag color="blue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px' }}>
                            {it.categoryName}
                          </Tag>
                          {it.wbsNodeId && (
                            <Tag color="geekblue" style={{ fontSize: 9.5, margin: 0, padding: '0 4px' }}>
                              {`WBS #${it.wbsNodeId}`}
                            </Tag>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Qty',
                    dataIndex: 'quantity',
                    key: 'quantity',
                    width: 65,
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
                    title: 'Estimasi Plafon Unit (Benchmark)',
                    dataIndex: 'estimatedUnitPrice',
                    key: 'estimatedUnitPrice',
                    width: 170,
                    align: 'right' as const,
                    render: (price: number) => (
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                        Rp {price.toLocaleString('id-ID')}
                      </span>
                    ),
                  },
                  {
                    title: 'Harga Penawaran Aktual Vendor (Rp)',
                    key: 'offeredUnitPrice',
                    width: 210,
                    align: 'right' as const,
                    render: (_: any, it: VendorQuotationItem) => (
                      <InputNumber
                        min={0}
                        step={1000}
                        disabled={isReadOnly}
                        placeholder={isReadOnly ? '—' : 'Masukkan harga penawaran'}
                        value={it.offeredUnitPrice}
                        onChange={(val) => handlePriceChange(it.key, val)}
                        formatter={(value) =>
                          value !== undefined && value !== null
                            ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                            : ''
                        }
                        parser={(value) => (value ? Number(String(value).replace(/[^0-9]/g, '')) : 0)}
                        style={{ width: '100%', borderRadius: 4, fontWeight: 600, fontSize: 11.5 }}
                      />
                    ),
                  },
                  {
                    title: 'Subtotal Penawaran',
                    dataIndex: 'subtotal',
                    key: 'subtotal',
                    width: 160,
                    align: 'right' as const,
                    render: (subtotal: number, it: VendorQuotationItem) => {
                      if (it.offeredUnitPrice === undefined || it.offeredUnitPrice <= 0) {
                        return (
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                              Belum diisi
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, color: '#0f172a' }}>
                            Rp {subtotal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
          </div>

          {/* Mobile Card View (max-width: 640px) */}
          <div className={styles.mobileCardView} data-testid="quotation-mobile-card-view">
            {itemsSnapshot.map((item, idx) => {
              const benchmarkSubtotal = item.quantity * item.estimatedUnitPrice;
              const hasOfferedPrice = item.offeredUnitPrice !== undefined && item.offeredUnitPrice > 0;
              const itemVariance = hasOfferedPrice ? item.subtotal - benchmarkSubtotal : 0;
              const isItemOver = itemVariance > 0;

              return (
                <div
                  key={item.key || idx}
                  className={styles.quotationItemCard}
                  data-testid="quotation-item-card"
                >
                  {/* Card Header */}
                  <div className={styles.cardHeader}>
                    <span className={styles.itemIndexBadge}>#{idx + 1}</span>
                    <div className={styles.cardTitleGroup}>
                      <div className={styles.itemTitle} data-testid="quotation-item-title">
                        {item.itemName}
                      </div>
                      {item.routeDetails && (
                        <div className={styles.routeDetails} data-testid="quotation-route-details">
                          {item.routeDetails}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category & WBS tags */}
                  <div className={styles.cardCategoryRow}>
                    <Tag color="blue" style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>
                      {item.categoryName}
                    </Tag>
                    {item.wbsNodeId && (
                      <Tag color="geekblue" style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>
                        {`WBS #${item.wbsNodeId}`}
                      </Tag>
                    )}
                    <Tag color="default" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', color: '#64748b' }}>
                      Snapshot Terkunci
                    </Tag>
                  </div>

                  {/* Read-only Snapshot Grid */}
                  <div className={styles.snapshotGrid}>
                    <div className={styles.snapshotField}>
                      <span className={styles.fieldLabel}>Volume / Qty</span>
                      <span className={styles.fieldValue}>
                        {item.quantity} <span style={{ fontWeight: 400, color: '#64748b' }}>{item.uom}</span>
                      </span>
                    </div>
                    <div className={styles.snapshotField}>
                      <span className={styles.fieldLabel}>Plafon Satuan (Benchmark)</span>
                      <span
                        className={styles.fieldValue}
                        style={{ fontFamily: 'monospace' }}
                        data-testid="quotation-benchmark-price"
                      >
                        Rp {item.estimatedUnitPrice.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className={styles.snapshotFieldFull}>
                      <span className={styles.fieldLabel}>Total Plafon Item</span>
                      <span className={styles.fieldValueHighlight}>
                        Rp {benchmarkSubtotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Vendor Quotation Input Box */}
                  <div
                    className={`${styles.quotationInputBox} ${
                      hasOfferedPrice ? styles.quotationInputBoxActive : ''
                    }`}
                  >
                    <div className={styles.inputLabelRow}>
                      <span className={styles.inputLabel}>
                        <DollarCircleOutlined style={{ color: '#4f46e5' }} />
                        Harga Penawaran Aktual Vendor (Rp)
                      </span>
                      {hasOfferedPrice && (
                        itemVariance === 0 ? (
                          <Tag color="cyan" style={{ fontSize: 9.5, margin: 0 }}>
                            Sesuai Plafon
                          </Tag>
                        ) : isItemOver ? (
                          <Tag color="volcano" style={{ fontSize: 9.5, margin: 0 }}>
                            + Rp {itemVariance.toLocaleString('id-ID')} Di Atas Plafon
                          </Tag>
                        ) : (
                          <Tag color="success" style={{ fontSize: 9.5, margin: 0 }}>
                            - Rp {Math.abs(itemVariance).toLocaleString('id-ID')} Lebih Hemat
                          </Tag>
                        )
                      )}
                    </div>

                    <InputNumber
                      min={0}
                      step={1000}
                      disabled={isReadOnly}
                      placeholder={isReadOnly ? '—' : 'Masukkan harga satuan vendor'}
                      value={item.offeredUnitPrice}
                      onChange={(val) => handlePriceChange(item.key, val)}
                      formatter={(value) =>
                        value !== undefined && value !== null
                          ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                          : ''
                      }
                      parser={(value) => (value ? Number(String(value).replace(/[^0-9]/g, '')) : 0)}
                      data-testid="quotation-price-input"
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 13,
                        borderColor: hasOfferedPrice ? '#6366f1' : '#d1d5db',
                      }}
                    />

                    <div className={styles.quotedSubtotalRow}>
                      <span className={styles.subtotalLabel}>Subtotal Penawaran</span>
                      {hasOfferedPrice ? (
                        <span
                          className={styles.subtotalValue}
                          data-testid="quotation-subtotal"
                        >
                          Rp {item.subtotal.toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span
                          className={styles.subtotalValueEmpty}
                          data-testid="quotation-subtotal"
                        >
                          Belum diisi
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
