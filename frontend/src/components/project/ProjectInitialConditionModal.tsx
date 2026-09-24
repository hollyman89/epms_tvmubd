"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Radio,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Tag,
  Alert,
  message,
  Card,
  Spin,
} from 'antd';
import {
  FileTextOutlined,
  SaveOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  EnvironmentOutlined,
  LockOutlined,
  AuditOutlined,
  CompassOutlined,
  ThunderboltOutlined,
  CarOutlined,
  StopOutlined,
  FireOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { ProjectCharter } from '../ProjectOperationTab';
import { useAuth } from '@/context/AuthContext';
import { ProjectService } from '@/services/project.service';

const { Text } = Typography;
const { TextArea } = Input;

export type ProjectConditionStatus = 'NORMAL' | 'PERLU_PERHATIAN' | 'BERISIKO';

export interface ProjectInitialConditionRecord {
  id?: number;
  projectId: number | string;
  conditionStatus: ProjectConditionStatus;
  locationCondition: string;
  existingInfrastructure?: string | null;
  accessLogistics?: string | null;
  initialConstraints: string;
  initialRisks: string;
  pmRecommendation?: string | null;
  status?: string;
  isComplete?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | number | null;
}

export const getInitialConditionStorageKey = (projectIdOrCode: string | number): string => {
  return `epms_initial_condition_${projectIdOrCode}`;
};

export const getInitialCondition = (projectIdOrCode: string | number): ProjectInitialConditionRecord | null => {
  if (typeof window === 'undefined' || !projectIdOrCode) return null;
  try {
    const key = getInitialConditionStorageKey(projectIdOrCode);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as ProjectInitialConditionRecord;
    }
  } catch (e) {
    console.warn('Failed to load initial condition from localStorage:', e);
  }
  return null;
};

export const saveInitialCondition = (record: ProjectInitialConditionRecord): void => {
  if (typeof window === 'undefined' || !record?.projectId) {
    return;
  }
  const key = getInitialConditionStorageKey(record.projectId);
  localStorage.setItem(key, JSON.stringify(record));
};

export const isInitialConditionComplete = (record: ProjectInitialConditionRecord | null): boolean => {
  if (!record) return false;
  return Boolean(
    record.conditionStatus &&
    record.locationCondition?.trim() &&
    record.initialConstraints?.trim() &&
    record.initialRisks?.trim()
  );
};

export interface ProjectInitialConditionModalProps {
  open: boolean;
  onClose: () => void;
  charter: ProjectCharter | null;
  onSaveSuccess?: (record: ProjectInitialConditionRecord) => void;
  readOnly?: boolean;
}

export const ProjectInitialConditionModal: React.FC<ProjectInitialConditionModalProps> = ({
  open,
  onClose,
  charter,
  onSaveSuccess,
  readOnly = false,
}) => {
  const { user, isProjectManager, isSuperAdmin, isPmOnly } = useAuth();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [existingRecord, setExistingRecord] = useState<ProjectInitialConditionRecord | null>(null);
  const [isDraftDetected, setIsDraftDetected] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Form watch for live completeness meter
  const formValues = Form.useWatch([], form);
  const isEditable = !readOnly;

  // Calculate live baseline input completeness (4 required inputs)
  const baselineCompletion = useMemo(() => {
    const hasStatus = Boolean(formValues?.conditionStatus);
    const hasLocation = Boolean(formValues?.locationCondition && formValues.locationCondition.trim().length > 0);
    const hasConstraints = Boolean(formValues?.initialConstraints && formValues.initialConstraints.trim().length > 0);
    const hasRisks = Boolean(formValues?.initialRisks && formValues.initialRisks.trim().length > 0);

    let count = 0;
    if (hasStatus) count++;
    if (hasLocation) count++;
    if (hasConstraints) count++;
    if (hasRisks) count++;

    return {
      count,
      total: 4,
      isComplete: count === 4,
      hasStatus,
      hasLocation,
      hasConstraints,
      hasRisks,
    };
  }, [formValues]);

  const canonicalProjectId = useMemo(
    () => Number(charter?.projectId || (charter as any)?.project_id || charter?.id || 0),
    [charter]
  );

  // Load authoritative server data when modal opens (Single Source of Truth)
  useEffect(() => {
    if (open && charter && canonicalProjectId > 0) {
      const pid = canonicalProjectId;
      const storageKey = getInitialConditionStorageKey(pid);
      setIsLoading(true);
      setIsDirty(false);

      ProjectService.getInitialCondition(pid)
        .then((serverData) => {
          if (
            serverData &&
            (serverData.id ||
              serverData.status === 'READY' ||
              (serverData.locationCondition && serverData.locationCondition.trim().length > 0))
          ) {
            // Server has canonical record -> Server Wins!
            setExistingRecord(serverData);
            setIsDraftDetected(false);
            form.setFieldsValue({
              conditionStatus: serverData.conditionStatus || 'NORMAL',
              locationCondition: serverData.locationCondition || '',
              existingInfrastructure: serverData.existingInfrastructure || '',
              accessLogistics: serverData.accessLogistics || '',
              initialConstraints: serverData.initialConstraints || '',
              initialRisks: serverData.initialRisks || '',
              pmRecommendation: serverData.pmRecommendation || '',
            });
            // Clean up stale local storage draft
            if (typeof window !== 'undefined') {
              localStorage.removeItem(storageKey);
            }
          } else {
            // Server is empty / NOT_STARTED -> Check for legacy recovery draft
            let localDraft: ProjectInitialConditionRecord | null = null;
            if (typeof window !== 'undefined') {
              const rawDraft = localStorage.getItem(storageKey);
              if (rawDraft) {
                try {
                  localDraft = JSON.parse(rawDraft);
                } catch (e) {}
              }
            }

            if (localDraft && (localDraft.locationCondition || localDraft.initialConstraints || localDraft.initialRisks)) {
              setExistingRecord(localDraft);
              setIsDraftDetected(true);
              form.setFieldsValue({
                conditionStatus: localDraft.conditionStatus || 'NORMAL',
                locationCondition: localDraft.locationCondition || '',
                existingInfrastructure: localDraft.existingInfrastructure || '',
                accessLogistics: localDraft.accessLogistics || '',
                initialConstraints: localDraft.initialConstraints || '',
                initialRisks: localDraft.initialRisks || '',
                pmRecommendation: localDraft.pmRecommendation || '',
              });
            } else {
              setExistingRecord(null);
              setIsDraftDetected(false);
              form.resetFields();
              form.setFieldsValue({
                conditionStatus: 'NORMAL',
                locationCondition: '',
                existingInfrastructure: '',
                accessLogistics: '',
                initialConstraints: '',
                initialRisks: '',
                pmRecommendation: '',
              });
            }
          }
        })
        .catch((err) => {
          console.error('Failed to load initial condition from server:', err);
          // Fallback to local draft on network failure
          const localDraft = getInitialCondition(pid);
          if (localDraft) {
            setExistingRecord(localDraft);
            setIsDraftDetected(true);
            form.setFieldsValue(localDraft);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, charter, canonicalProjectId, form]);

  const handleFormChange = (_changedValues?: any, allValues?: any) => {
    if (!isDirty) {
      setIsDirty(true);
    }
    // Update local recovery draft on edit for crash recovery
    if (charter && canonicalProjectId > 0) {
      const currentValues = allValues || form.getFieldsValue();
      const statusVal = form.getFieldValue('conditionStatus') || currentValues?.conditionStatus || 'NORMAL';
      saveInitialCondition({
        projectId: canonicalProjectId,
        ...currentValues,
        conditionStatus: statusVal,
      });
    }
  };

  const handleSafeClose = useCallback(() => {
    if (isDirty && isEditable) {
      Modal.confirm({
        title: 'Perubahan Belum Disimpan',
        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
        content: 'Terdapat draf perubahan kondisi awal yang belum tersimpan ke server. Apakah Anda yakin ingin menutup modal?',
        okText: 'Tutup Tanpa Menyimpan',
        okType: 'danger',
        cancelText: 'Kembali Mengedit',
        centered: true,
        onOk: () => {
          setIsDirty(false);
          onClose();
        },
      });
    } else {
      onClose();
    }
  }, [isDirty, isEditable, onClose]);

  const handleSubmit = async (values: any) => {
    if (!charter || canonicalProjectId <= 0) {
      message.error('Project ID tidak valid.');
      return;
    }

    const pid = canonicalProjectId;

    // Frontend validation checks
    if (!values.conditionStatus) {
      message.error('Status kondisi proyek wajib dipilih.');
      return;
    }
    if (!values.locationCondition || !values.locationCondition.trim()) {
      message.error('Kondisi fisik lokasi wajib diisi.');
      return;
    }
    if (!values.initialConstraints || !values.initialConstraints.trim()) {
      message.error('Kendala awal wajib diisi.');
      return;
    }
    if (!values.initialRisks || !values.initialRisks.trim()) {
      message.error('Risiko awal wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        conditionStatus: values.conditionStatus,
        locationCondition: values.locationCondition.trim(),
        existingInfrastructure: values.existingInfrastructure ? values.existingInfrastructure.trim() : null,
        accessLogistics: values.accessLogistics ? values.accessLogistics.trim() : null,
        initialConstraints: values.initialConstraints.trim(),
        initialRisks: values.initialRisks.trim(),
        pmRecommendation: values.pmRecommendation ? values.pmRecommendation.trim() : null,
      };

      const savedRecord = await ProjectService.saveInitialCondition(pid, payload);

      // Clean up legacy localStorage draft upon authoritative API success
      const storageKey = getInitialConditionStorageKey(pid);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageKey);
      }

      setExistingRecord(savedRecord);
      setIsDraftDetected(false);
      setIsDirty(false);
      message.success('Baseline Kondisi Awal Proyek berhasil disimpan ke server!');
      onSaveSuccess?.(savedRecord);
      onClose();
    } catch (err: any) {
      console.error('Failed to save initial condition to server:', err);
      const errMsg = err.response?.data?.message || err.message || 'Gagal menyimpan kondisi awal proyek ke server.';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!charter) return null;

  return (
    <Modal
      open={open}
      onCancel={handleSafeClose}
      width="min(1080px, 95vw)"
      centered
      destroyOnClose
      styles={{
        body: {
          maxHeight: 'calc(85vh - 110px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 16px',
        },
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
            paddingTop: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AuditOutlined style={{ color: '#64748b' }} />
            {isSubmitting ? (
              <Tag color="processing" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                Menyimpan ke Server...
              </Tag>
            ) : isDirty ? (
              <Tag color="warning" style={{ fontSize: 11, borderRadius: 4, margin: 0 }}>
                ● DRAF: Perubahan Belum Disimpan
              </Tag>
            ) : existingRecord?.updatedAt ? (
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                ● SERVER: Tersimpan di Database SSOT ({new Date(existingRecord.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 11.5 }}>
                ● SERVER: Database SSOT Resmi
              </Text>
            )}
          </div>
          <Space size={8}>
            <Button onClick={handleSafeClose} style={{ borderRadius: 6 }}>
              {readOnly ? 'Tutup' : 'Batal'}
            </Button>
            {isEditable && (
              <Button
                type="primary"
                loading={isSubmitting}
                onClick={() => form.submit()}
                icon={<SaveOutlined />}
                style={{
                  backgroundColor: '#1d4ed8',
                  borderColor: '#1d4ed8',
                  borderRadius: 6,
                  fontWeight: 600,
                }}
              >
                Simpan Baseline Kondisi Awal
              </Button>
            )}
          </Space>
        </div>
      }
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 24 }}>
          <div style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 8, color: '#2563eb' }}>
            <FileTextOutlined style={{ fontSize: 18 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              Baseline Kondisi Awal Proyek — {charter.project_name}
            </div>
            <Text type="secondary" style={{ fontSize: 11, color: '#64748b' }}>
              Workspace dokumentasi kesiapan site, akses, infrastruktur, kendala operasional, dan risiko awal sebelum kickoff &amp; pengadaan
            </Text>
          </div>
        </div>
      }
    >
      <Spin spinning={isLoading}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Readonly / Locked Alert */}
          {readOnly && (
            <Alert
              type="warning"
              showIcon
              icon={<LockOutlined style={{ color: '#b45309' }} />}
              message={<span style={{ fontWeight: 700, fontSize: 12 }}>Baseline Terkunci (Mode Pratinjau / Review)</span>}
              description="Rencana Operasional sedang dalam tahap review manajemen atau telah disetujui. Formulir ditampilkan dalam mode baca (read-only)."
              style={{ borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}
            />
          )}

          {/* Draft Recovery Alert */}
          {isDraftDetected && !readOnly && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined style={{ color: '#b45309' }} />}
              message={<span style={{ fontWeight: 700, fontSize: 12 }}>Ditemukan Draf Pemulihan Lokal</span>}
              description="Data di bawah dipulihkan dari memori browser lokal. Klik 'Simpan Baseline Kondisi Awal' untuk memvalidasi dan menyimpannya secara resmi ke Database SSOT Server."
              style={{ borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}
            />
          )}

          {/* Executive Baseline Summary Strip */}
          <div
            style={{
              background: '#f8fafc',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <Row gutter={[12, 8]} align="middle" style={{ marginLeft: 0, marginRight: 0 }}>
              <Col xs={24} sm={8} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PROYEK / REF SPK:
                </Text>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {charter.project_name}
                </div>
                <Tag color="blue" style={{ fontSize: 9.5, margin: 0, marginTop: 2, borderRadius: 4 }}>
                  {charter.project_code || `PRJ-${charter.id}`}
                </Tag>
              </Col>

              <Col xs={24} sm={8} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  KLIEN &amp; LOKASI SITE:
                </Text>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#0f766e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {charter.customerName || 'PT Customer'}
                </div>
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <EnvironmentOutlined style={{ marginRight: 3, color: '#0284c7' }} />
                  {charter.city ? `${charter.city}${charter.province ? `, ${charter.province}` : ''}` : 'Site Lapangan'}
                </div>
              </Col>

              <Col xs={24} sm={8} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  STATUS SSOT &amp; FORM BASELINE:
                </Text>
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {existingRecord?.status === 'READY' || isInitialConditionComplete(existingRecord) ? (
                    <Tag color="success" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                      TERSIMPAN DI SERVER
                    </Tag>
                  ) : isDraftDetected ? (
                    <Tag color="warning" style={{ fontWeight: 700, borderRadius: 4, margin: 0 }}>
                      DRAFT LOKAL
                    </Tag>
                  ) : (
                    <Tag color="default" style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}>
                      ○ BELUM DIISI
                    </Tag>
                  )}
                  <Tag
                    color={baselineCompletion.isComplete ? 'blue' : 'default'}
                    style={{ fontWeight: 600, borderRadius: 4, margin: 0 }}
                  >
                    {baselineCompletion.isComplete
                      ? '4/4 Informasi Wajib Lengkap'
                      : `${baselineCompletion.count}/4 Wajib Lengkap (${4 - baselineCompletion.count} belum diisi)`}
                  </Tag>
                </div>
              </Col>
            </Row>
          </div>

          {/* Form Container */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={handleFormChange}
            disabled={!isEditable}
            initialValues={{
              conditionStatus: 'NORMAL',
            }}
          >
            {/* Section: Status Kesiapan Lapangan (Decision Strip) */}
            <Card
              size="small"
              style={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fafafa',
                marginBottom: 10,
              }}
            >
              <Form.Item
                name="conditionStatus"
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                      Status Kesiapan Lapangan <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                    <Text type="secondary" style={{ fontSize: 10.5 }}>
                      Klasifikasi kesiapan operasional awal proyek
                    </Text>
                  </div>
                }
                rules={[{ required: true, message: 'Status kondisi awal proyek wajib dipilih' }]}
                style={{ marginBottom: 0 }}
              >
                <Radio.Group
                  style={{ width: '100%' }}
                  value={formValues?.conditionStatus || 'NORMAL'}
                  onChange={(e) => {
                    form.setFieldValue('conditionStatus', e.target.value);
                    handleFormChange({ conditionStatus: e.target.value });
                  }}
                >
                  <Row gutter={[10, 10]} style={{ marginLeft: 0, marginRight: 0 }}>
                    {/* NORMAL */}
                    <Col xs={24} sm={8} style={{ paddingLeft: 4, paddingRight: 4 }}>
                      <div
                        id="status-option-normal"
                        data-testid="status-option-normal"
                        onClick={() => {
                          if (isEditable) {
                            form.setFieldValue('conditionStatus', 'NORMAL');
                            handleFormChange({ conditionStatus: 'NORMAL' });
                          }
                        }}
                        style={{
                          cursor: isEditable ? 'pointer' : 'default',
                          padding: '9px 12px',
                          borderRadius: 6,
                          border: (formValues?.conditionStatus || 'NORMAL') === 'NORMAL' ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                          background: (formValues?.conditionStatus || 'NORMAL') === 'NORMAL' ? '#f0fdf4' : '#ffffff',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          height: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {(formValues?.conditionStatus || 'NORMAL') === 'NORMAL' ? (
                            <Tag color="success" style={{ fontWeight: 600, margin: 0, borderRadius: 4, fontSize: 11 }}>
                              ● NORMAL
                            </Tag>
                          ) : (
                            <Tag style={{ color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 500, margin: 0, borderRadius: 4, fontSize: 11 }}>
                              ○ NORMAL
                            </Tag>
                          )}
                          <Radio value="NORMAL" style={{ margin: 0 }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: (formValues?.conditionStatus || 'NORMAL') === 'NORMAL' ? 600 : 500 }}>
                          Site siap tanpa hambatan kritis
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Dapat berjalan sesuai rencana awal
                        </div>
                      </div>
                    </Col>

                    {/* PERLU_PERHATIAN */}
                    <Col xs={24} sm={8} style={{ paddingLeft: 4, paddingRight: 4 }}>
                      <div
                        id="status-option-perlu-perhatian"
                        data-testid="status-option-perlu-perhatian"
                        onClick={() => {
                          if (isEditable) {
                            form.setFieldValue('conditionStatus', 'PERLU_PERHATIAN');
                            handleFormChange({ conditionStatus: 'PERLU_PERHATIAN' });
                          }
                        }}
                        style={{
                          cursor: isEditable ? 'pointer' : 'default',
                          padding: '9px 12px',
                          borderRadius: 6,
                          border: formValues?.conditionStatus === 'PERLU_PERHATIAN' ? '1.5px solid #d97706' : '1px solid #e2e8f0',
                          background: formValues?.conditionStatus === 'PERLU_PERHATIAN' ? '#fffbeb' : '#ffffff',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          height: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {formValues?.conditionStatus === 'PERLU_PERHATIAN' ? (
                            <Tag color="gold" style={{ fontWeight: 600, margin: 0, borderRadius: 4, fontSize: 11 }}>
                              ● PERLU PERHATIAN
                            </Tag>
                          ) : (
                            <Tag style={{ color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 500, margin: 0, borderRadius: 4, fontSize: 11 }}>
                              ○ PERLU PERHATIAN
                            </Tag>
                          )}
                          <Radio value="PERLU_PERHATIAN" style={{ margin: 0 }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: formValues?.conditionStatus === 'PERLU_PERHATIAN' ? 600 : 500 }}>
                          Catatan teknis / izin perlu dipantau
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Butuh koordinasi khusus sebelum mulai
                        </div>
                      </div>
                    </Col>

                    {/* BERISIKO */}
                    <Col xs={24} sm={8} style={{ paddingLeft: 4, paddingRight: 4 }}>
                      <div
                        id="status-option-berisiko"
                        data-testid="status-option-berisiko"
                        onClick={() => {
                          if (isEditable) {
                            form.setFieldValue('conditionStatus', 'BERISIKO');
                            handleFormChange({ conditionStatus: 'BERISIKO' });
                          }
                        }}
                        style={{
                          cursor: isEditable ? 'pointer' : 'default',
                          padding: '9px 12px',
                          borderRadius: 6,
                          border: formValues?.conditionStatus === 'BERISIKO' ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                          background: formValues?.conditionStatus === 'BERISIKO' ? '#fef2f2' : '#ffffff',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          height: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {formValues?.conditionStatus === 'BERISIKO' ? (
                            <Tag color="error" style={{ fontWeight: 600, margin: 0, borderRadius: 4, fontSize: 11 }}>
                              ● BERISIKO
                            </Tag>
                          ) : (
                            <Tag style={{ color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 500, margin: 0, borderRadius: 4, fontSize: 11 }}>
                              ○ BERISIKO
                            </Tag>
                          )}
                          <Radio value="BERISIKO" style={{ margin: 0 }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: formValues?.conditionStatus === 'BERISIKO' ? 600 : 500 }}>
                          Kendala / bahaya tinggi di site
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>
                          Perlu mitigasi aktif sebelum eksekusi
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Radio.Group>
              </Form.Item>

              {/* Dynamic Operational Implication Consequence Strip */}
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  background:
                    (formValues?.conditionStatus || 'NORMAL') === 'NORMAL'
                      ? '#f0fdf4'
                      : formValues?.conditionStatus === 'PERLU_PERHATIAN'
                      ? '#fffbeb'
                      : '#fef2f2',
                  border:
                    (formValues?.conditionStatus || 'NORMAL') === 'NORMAL'
                      ? '1px solid #bbf7d0'
                      : formValues?.conditionStatus === 'PERLU_PERHATIAN'
                      ? '1px solid #fde68a'
                      : '1px solid #fecaca',
                  color:
                    (formValues?.conditionStatus || 'NORMAL') === 'NORMAL'
                      ? '#166534'
                      : formValues?.conditionStatus === 'PERLU_PERHATIAN'
                      ? '#92400e'
                      : '#991b1b',
                }}
              >
                <span style={{ fontWeight: 700 }}>Implikasi Operasional:</span>
                <span>
                  {(formValues?.conditionStatus || 'NORMAL') === 'NORMAL'
                    ? 'Dapat berjalan sesuai rencana awal tanpa prasyarat mitigasi khusus.'
                    : formValues?.conditionStatus === 'PERLU_PERHATIAN'
                    ? 'Memerlukan koordinasi teknis/perizinan bertahap dan pemantauan berkala oleh PM.'
                    : 'Memerlukan mitigasi risiko aktif dan asesmen intensif PM sebelum eksekusi pekerjaan.'}
                </span>
              </div>
            </Card>

            {/* ROW 1: Site Condition | Access & Logistics */}
            <Row gutter={[12, 10]} style={{ marginLeft: 0, marginRight: 0, marginBottom: 10 }}>
              <Col xs={24} md={12} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    height: '100%',
                  }}
                  title={
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                      <CompassOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                      Kondisi Fisik Lokasi Kerja <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                  }
                  extra={<Tag color="red" style={{ fontSize: 9.5, margin: 0 }}>Wajib</Tag>}
                >
                  <Form.Item
                    name="locationCondition"
                    rules={[{ required: true, message: 'Kondisi fisik lokasi wajib diisi' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <TextArea
                      rows={3}
                      placeholder="Jelaskan kondisi fisik lokasi kerja: kesiapan ruangan/lahan, suhu/AC, raised floor, dan keamanan..."
                      style={{ borderRadius: 6, fontSize: 11.5, width: '100%', boxSizing: 'border-box' }}
                    />
                  </Form.Item>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b' }}>
                    Contoh: <em>Ruang server lantai 2 siap, AC 20°C aktif, raised floor rapi, akses biometric 24 jam.</em>
                  </div>
                </Card>
              </Col>

              <Col xs={24} md={12} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    height: '100%',
                  }}
                  title={
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                      <CarOutlined style={{ marginRight: 6, color: '#0284c7' }} />
                      Akses &amp; Logistik Lokasi
                    </span>
                  }
                  extra={<Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>Opsional</Tag>}
                >
                  <Form.Item name="accessLogistics" style={{ marginBottom: 0 }}>
                    <TextArea
                      rows={3}
                      placeholder="Jelaskan akses transportasi: kapasitas truk, izin loading dock, lift barang, SIMK, jam kerja gedung..."
                      style={{ borderRadius: 6, fontSize: 11.5, width: '100%', boxSizing: 'border-box' }}
                    />
                  </Form.Item>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b' }}>
                    Contoh: <em>Loading dock buka pkl 20.00-05.00 WIB. Truk maks double engkel 5T. Wajib SIMK H-2.</em>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* ROW 2: Existing Infrastructure | Constraints (Blockers) */}
            <Row gutter={[12, 10]} style={{ marginLeft: 0, marginRight: 0, marginBottom: 10 }}>
              <Col xs={24} md={12} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    height: '100%',
                  }}
                  title={
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                      <ThunderboltOutlined style={{ marginRight: 6, color: '#d97706' }} />
                      Kondisi Infrastruktur Existing
                    </span>
                  }
                  extra={<Tag color="default" style={{ fontSize: 9.5, margin: 0 }}>Opsional</Tag>}
                >
                  <Form.Item name="existingInfrastructure" style={{ marginBottom: 0 }}>
                    <TextArea
                      rows={3}
                      placeholder="Jelaskan ketersediaan utilitas: daya listrik PLN (kVA), kapasitas genset/UPS, grounding, rack server..."
                      style={{ borderRadius: 6, fontSize: 11.5, width: '100%', boxSizing: 'border-box' }}
                    />
                  </Form.Item>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b' }}>
                    Contoh: <em>Rack 42U eksisting masih sisa 8U, grounding 0.8 Ohm, breaker cadangan 32A tersedia.</em>
                  </div>
                </Card>
              </Col>

              <Col xs={24} md={12} style={{ paddingLeft: 4, paddingRight: 4 }}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #fde68a',
                    background: '#fffbeb',
                    height: '100%',
                  }}
                  title={
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>
                      <StopOutlined style={{ marginRight: 6, color: '#b45309' }} />
                      Kendala Awal Teridentifikasi (Blockers) <span style={{ color: '#dc2626' }}>*</span>
                    </span>
                  }
                  extra={<Tag color="warning" style={{ fontSize: 9.5, margin: 0 }}>Wajib Blocker</Tag>}
                >
                  <Form.Item
                    name="initialConstraints"
                    rules={[{ required: true, message: 'Kendala awal wajib diisi' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <TextArea
                      rows={3}
                      placeholder="Jelaskan batasan atau kendala awal: izin galian belum terbit, maintenance window terbatas, blackout period..."
                      style={{ borderRadius: 6, fontSize: 11.5, background: '#ffffff', width: '100%', boxSizing: 'border-box' }}
                    />
                  </Form.Item>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: '#92400e' }}>
                    Contoh: <em>Izin galian Dishub butuh 5 hari kerja. Window cutover jaringan hanya Minggu subuh.</em>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* ROW 3: Risks (Full Width) */}
            <Card
              size="small"
              style={{
                borderRadius: 8,
                border: '1px solid #fecaca',
                background: '#fef2f2',
                marginBottom: 10,
              }}
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>
                  <FireOutlined style={{ marginRight: 6, color: '#b91c1c' }} />
                  Risiko Awal &amp; Mitigasi Operasional <span style={{ color: '#dc2626' }}>*</span>
                </span>
              }
              extra={<Tag color="error" style={{ fontSize: 9.5, margin: 0 }}>Wajib • Bahaya → Dampak → Mitigasi</Tag>}
            >
              <Form.Item
                name="initialRisks"
                rules={[{ required: true, message: 'Risiko awal wajib diisi' }]}
                style={{ marginBottom: 0 }}
              >
                <TextArea
                  rows={3}
                  placeholder="Format penulisan: [Faktor Bahaya/Kendala] → [Dampak Operasional] → [Mitigasi Awal]..."
                  style={{ borderRadius: 6, fontSize: 11.5, background: '#ffffff', width: '100%', boxSizing: 'border-box' }}
                />
              </Form.Item>
              <div style={{ marginTop: 4, fontSize: 10.5, color: '#991b1b' }}>
                Contoh: <em>Lead time switch 3 minggu → Dampak: UAT mundur → Mitigasi: Pinjam unit lab sebagai temporary bypass.</em>
              </div>
            </Card>

            {/* ROW 4: PM Recommendation / Assessment (Full Width) */}
            <Card
              size="small"
              style={{
                borderRadius: 8,
                border: '1px solid #bfdbfe',
                background: '#f0f9ff',
                marginBottom: 4,
              }}
              title={
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                  <SolutionOutlined style={{ marginRight: 6, color: '#1d4ed8' }} />
                  Rekomendasi &amp; Asesmen PM untuk Manajemen
                </span>
              }
              extra={<Tag color="processing" style={{ fontSize: 9.5, margin: 0 }}>Opsional Ringkasan Eksekutif</Tag>}
            >
              <Form.Item name="pmRecommendation" style={{ marginBottom: 0 }}>
                <TextArea
                  rows={2}
                  placeholder="Catatan atau rekomendasi PM kepada Manajemen (misal: percepatan DP vendor, perizinan khusus, persetujuan window kerja)..."
                  style={{ borderRadius: 6, fontSize: 11.5, background: '#ffffff', width: '100%', boxSizing: 'border-box' }}
                />
              </Form.Item>
              <div style={{ marginTop: 4, fontSize: 10.5, color: '#1e40af' }}>
                Contoh: <em>Rekomendasi segera terbitkan PR material kabel minggu ini agar pengadaan berjalan paralel dengan izin Dishub.</em>
              </div>
            </Card>
          </Form>
        </div>
      </Spin>
    </Modal>
  );
};

export default ProjectInitialConditionModal;
