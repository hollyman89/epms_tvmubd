"use client";

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Form,
  Input,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import {
  ProcurementService,
  ServiceOrder,
  ServiceOrderDocumentType,
  CreateServiceOrderPayload,
  UpdateServiceOrderPayload,
} from '@/services/procurement.service';
import type { PurchaseOrderPrototypeRecord } from '@/components/procurement/PurchaseOrderModal';
import { formatCurrency } from '@/lib/formatters';

const { Text } = Typography;

export interface ServiceOrderModalProps {
  open: boolean;
  onClose: () => void;
  po: PurchaseOrderPrototypeRecord | null;
  onOrderUpdated?: () => void;
  canManage?: boolean;
}

export const SERVICE_ORDER_DESCRIPTIONS_COLUMN = {
  xxl: 2,
  xl: 2,
  lg: 2,
  md: 2,
  sm: 1,
  xs: 1,
} as const;

export function resolveServiceOrderProject(
  serviceOrder?: Partial<ServiceOrder> | null,
  po?: Partial<PurchaseOrderPrototypeRecord> | null
): { projectName: string; projectCode: string | null } {
  const resolvedProject = (serviceOrder as any)?.project || (po as any)?.project;
  const projectName =
    resolvedProject?.name ||
    po?.projectName ||
    (serviceOrder?.projectId ? `Proyek #${serviceOrder.projectId}` : null) ||
    'Belum ada data';
  const projectCode = resolvedProject?.code || (po as any)?.projectCode || null;
  return { projectName, projectCode };
}

export function resolveServiceOrderVendor(
  serviceOrder?: Partial<ServiceOrder> | null,
  po?: Partial<PurchaseOrderPrototypeRecord> | null
): { vendorName: string; vendorCode: string | null } {
  const resolvedVendor = (serviceOrder as any)?.vendor || (po as any)?.vendor;
  const vendorName = resolvedVendor?.name || po?.vendorName || (po as any)?.vendor?.name || '—';
  const vendorCode = resolvedVendor?.code || (po as any)?.vendorCode || null;
  return { vendorName, vendorCode };
}

type ModalViewMode = 'LIST' | 'DETAIL' | 'CREATE' | 'EDIT';

export const ServiceOrderModal: React.FC<ServiceOrderModalProps> = ({
  open,
  onClose,
  po,
  onOrderUpdated,
  canManage = true,
}) => {
  const [form] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [viewMode, setViewMode] = useState<ModalViewMode>('LIST');
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  const poId = po?.poId || (po as any)?.id;

  // Load all service orders for the PO (0..N canonical collection)
  const fetchServiceOrders = async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const orders = await ProcurementService.getServiceOrdersByPo(Number(poId));
      setServiceOrders(orders || []);
      // If we are currently viewing a selected order, refresh its state from the fetched list
      if (selectedOrder) {
        const refreshed = (orders || []).find((o) => o.id === selectedOrder.id);
        if (refreshed) {
          setSelectedOrder(refreshed);
        }
      }
    } catch (err) {
      console.error('Failed to fetch service orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && poId) {
      setSelectedOrder(null);
      setViewMode('LIST');
      form.resetFields();
      fetchServiceOrders();
    } else {
      setServiceOrders([]);
      setSelectedOrder(null);
      setViewMode('LIST');
      form.resetFields();
    }
  }, [open, poId]);

  // Handle open create form
  const handleOpenCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      documentType: 'SPK',
      workLocation: po?.deliveryLocation || 'Lokasi Proyek',
    });
    setViewMode('CREATE');
  };

  // Handle open edit form for draft
  const handleOpenEdit = (order: ServiceOrder) => {
    form.resetFields();
    form.setFieldsValue({
      documentType: order.documentType,
      scopeOfWork: order.scopeOfWork,
      startDate: order.startDate ? dayjs(order.startDate) : undefined,
      endDate: order.endDate ? dayjs(order.endDate) : undefined,
      workLocation: order.workLocation || order.location,
      notes: order.notes,
    });
    setSelectedOrder(order);
    setViewMode('EDIT');
  };

  // Handle open detail view for a specific order
  const handleOpenDetail = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setViewMode('DETAIL');
  };

  // Handle Create or Update Draft
  const handleSubmit = async (values: any) => {
    if (!poId) return;
    setIsSubmitting(true);
    try {
      const startDateStr = values.startDate ? dayjs(values.startDate).format('YYYY-MM-DD') : undefined;
      const endDateStr = values.endDate ? dayjs(values.endDate).format('YYYY-MM-DD') : undefined;

      if (viewMode === 'EDIT' && selectedOrder) {
        const updatePayload: UpdateServiceOrderPayload = {
          documentType: values.documentType,
          scopeOfWork: values.scopeOfWork,
          startDate: startDateStr,
          endDate: endDateStr,
          workLocation: values.workLocation || values.location,
          notes: values.notes,
        };
        const updated = await ProcurementService.updateServiceOrder(selectedOrder.id, updatePayload);
        message.success('Draft SPK / Work Order berhasil diperbarui.');
        setSelectedOrder(updated);
        setViewMode('DETAIL');
      } else {
        const payload: CreateServiceOrderPayload = {
          purchaseOrderId: Number(poId),
          documentType: values.documentType || 'SPK',
          scopeOfWork: values.scopeOfWork,
          startDate: startDateStr,
          endDate: endDateStr,
          workLocation: values.workLocation || values.location,
          notes: values.notes,
        };
        const created = await ProcurementService.createServiceOrder(payload);
        message.success(`SPK / Work Order ${created.serviceOrderNumber} berhasil dibuat.`);
        setSelectedOrder(created);
        setViewMode('DETAIL');
      }

      await fetchServiceOrders();
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceOrders'] });
      onOrderUpdated?.();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal menyimpan SPK / Work Order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Issue
  const handleIssue = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      const issued = await ProcurementService.issueServiceOrder(selectedOrder.id);
      message.success(`SPK / Work Order ${issued.serviceOrderNumber} berhasil diterbitkan.`);
      setSelectedOrder(issued);
      await fetchServiceOrders();
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceOrders'] });
      onOrderUpdated?.();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal menerbitkan SPK / Work Order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cancel
  const handleCancelOrder = async (values: { reason: string }) => {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      const cancelled = await ProcurementService.cancelServiceOrder(selectedOrder.id, {
        reason: values.reason,
      });
      message.success(`SPK / Work Order ${cancelled.serviceOrderNumber} berhasil dibatalkan.`);
      setSelectedOrder(cancelled);
      setShowCancelModal(false);
      cancelForm.resetFields();
      await fetchServiceOrders();
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      queryClient.invalidateQueries({ queryKey: ['serviceOrders'] });
      onOrderUpdated?.();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal membatalkan SPK / Work Order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeOrFirstOrder = selectedOrder || serviceOrders[0];
  const { projectName, projectCode } = resolveServiceOrderProject(activeOrFirstOrder, po);
  const { vendorName, vendorCode } = resolveServiceOrderVendor(activeOrFirstOrder, po);
  const totalAmount = po?.totalAmount || (selectedOrder?.purchaseOrder as any)?.totalAmount || 0;

  // Counts for document status summary
  const issuedCount = serviceOrders.filter((o) => o.status === 'ISSUED').length;
  const draftCount = serviceOrders.filter((o) => o.status === 'DRAFT').length;
  const cancelledCount = serviceOrders.filter((o) => o.status === 'CANCELLED').length;

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={850}
        style={{ top: 20, maxWidth: 'calc(100vw - 32px)' }}
        styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' } }}
        destroyOnClose
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '6px 10px', background: '#e0f2fe', borderRadius: 8, color: '#0284c7' }}>
              <FileTextOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Surat Perintah Kerja (SPK) / Work Order Jasa</span>
                {viewMode === 'DETAIL' && selectedOrder && (
                  <>
                    <Tag
                      color={
                        selectedOrder.status === 'ISSUED'
                          ? 'blue'
                          : selectedOrder.status === 'CANCELLED'
                          ? 'red'
                          : 'gold'
                      }
                      style={{ fontWeight: 700, margin: 0 }}
                    >
                      ● {selectedOrder.status}
                    </Tag>
                    <Tag color="purple" style={{ fontWeight: 600, margin: 0 }}>
                      {selectedOrder.documentType}
                    </Tag>
                  </>
                )}
                {viewMode === 'LIST' && (
                  <Tag color="cyan" style={{ fontWeight: 600, margin: 0 }}>
                    {serviceOrders.length} Dokumen
                  </Tag>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
                Dokumen resmi penugasan pelaksanaan pekerjaan jasa / subkontraktor untuk PO #{po?.poNumber}
              </Text>
            </div>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {viewMode === 'DETAIL' && selectedOrder ? (
                <span>
                  Nomor Dokumen: <strong style={{ color: '#0284c7', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{selectedOrder.serviceOrderNumber}</strong>
                </span>
              ) : (
                <span>
                  Total Dokumen: <strong>{serviceOrders.length}</strong> (ISSUED: {issuedCount}, DRAFT: {draftCount})
                </span>
              )}
            </div>
            <Space size={8}>
              {/* LIST Actions */}
              {viewMode === 'LIST' && (
                <>
                  <Button onClick={onClose} style={{ borderRadius: 6 }}>
                    Tutup
                  </Button>
                  {canManage && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleOpenCreate}
                      style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', borderRadius: 6, fontWeight: 600 }}
                    >
                      Buat SPK / Work Order
                    </Button>
                  )}
                </>
              )}

              {/* DETAIL Actions */}
              {viewMode === 'DETAIL' && selectedOrder && (
                <>
                  <Button
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setViewMode('LIST')}
                    style={{ borderRadius: 6 }}
                  >
                    Daftar Dokumen
                  </Button>
                  <Button onClick={onClose} style={{ borderRadius: 6 }}>
                    Tutup
                  </Button>

                  {/* DRAFT Actions */}
                  {selectedOrder.status === 'DRAFT' && canManage && (
                    <>
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => handleOpenEdit(selectedOrder)}
                        style={{ borderRadius: 6 }}
                      >
                        Ubah Draft
                      </Button>
                      <Popconfirm
                        title="Terbitkan SPK / Work Order?"
                        description="SPK yang diterbitkan akan mengikat vendor untuk pelaksanaan pekerjaan."
                        onConfirm={handleIssue}
                        okText="Ya, Terbitkan"
                        cancelText="Batal"
                      >
                        <Button
                          type="primary"
                          icon={<SendOutlined />}
                          loading={isSubmitting}
                          style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', borderRadius: 6, fontWeight: 600 }}
                        >
                          Terbitkan SPK
                        </Button>
                      </Popconfirm>
                      <Button
                        danger
                        icon={<StopOutlined />}
                        onClick={() => setShowCancelModal(true)}
                        style={{ borderRadius: 6 }}
                      >
                        Batalkan
                      </Button>
                    </>
                  )}

                  {/* ISSUED Actions */}
                  {selectedOrder.status === 'ISSUED' && canManage && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => setShowCancelModal(true)}
                      style={{ borderRadius: 6 }}
                    >
                      Batalkan SPK
                    </Button>
                  )}
                </>
              )}

              {/* CREATE / EDIT Actions */}
              {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
                <>
                  <Button
                    onClick={() => setViewMode(selectedOrder ? 'DETAIL' : 'LIST')}
                    style={{ borderRadius: 6 }}
                  >
                    Batal
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={isSubmitting}
                    onClick={() => form.submit()}
                    style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', borderRadius: 6, fontWeight: 600 }}
                  >
                    {viewMode === 'EDIT' ? 'Simpan Perubahan' : 'Buat SPK / Work Order'}
                  </Button>
                </>
              )}
            </Space>
          </div>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Spin />
              <span style={{ color: '#64748b', fontSize: 14 }}>Memuat rincian SPK / Work Order...</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Phase 20 Domain Rule Alert */}
            <Alert
              type="info"
              showIcon
              icon={<SafetyCertificateOutlined style={{ color: '#0284c7', fontSize: 16 }} />}
              message="Ketentuan Pelaksanaan Pekerjaan Jasa (Phase 20)"
              description="SERVICE PO adalah SSOT komersial. Penerimaan jasa tidak menggunakan Goods Receipt (GR). Dokumen SPK / Work Order bersifat opsional untuk instruksi kerja teknis (0..N dokumen per PO)."
              style={{ borderRadius: 8, border: '1px solid #bae6fd', background: '#f0f9ff' }}
            />

            {/* PO Context Reference Strip (Commercial SSOT) */}
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <Row gutter={[16, 10]} align="middle">
                <Col xs={24} sm={6}>
                  <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROYEK:</Text>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={projectName}>
                    {projectName}
                  </div>
                  {projectCode && (
                    <Text type="secondary" style={{ fontSize: 10.5, color: '#64748b', display: 'block', fontFamily: 'monospace' }}>
                      {projectCode}
                    </Text>
                  )}
                </Col>
                <Col xs={24} sm={6}>
                  <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PURCHASE ORDER:</Text>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>{po?.poNumber || (selectedOrder?.purchaseOrder as any)?.poNumber || '—'}</div>
                  <Tag color="cyan" style={{ fontSize: 10, margin: 0, marginTop: 2, borderRadius: 4 }}>Jasa / Subcon</Tag>
                </Col>
                <Col xs={24} sm={6}>
                  <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>VENDOR / SUBCON:</Text>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#047857', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={vendorName}>
                    {vendorName}
                  </div>
                  {vendorCode && (
                    <Text type="secondary" style={{ fontSize: 10.5, color: '#64748b', display: 'block', fontFamily: 'monospace' }}>
                      {vendorCode}
                    </Text>
                  )}
                </Col>
                <Col xs={24} sm={6}>
                  <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NILAI KONTRAK PO:</Text>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#059669', fontFamily: 'monospace' }}>
                    {formatCurrency(totalAmount)}
                  </div>
                </Col>
              </Row>
            </div>

            {/* ========================================================================= */}
            {/* VIEW MODE 1: DOCUMENTS LIST (0..N Collection View)                       */}
            {/* ========================================================================= */}
            {viewMode === 'LIST' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>
                    Daftar Dokumen Pelaksanaan (SPK / Work Order)
                  </div>
                  {canManage && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleOpenCreate}
                      style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', borderRadius: 6, fontWeight: 600 }}
                    >
                      + Buat SPK / Work Order
                    </Button>
                  )}
                </div>

                {serviceOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 16px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#334155', marginBottom: 4 }}>
                            Belum ada SPK / Work Order
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Purchase Order ini sah sebagai SSOT komersial. Dokumen SPK atau Work Order dapat diterbitkan untuk penugasan teknis lapangan.
                          </Text>
                        </div>
                      }
                    >
                      {canManage && (
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={handleOpenCreate}
                          style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', borderRadius: 6, fontWeight: 600, marginTop: 8 }}
                        >
                          Buat SPK / Work Order
                        </Button>
                      )}
                    </Empty>
                  </div>
                ) : (
                  <Table
                    size="small"
                    bordered
                    pagination={serviceOrders.length > 5 ? { pageSize: 5 } : false}
                    dataSource={serviceOrders}
                    rowKey="id"
                    columns={[
                      {
                        title: 'Nomor Dokumen',
                        dataIndex: 'serviceOrderNumber',
                        key: 'serviceOrderNumber',
                        width: '32%',
                        render: (num: string, record: ServiceOrder) => (
                          <Space size={6} wrap={false}>
                            <Tag color="purple" style={{ fontWeight: 600, margin: 0, fontSize: 10 }}>
                              {record.documentType}
                            </Tag>
                            <strong style={{ color: '#0284c7', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {num}
                            </strong>
                          </Space>
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        width: '18%',
                        render: (status: string) => (
                          <Tag
                            color={status === 'ISSUED' ? 'blue' : status === 'CANCELLED' ? 'red' : 'gold'}
                            style={{ fontWeight: 700, borderRadius: 12, padding: '1px 8px', fontSize: 11 }}
                          >
                            ● {status}
                          </Tag>
                        ),
                      },
                      {
                        title: 'Target Jadwal',
                        key: 'schedule',
                        width: '24%',
                        render: (_: any, r: ServiceOrder) => (
                          <span style={{ fontSize: 11.5, color: '#475569', whiteSpace: 'nowrap' }}>
                            {r.startDate ? dayjs(r.startDate).format('DD/MM/YY') : '—'} s/d{' '}
                            {r.endDate ? dayjs(r.endDate).format('DD/MM/YY') : '—'}
                          </span>
                        ),
                      },
                      {
                        title: 'Aksi',
                        key: 'action',
                        width: '26%',
                        align: 'center',
                        render: (_: any, record: ServiceOrder) => (
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            icon={<EyeOutlined />}
                            onClick={() => handleOpenDetail(record)}
                            style={{ borderRadius: 6, fontWeight: 600, fontSize: 11.5 }}
                          >
                            Lihat Detail
                          </Button>
                        ),
                      },
                    ]}
                  />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 2: DETAIL VIEW (Single Service Order Full Inspection)          */}
            {/* ========================================================================= */}
            {viewMode === 'DETAIL' && selectedOrder && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Button
                    size="small"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setViewMode('LIST')}
                    style={{ borderRadius: 6, fontSize: 11.5 }}
                  >
                    ← Kembali ke Daftar SPK / WO
                  </Button>
                  <Space size={6}>
                    <Tag color="purple" style={{ fontWeight: 600 }}>{selectedOrder.documentType}</Tag>
                    <Tag
                      color={selectedOrder.status === 'ISSUED' ? 'blue' : selectedOrder.status === 'CANCELLED' ? 'red' : 'gold'}
                      style={{ fontWeight: 700 }}
                    >
                      ● {selectedOrder.status}
                    </Tag>
                  </Space>
                </div>

                {/* Issued Notice */}
                {selectedOrder.status === 'ISSUED' && (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined style={{ color: '#059669', fontSize: 18 }} />}
                    message={
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        SPK / Work Order Diterbitkan: {selectedOrder.serviceOrderNumber}
                      </span>
                    }
                    description={
                      <div style={{ fontSize: 11.5, marginTop: 4 }}>
                        Diterbitkan pada{' '}
                        {selectedOrder.issuedAt ? dayjs(selectedOrder.issuedAt).format('DD MMMM YYYY HH:mm') : '—'}.
                        Status saat ini: <strong>Menunggu Pelaksanaan / Klaim Jasa (Phase 21)</strong>.
                      </div>
                    }
                    style={{ borderRadius: 8, border: '1px solid #86efac', background: '#f0fdf4', marginBottom: 12 }}
                  />
                )}

                {/* Cancelled Notice */}
                {selectedOrder.status === 'CANCELLED' && (
                  <Alert
                    type="error"
                    showIcon
                    icon={<CloseCircleOutlined style={{ color: '#dc2626', fontSize: 18 }} />}
                    message={
                      <span style={{ fontWeight: 700, fontSize: 13 }}>
                        SPK / Work Order Dibatalkan: {selectedOrder.serviceOrderNumber}
                      </span>
                    }
                    description={
                      <div style={{ fontSize: 11.5, marginTop: 4 }}>
                        Alasan Pembatalan: <em>{selectedOrder.cancellationReason || 'Tidak ada keterangan'}</em>
                        <br />
                        Dibatalkan pada:{' '}
                        {selectedOrder.cancelledAt ? dayjs(selectedOrder.cancelledAt).format('DD MMMM YYYY HH:mm') : '—'}
                      </div>
                    }
                    style={{ borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', marginBottom: 12 }}
                  />
                )}

                {/* The Canonical UI-C1 Descriptions Grid */}
                <Descriptions
                  size="small"
                  bordered
                  column={SERVICE_ORDER_DESCRIPTIONS_COLUMN}
                  labelStyle={{ width: '20%', minWidth: '130px', fontWeight: 600, background: '#f8fafc', color: '#475569' }}
                  contentStyle={{ width: '30%', color: '#0f172a' }}
                >
                  <Descriptions.Item label="Nomor Dokumen">
                    <strong style={{ color: '#0284c7', whiteSpace: 'nowrap', wordBreak: 'keep-all', letterSpacing: '0.02em', fontFamily: 'monospace', fontSize: 13 }}>
                      {selectedOrder.serviceOrderNumber}
                    </strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tipe Dokumen">
                    <Tag color="purple" style={{ fontWeight: 600, borderRadius: 4 }}>{selectedOrder.documentType}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tanggal Dibuat">
                    {selectedOrder.createdAt ? dayjs(selectedOrder.createdAt).format('DD MMMM YYYY, HH:mm') : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag
                      color={
                        selectedOrder.status === 'ISSUED'
                          ? 'blue'
                          : selectedOrder.status === 'CANCELLED'
                          ? 'red'
                          : 'gold'
                      }
                      style={{ fontWeight: 700, borderRadius: 12, padding: '1px 8px' }}
                    >
                      ● {selectedOrder.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Target Mulai">
                    {selectedOrder.startDate
                      ? dayjs(selectedOrder.startDate).format('DD MMMM YYYY')
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Target Selesai">
                    {selectedOrder.endDate
                      ? dayjs(selectedOrder.endDate).format('DD MMMM YYYY')
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Lokasi Pelaksanaan" span={2}>
                    <div style={{ wordBreak: 'normal', overflowWrap: 'break-word', color: '#0f172a' }}>
                      {selectedOrder.workLocation || selectedOrder.location || '—'}
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Lingkup Pekerjaan" span={2}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: 1.6, color: '#0f172a' }}>
                      {selectedOrder.scopeOfWork}
                    </div>
                  </Descriptions.Item>
                  {selectedOrder.notes && (
                    <Descriptions.Item label="Catatan / Ketentuan Khusus" span={2}>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'normal', overflowWrap: 'break-word', lineHeight: 1.6, color: '#475569' }}>
                        {selectedOrder.notes}
                      </div>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW MODE 3: CREATE / EDIT FORM                                          */}
            {/* ========================================================================= */}
            {(viewMode === 'CREATE' || viewMode === 'EDIT') && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Button
                    size="small"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => setViewMode(selectedOrder ? 'DETAIL' : 'LIST')}
                    style={{ borderRadius: 6, fontSize: 11.5 }}
                  >
                    ← Batal / Kembali
                  </Button>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                    {viewMode === 'EDIT' ? `Ubah Draft SPK #${selectedOrder?.serviceOrderNumber}` : 'Buat SPK / Work Order Baru'}
                  </span>
                </div>

                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  initialValues={{
                    documentType: 'SPK',
                    workLocation: po?.deliveryLocation || 'Lokasi Proyek',
                  }}
                >
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600, fontSize: 12 }}>Tipe Dokumen</span>}
                        name="documentType"
                        rules={[{ required: true, message: 'Pilih tipe dokumen' }]}
                      >
                        <Select style={{ borderRadius: 6 }}>
                          <Select.Option value="SPK">SPK (Surat Perintah Kerja)</Select.Option>
                          <Select.Option value="WORK_ORDER">Work Order (WO)</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600, fontSize: 12 }}>Target Mulai Pelaksanaan</span>}
                        name="startDate"
                      >
                        <DatePicker style={{ width: '100%', borderRadius: 6 }} format="DD MMMM YYYY" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600, fontSize: 12 }}>Target Selesai Pekerjaan</span>}
                        name="endDate"
                      >
                        <DatePicker style={{ width: '100%', borderRadius: 6 }} format="DD MMMM YYYY" />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600, fontSize: 12 }}>Lingkup Pekerjaan Jasa (Scope of Work)</span>}
                        name="scopeOfWork"
                        rules={[{ required: true, message: 'Lingkup pekerjaan wajib diisi' }]}
                      >
                        <Input.TextArea
                          rows={3}
                          placeholder="Uraikan detail lingkup pekerjaan yang wajib diselesaikan oleh vendor/subkontraktor..."
                          style={{ borderRadius: 6, fontSize: 12 }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600, fontSize: 12 }}>Lokasi Pekerjaan (Site / Workshop)</span>}
                        name="workLocation"
                      >
                        <Input
                          prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />}
                          placeholder="Contoh: Site Proyek Gedung Fasilitas Utama, Lantai 2"
                          style={{ borderRadius: 6 }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Form.Item
                        label={<span style={{ fontWeight: 600, fontSize: 12 }}>Catatan / Instruksi Khusus</span>}
                        name="notes"
                      >
                        <Input.TextArea
                          rows={2}
                          placeholder="Contoh: Wajib APD lengkap, izin kerja panas (hot work permit), dan SOP K3."
                          style={{ borderRadius: 6, fontSize: 12 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancellation Reason Modal */}
      <Modal
        open={showCancelModal}
        title="Konfirmasi Pembatalan SPK / Work Order"
        onCancel={() => {
          setShowCancelModal(false);
          cancelForm.resetFields();
        }}
        onOk={() => cancelForm.submit()}
        okText="Konfirmasi Batalkan"
        okButtonProps={{ danger: true, loading: isSubmitting }}
        cancelText="Kembali"
        destroyOnClose
      >
        <Form form={cancelForm} layout="vertical" onFinish={handleCancelOrder}>
          <Form.Item
            name="reason"
            label="Alasan Pembatalan SPK"
            rules={[{ required: true, message: 'Alasan pembatalan wajib diisi' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Jelaskan alasan pembatalan SPK / Work Order ini..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ServiceOrderModal;
