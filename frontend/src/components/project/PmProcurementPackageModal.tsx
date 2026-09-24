'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Checkbox,
  Alert,
  Spin,
  Empty,
  Popconfirm,
  Divider,
  message,
} from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  RollbackOutlined,
  StopOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ShoppingCartOutlined,
  ClockCircleFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ProcurementService,
  ProcurementPackage,
  ProcurementPackageStatus,
  CreatePackageDraftPayload,
  UpdatePackageDraftPayload,
  ProcurementCostItemAvailability,
} from '@/services/procurement.service';
import {
  ProjectService,
  CanonicalCostCategory,
  CanonicalCostItem,
} from '@/services/project.service';
import { useAuth } from '@/context/AuthContext';
import { getPackageStatusTag } from '@/components/procurement/ProcurementPackageDetailDrawer';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export interface EligibleCostItemRow extends CanonicalCostItem {
  categoryKey: string;
  categoryLabel?: string;
  categoryMode?: string;
}

/**
 * Pure helper to build WBS lookup map from canonical wbsCostSummary or costEstimateData.
 */
export function buildWbsMap(
  costEstimateOrSummary?: any
): Map<number, { code: string; name: string }> {
  const summary = Array.isArray(costEstimateOrSummary)
    ? costEstimateOrSummary
    : costEstimateOrSummary?.wbsCostSummary;

  const map = new Map<number, { code: string; name: string }>();
  if (Array.isArray(summary)) {
    summary.forEach((w: any) => {
      if (w.wbsId) {
        map.set(Number(w.wbsId), {
          code: w.wbsCode,
          name: w.wbsName,
        });
      }
    });
  }
  return map;
}

/**
 * Pure canonical filter for procurement package eligible CostItems.
 * Rule: categoryKey in [MATERIAL, EQUIPMENT, SUBCONTRACTOR, OPERATIONAL]
 * and category.mode === 'ITEMIZED' and items is Array.
 * Accepts either costEstimateData object or categories array directly.
 */
export function filterEligibleCostItems(
  costEstimateOrCategories?: any
): EligibleCostItemRow[] {
  const categories = Array.isArray(costEstimateOrCategories)
    ? costEstimateOrCategories
    : costEstimateOrCategories?.categories;

  if (!categories || !Array.isArray(categories)) {
    return [];
  }
  const eligibleCategories = ['MATERIAL', 'EQUIPMENT', 'SUBCONTRACTOR', 'OPERATIONAL'];
  const items: EligibleCostItemRow[] = [];

  categories.forEach((cat: CanonicalCostCategory) => {
    if (
      eligibleCategories.includes(cat.categoryKey) &&
      cat.mode === 'ITEMIZED' &&
      Array.isArray(cat.items)
    ) {
      cat.items.forEach((ci: CanonicalCostItem) => {
        items.push({
          ...ci,
          categoryKey: cat.categoryKey,
          categoryLabel: cat.categoryLabel,
          categoryMode: cat.mode,
        });
      });
    }
  });

  return items;
}

/**
 * Resolves WBS label or Project-Level display tag.
 * Fallback: WBS Node #<id> if label is not found in wbsCostSummary.
 */
export function resolveWbsDisplay(
  item: { assignmentScope?: string; wbsId?: number | null },
  wbsMap: Map<number, { code: string; name: string }>
): { isProjectLevel: boolean; label: string } {
  if (item.assignmentScope === 'PROJECT' || !item.wbsId) {
    return { isProjectLevel: true, label: 'Project-Level' };
  }
  const wbsInfo = wbsMap.get(Number(item.wbsId));
  if (wbsInfo && (wbsInfo.code || wbsInfo.name)) {
    const formatted = [wbsInfo.code, wbsInfo.name].filter(Boolean).join(' — ');
    return { isProjectLevel: false, label: `WBS ${formatted}` };
  }
  return { isProjectLevel: false, label: `WBS Node #${item.wbsId}` };
}

export interface PmProcurementPackageModalProps {
  open: boolean;
  onClose: () => void;
  project: {
    id: number;
    name?: string;
    project_name?: string;
    code?: string;
    project_code?: string;
    status?: string;
    managerId?: number | null;
  } | null;
  onRefreshParent?: () => void;
}

export const PmProcurementPackageModal: React.FC<PmProcurementPackageModalProps> = ({
  open,
  onClose,
  project,
  onRefreshParent,
}) => {
  const queryClient = useQueryClient();
  const { user, isProjectManager, isSuperAdmin } = useAuth();
  const projectId = Number(project?.id || 0);

  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingPackage, setEditingPackage] = useState<ProcurementPackage | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [selectedCostItemIds, setSelectedCostItemIds] = useState<React.Key[]>([]);
  const [quantitiesMap, setQuantitiesMap] = useState<Record<number, number>>({});
  const [itemDatesMap, setItemDatesMap] = useState<Record<number, string | undefined>>({});
  const [viewingPackage, setViewingPackage] = useState<ProcurementPackage | null>(null);
  const [showAllocatedItems, setShowAllocatedItems] = useState(false);
  const { data: availableItems = [], isFetching: loadingAvailability, isError: availabilityError, refetch: refetchAvailability } = useQuery({
    queryKey: ['procurement', 'availability', projectId],
    queryFn: () => ProcurementService.getEligibleCostItems(projectId),
    enabled: Boolean(open && projectId > 0),
    staleTime: 0,
  });

  // 1. Load project packages via React Query
  const {
    data: packages = [],
    isLoading: loadingPackages,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ['procurement', 'packages', { projectId }],
    queryFn: () => ProcurementService.getPackages({ projectId }),
    enabled: Boolean(open && projectId > 0),
    staleTime: 10 * 1000,
  });

  // 2. Load active approved RAB CostItems for the project
  const {
    data: costEstimateData,
    isLoading: loadingCostEstimate,
  } = useQuery({
    queryKey: ['project-cost-estimate', projectId],
    queryFn: () => ProjectService.getCostEstimate(projectId),
    enabled: Boolean(open && projectId > 0),
    staleTime: 60 * 1000,
  });

  // Authoritative WBS mapping from costEstimateData.wbsCostSummary
  const wbsMap = useMemo(() => {
    return buildWbsMap(costEstimateData?.wbsCostSummary);
  }, [costEstimateData]);

  const eligibleCostItems = useMemo(() => availableItems.filter(item =>
    showAllocatedItems || item.availableQty > 0 || selectedCostItemIds.includes(item.id)
  ), [availableItems, showAllocatedItems, selectedCostItemIds]);

  useEffect(() => {
    if (open) {
      setViewMode('list');
      setEditingPackage(null);
      setSelectedCostItemIds([]);
      setShowAllocatedItems(false);
    }
  }, [open, projectId]);

  // Handle open Form to Create or Edit
  const handleOpenCreateForm = () => {
    void refetchAvailability();
    setEditingPackage(null);
    setSelectedCostItemIds([]);
    setQuantitiesMap({});
    setItemDatesMap({});
    form.resetFields();
    setViewMode('form');
  };

  const handleOpenEditForm = (pkg: ProcurementPackage) => {
    void refetchAvailability();
    setEditingPackage(pkg);
    const itemIds = (pkg.items || []).map((i) => i.costItemId);
    const qMap: Record<number, number> = {};
    const dMap: Record<number, string> = {};

    (pkg.items || []).forEach((i) => {
      qMap[i.costItemId] = Number(i.requestedQty);
      if (i.requiredDate) {
        dMap[i.costItemId] = dayjs(i.requiredDate).isValid()
          ? dayjs(i.requiredDate).format('YYYY-MM-DD')
          : i.requiredDate;
      }
    });

    setSelectedCostItemIds(itemIds);
    setQuantitiesMap(qMap);
    setItemDatesMap(dMap);

    form.setFieldsValue({
      title: pkg.title,
      description: pkg.description,
      requiredDate: pkg.requiredDate ? dayjs(pkg.requiredDate) : undefined,
    });

    setViewMode('form');
  };

  // Submit Draft or Submit Immediately
  const handleSavePackage = async (submitImmediately = false) => {
    try {
      const values = await form.validateFields();

      if (selectedCostItemIds.length === 0) {
        message.error('Wajib memilih minimal 1 item RAB untuk paket pengadaan.');
        return;
      }

      // Check required date on submit
      if (submitImmediately && !values.requiredDate) {
        message.error('Tanggal kebutuhan (requiredDate) wajib ditentukan sebelum mengajukan paket!');
        return;
      }

      // Build items payload: strictly { costItemId, requestedQty, requiredDate }
      const itemsPayload = selectedCostItemIds.map((cid) => {
        const costItemId = Number(cid);
        const requestedQty = quantitiesMap[costItemId];
        if (!requestedQty || requestedQty <= 0) {
          throw new Error(`Kuantitas untuk item #${costItemId} harus lebih dari 0.`);
        }
        const availability = availableItems.find(item => Number(item.id) === costItemId);
        if (!availability || requestedQty > availability.availableQty) {
          throw new Error(`${availability?.itemName || `Item #${costItemId}`}: jumlah diminta melebihi sisa tersedia (${availability?.availableQty ?? 0}).`);
        }
        return {
          costItemId,
          requestedQty,
          requiredDate: itemDatesMap[costItemId] || (values.requiredDate ? values.requiredDate.format('YYYY-MM-DD') : undefined),
        };
      });

      setSubmitting(true);
      let savedPkg: ProcurementPackage;

      if (editingPackage) {
        // Edit existing package via verified PUT method
        const payload: UpdatePackageDraftPayload = {
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          requiredDate: values.requiredDate ? values.requiredDate.format('YYYY-MM-DD') : undefined,
          items: itemsPayload,
        };
        savedPkg = submitImmediately
          ? await ProcurementService.saveAndSubmitPackage(payload, editingPackage.id)
          : await ProcurementService.updatePackageDraft(editingPackage.id, payload);
      } else {
        // Create new draft
        const payload: CreatePackageDraftPayload = {
          projectId,
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          requiredDate: values.requiredDate ? values.requiredDate.format('YYYY-MM-DD') : undefined,
          items: itemsPayload,
        };
        savedPkg = submitImmediately
          ? await ProcurementService.saveAndSubmitPackage(payload)
          : await ProcurementService.createPackageDraft(payload);
      }

      // If submit immediately was requested:
      if (submitImmediately) {
        message.success(`Paket ${savedPkg.packageNumber} berhasil diajukan ke Antrean Procurement!`);
      } else {
        message.success(`Draf paket ${savedPkg.packageNumber} berhasil disimpan!`);
      }

      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      onRefreshParent?.();
      setViewMode('list');
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal menyimpan paket pengadaan.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
      void queryClient.invalidateQueries({ queryKey: ['procurement', 'availability', projectId] });
    }
  };

  // Lifecycle Actions
  const handleSubmitPackage = async (pkgId: number) => {
    try {
      setSubmitting(true);
      const res = await ProcurementService.submitPackage(pkgId);
      message.success(`Paket ${res.packageNumber} berhasil diajukan ke Procurement!`);
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      onRefreshParent?.();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengajukan paket.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmitPackage = async (pkgId: number) => {
    try {
      setSubmitting(true);
      const res = await ProcurementService.resubmitPackage(pkgId);
      message.success(`Paket ${res.packageNumber} berhasil diajukan ulang ke Procurement!`);
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      onRefreshParent?.();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mengajukan ulang paket.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDraft = async (pkgId: number) => {
    try {
      setSubmitting(true);
      await ProcurementService.deletePackageDraft(pkgId);
      message.success('Draf paket berhasil dihapus.');
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      onRefreshParent?.();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal menghapus draf paket.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPackage = async (pkgId: number) => {
    try {
      setSubmitting(true);
      await ProcurementService.cancelPackage(pkgId, { reason: 'Dibatalkan oleh Project Manager' });
      message.success('Paket berhasil dibatalkan.');
      await queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'] });
      onRefreshParent?.();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal membatalkan paket.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // CostItems selection table columns
  const costItemColumns = [
    {
      title: 'Item RAB',
      key: 'itemName',
      width: 250,
      render: (_: any, r: EligibleCostItemRow) => {
        const wbs = resolveWbsDisplay(r, wbsMap);
        return (
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.itemName}</div>
            <Space size={4} style={{ marginTop: 2 }} wrap>
              <Tag color="cyan" style={{ fontSize: 9.5, margin: 0 }}>
                {r.categoryKey}
              </Tag>
              {wbs.isProjectLevel ? (
                <Tag color="purple" style={{ fontSize: 9.5, margin: 0 }}>
                  {wbs.label}
                </Tag>
              ) : (
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {wbs.label}
                </span>
              )}
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Baseline RAB',
      key: 'baseline',
      width: 120,
      align: 'right' as const,
      render: (_: any, r: any) => (
        <span style={{ fontSize: 12 }}>
          {Number(r.quantity || 0).toLocaleString('id-ID')} {r.uom || 'Unit'}
        </span>
      ),
    },
    {
      title: 'Sisa Tersedia',
      key: 'availableQty',
      width: 145,
      render: (_: any, r: ProcurementCostItemAvailability) => (
        <div>
          <Text strong type={r.availableQty > 0 ? undefined : 'secondary'}>{r.availableQty.toLocaleString('id-ID')} {r.uom}</Text>
          {r.availableQty === 0 && <div><Text type="secondary" style={{ fontSize: 11 }}>Sudah dialokasikan sepenuhnya</Text></div>}
        </div>
      ),
    },
    {
      title: 'Estimasi Harga',
      key: 'price',
      width: 130,
      align: 'right' as const,
      render: (_: any, r: any) => `Rp ${Number(r.unitPrice || 0).toLocaleString('id-ID')}`,
    },
    {
      title: 'Jumlah Diminta (Qty)',
      key: 'requestedQty',
      width: 160,
      render: (_: any, r: any) => {
        const isSelected = selectedCostItemIds.includes(r.id);
        if (r.availableQty <= 0) return <Text type="secondary">Tidak tersedia</Text>;
        return (
          <InputNumber
            min={0.0001}
            max={r.availableQty}
            disabled={!isSelected || r.availableQty <= 0}
            value={quantitiesMap[r.id] ?? r.availableQty}
            onChange={(val) => {
              if (val !== null) {
                setQuantitiesMap((prev) => ({ ...prev, [r.id]: Number(val) }));
              }
            }}
            placeholder="Qty"
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: 'Tgl Dibutuhkan (Opsional)',
      key: 'itemDate',
      width: 160,
      render: (_: any, r: any) => {
        const isSelected = selectedCostItemIds.includes(r.id);
        return (
          <DatePicker
            disabled={!isSelected}
            format="DD/MM/YYYY"
            value={itemDatesMap[r.id] ? dayjs(itemDatesMap[r.id]) : null}
            onChange={(date) => {
              setItemDatesMap((prev) => ({
                ...prev,
                [r.id]: date ? date.format('YYYY-MM-DD') : undefined,
              }));
            }}
            placeholder="Pilih tgl"
            style={{ width: '100%' }}
          />
        );
      },
    },
  ];

  const packageListColumns = [
    {
      title: 'Nomor Paket',
      key: 'packageNumber',
      width: 180,
      render: (_: any, r: ProcurementPackage) => (
        <div>
          <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#1d4ed8' }}>
            {r.packageNumber}
          </span>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{r.title}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_: any, r: ProcurementPackage) => getPackageStatusTag(r.status),
    },
    {
      title: 'Tgl Dibutuhkan',
      dataIndex: 'requiredDate',
      key: 'requiredDate',
      width: 130,
      render: (val: string) => (val ? dayjs(val).format('DD MMM YYYY') : '—'),
    },
    {
      title: 'Item',
      key: 'itemCount',
      width: 90,
      align: 'center' as const,
      render: (_: any, r: ProcurementPackage) => (
        <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>
          {(r.items || []).length} Item
        </Tag>
      ),
    },
    {
      title: 'Total Estimasi',
      dataIndex: 'totalEstimatedAmount',
      key: 'totalEstimatedAmount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => (
        <span style={{ fontWeight: 700, color: '#059669' }}>
          Rp {Number(val || 0).toLocaleString('id-ID')}
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 240,
      align: 'center' as const,
      render: (_: any, r: ProcurementPackage) => (
        <Space size={4} wrap>
          {r.status === 'DRAFT' && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditForm(r)}>
                Ubah
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                style={{ backgroundColor: '#2563eb' }}
                onClick={() => handleSubmitPackage(r.id)}
              >
                Ajukan
              </Button>
              <Popconfirm title="Hapus draf paket ini?" onConfirm={() => handleDeleteDraft(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}

          {r.status === 'RETURNED' && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditForm(r)}>
                Revisi
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                style={{ backgroundColor: '#059669', borderColor: '#059669' }}
                onClick={() => handleResubmitPackage(r.id)}
              >
                Ajukan Ulang
              </Button>
              <Button size="small" danger onClick={() => handleCancelPackage(r.id)}>
                Batal
              </Button>
            </>
          )}

          {r.status === 'SUBMITTED' && (
            <Popconfirm title="Batalkan pengajuan paket ini?" onConfirm={() => handleCancelPackage(r.id)}>
              <Button size="small" danger icon={<StopOutlined />}>
                Batalkan
              </Button>
            </Popconfirm>
          )}

          {(r.status === 'PR_CREATED' || r.status === 'CLOSED') && (
            <Tag color="green" style={{ fontWeight: 600 }}>
              PR: {r.purchaseRequest?.prNumber || 'Diterbitkan'}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (viewMode === 'form') {
          setViewMode('list');
        } else {
          onClose();
        }
      }}
      width="min(1200px, 95vw)"
      centered
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCartOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>
            Paket Pengadaan Proyek — {project?.project_name || project?.name || `Proyek #${projectId}`}
          </span>
          {project?.project_code && (
            <Tag color="blue" style={{ fontFamily: 'monospace' }}>{project.project_code}</Tag>
          )}
        </div>
      }
      footer={null}
    >
      {viewMode === 'list' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <Text strong style={{ fontSize: 13.5, color: '#0f172a' }}>
                Daftar Paket Pengadaan (Procurement Packages)
              </Text>
              <div style={{ fontSize: 11.5, color: '#64748b' }}>
                Paket pengadaan dibentuk dari item RAB yang disetujui, diajukan oleh PM, dan diproses oleh tim Procurement.
              </div>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateForm}
              style={{ backgroundColor: '#2563eb', fontWeight: 600 }}
            >
              Buat Paket Pengadaan Baru
            </Button>
          </div>

          <Table
            size="small"
            columns={packageListColumns}
            dataSource={packages}
            rowKey="id"
            loading={loadingPackages}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div style={{ padding: '16px 0' }}>
                      <div style={{ fontWeight: 600, color: '#475569' }}>Belum ada paket pengadaan untuk proyek ini</div>
                      <Text type="secondary" style={{ fontSize: 11.5 }}>
                        Klik &ldquo;Buat Paket Pengadaan Baru&rdquo; untuk memilih item dari RAB yang telah disetujui.
                      </Text>
                    </div>
                  }
                />
              ),
            }}
          />
        </div>
      ) : (
        <div>
          {/* Form Create / Edit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>
              {editingPackage ? `Ubah / Revisi Paket ${editingPackage.packageNumber}` : 'Penyusunan Paket Pengadaan Baru'}
            </Title>
            <Button size="small" onClick={() => setViewMode('list')}>
              Kembali ke Daftar
            </Button>
          </div>

          {editingPackage?.rejectionNotes && (
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleFilled style={{ color: '#d97706' }} />}
              message="Alasan Pengembalian oleh Procurement:"
              description={<Paragraph style={{ margin: 0, color: '#92400e' }}>{editingPackage.rejectionNotes}</Paragraph>}
              style={{ marginBottom: 14, border: '1px solid #fde68a', background: '#fffbeb' }}
            />
          )}

          <Form form={form} layout="vertical">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              <Form.Item
                label="Judul Paket Pengadaan"
                name="title"
                rules={[{ required: true, message: 'Judul paket wajib diisi!' }]}
              >
                <Input placeholder="Contoh: Pengadaan Kabel MV & LV Substation" maxLength={255} />
              </Form.Item>

              <Form.Item
                label="Tanggal Target Dibutuhkan (Required Date)"
                name="requiredDate"
                extra="Wajib diisi sebelum mengajukan ke tim Procurement."
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Pilih tanggal" />
              </Form.Item>
            </div>

            <Form.Item label="Keterangan / Ruang Lingkup (Opsional)" name="description">
              <TextArea rows={2} placeholder="Penjelasan teknis atau spesifikasi khusus..." />
            </Form.Item>

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                  Pilih Item Biaya dari RAB Aktif yang Disetujui
                </Text>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  *Centang item yang ingin dimasukkan ke dalam paket ini. Tentukan kuantitas yang diminta.
                </div>
              </div>
              <Tag color="blue" style={{ fontWeight: 600 }}>
                {selectedCostItemIds.length} Item Dipilih
              </Tag>
            </div>

            {availabilityError && <Alert type="error" showIcon message="Sisa kuota gagal dimuat. Coba buka kembali formulir." style={{ marginBottom: 8 }} />}
            <Checkbox checked={showAllocatedItems} onChange={event => setShowAllocatedItems(event.target.checked)} style={{ marginBottom: 8 }}>
              Tampilkan item sudah dialokasikan
            </Checkbox>
            <Table
              size="small"
              columns={costItemColumns}
              dataSource={eligibleCostItems}
              rowKey="id"
              loading={loadingAvailability}
              locale={{ emptyText: 'Tidak ada item RAB dengan sisa kuota pengadaan.' }}
              pagination={false}
              scroll={{ x: 1100, y: 260 }}
              rowSelection={{
                selectedRowKeys: selectedCostItemIds,
                getCheckboxProps: (record) => ({ disabled: record.availableQty <= 0 && !selectedCostItemIds.includes(record.id) }),
                onChange: (selectedKeys) => {
                  setSelectedCostItemIds(selectedKeys);
                  // Initialize default quantity if not set
                  setQuantitiesMap((prev) => {
                    const next = { ...prev };
                    selectedKeys.forEach((key) => {
                      const id = Number(key);
                      if (next[id] === undefined) {
                        const it = eligibleCostItems.find((ci) => ci.id === id);
                        next[id] = Number(it?.availableQty || 0);
                      }
                    });
                    return next;
                  });
                },
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <Button onClick={() => setViewMode('list')}>Batal</Button>
              <Button disabled={availabilityError || loadingAvailability} loading={submitting} onClick={() => handleSavePackage(false)}>
                Simpan Draf
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                disabled={availabilityError || loadingAvailability}
                onClick={() => handleSavePackage(true)}
                style={{ backgroundColor: '#059669', borderColor: '#059669' }}
              >
                {editingPackage?.status === 'RETURNED' ? 'Simpan & Ajukan Ulang' : 'Simpan & Ajukan ke Procurement'}
              </Button>
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
};
