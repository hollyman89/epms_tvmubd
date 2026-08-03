import React, { useState, useEffect } from 'react';
import { Upload, message, List, Button, Typography, Spin } from 'antd';
import { InboxOutlined, FilePdfOutlined, PictureOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import axios from 'axios';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface DocumentUploadProps {
  entityType: string;
  entityId: number;
}

interface DocumentItem {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  createdAt: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ entityType, entityId }) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:4000/api/v1/documents/entity/${entityType}/${entityId}`);
      // Handle nested interceptor payload
      const data = res.data?.data?.data || res.data?.data || [];
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch documents', error);
      message.error('Gagal mengambil daftar dokumen');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      fetchDocuments();
    }
  }, [entityType, entityId]);

  const props: UploadProps = {
    name: 'file',
    multiple: false,
    action: 'http://localhost:4000/api/v1/documents/upload',
    data: {
      entityType,
      entityId: String(entityId),
    },
    onChange(info) {
      const { status } = info.file;
      if (status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (status === 'done') {
        message.success(`File ${info.file.name} berhasil diunggah.`);
        fetchDocuments(); // Refresh the list
      } else if (status === 'error') {
        message.error(`File ${info.file.name} gagal diunggah.`);
      }
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.includes('pdf')) return <FilePdfOutlined style={{ fontSize: '24px', color: '#f5222d' }} />;
    if (mimeType?.includes('image')) return <PictureOutlined style={{ fontSize: '24px', color: '#1677ff' }} />;
    return <FilePdfOutlined style={{ fontSize: '24px', color: '#8c8c8c' }} />;
  };

  return (
    <div style={{ background: '#fff', padding: 24, borderRadius: 8, marginTop: 24 }}>
      <Title level={4}>Lampiran Dokumen</Title>
      
      <Dragger {...props} style={{ marginBottom: 24 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Klik atau seret file ke area ini untuk mengunggah</p>
        <p className="ant-upload-hint">
          Mendukung unggahan file tunggal. Harap jangan mengunggah data rahasia perusahaan secara publik.
        </p>
      </Dragger>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={documents}
          locale={{ emptyText: 'Belum ada dokumen terlampir' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button 
                  type="link" 
                  icon={<DownloadOutlined />} 
                  href={item.fileUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Unduh
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={getFileIcon(item.mimeType)}
                title={<a href={item.fileUrl} target="_blank" rel="noopener noreferrer">{item.fileName}</a>}
                description={`Diunggah pada: ${new Date(item.createdAt).toLocaleString()}`}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
};
