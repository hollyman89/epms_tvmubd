import React, { useState } from 'react';
import { Modal, Form, Select, DatePicker, Button, message, Alert, Typography, Descriptions, Tag, Space } from 'antd';
import { ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  ProjectRiskItem,
  ProjectIssueSeverity,
  ProjectIssuePriority,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';

const { Text } = Typography;

interface MaterializeRiskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (issueId: number) => void;
  projectId: number;
  risk: ProjectRiskItem | null;
  eligibleOwners: { id: number; name: string; email: string; roles: string[] }[];
}

export const MaterializeRiskModal: React.FC<MaterializeRiskModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  risk,
  eligibleOwners,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!risk) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        expectedVersion: risk.version,
        severity: values.severity,
        priority: values.priority,
        dueDate: values.dueDate ? dayjs(values.dueDate).format('YYYY-MM-DD') : undefined,
        ownerId: values.ownerId || undefined,
      };

      const result = await ProjectIssueRiskService.materializeRisk(projectId, risk.id, payload);
      message.success(`Risiko ${risk.riskNumber} berhasil dimaterialisasi menjadi Issue ${result.issue.issueNumber}`);
      form.resetFields();
      onSuccess(result.issue.id);
    } catch (err: any) {
      if (err?.errorFields) return; // Validation error
      const status = err?.response?.status;
      const errMsg = err?.response?.data?.message || err?.message || 'Gagal mematerialisasi risiko';
      if (status === 409) {
        message.error(`Konflik: ${errMsg}`);
      } else {
        message.error(errMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <ThunderboltOutlined style={{ color: '#d97706', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
            Materialisasi Risiko ke Issue Proyek
          </span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Batal
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger
          loading={submitting}
          onClick={handleSubmit}
          icon={<ThunderboltOutlined />}
          data-testid="submit-materialize-btn"
        >
          Konfirmasi Materialisasi
        </Button>,
      ]}
      width={640}
      centered
      destroyOnClose
    >
      <Alert
        message="Materialisasi Risiko Menjadi Masalah Operasional Riil (Issue)"
        description="Materialisasi mengindikasikan bahwa risiko ancaman telah benar-benar terjadi di lapangan. Tindakan ini akan mengunci status Risiko menjadi MATERIALIZED (0..1 SSOT) dan membuat Issue baru yang memerlukan penanganan aktif."
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 16, borderRadius: 8 }}
      />

      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Nomor Risiko">
            <Text strong>{risk.riskNumber}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Level Risiko (Konteks)">
            <Tag color={risk.riskLevel === 'CRITICAL' ? 'red' : risk.riskLevel === 'HIGH' ? 'orange' : 'gold'}>
              {risk.riskLevel || 'Belum dinilai'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Judul Risiko" span={2}>
            <Text>{risk.title}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Kategori">
            <Tag>{risk.category}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Owner Risiko">
            <Text>{risk.owner?.fullName || risk.owner?.name || '-'}</Text>
          </Descriptions.Item>
        </Descriptions>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ownerId: risk.ownerId,
        }}
      >
        <Form.Item
          name="severity"
          label="Keparahan Issue (Evaluasi Mandiri - Wajib)"
          rules={[{ required: true, message: 'Harap tentukan tingkat keparahan Issue' }]}
          extra="Keparahan Issue TIDAK dipetakan otomatis dari level risiko dan wajib dievaluasi oleh PM/governance."
        >
          <Select
            placeholder="Pilih Keparahan Issue"
            data-testid="materialize-severity-select"
            options={[
              { value: ProjectIssueSeverity.LOW, label: 'LOW — Dampak minor pada operasional' },
              { value: ProjectIssueSeverity.MEDIUM, label: 'MEDIUM — Berdampak pada sebagian pekerjaan' },
              { value: ProjectIssueSeverity.HIGH, label: 'HIGH — Mengancam kelancaran target proyek' },
              { value: ProjectIssueSeverity.CRITICAL, label: 'CRITICAL — Menghentikan pekerjaan operasional' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="priority"
          label="Prioritas Penanganan (Wajib)"
          rules={[{ required: true, message: 'Harap tentukan prioritas penanganan Issue' }]}
          extra="Prioritas penanganan operasional Issue baru."
        >
          <Select
            placeholder="Pilih Prioritas Issue"
            data-testid="materialize-priority-select"
            options={[
              { value: ProjectIssuePriority.LOW, label: 'LOW — Penanganan terjadwal rutin' },
              { value: ProjectIssuePriority.MEDIUM, label: 'MEDIUM — Penanganan dalam sprint aktif' },
              { value: ProjectIssuePriority.HIGH, label: 'HIGH — Penanganan prioritas tinggi' },
              { value: ProjectIssuePriority.URGENT, label: 'URGENT — Tindakan darurat segera' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="dueDate"
          label="Batas Waktu Penyelesaian (Target Due Date - Opsional)"
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" placeholder="Pilih target tanggal selesai" />
        </Form.Item>

        <Form.Item
          name="ownerId"
          label="Penanggung Jawab Issue (Owner Override - Opsional)"
          extra="Default mewarisi owner dari risiko terkait kecuali diubah."
        >
          <Select
            placeholder="Pilih penanggung jawab"
            showSearch
            optionFilterProp="label"
            options={eligibleOwners.map((u) => ({
              value: u.id,
              label: `${u.name} (${u.roles.join(', ')})`,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
