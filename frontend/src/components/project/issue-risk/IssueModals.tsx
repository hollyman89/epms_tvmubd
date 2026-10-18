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
  Descriptions,
  Tag,
} from 'antd';
import {
  CheckCircleOutlined,
  UndoOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProjectIssueItem,
  ProjectIssueSeverity,
  ProjectIssuePriority,
  ProjectIssueRiskCategory,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';

const { TextArea } = Input;
const { Text } = Typography;

// -------------------------------------------------------------------
// CREATE ISSUE MODAL
// -------------------------------------------------------------------
interface CreateIssueModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  eligibleOwners: { id: number; name: string; email: string; roles: string[] }[];
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  eligibleOwners,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        severity: values.severity,
        priority: values.priority,
        ownerId: Number(values.ownerId),
        dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
      };

      const res = await ProjectIssueRiskService.createIssue(projectId, payload);
      message.success(`Issue ${res.issueNumber} berhasil didaftarkan.`);
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal membuat Issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <PlusOutlined style={{ color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Daftarkan Issue Proyek Baru</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit} data-testid="submit-create-issue-btn">
          Buat Issue
        </Button>,
      ]}
      width={600}
      centered
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="Judul Issue (Singkat & Jelas)"
          rules={[{ required: true, message: 'Harap isi judul issue' }]}
        >
          <Input placeholder="Contoh: Keterlambatan pengiriman material pondasi" data-testid="issue-title-input" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Deskripsi Detail Masalah"
          rules={[{ required: true, message: 'Harap isi deskripsi issue' }]}
        >
          <TextArea rows={3} placeholder="Jelaskan dampak riil, lokasi kejadian, dan kondisi di lapangan..." data-testid="issue-description-input" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item
            name="category"
            label="Kategori"
            rules={[{ required: true, message: 'Pilih kategori' }]}
          >
            <Select
              placeholder="Pilih Kategori"
              data-testid="issue-category-select"
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
              data-testid="issue-owner-select"
              showSearch
              optionFilterProp="label"
              options={eligibleOwners.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.roles.join(', ')})`,
              }))}
            />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item
            name="severity"
            label="Tingkat Keparahan (Severity)"
            rules={[{ required: true, message: 'Pilih severity' }]}
          >
            <Select
              placeholder="Pilih Keparahan"
              data-testid="issue-severity-select"
              options={Object.values(ProjectIssueSeverity).map((s) => ({ value: s, label: s }))}
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Prioritas Penanganan"
            rules={[{ required: true, message: 'Pilih priority' }]}
          >
            <Select
              placeholder="Pilih Prioritas"
              data-testid="issue-priority-select"
              options={Object.values(ProjectIssuePriority).map((p) => ({ value: p, label: p }))}
            />
          </Form.Item>
        </div>

        <Form.Item name="dueDate" label="Target Selesai (Due Date)">
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Pilih batas waktu penanganan" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// -------------------------------------------------------------------
// RESOLVE ISSUE MODAL
// -------------------------------------------------------------------
interface ResolveIssueModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  issue: ProjectIssueItem | null;
}

export const ResolveIssueModal: React.FC<ResolveIssueModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  issue,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!issue) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await ProjectIssueRiskService.resolveIssue(
        projectId,
        issue.id,
        issue.version,
        values.resolution.trim(),
      );

      message.success(`Issue ${issue.issueNumber} berhasil ditandai RESOLVED.`);
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal menyelesaikan Issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Penyelesaian Issue ({issue.issueNumber})</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>,
        <Button key="submit" type="primary" style={{ backgroundColor: '#16a34a' }} loading={submitting} onClick={handleSubmit} data-testid="submit-resolve-btn">
          Tandai Selesai (Resolved)
        </Button>,
      ]}
      width={560}
      centered
      destroyOnClose
    >
      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #e2e8f0' }}>
        <Text strong>{issue.title}</Text>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          name="resolution"
          label="Catatan Solusi / Tindakan Penyelesaian (Wajib)"
          rules={[{ required: true, message: 'Harap jelaskan solusi penyelesaian yang telah dilakukan' }]}
        >
          <TextArea
            rows={4}
            placeholder="Jelaskan tindakan korektif dan hasil verifikasi di lapangan..."
            data-testid="resolve-resolution-input"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// -------------------------------------------------------------------
// REOPEN ISSUE MODAL
// -------------------------------------------------------------------
interface ReopenIssueModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  issue: ProjectIssueItem | null;
}

export const ReopenIssueModal: React.FC<ReopenIssueModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  issue,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!issue) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await ProjectIssueRiskService.reopenIssue(
        projectId,
        issue.id,
        issue.version,
        values.reason.trim(),
      );

      message.success(`Issue ${issue.issueNumber} dibuka kembali ke status IN_PROGRESS.`);
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal membuka kembali Issue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <UndoOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Buka Kembali Issue ({issue.issueNumber})</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>,
        <Button key="submit" type="primary" danger loading={submitting} onClick={handleSubmit} data-testid="submit-reopen-btn">
          Konfirmasi Reopen
        </Button>,
      ]}
      width={560}
      centered
      destroyOnClose
    >
      <Alert
        message="Governance Reopen"
        description="Membuka kembali Issue akan mengembalikan status ke IN_PROGRESS serta me-reset catatan penyelesaian sebelumnya (namun riwayat tetap terekam di Audit Log)."
        type="warning"
        showIcon
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="Alasan Pembukaan Kembali (Wajib)"
          rules={[{ required: true, message: 'Harap cantumkan alasan mengapa Issue perlu dibuka kembali' }]}
        >
          <TextArea
            rows={3}
            placeholder="Contoh: Kendala terjadi kembali setelah pengetesan lanjutan..."
            data-testid="reopen-reason-input"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// -------------------------------------------------------------------
// CANCEL MODAL (FOR ISSUE OR RISK)
// -------------------------------------------------------------------
interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  recordIdentifier: string;
  onConfirm: (reason: string) => Promise<any>;
}

export const CancelRecordModal: React.FC<CancelModalProps> = ({
  open,
  onClose,
  onSuccess,
  title,
  recordIdentifier,
  onConfirm,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onConfirm(values.reason.trim());
      message.success(`${recordIdentifier} berhasil dibatalkan.`);
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal membatalkan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>{title} ({recordIdentifier})</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Kembali
        </Button>,
        <Button key="submit" type="primary" danger loading={submitting} onClick={handleSubmit} data-testid="submit-cancel-btn">
          Batalkan Record
        </Button>,
      ]}
      width={540}
      centered
      destroyOnClose
    >
      <Alert
        message="Status Terminal Pembatalan"
        description="Pembatalan bersifat permanen dan tidak dapat dibuka kembali (terminal state)."
        type="error"
        showIcon
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label="Alasan Pembatalan (Wajib)"
          rules={[{ required: true, message: 'Harap cantumkan alasan pembatalan' }]}
        >
          <TextArea rows={3} placeholder="Jelaskan alasan mengapa record ini dibatalkan..." data-testid="cancel-reason-input" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// -------------------------------------------------------------------
// ISSUE DETAIL MODAL (Deep-Link & Direct View Canonical UI)
// -------------------------------------------------------------------
interface IssueDetailModalProps {
  open: boolean;
  onClose: () => void;
  issue: ProjectIssueItem | null;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  open,
  onClose,
  issue,
}) => {
  if (!issue) return null;

  return (
    <Modal
      title={
        <Space size={8}>
          <InfoCircleOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }} data-testid="issue-detail-modal-title">
            Detail Issue: {issue.issueNumber}
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} data-testid="close-issue-detail-btn">
          Tutup
        </Button>,
      ]}
      width={680}
      centered
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid={`issue-detail-${issue.id}`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tag color="blue">{issue.status}</Tag>
          <Tag color={issue.severity === 'CRITICAL' ? 'red' : issue.severity === 'HIGH' ? 'orange' : 'gold'}>
            {issue.severity}
          </Tag>
          <Tag color={issue.priority === 'URGENT' ? 'magenta' : issue.priority === 'HIGH' ? 'volcano' : 'default'}>
            {issue.priority}
          </Tag>
          <Tag>{issue.category}</Tag>
          {issue.sourceRiskId && (
            <Tag color="cyan">Materialized Risk #{issue.sourceRiskId}</Tag>
          )}
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Judul Issue</Text>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#0f172a' }}>{issue.title}</div>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Deskripsi Kendala</Text>
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
            {issue.description}
          </div>
        </div>

        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="Penanggung Jawab">
            {issue.owner?.fullName || issue.owner?.name || `User #${issue.ownerId}`}
          </Descriptions.Item>
          <Descriptions.Item label="Target Selesai">
            {issue.dueDate ? dayjs(issue.dueDate).format('DD MMM YYYY') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Dilaporkan Oleh">
            {issue.reportedBy?.fullName || issue.reportedBy?.name || `User #${issue.reportedById}`}
          </Descriptions.Item>
          <Descriptions.Item label="Tanggal Lapor">
            {issue.reportedAt ? dayjs(issue.reportedAt).format('DD MMM YYYY HH:mm') : '-'}
          </Descriptions.Item>
        </Descriptions>

        {issue.resolution && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Catatan Solusi / Penyelesaian</Text>
            <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0', color: '#166534', fontSize: 13 }}>
              {issue.resolution}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

