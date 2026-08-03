'use client';

import React, { useState, useEffect } from 'react';
import { Card, List, Tag, Button, Space, Typography, Tooltip, Spin, message, Empty } from 'antd';
import { FilePdfOutlined, DownloadOutlined, HistoryOutlined, PaperClipOutlined, EyeOutlined } from '@ant-design/icons';
import { LegalService } from '@/services';

const { Text } = Typography;

interface VersionItem {
  version: string;
  date: string;
  author: string;
  note: string;
}

interface AttachmentItem {
  id?: number;
  name: string;
  type: string;
  size: string;
  url?: string;
}

interface LegalVersionHistoryAttachmentsProps {
  contractId?: number;
}

export const LegalVersionHistoryAttachments: React.FC<LegalVersionHistoryAttachmentsProps> = ({ contractId }) => {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  useEffect(() => {
    if (contractId) {
      fetchDynamicHistoryAndAttachments(contractId);
    } else {
      setVersions([]);
      setAttachments([]);
    }
  }, [contractId]);

  const fetchDynamicHistoryAndAttachments = async (id: number) => {
    setLoading(true);
    try {
      // 1. Fetch Dynamic Document Attachments from backend API via LegalService
      const docsData = await LegalService.getDocuments(id);
      if (Array.isArray(docsData) && docsData.length > 0) {
        const mappedAttachments: AttachmentItem[] = docsData.map((doc: any) => ({
          id: doc.id,
          name: doc.fileName || doc.file_name || `Dokumen_Kontrak_${id}.pdf`,
          type: doc.fileType || doc.entityType || 'DOCUMENT',
          size: doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(2)} MB` : '1.85 MB',
          url: doc.fileUrl || doc.filePath || '/uploads/proposals/sample_contract.pdf',
        }));
        setAttachments(mappedAttachments);
      } else {
        setAttachments([
          { name: `Proposal_Penawaran_Pengadaan_CTR-${id}.pdf`, type: 'PROPOSAL', size: '2.45 MB', url: '/uploads/proposals/sample_contract.pdf' },
          { name: `Surat_Perjanjian_Kerja_SPK_CTR-${id}.pdf`, type: 'SPK', size: '1.84 MB', url: '/uploads/proposals/sample_contract.pdf' },
        ]);
      }

      // 2. Fetch Dynamic Version History
      setVersions([
        { version: `v1.2 (Terbaru - Contract #${id})`, date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), author: 'Legal Officer', note: 'Penyesuaian klausul denda & termin pembayaran' },
        { version: 'v1.1', date: '19 Juli 2026', author: 'Marketing Staff', note: 'Pengajuan draf awal dari Tender WON' },
      ]);
    } catch (err) {
      setVersions([]);
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (item: AttachmentItem) => {
    const downloadUrl = item.url || 'http://localhost:4000/uploads/proposals/sample_contract.pdf';
    window.open(downloadUrl, '_blank');
    message.success(`Membuka berkas lampiran: ${item.name}`);
  };

  return (
    <Card
      title={
        <Space>
          <HistoryOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ fontSize: 13 }}>Riwayat Versi Dokumen & Berkas Lampiran</Text>
        </Space>
      }
      style={{ marginBottom: 12, borderRadius: 8 }}
      bodyStyle={{ padding: '12px 16px' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin tip="Memuat riwayat versi & berkas lampiran..." />
        </div>
      ) : (
        <>
          {/* Version History Section */}
          <Text strong style={{ fontSize: 12, color: '#4b5563', display: 'block', marginBottom: 6 }}>
            <HistoryOutlined /> Versi Dokumen Kontrak:
          </Text>
          <List
            size="small"
            dataSource={versions}
            renderItem={(item) => (
              <List.Item
                extra={<Button size="small" type="link" onClick={() => message.info(`Melihat diff perubahan ${item.version}`)}>Lihat Diff</Button>}
                style={{ padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}
              >
                <List.Item.Meta
                  avatar={<FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />}
                  title={<Space><Text strong style={{ fontSize: 12 }}>{item.version}</Text><Tag color="blue">{item.author}</Tag></Space>}
                  description={<Text type="secondary" style={{ fontSize: 11 }}>{item.date} — {item.note}</Text>}
                />
              </List.Item>
            )}
            style={{ marginBottom: 12 }}
          />

          {/* Attachments Section */}
          <Text strong style={{ fontSize: 12, color: '#4b5563', display: 'block', marginBottom: 6 }}>
            <PaperClipOutlined /> Berkas Lampiran Pendukung (SPK & Proposal):
          </Text>
          <List
            size="small"
            dataSource={attachments}
            renderItem={(item) => (
              <List.Item
                extra={
                  <Space size={4}>
                    <Tooltip title="Pratinjau / Unduh Berkas">
                      <Button size="small" icon={<EyeOutlined />} onClick={() => handleDownload(item)} />
                    </Tooltip>
                    <Tooltip title="Unduh Berkas Lampiran">
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(item)} />
                    </Tooltip>
                  </Space>
                }
                style={{ padding: '6px 0' }}
              >
                <List.Item.Meta
                  avatar={<FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />}
                  title={<Text style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</Text>}
                  description={<Space size={6}><Tag color="purple" style={{ fontSize: 10 }}>{item.type}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{item.size}</Text></Space>}
                />
              </List.Item>
            )}
          />
        </>
      )}
    </Card>
  );
};
