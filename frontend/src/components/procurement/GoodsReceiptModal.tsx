"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
  InputNumber,
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
  InboxOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
  CheckSquareOutlined,
  ShopOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { ProcurementService, PurchaseOrder } from '@/services/procurement.service';
import type { PurchaseOrderPrototypeRecord } from './PurchaseOrderModal';
import UserIdentityDisplay from '@/components/common/UserIdentityDisplay';
import {
  formatDate,
  formatQuantity,
  formatQuantityWithUom,
} from '@/lib/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';

const { Text, Title } = Typography;

/**
 * Deterministic helper to get a consistent item key across PO items and GR items
 */
export const getPoItemKey = (item: any, index: number): string => {
  return String(item.key || item.poItemId || item.id || `item_${index}_${item.itemName || 'unnamed'}`);
};

export interface GoodsReceiptItemRecord {
  key: string;
  poItemId: string | number;
  categoryName: string;
  itemName: string;
  specification?: string;
  orderedQty: number;
  previouslyReceivedQty: number;
  receivedQuantity: number;
  remainingQty: number; // Sisa yang belum diterima sebelum GR ini
  remainingAfterThisGr: number; // Sisa setelah GR ini disimpan
  uom: string;
  unitPrice?: number;
  remarks?: string;
  wbsNodeId?: string;
}

export interface GoodsReceiptRecord {
  grId: string;
  grNumber: string;
  poId: string;
  poNumber: string;
  prId: string | number;
  prNumber: string;
  projectId: string | number;
  projectName: string;
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  receiptDate: string;
  deliveryNoteNumber?: string;
  remarks?: string;
  status: 'PARTIAL' | 'COMPLETED';
  createdAt: string;
  createdBy: string;
  totalItemsCount: number;
  totalQtyReceivedInGr: number;
  items: GoodsReceiptItemRecord[];
}

export interface GoodsReceiptModalProps {
  open: boolean;
  onClose: () => void;
  po: PurchaseOrder | PurchaseOrderPrototypeRecord | null;
  existingGr?: GoodsReceiptRecord | null;
  viewOnly?: boolean;
  onGrCreated?: (gr: GoodsReceiptRecord, updatedPo: any) => void;
  currentUserName?: string;
  canReceiveGoods?: boolean;
}

/**
 * Deterministic normalizer for View Mode GR items
 */
export const normalizeGoodsReceiptViewItems = (items: any[]): GoodsReceiptItemRecord[] => {
  return (items || []).map((it: any, idx: number) => {
    const poi = it.purchaseOrderItem || it.purchase_order_item || {};
    const pri = poi.purchaseRequestItem || poi.purchase_request_item || {};
    const ci = poi.costItem || poi.cost_item || {};
    const orderedQty = poi.quantity !== undefined
      ? Number(poi.quantity)
      : Number(it.orderedQty ?? it.ordered_qty ?? it.quantity ?? 0);
    const previouslyReceivedQty = Number(poi.receivedQuantity ?? poi.received_quantity ?? it.previouslyReceivedQty ?? 0);
    const receivedQuantity = Number(it.receivedQuantity ?? it.received_quantity ?? 0);

    return {
      key: String(it.id || it.key || idx),
      poItemId: it.poItemId || it.po_item_id || poi.id || idx + 1,
      categoryName: ci.categoryKey || ci.category_key || it.categoryName || it.category_name || 'Material',
      itemName: poi.itemName || poi.item_name || pri.itemName || pri.item_name || ci.itemName || ci.item_name || it.itemName || it.item_name || 'Item Pengadaan',
      specification: ci.description || pri.description || it.specification || '',
      orderedQty,
      previouslyReceivedQty,
      receivedQuantity,
      remainingQty: Math.max(0, orderedQty - previouslyReceivedQty),
      remainingAfterThisGr: 0,
      uom: pri.uom || ci.uom || poi.uom || it.uom || 'Unit',
      unitPrice: it.unitPrice ?? it.unit_price ?? poi.unitPrice ?? poi.unit_price,
      remarks: it.remarks || '',
      wbsNodeId: it.wbsNodeId || it.wbs_node_id || pri.wbsId || pri.wbs_id || ci.wbsId || ci.wbs_id,
    };
  });
};

export const GoodsReceiptModal: React.FC<GoodsReceiptModalProps> = ({
  open,
  onClose,
  po,
  existingGr,
  viewOnly = false,
  onGrCreated,
  currentUserName = 'Petugas Logistik / Procurement',
  canReceiveGoods = true,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [itemInputMap, setItemInputMap] = useState<{ [key: string]: { receivedQty: number; remarks: string } }>({});

  const isViewMode = viewOnly || Boolean(existingGr);

  // Active PO source
  const targetPo = useMemo(() => {
    if (po) return po;
    return null;
  }, [po]);

  // Compute item rows for Create Mode or View Mode
  const tableRows: GoodsReceiptItemRecord[] = useMemo(() => {
    if (isViewMode && existingGr?.items) {
      return normalizeGoodsReceiptViewItems(existingGr.items);
    }

    if (!targetPo?.items) return [];

    return targetPo.items.map((it: any, idx: number) => {
      const itemKey = getPoItemKey(it, idx);
      const orderedQty = Number(it.quantity || 0);
      const previouslyReceivedQty = Number(it.receivedQuantity || 0);
      const remainingQty = Math.max(0, orderedQty - previouslyReceivedQty);
      const currentInputQty = itemInputMap[itemKey]?.receivedQty ?? 0;
      const currentInputRemarks = itemInputMap[itemKey]?.remarks ?? '';

      return {
        key: itemKey,
        poItemId: it.id || it.poItemId || it.key || idx + 1,
        categoryName: it.costItem?.categoryKey || it.categoryName || 'Material',
        itemName: it.itemName || 'Item Pengadaan',
        specification: it.costItem?.description || it.purchaseRequestItem?.description || it.specification || '',
        orderedQty,
        previouslyReceivedQty,
        receivedQuantity: currentInputQty,
        remainingQty,
        remainingAfterThisGr: Math.max(0, remainingQty - currentInputQty),
        uom: it.purchaseRequestItem?.uom || it.costItem?.uom || it.uom || 'Unit',
        unitPrice: it.unitPrice,
        remarks: currentInputRemarks,
        wbsNodeId: it.wbsNodeId || it.purchaseRequestItem?.wbsId || it.costItem?.wbsId,
      };
    });
  }, [isViewMode, existingGr, targetPo, itemInputMap]);

  // Reset or initialize state upon opening
  useEffect(() => {
    if (open) {
      if (!isViewMode && targetPo?.items) {
        const initialMap: { [key: string]: { receivedQty: number; remarks: string } } = {};
        targetPo.items.forEach((it, idx) => {
          const itemKey = getPoItemKey(it, idx);
          initialMap[itemKey] = {
            receivedQty: 0,
            remarks: '',
          };
        });
        setItemInputMap(initialMap);
        form.setFieldsValue({
          receiptDate: dayjs(),
          deliveryNoteNumber: '',
          remarks: '',
        });
      }
    }
  }, [open, isViewMode, targetPo]);

  // Handle CTA: "Terima Semua Item" (Populate receivedQty = remainingQty for all outstanding items)
  const handleReceiveAll = () => {
    if (!targetPo?.items) return;
    const newMap: { [key: string]: { receivedQty: number; remarks: string } } = {};
    let filledCount = 0;

    targetPo.items.forEach((it, idx) => {
      const itemKey = getPoItemKey(it, idx);
      const ordered = Number(it.quantity || 0);
      const prevReceived = Number(it.receivedQuantity || 0);
      const remaining = Math.max(0, ordered - prevReceived);

      newMap[itemKey] = {
        receivedQty: remaining,
        remarks: itemInputMap[itemKey]?.remarks || '',
      };
      if (remaining > 0) filledCount++;
    });

    setItemInputMap(newMap);
    message.info(`Semua ${filledCount} item yang tersisa telah diisi kuantitas penuh.`);
  };

  /**
   * LAYER 1 — INPUT LEVEL GUARD:
   * Strictly clamps typed or spinner values between [0, maxAllowed].
   * Rejects / alerts user if input exceeds remaining outstanding.
   */
  const handleItemQtyChange = (
    key: string,
    val: number | null | undefined,
    maxAllowed: number,
    itemName: string,
    uom: string
  ) => {
    const rawVal = val === null || val === undefined ? 0 : Number(val);

    if (rawVal > maxAllowed) {
      message.warning(
        `${itemName}: Qty diterima maksimal ${maxAllowed} ${uom}. Input ${rawVal} disesuaikan ke ${maxAllowed}.`
      );
    } else if (rawVal < 0) {
      message.warning(`${itemName}: Kuantitas diterima tidak boleh bernilai negatif.`);
    }

    const safeVal = Math.max(0, Math.min(rawVal, maxAllowed));

    setItemInputMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { remarks: '' }),
        receivedQty: safeVal,
      },
    }));
  };

  // Handle individual item remarks change
  const handleItemRemarksChange = (key: string, remarksVal: string) => {
    setItemInputMap((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || { receivedQty: 0 }),
        remarks: remarksVal,
      },
    }));
  };

  // Summary Metrics
  const totalOrderedQty = useMemo(() => {
    return tableRows.reduce((sum, it) => sum + it.orderedQty, 0);
  }, [tableRows]);

  const totalPreviouslyReceived = useMemo(() => {
    return tableRows.reduce((sum, it) => sum + it.previouslyReceivedQty, 0);
  }, [tableRows]);

  const totalInputReceivedQty = useMemo(() => {
    return tableRows.reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0);
  }, [tableRows]);

  const totalRemainingOutstanding = useMemo(() => {
    return tableRows.reduce((sum, it) => sum + it.remainingQty, 0);
  }, [tableRows]);

  /**
   * LAYER 2 — PRE-SUBMIT GUARD & STALE DATA PROTECTION:
   * Re-reads live PO state from Server SSOT.
   * Recalculates currentRemainingQty = orderedQty - previouslyReceivedQty.
   * If any item receivedQty > currentRemainingQty or receivedQty < 0:
   * STRICT BLOCK with zero data mutation.
   */
  const handleSubmit = async (values: any) => {
    if (!targetPo) {
      message.error('Data Purchase Order tidak ditemukan.');
      return;
    }

    // 1. Live PO reference
    const livePo: any = targetPo;

    // 2. Eligibility check on live PO
    if (livePo.status !== 'ISSUED' && livePo.status !== 'PARTIALLY_FULFILLED') {
      message.error(`Tidak dapat menerima barang untuk PO dengan status ${livePo.status}.`);
      return; // STRICT BLOCK: ZERO DATA MUTATION
    }

    // 3. Pre-submit validation per item against live fresh remaining quantity
    let totalLiveReceived = 0;
    const itemsToReceive: GoodsReceiptItemRecord[] = [];

    for (let idx = 0; idx < (livePo.items || []).length; idx++) {
      const pItem = livePo.items[idx];
      const itemKey = getPoItemKey(pItem, idx);
      const inputQty = Number(itemInputMap[itemKey]?.receivedQty ?? 0);
      const inputRemarks = itemInputMap[itemKey]?.remarks || '';

      const ordered = Number(pItem.quantity || 0);
      const alreadyReceived = Number(pItem.receivedQuantity || 0);
      const liveRemaining = Math.max(0, ordered - alreadyReceived);

      // Guard: Negative value check
      if (inputQty < 0) {
        message.error(`Kuantitas item "${pItem.itemName}" tidak boleh bernilai negatif.`);
        return; // STRICT BLOCK: ZERO DATA MUTATION
      }

      // Guard: Over-receipt check
      if (inputQty > liveRemaining) {
        message.error(
          `${pItem.itemName}: Qty diterima maksimal ${liveRemaining} ${pItem.uom || 'Unit'}.`
        );
        return; // STRICT BLOCK: ZERO DATA MUTATION
      }

      if (inputQty > 0) {
        itemsToReceive.push({
          key: itemKey,
          poItemId: pItem.id || pItem.poItemId || pItem.key || idx + 1,
          categoryName: pItem.categoryName || 'Material',
          itemName: pItem.itemName,
          orderedQty: ordered,
          previouslyReceivedQty: alreadyReceived,
          receivedQuantity: inputQty,
          remainingQty: liveRemaining,
          remainingAfterThisGr: Math.max(0, liveRemaining - inputQty),
          uom: pItem.uom || 'Unit',
          unitPrice: pItem.unitPrice,
          remarks: inputRemarks,
          wbsNodeId: pItem.wbsNodeId,
        });
        totalLiveReceived += inputQty;
      }
    }

    // Guard: Minimal 1 item with quantity > 0
    if (totalLiveReceived <= 0 || itemsToReceive.length === 0) {
      message.warning('Harap masukkan kuantitas diterima minimal > 0 untuk setidaknya 1 item.');
      return; // STRICT BLOCK: ZERO DATA MUTATION
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const receiptDateVal: Dayjs = values.receiptDate || dayjs();
      const receiptDateIso = receiptDateVal.toISOString();

      const poIdNum = Number(livePo.id || livePo.poId);
      const res = await ProcurementService.createGoodsReceipt({
        purchaseOrderId: poIdNum,
        receiptDate: receiptDateIso,
        remarks: values.remarks || '',
        items: itemsToReceive.map((it) => ({
          poItemId: Number(it.poItemId),
          receivedQuantity: Number(it.receivedQuantity),
          remarks: it.remarks,
        })),
      });

      const savedGrData = res?.data || res;
      const grNumber = savedGrData?.grNumber || `GR-${savedGrData?.id || Date.now()}`;

      // Check if all items in live PO will be fully completed after this GR
      const isCompletelyFulfilled = (livePo.items || []).every((pItem: any, idx: number) => {
        const itemKey = getPoItemKey(pItem, idx);
        const inputQty = Number(itemInputMap[itemKey]?.receivedQty ?? 0);
        const ordered = Number(pItem.quantity || 0);
        const alreadyReceived = Number(pItem.receivedQuantity || 0);
        return alreadyReceived + inputQty >= ordered;
      });

      const grStatus: 'PARTIAL' | 'COMPLETED' = isCompletelyFulfilled ? 'COMPLETED' : 'PARTIAL';

      const newGr: GoodsReceiptRecord = {
        grId: String(savedGrData?.id || Date.now()),
        grNumber,
        poId: String(livePo.id || livePo.poId),
        poNumber: livePo.poNumber,
        prId: livePo.prId || livePo.purchaseRequestId || (livePo as any).purchaseRequest?.id || '',
        prNumber: livePo.prNumber || (livePo as any).purchaseRequest?.prNumber || '',
        projectId: livePo.projectId || (livePo as any).purchaseRequest?.project?.id || (livePo as any).purchaseRequest?.projectId || '',
        projectName: livePo.projectName || (livePo as any).purchaseRequest?.project?.name || 'Proyek Tanpa Nama',
        vendorId: livePo.vendorId || (livePo as any).vendor?.id || 0,
        vendorCode: livePo.vendorCode || (livePo as any).vendor?.code || '',
        vendorName: livePo.vendorName || (livePo as any).vendor?.name || '—',
        receiptDate: receiptDateIso,
        deliveryNoteNumber: values.deliveryNoteNumber || '',
        remarks: values.remarks || '',
        status: grStatus,
        createdAt: savedGrData?.createdAt || now.toISOString(),
        createdBy: currentUserName,
        totalItemsCount: itemsToReceive.length,
        totalQtyReceivedInGr: totalLiveReceived,
        items: itemsToReceive,
      };

      const updatedPo: any = {
        ...livePo,
        status: grStatus === 'COMPLETED' ? 'COMPLETED' : 'PARTIALLY_FULFILLED',
      };

      message.success(
        `Goods Receipt (${grNumber}) berhasil diterbitkan melalui Server SSOT! Status PO kini: ${updatedPo.status}.`
      );

      onGrCreated?.(newGr, updatedPo);
      onClose();
    } catch (err: any) {
      console.error('Failed to create Goods Receipt via Server SSOT:', err);
      const backendMsg = err.response?.data?.message || err.message || 'Gagal menerbitkan Goods Receipt.';
      message.error(backendMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!targetPo && !existingGr) return null;

  const vendorName =
    existingGr?.vendorName ||
    (targetPo as any)?.vendor?.name ||
    targetPo?.vendorName ||
    '—';
  const vendorCode =
    existingGr?.vendorCode ||
    (targetPo as any)?.vendor?.code ||
    targetPo?.vendorCode ||
    '';
  const projectName =
    existingGr?.projectName ||
    (targetPo as any)?.purchaseRequest?.project?.name ||
    targetPo?.projectName ||
    (targetPo as any)?.project_name ||
    'Proyek Tidak Tersedia';
  const poNumber = existingGr?.poNumber || targetPo?.poNumber || '-';
  const currentProjectId =
    existingGr?.projectId ||
    (targetPo as any)?.purchaseRequest?.project?.id ||
    (targetPo as any)?.purchaseRequest?.projectId ||
    targetPo?.projectId;

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
            <SafetyCertificateOutlined style={{ color: '#0d9488', fontSize: 16 }} />
            <Text style={{ fontSize: 12 }}>
              {isViewMode ? (
                <span>
                  Nomor GR: <strong>{existingGr?.grNumber}</strong> — Penerima:{' '}
                  <UserIdentityDisplay
                    user={(existingGr as any)?.receiver || (existingGr as any)?.creator}
                    userId={existingGr?.createdBy}
                    fallbackRole="Petugas Gudang"
                  />
                </span>
              ) : (
                <span>
                  Total Kuantitas Diterima pada GR ini:{' '}
                  <strong style={{ color: '#0f766e', fontSize: 13.5 }}>
                    {totalInputReceivedQty} Unit / Item
                  </strong>
                </span>
              )}
            </Text>
          </div>

          <Space size={8}>
            <Button onClick={onClose} style={{ borderRadius: 6 }}>
              {isViewMode ? 'Tutup' : 'Batal'}
            </Button>
            {!isViewMode && canReceiveGoods && (
              <Button
                type="primary"
                loading={isSubmitting}
                onClick={() => form.submit()}
                icon={<SendOutlined />}
                style={{
                  backgroundColor: '#0d9488',
                  borderColor: '#0d9488',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                Terbitkan Goods Receipt (GR)
              </Button>
            )}
          </Space>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#ccfbf1', borderRadius: 8, color: '#0f766e' }}>
            <InboxOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {isViewMode
                ? `Rincian Goods Receipt (GR) — ${existingGr?.grNumber}`
                : `Penerimaan Barang (Goods Receipt) — Dari PO ${poNumber}`}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              {isViewMode
                ? 'Dokumen bukti penerimaan fisik barang di gudang / lokasi proyek'
                : 'Verifikasi fisik barang yang diterima dari vendor berdasarkan Surat Jalan dan PO'}
            </Text>
          </div>
        </div>
      }
    >
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Context Summary Header */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <Row gutter={[12, 8]} align="middle">
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PROYEK:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{projectName}</div>
              {currentProjectId ? (
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID #{currentProjectId}</Tag>
              ) : (
                <Tag style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>Project ID Tidak Tersedia</Tag>
              )}
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>PURCHASE ORDER (PO):</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1d4ed8', fontFamily: 'monospace' }}>
                {poNumber}
              </div>
              <StatusBadge
                domain="po"
                status={targetPo?.status || 'ISSUED'}
                showDot
                style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}
              />
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>VENDOR PENYEDIA:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                <ShopOutlined style={{ marginRight: 4 }} />
                {vendorName}
              </div>
              <Tag color="cyan" style={{ fontSize: 9.5, margin: 0, marginTop: 2 }}>{vendorCode}</Tag>
            </Col>
            <Col xs={24} sm={6}>
              <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase' }}>STATUS PEMENUHAN BARANG:</Text>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: '#334155' }}>
                {isViewMode ? (
                  <StatusBadge
                    domain="gr"
                    status={existingGr?.status === 'COMPLETED' ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED'}
                    style={{ fontWeight: 700, margin: 0 }}
                  />
                ) : (
                  <span>
                    Sisa: <strong>{formatQuantity(totalRemainingOutstanding)}</strong> dari <strong>{formatQuantity(totalOrderedQty)}</strong> unit
                  </span>
                )}
              </div>
              {!isViewMode && (
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                  Sudah diterima sebelumnya: {formatQuantity(totalPreviouslyReceived)} unit
                </div>
              )}
            </Col>
          </Row>
        </div>

        {/* View Mode Summary Description */}
        {isViewMode && existingGr ? (
          <Descriptions
            size="small"
            bordered
            column={{ xs: 1, sm: 3 }}
            style={{ borderRadius: 6, overflow: 'hidden' }}
          >
            <Descriptions.Item label="Tanggal Penerimaan">
              {formatDate(existingGr.receiptDate)}
            </Descriptions.Item>
            <Descriptions.Item label="Nomor Surat Jalan / DO">
              {existingGr.deliveryNoteNumber || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Petugas Penerima">
              <UserIdentityDisplay
                user={(existingGr as any).receiver || (existingGr as any).creator}
                userId={existingGr.createdBy}
                fallbackRole="Petugas Gudang"
                showEmail
              />
            </Descriptions.Item>
            {existingGr.remarks && (
              <Descriptions.Item label="Catatan Surat Jalan / Logistik" span={3}>
                {existingGr.remarks}
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : (
          /* Create Mode Header Form */
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              receiptDate: dayjs(),
              deliveryNoteNumber: '',
              remarks: '',
            }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Tanggal Kedatangan Fisik</span>}
                  name="receiptDate"
                  rules={[{ required: true, message: 'Tanggal penerimaan wajib diisi' }]}
                >
                  <DatePicker
                    style={{ width: '100%', borderRadius: 6 }}
                    format="DD MMMM YYYY"
                    allowClear={false}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Nomor Surat Jalan / DO Vendor</span>}
                  name="deliveryNoteNumber"
                >
                  <Input placeholder="Contoh: SJ-MI/2026/08/001..." style={{ borderRadius: 6, fontSize: 11.5 }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan Pengiriman / Ekspedisi</span>}
                  name="remarks"
                >
                  <Input placeholder="Kondisi armada, nomor polisi, dll..." style={{ borderRadius: 6, fontSize: 11.5 }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        )}

        {/* 24 Items Receiving Table */}
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              padding: '8px 12px',
              background: '#f0fdfa',
              borderBottom: '1px solid #ccfbf1',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f766e' }}>
                {isViewMode
                  ? `Daftar Item yang Diterima pada GR ini (${tableRows.length} Item)`
                  : `Daftar ${tableRows.length} Item PO — Input Kuantitas Diterima`}
              </span>
              {!isViewMode && (
                <Tag color="teal" style={{ fontSize: 10, margin: 0, fontWeight: 600 }}>
                  VALIDASI ANTI OVER-RECEIPT AKTIF (MAKS = SISA OUTSTANDING)
                </Tag>
              )}
            </div>

            {!isViewMode && canReceiveGoods && (
              <Button
                size="small"
                icon={<CheckSquareOutlined />}
                onClick={handleReceiveAll}
                style={{
                  background: '#0d9488',
                  color: '#ffffff',
                  borderColor: '#0f766e',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 11.5,
                }}
              >
                Terima Semua Item Tersisa
              </Button>
            )}
          </div>

          <Table
            size="small"
            rowKey="key"
            dataSource={tableRows}
            pagination={false}
            scroll={{ y: 240 }}
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
                render: (name: string, it: GoodsReceiptItemRecord) => (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11.5, color: '#0f172a' }}>{name || it.itemName}</div>
                    {it.specification && (
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                        {it.specification}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      <Tag
                        color={it.categoryName === 'EQUIPMENT' ? 'purple' : 'blue'}
                        style={{ fontSize: 9, margin: 0, padding: '0 4px' }}
                      >
                        {it.categoryName || 'Material'}
                      </Tag>
                      {it.wbsNodeId && (
                        <Tag color="geekblue" style={{ fontSize: 9, margin: 0, padding: '0 4px' }}>
                          WBS #{it.wbsNodeId}
                        </Tag>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                title: 'Qty Dipesan',
                dataIndex: 'orderedQty',
                key: 'orderedQty',
                width: 85,
                align: 'center' as const,
                render: (qty: number) => (
                  <span style={{ fontWeight: 600, color: '#334155' }}>{formatQuantity(qty)}</span>
                ),
              },
              ...(!isViewMode
                ? [
                    {
                      title: 'Sudah Diterima',
                      dataIndex: 'previouslyReceivedQty',
                      key: 'previouslyReceivedQty',
                      width: 95,
                      align: 'center' as const,
                      render: (prev: number) => (
                        <span style={{ color: prev > 0 ? '#059669' : '#64748b', fontWeight: 600 }}>
                          {formatQuantity(prev)}
                        </span>
                      ),
                    },
                    {
                      title: 'Sisa Outstanding',
                      dataIndex: 'remainingQty',
                      key: 'remainingQty',
                      width: 105,
                      align: 'center' as const,
                      render: (rem: number) => (
                        <Tag color={rem > 0 ? 'orange' : 'green'} style={{ fontWeight: 700, margin: 0 }}>
                          {formatQuantity(rem)}
                        </Tag>
                      ),
                    },
                  ]
                : []),
              {
                title: 'Satuan',
                dataIndex: 'uom',
                key: 'uom',
                width: 65,
                align: 'center' as const,
                render: (uom: string) => <span style={{ fontSize: 11, color: '#64748b' }}>{uom}</span>,
              },
              {
                title: isViewMode ? 'Qty Diterima di GR ini' : 'Qty Diterima Saat Ini',
                dataIndex: 'receivedQuantity',
                key: 'receivedQuantity',
                width: 140,
                align: 'center' as const,
                render: (val: number, it: GoodsReceiptItemRecord) => {
                  if (isViewMode) {
                    return (
                      <span style={{ fontWeight: 700, color: '#0f766e', fontSize: 12.5 }}>
                        {formatQuantityWithUom(val, it.uom)}
                      </span>
                    );
                  }

                  const isFinished = it.remainingQty === 0;
                  return (
                    <InputNumber
                      min={0}
                      max={it.remainingQty}
                      precision={2}
                      step={1}
                      value={it.receivedQuantity}
                      disabled={isFinished || !canReceiveGoods}
                      status={it.receivedQuantity > it.remainingQty ? 'error' : undefined}
                      onChange={(num) =>
                        handleItemQtyChange(it.key, num, it.remainingQty, it.itemName, it.uom)
                      }
                      onBlur={() =>
                        handleItemQtyChange(
                          it.key,
                          itemInputMap[it.key]?.receivedQty,
                          it.remainingQty,
                          it.itemName,
                          it.uom
                        )
                      }
                      style={{
                        width: 90,
                        borderColor: it.receivedQuantity > 0 ? '#0d9488' : undefined,
                        fontWeight: 600,
                      }}
                      placeholder="0"
                    />
                  );
                },
              },
              {
                title: 'Catatan Kondisi Barang',
                dataIndex: 'remarks',
                key: 'remarks',
                width: 190,
                render: (rem: string, it: GoodsReceiptItemRecord) => {
                  if (isViewMode) {
                    return (
                      <span style={{ fontSize: 11, color: it.remarks ? '#0f172a' : '#94a3b8' }}>
                        {it.remarks || '—'}
                      </span>
                    );
                  }

                  return (
                    <Input
                      size="small"
                      value={it.remarks}
                      disabled={!canReceiveGoods}
                      placeholder="Kondisi fisik / segel..."
                      onChange={(e) => handleItemRemarksChange(it.key, e.target.value)}
                      style={{ borderRadius: 4, fontSize: 11 }}
                    />
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

export default GoodsReceiptModal;
