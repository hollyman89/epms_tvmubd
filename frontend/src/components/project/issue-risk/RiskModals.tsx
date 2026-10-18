import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  message,
  Space,
  Typography,
  Alert,
  Card,
  Tag,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProjectRiskItem,
  ProjectIssueRiskCategory,
} from '@/services/project-issue-risk.service';
import { ProjectIssueRiskService } from '@/services/project-issue-risk.service';

const { TextArea } = Input;
const { Text } = Typography;

// -------------------------------------------------------------------
// CREATE RISK MODAL
// -------------------------------------------------------------------
interface CreateRiskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  eligibleOwners: { id: number; name: string; email: string; roles: string[] }[];
}

export const CreateRiskModal: React.FC<CreateRiskModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  eligibleOwners,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [probValue, setProbValue] = useState<number | undefined>(undefined);
  const [impValue, setImpValue] = useState<number | undefined>(undefined);

  const previewScore = probValue && impValue ? probValue * impValue : null;
  let previewLevel: { label: string; color: string } | null = null;
  if (previewScore !== null) {
    if (previewScore <= 4) previewLevel = { label: 'LOW', color: 'green' };
    else if (previewScore <= 9) previewLevel = { label: 'MEDIUM', color: 'gold' };
    else if (previewScore <= 14) previewLevel = { label: 'HIGH', color: 'orange' };
    else previewLevel = { label: 'CRITICAL', color: 'red' };
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Check both or neither rule for assessment
      const hasProb = values.probability !== undefined && values.probability !== null;
      const hasImp = values.impact !== undefined && values.impact !== null;
      if ((hasProb && !hasImp) || (!hasProb && hasImp)) {
        message.error('Harap lengkapi kedua probabilitas dan dampak atau kosongkan keduanya.');
        return;
      }

      setSubmitting(true);

      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        ownerId: Number(values.ownerId),
        probability: hasProb ? Number(values.probability) : undefined,
        impact: hasImp ? Number(values.impact) : undefined,
        mitigationPlan: values.mitigationPlan ? values.mitigationPlan.trim() : undefined,
        contingencyPlan: values.contingencyPlan ? values.contingencyPlan.trim() : undefined,
        targetDate: values.targetDate ? dayjs(values.targetDate).format('YYYY-MM-DD') : undefined,
        reviewDate: values.reviewDate ? dayjs(values.reviewDate).format('YYYY-MM-DD') : undefined,
      };

      const res = await ProjectIssueRiskService.createRisk(projectId, payload);
      message.success(`Risiko ${res.riskNumber} berhasil didaftarkan.`);
      form.resetFields();
      setProbValue(undefined);
      setImpValue(undefined);
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal mendaftarkan Risiko');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <PlusOutlined style={{ color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Daftarkan Risiko Proyek Baru</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit} data-testid="submit-create-risk-btn">
          Buat Risiko
        </Button>,
      ]}
      width={640}
      centered
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(_, all) => {
          setProbValue(all.probability);
          setImpValue(all.impact);
        }}
      >
        <Form.Item
          name="title"
          label="Judul Risiko (Ancaman Adverse)"
          rules={[{ required: true, message: 'Harap cantumkan judul risiko' }]}
        >
          <Input placeholder="Contoh: Risiko kenaikan harga material impor" data-testid="risk-title-input" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Deskripsi Analisis Ancaman"
          rules={[{ required: true, message: 'Harap cantumkan deskripsi risiko' }]}
        >
          <TextArea rows={3} placeholder="Jelaskan penyebab, kondisi yang memicu, dan potensi dampak negatif..." data-testid="risk-description-input" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item
            name="category"
            label="Kategori"
            rules={[{ required: true, message: 'Pilih kategori' }]}
          >
            <Select
              placeholder="Pilih Kategori"
              data-testid="risk-category-select"
              options={Object.values(ProjectIssueRiskCategory).map((c) => ({ value: c, label: c }))}
            />
          </Form.Item>

          <Form.Item
            name="ownerId"
            label="Penanggung Jawab (Owner)"
            rules={[{ required: true, message: 'Pilih owner' }]}
          >
            <Select
              placeholder="Pilih Owner"
              data-testid="risk-owner-select"
              showSearch
              optionFilterProp="label"
              options={eligibleOwners.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.roles.join(', ')})`,
              }))}
            />
          </Form.Item>
        </div>

        {/* Optional Assessment on Creation */}
        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: 8, fontSize: 13 }}>
            Asesmen Awal (Opsional — Boleh Dikosongkan untuk Status IDENTIFIED)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="probability" label="Probabilitas (1..5)" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Belum dinilai"
                allowClear
                options={[
                  { value: 1, label: '1 - Sangat Jarang' },
                  { value: 2, label: '2 - Jarang' },
                  { value: 3, label: '3 - Sedang' },
                  { value: 4, label: '4 - Sering' },
                  { value: 5, label: '5 - Sangat Sering' },
                ]}
              />
            </Form.Item>

            <Form.Item name="impact" label="Dampak (1..5)" style={{ marginBottom: 0 }}>
              <Select
                placeholder="Belum dinilai"
                allowClear
                options={[
                  { value: 1, label: '1 - Sangat Ringan' },
                  { value: 2, label: '2 - Ringan' },
                  { value: 3, label: '3 - Moderat' },
                  { value: 4, label: '4 - Berat' },
                  { value: 5, label: '5 - Sangat Berat' },
                ]}
              />
            </Form.Item>
          </div>

          {previewScore !== null && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Preview Skor:</Text>
              <Text strong>{previewScore}</Text>
              <Tag color={previewLevel?.color}>{previewLevel?.label}</Tag>
            </div>
          )}
        </div>

        <Form.Item name="mitigationPlan" label="Rencana Mitigasi (Proaktif)">
          <TextArea rows={2} placeholder="Langkah preventif untuk mengurangi probabilitas atau dampak..." data-testid="risk-mitigation-input" />
        </Form.Item>

        <Form.Item name="contingencyPlan" label="Rencana Kontinjensi (Fallback)">
          <TextArea rows={2} placeholder="Tindakan darurat jika risiko tetap terjadi..." />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="targetDate" label="Target Mitigasi Selesai">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Target tanggal" />
          </Form.Item>

          <Form.Item name="reviewDate" label="Tanggal Review Berkala">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Review berikutnya" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

// -------------------------------------------------------------------
// UPDATE MITIGATION MODAL
// -------------------------------------------------------------------
interface UpdateMitigationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  risk: ProjectRiskItem | null;
}

export const UpdateMitigationModal: React.FC<UpdateMitigationModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  risk,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (risk) {
      form.setFieldsValue({
        mitigationPlan: risk.mitigationPlan || '',
        contingencyPlan: risk.contingencyPlan || '',
        targetDate: risk.targetDate ? dayjs(risk.targetDate) : undefined,
        reviewDate: risk.reviewDate ? dayjs(risk.reviewDate) : undefined,
      });
    }
  }, [risk, form]);

  if (!risk) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        expectedVersion: risk.version,
        mitigationPlan: values.mitigationPlan ? values.mitigationPlan.trim() : null,
        contingencyPlan: values.contingencyPlan ? values.contingencyPlan.trim() : null,
        targetDate: values.targetDate ? dayjs(values.targetDate).format('YYYY-MM-DD') : null,
        reviewDate: values.reviewDate ? dayjs(values.reviewDate).format('YYYY-MM-DD') : null,
      };

      await ProjectIssueRiskService.updateRisk(projectId, risk.id, payload);
      message.success(`Rencana mitigasi risiko ${risk.riskNumber} berhasil diperbarui.`);
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal memperbarui mitigasi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <SafetyCertificateOutlined style={{ color: '#16a34a', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Perbarui Rencana Mitigasi ({risk.riskNumber})</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit} data-testid="submit-mitigation-btn">
          Simpan Rencana
        </Button>,
      ]}
      width={600}
      centered
      destroyOnClose
    >
      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
        <Text strong>{risk.title}</Text>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          name="mitigationPlan"
          label="Rencana Mitigasi (Proaktif)"
          rules={[{ required: true, message: 'Harap jelaskan rencana mitigasi' }]}
        >
          <TextArea rows={3} placeholder="Langkah proaktif untuk menurunkan risiko..." data-testid="edit-mitigation-plan-input" />
        </Form.Item>

        <Form.Item name="contingencyPlan" label="Rencana Kontinjensi (Fallback)">
          <TextArea rows={2} placeholder="Tindakan pemulihan jika risiko tetap terjadi..." />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="targetDate" label="Target Penyelesaian Mitigasi">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="reviewDate" label="Tanggal Review Berkala">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};

// -------------------------------------------------------------------
// RISK DETAIL MODAL (Deep-Link & Direct View Canonical UI)
// -------------------------------------------------------------------
interface RiskDetailModalProps {
  open: boolean;
  onClose: () => void;
  risk: ProjectRiskItem | null;
}

export const RiskDetailModal: React.FC<RiskDetailModalProps> = ({
  open,
  onClose,
  risk,
}) => {
  if (!risk) return null;

  return (
    <Modal
      title={
        <Space size={8}>
          <SafetyCertificateOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="risk-detail-modal-title">
            Detail Risiko: {risk.riskNumber}
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} data-testid="close-risk-detail-btn">
          Tutup
        </Button>,
      ]}
      width={680}
      centered
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid={`risk-detail-${risk.id}`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tag color="geekblue">{risk.status}</Tag>
          <Tag
            color={
              risk.riskLevel === 'CRITICAL'
                ? 'red'
                : risk.riskLevel === 'HIGH'
                ? 'orange'
                : risk.riskLevel === 'MEDIUM'
                ? 'gold'
                : risk.riskLevel === 'LOW'
                ? 'green'
                : 'default'
            }
          >
            {risk.riskLevel || 'Belum dinilai'}
          </Tag>
          <Tag>{risk.category}</Tag>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Judul Ancaman Risiko</Text>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#0f172a' }}>{risk.title}</div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Deskripsi Potensi Dampak</Text>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
            {risk.description}
          </div>
        </div>

        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="Probabilitas">
            {risk.probability ? `${risk.probability} / 5` : 'Belum dinilai'}
          </Descriptions.Item>
          <Descriptions.Item label="Dampak">
            {risk.impact ? `${risk.impact} / 5` : 'Belum dinilai'}
          </Descriptions.Item>
          <Descriptions.Item label="Skor Risiko">
            <span style={{ fontWeight: 700 }}>
              {risk.riskScore !== null && risk.riskScore !== undefined ? risk.riskScore : 'N/A'}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="Level Risiko">
            {risk.riskLevel || 'Belum dinilai'}
          </Descriptions.Item>
          <Descriptions.Item label="Penanggung Jawab">
            {risk.owner?.fullName || risk.owner?.name || `User #${risk.ownerId}`}
          </Descriptions.Item>
          <Descriptions.Item label="Target Selesai">
            {risk.targetDate ? dayjs(risk.targetDate).format('DD MMM YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Diidentifikasi Oleh">
            {risk.identifiedBy?.fullName || risk.identifiedBy?.name || `User #${risk.identifiedById}`}
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Tinjauan">
            {risk.reviewDate ? dayjs(risk.reviewDate).format('DD MMM YYYY') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {risk.mitigationPlan && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Rencana Mitigasi Pencegahan</Text>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              {risk.mitigationPlan}
            </div>
          </div>
        )}

        {risk.contingencyPlan && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Rencana Kontinjensi Tanggap Darurat</Text>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              {risk.contingencyPlan}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
