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
} from '@/services/procurement.service';
import { ProjectService } from '@/services/project.service';
import { useAuth } from '@/context/AuthContext';
import { getPackageStatusTag } from '@/components/procurement/ProcurementPackageDetailDrawer';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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
}

export const PmProcurementPackageModal: React.FC<PmProcurementPackageModalProps> = ({
  open,
  onClose,
  project,
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
  const [itemDatesMap, setItemDatesMap] = useState<Record<number, string>>({});
  const [viewingPackage, setViewingPackage] = useState<ProcurementPackage | null>(null);

  // 1. Load project packages via React Query
  const {
    data: packages = [],
    isLoading: loadingPackages,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ['procurement-packages', { projectId }],
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

  // Filter eligible CostItems: entryMode = 'ITEMIZED' & category in [MATERIAL, EQUIPMENT, SUBCONTRACTOR, OPERATIONAL]
  const eligibleCostItems = useMemo(() => {
    if (!costEstimateData?.categories || !Array.isArray(costEstimateData.categories)) {
      return [];
    }
    const eligibleCategories = ['MATERIAL', 'EQUIPMENT', 'SUBCONTRACTOR', 'OPERATIONAL'];
    const items: any[] = [];

    costEstimateData.categories.forEach((cat: any) => {
      if (eligibleCategories.includes(cat.categoryKey) && Array.isArray(cat.costItems)) {
        cat.costItems.forEach((ci: any) => {
          if (ci.entryMode === 'ITEMIZED') {
            items.push({
              ...ci,
              categoryKey: cat.categoryKey,
            });
          }
        });
      }
    });

    return items;
  }, [costEstimateData]);

  // Handle open Form to Create or Edit
  const handleOpenCreateForm = () => {
    setEditingPackage(null);
    setSelectedCostItemIds([]);
    setQuantitiesMap({});
    setItemDatesMap({});
    form.resetFields();
    setViewMode('form');
  };

  const handleOpenEditForm = (pkg: ProcurementPackage) => {
    setEditingPackage(pkg);
    const itemIds = (pkg.items || []).map((i) => i.costItemId);
    const qMap: Record<number, number> = {};
    const dMap: Record<number, string> = {};

    (pkg.items || []).forEach((i) => {
      qMap[i.costItemId] = Number(i.requestedQty);
      if (i.requiredDate) dMap[i.costItemId] = i.requiredDate;
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
        savedPkg = await ProcurementService.updatePackageDraft(editingPackage.id, payload);
      } else {
        // Create new draft
        const payload: CreatePackageDraftPayload = {
          projectId,
          title: values.title.trim(),
          description: values.description?.trim() || undefined,
          requiredDate: values.requiredDate ? values.requiredDate.format('YYYY-MM-DD') : undefined,
          items: itemsPayload,
        };
        savedPkg = await ProcurementService.createPackageDraft(payload);
      }

      // If submit immediately was requested:
      if (submitImmediately) {
        if (editingPackage && editingPackage.status === 'RETURNED') {
          savedPkg = await ProcurementService.resubmitPackage(savedPkg.id);
          message.success(`Paket ${savedPkg.packageNumber} berhasil diajukan ulang ke Procurement!`);
        } else {
          savedPkg = await ProcurementService.submitPackage(savedPkg.id);
          message.success(`Paket ${savedPkg.packageNumber} berhasil diajukan ke Antrean Procurement!`);
        }
      } else {
        message.success(`Draf paket ${savedPkg.packageNumber} berhasil disimpan!`);
      }

      await queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
      setViewMode('list');
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal menyimpan paket pengadaan.';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // Lifecycle Actions
  const handleSubmitPackage = async (pkgId: number) => {
    try {
      setSubmitting(true);
      const res = await ProcurementService.submitPackage(pkgId);
      message.success(`Paket ${res.packageNumber} berhasil diajukan ke Procurement!`);
      await queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
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
      await queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
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
      await queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
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
      await queryClient.invalidateQueries({ queryKey: ['procurement-packages'] });
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
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{r.itemName}</div>
          <Space size={4} style={{ marginTop: 2 }}>
            <Tag color="cyan" style={{ fontSize: 9.5, margin: 0 }}>{r.categoryKey}</Tag>
            {r.wbs?.task_name && (
              <span style={{ fontSize: 11, color: '#64748b' }}>WBS: {r.wbs.task_name}</span>
            )}
          </Space>
        </div>
      ),
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
        return (
          <InputNumber
            min={0.0001}
            disabled={!isSelected}
            value={quantitiesMap[r.id] ?? Number(r.quantity || 1)}
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
            value={itemDatesMap[r.id] ? dayjs(itemDatesMap[r.id]) : undefined}
            onChange={(_, dateString) => {
              setItemDatesMap((prev) => ({ ...prev, [r.id]: dateString as string }));
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

          {r.status === 'PR_CREATED' && (
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
      width="min(1050px, 95vw)"
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

            <Table
              size="small"
              columns={costItemColumns}
              dataSource={eligibleCostItems}
              rowKey="id"
              loading={loadingCostEstimate}
              pagination={false}
              scroll={{ y: 260 }}
              rowSelection={{
                selectedRowKeys: selectedCostItemIds,
                onChange: (selectedKeys) => {
                  setSelectedCostItemIds(selectedKeys);
                  // Initialize default quantity if not set
                  setQuantitiesMap((prev) => {
                    const next = { ...prev };
                    selectedKeys.forEach((key) => {
                      const id = Number(key);
                      if (next[id] === undefined) {
                        const it = eligibleCostItems.find((ci) => ci.id === id);
                        next[id] = Number(it?.quantity || 1);
                      }
                    });
                    return next;
                  });
                },
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
              <Button onClick={() => setViewMode('list')}>Batal</Button>
              <Button loading={submitting} onClick={() => handleSavePackage(false)}>
                Simpan Draf
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
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
