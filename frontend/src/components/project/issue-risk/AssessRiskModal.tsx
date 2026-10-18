import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, message, Space, Card, Tag, Typography, Alert } from 'antd';
import { FundProjectionScreenOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  ProjectRiskItem,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';

const { Text } = Typography;

interface AssessRiskModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  risk: ProjectRiskItem | null;
}

export const AssessRiskModal: React.FC<AssessRiskModalProps> = ({
  open,
  onClose,
  onSuccess,
  projectId,
  risk,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [probValue, setProbValue] = useState<number | undefined>(risk?.probability || undefined);
  const [impValue, setImpValue] = useState<number | undefined>(risk?.impact || undefined);

  useEffect(() => {
    if (risk) {
      form.setFieldsValue({
        probability: risk.probability || undefined,
        impact: risk.impact || undefined,
      });
      setProbValue(risk.probability || undefined);
      setImpValue(risk.impact || undefined);
    }
  }, [risk, form]);

  if (!risk) return null;

  // Live client preview (authoritative calculation done server-side)
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
      setSubmitting(true);

      await ProjectIssueRiskService.assessRisk(
        projectId,
        risk.id,
        risk.version,
        Number(values.probability),
        Number(values.impact),
      );

      message.success(`Asesmen risiko ${risk.riskNumber} berhasil disimpan.`);
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || err?.message || 'Gagal menyimpan asesmen risiko');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space size={8}>
          <FundProjectionScreenOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
            Asesmen Probabilitas & Dampak Risiko
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
          loading={submitting}
          onClick={handleSubmit}
          data-testid="submit-assess-btn"
        >
          Simpan Asesmen
        </Button>,
      ]}
      width={560}
      centered
      destroyOnClose
    >
      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Risiko:</Text>
        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
          {risk.riskNumber} — {risk.title}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onValuesChange={(_, all) => {
          setProbValue(all.probability);
          setImpValue(all.impact);
        }}
      >
        <Form.Item
          name="probability"
          label="Probabilitas Terjadinya Risiko (1 - 5)"
          rules={[{ required: true, message: 'Harap tentukan skala probabilitas' }]}
        >
          <Select
            placeholder="Pilih Probabilitas (1..5)"
            data-testid="assess-probability-select"
            options={[
              { value: 1, label: '1 — Sangat Jarang (Sangat kecil kemungkinan terjadi)' },
              { value: 2, label: '2 — Jarang (Kemungkinan kecil terjadi)' },
              { value: 3, label: '3 — Sedang (Dapat terjadi sewaktu-waktu)' },
              { value: 4, label: '4 — Sering (Kemungkinan besar terjadi)' },
              { value: 5, label: '5 — Sangat Sering (Hampir pasti terjadi)' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="impact"
          label="Tingkat Dampak Jika Terjadi (1 - 5)"
          rules={[{ required: true, message: 'Harap tentukan skala dampak' }]}
        >
          <Select
            placeholder="Pilih Dampak (1..5)"
            data-testid="assess-impact-select"
            options={[
              { value: 1, label: '1 — Sangat Ringan (Dampak minor terhadap biaya/waktu)' },
              { value: 2, label: '2 — Ringan (Dampak kecil pada pekerjaan)' },
              { value: 3, label: '3 — Moderat (Dampak menengah, deviasi terkontrol)' },
              { value: 4, label: '4 — Berat (Dampak signifikan terhadap target proyek)' },
              { value: 5, label: '5 — Sangat Berat (Fatal bagi kelangsungan proyek)' },
            ]}
          />
        </Form.Item>
      </Form>

      {/* Live Preview Card */}
      <Card
        size="small"
        style={{
          background: previewScore ? '#f8fafc' : '#f1f5f9',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          marginTop: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Kalkulasi Skor Risiko (5x5):</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              {previewScore !== null ? previewScore : 'N/A'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Level Risiko:</Text>
            <div>
              {previewLevel ? (
                <Tag color={previewLevel.color} style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px' }}>
                  {previewLevel.label}
                </Tag>
              ) : (
                <Tag color="default">Belum dinilai</Tag>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Alert
        message="Validasi Skor Server-Side"
        description="Skor (Probability × Impact) dan Level (LOW 1-4, MEDIUM 5-9, HIGH 10-14, CRITICAL 15-25) dihitung dan diverifikasi secara authoritative oleh backend."
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginTop: 14, borderRadius: 8, fontSize: 12 }}
      />
    </Modal>
  );
};
