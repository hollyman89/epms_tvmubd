'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, message, Typography, Space, Alert } from 'antd';
import { ProjectService } from '@/services';

const { Text } = Typography;
const { TextArea } = Input;

export interface RoutineProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  taskId: number;
  taskName: string;
  currentProgress: number;
}

export const RoutineProgressModal: React.FC<RoutineProgressModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  taskId,
  taskName,
  currentProgress,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      form.setFieldsValue({
        expectedProgress: currentProgress,
        progress: undefined,
        reason: '',
      });
    }
  }, [isOpen, currentProgress, form]);

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async (values: any) => {
    try {
      setIsSubmitting(true);

      const targetProgress = Number(values.progress);

      if (targetProgress <= currentProgress) {
        message.error('Progres rutin harus berupa kenaikan (lebih besar dari progres saat ini). Untuk koreksi penurunan, gunakan Claim Progress.');
        return;
      }

      if (targetProgress >= 100) {
        message.error('Penyelesaian task 100% merupakan Critical Claim yang memerlukan bukti dokumen dan verifikasi PMO/HOO.');
        return;
      }

      await ProjectService.updateTaskProgress(projectId, taskId, {
        progress: targetProgress,
        expectedProgress: currentProgress,
        reason: values.reason?.trim() || undefined,
      });

      message.success(`Progres tugas berhasil diperbarui ke ${targetProgress}%.`);
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to update routine progress:', error);
      const errMsg = error?.response?.data?.message || error?.message || 'Gagal memperbarui progres tugas';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Update Progres Tugas (Rutin)"
      open={isOpen}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
    >
      <Alert
        message="Aturan Progres Rutin"
        description="Gunakan form ini untuk mencatat kemajuan pekerjaan harian/mingguan (misal: dari 0% ke 25%, 50%, atau 75%). Penyelesaian 100% atau koreksi penurunan progres wajib menggunakan Claim Progress."
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Nama Tugas">
          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{taskName}</Text>
        </Form.Item>

        <Form.Item label="Progres Saat Ini">
          <Text style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>{currentProgress}%</Text>
        </Form.Item>

        <Form.Item
          name="progress"
          label="Progres Baru (%)"
          rules={[
            { required: true, message: 'Silakan masukkan nilai progres baru' },
            { type: 'number', min: 0.01, max: 99.99, message: 'Progres rutin harus antara 0.01% dan 99.99%' },
            () => ({
              validator(_, value) {
                if (value !== undefined && value <= currentProgress) {
                  return Promise.reject(new Error(`Progres baru harus lebih tinggi dari ${currentProgress}%`));
                }
                if (value !== undefined && value >= 100) {
                  return Promise.reject(new Error('Penyelesaian 100% wajib menggunakan menu Claim Progress'));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            max={99.99}
            step={1}
            precision={2}
            placeholder={`Masukkan angka lebih besar dari ${currentProgress}`}
          />
        </Form.Item>

        <Form.Item
          name="reason"
          label="Catatan Lapangan (Opsional)"
          rules={[{ max: 2000, message: 'Catatan maksimal 2000 karakter' }]}
        >
          <TextArea rows={3} placeholder="Catatan pekerjaan yang telah diselesaikan di lapangan..." />
        </Form.Item>

        <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleCancel} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              Simpan Progres
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
