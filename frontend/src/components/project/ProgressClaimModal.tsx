'use client';

import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Button, Upload, message, Typography, Space, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ProjectService } from '@/services';
import { PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES } from '@/lib/uploadTransport';
import { uploadTaskManager } from '@/lib/uploadTaskManager';

const { Text } = Typography;
const { TextArea } = Input;

export interface ProgressClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  taskId: number;
  taskName: string;
  currentProgress: number;
}

export const ProgressClaimModal: React.FC<ProgressClaimModalProps> = ({
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
  const [fileList, setFileList] = useState<any[]>([]);

  const handleCancel = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const handleUploadChange = (info: any) => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-1);
    setFileList(newFileList);
  };

  const beforeUpload = (file: File) => {
    const isLt10M = file.size <= PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES;
    if (!isLt10M) {
      message.error('Ukuran berkas bukti maksimal 10MB.');
      return Upload.LIST_IGNORE;
    }
    return false; // Prevent automatic upload by antd; handled on form submission
  };

  const handleSubmit = async (values: any) => {
    try {
      setIsSubmitting(true);
      
      const claimedProgress = Number(values.progress);
      const isDownward = claimedProgress < currentProgress;
      const isCritical = claimedProgress === 100;
      
      if (!isDownward && !isCritical) {
        message.error('Klaim progress hanya untuk penyelesaian 100% atau koreksi penurunan. Untuk progres kenaikan rutin, gunakan tombol "Update Progress".');
        return;
      }

      if (isCritical && fileList.length === 0) {
        message.error('Dokumen bukti (Evidence) wajib dilampirkan untuk pengajuan klaim kritis 100%.');
        return;
      }

      // Fast non-blocking UI for evidence upload
      if (fileList.length > 0) {
        const fileObj = fileList[0].originFileObj || fileList[0];
        const payloadProgress = claimedProgress;
        const payloadReason = values.reason.trim();

        // Immediately close modal and clear input state
        form.resetFields();
        setFileList([]);
        setIsSubmitting(false);
        onClose();

        uploadTaskManager.startUploadTask({
          fileName: fileObj.name,
          fileSize: fileObj.size,
          flowLabel: 'Bukti Progres',
          file: fileObj,
          uploadFn: async (onProgress) => {
            return await ProjectService.uploadEvidence(
              projectId,
              fileObj,
              undefined,
              PROGRESS_EVIDENCE_MAX_FILE_SIZE_BYTES,
              onProgress,
            );
          },
          onSuccess: async (uploadedDoc) => {
            const docId = uploadedDoc?.id || (uploadedDoc as any)?.data?.id;
            if (!uploadedDoc || !docId) {
              throw new Error('Respons upload berkas tidak menyertakan ID dokumen yang valid.');
            }
            const payload = {
              reportedProgress: payloadProgress,
              reason: payloadReason,
              documentIds: [Number(docId)],
            };
            await ProjectService.createProgressClaim(projectId, taskId, payload);
            message.success('Klaim progres berhasil diajukan dan tercatat dalam antrean verifikasi PMO / Head of Operations.');
            onSuccess();
          },
          onError: (uploadErr: any) => {
            console.error('Evidence upload failed:', uploadErr);
            const uploadErrMsg =
              uploadErr?.response?.data?.message || uploadErr?.message || 'Gagal mengunggah berkas bukti';
            message.error(`Upload bukti gagal: ${uploadErrMsg}`);
          },
        });
        return;
      }

      // No file attached: direct submission
      const payload = {
        reportedProgress: claimedProgress,
        reason: values.reason.trim(),
        documentIds: undefined,
      };

      await ProjectService.createProgressClaim(projectId, taskId, payload);
      message.success('Klaim progres berhasil diajukan dan tercatat dalam antrean verifikasi PMO / Head of Operations.');
      
      form.resetFields();
      setFileList([]);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to submit progress claim:', error);
      const errMsg = error?.response?.data?.message || error?.message || 'Gagal mengajukan klaim progres';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Pengajuan Klaim Progres (Kritis 100% / Koreksi Penurunan)"
      open={isOpen}
      onCancel={handleCancel}
      footer={null}
      destroyOnClose
    >
      <Alert
        message="Ketentuan Klaim & Verifikasi"
        description="Menu ini diperuntukkan untuk: (1) Penyelesaian task 100% yang memerlukan audit bukti dokumen, atau (2) Koreksi penurunan progres fisik. Progres kenaikan rutin (<100%) wajib menggunakan tombol 'Update Progress'."
        type="warning"
        showIcon
        style={{ marginBottom: 20 }}
      />
      
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Nama Tugas">
          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>{taskName}</Text>
        </Form.Item>
        
        <Form.Item label="Progres Resmi Saat Ini">
          <Text style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>{currentProgress}%</Text>
        </Form.Item>

        <Form.Item
          name="progress"
          label="Nilai Progres yang Diklaim (%)"
          rules={[
            { required: true, message: 'Silakan masukkan nilai progres yang diajukan' },
            { type: 'number', min: 0, max: 100, message: 'Nilai harus antara 0 dan 100' },
            () => ({
              validator(_, value) {
                if (value !== undefined && value > currentProgress && value < 100) {
                  return Promise.reject(new Error('Kenaikan progres rutin di bawah 100% harus menggunakan tombol "Update Progress"'));
                }
                return Promise.resolve();
              },
            }),
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={100}
            step={1}
            precision={2}
            placeholder="Contoh: 100 untuk selesai penuh, atau lebih rendah dari nilai saat ini untuk koreksi"
          />
        </Form.Item>

        <Form.Item
          name="reason"
          label="Alasan / Keterangan Lapangan"
          rules={[{ required: true, message: 'Alasan pengajuan klaim wajib diisi' }]}
        >
          <TextArea rows={3} placeholder="Jelaskan justifikasi teknis pengajuan 100% atau koreksi penurunan progres..." />
        </Form.Item>

        <Form.Item
          label="Dokumen Bukti Pendukung (Wajib untuk 100%)"
          required
          extra="Format yang didukung: PDF, Foto Lapangan, Dokumen Teknis (maks. 10MB)"
        >
          <Upload
            fileList={fileList}
            onChange={handleUploadChange}
            beforeUpload={beforeUpload}
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>Pilih Berkas Bukti (Evidence)</Button>
          </Upload>
        </Form.Item>

        <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleCancel} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              Ajukan Klaim
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
