'use client';

import React, { useState } from 'react';
import { Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import api from '../lib/api';
import axios from 'axios';

interface UploadDocumentProps {
  entityType: string;
  entityId: number;
  onSuccess?: (documentId: number) => void;
}

const UploadDocument: React.FC<UploadDocumentProps> = ({ entityType, entityId, onSuccess }) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    const file = fileList[0];
    if (!file || !file.originFileObj) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file.originFileObj);
      formData.append('entityType', entityType);
      formData.append('entityId', String(entityId));

      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      message.success('File berhasil diupload dan disimpan permanen');
      
      if (onSuccess && res.data?.data?.id) {
        onSuccess(res.data.data.id);
      }
      
      setFileList([]);
    } catch (error: any) {
      message.error('Gagal mengupload dokumen: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const props: UploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      setFileList([file]);
      return false; // Prevent automatic upload by antd
    },
    fileList,
  };

  return (
    <div>
      <Upload {...props} maxCount={1}>
        <Button icon={<UploadOutlined />}>Pilih File (Maks 10MB)</Button>
      </Upload>
      <Button
        type="primary"
        onClick={handleUpload}
        disabled={fileList.length === 0}
        loading={uploading}
        style={{ marginTop: 16 }}
      >
        {uploading ? 'Mengupload...' : 'Mulai Upload'}
      </Button>
    </div>
  );
};

export default UploadDocument;
