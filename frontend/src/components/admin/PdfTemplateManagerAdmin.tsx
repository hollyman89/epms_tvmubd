'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Space, Typography, Tag, Table, Modal, Row, Col, message, Spin } from 'antd';
import { FilePdfOutlined, EyeOutlined, SaveOutlined, PlusOutlined, CodeOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Text, Title } = Typography;

export interface PdfTemplateItem {
  id: number;
  name: string;
  content: string;
  version: number;
  is_active: boolean;
  variable_mapping: Record<string, string>;
  created_at: string;
}

export const PdfTemplateManagerAdmin: React.FC = () => {
  const [templates, setTemplates] = useState<PdfTemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [templateName, setTemplateName] = useState<string>('Kontrak Kerjasama SPK Standar');
  const [templateContent, setTemplateContent] = useState<string>(
`<div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">
  <h2 style="color: #0284c7; text-align: center;">SURAT PERJANJIAN KERJASAMA (SPK)</h2>
  <p><strong>Nomor Kontrak:</strong> {{contractNumber}}</p>
  <p><strong>Nama Klien:</strong> {{customerName}}</p>
  <p><strong>Nilai Kontrak:</strong> {{contractValue}}</p>
  <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />
  <p>Pasal 1: Pihak Pertama dan Pihak Kedua sepakat melaksanakan pekerjaan sesuai spesifikasi teknis.</p>
  {{#if hasDeposit}}
    <p style="background: #f0fdf4; padding: 8px; border-left: 4px solid #10b981;">
      <strong>Uang Muka (Deposit):</strong> {{depositAmount}}
    </p>
  {{/if}}
</div>`
  );
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get('http://localhost:4000/api/v1/pdf-templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(res.data)) setTemplates(res.data);
    } catch (err) {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !templateContent.trim()) {
      message.warning('Nama dan Konten Template Handlebars wajib diisi!');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('access_token');
      await axios.post(
        'http://localhost:4000/api/v1/pdf-templates',
        { name: templateName, content: templateContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success('Template PDF Handlebars berhasil disimpan!');
      setModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gagal menyimpan template');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = (content: string) => {
    const sampleData = {
      contractNumber: 'CON-2026-DEMO-001',
      customerName: 'PT Telekomunikasi Indonesia Tbk',
      contractValue: 'Rp 1.500.000.000',
      hasDeposit: 'true',
      depositAmount: 'Rp 150.000.000',
    };

    let rendered = content;
    Object.keys(sampleData).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, (sampleData as any)[key]);
    });
    rendered = rendered.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, '$2');

    setPreviewHtml(rendered);
    setPreviewModalOpen(true);
  };

  const columns = [
    {
      title: 'Nama Template',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Versi Engine',
      dataIndex: 'version',
      key: 'version',
      render: (ver: number) => <Tag color="blue">v{ver}.0</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (active ? <Tag color="green">Aktif</Tag> : <Tag color="default">Nonaktif</Tag>),
    },
    {
      title: 'Aksi',
      key: 'action',
      render: (_: any, record: PdfTemplateItem) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handlePreview(record.content)}>
            Live Preview
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <FilePdfOutlined style={{ color: '#0284c7', fontSize: 18 }} />
            <Text strong style={{ fontSize: 14 }}>Dynamic PDF Template Engine (Handlebars HTML)</Text>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Buat Versi Template Baru
          </Button>
        </div>
      }
    >
      <Table dataSource={templates} columns={columns} rowKey="id" loading={loading} />

      {/* Modal Editor Template Handlebars */}
      <Modal
        title="Editor Template Dynamic PDF (Handlebars & Variable Mapping)"
        open={modalOpen}
        onOk={handleSaveTemplate}
        confirmLoading={submitting}
        onCancel={() => setModalOpen(false)}
        width={800}
        okText="Simpan Template Versi Baru"
        cancelText="Batal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text strong style={{ fontSize: 12 }}>Nama Template PDF:</Text>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Contoh: Kontrak SPK Pengadaan Hardware"
            />
          </div>
          <div>
            <Text strong style={{ fontSize: 12 }}>Konten HTML Template Handlebars:</Text>
            <Input.TextArea
              rows={10}
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <Button icon={<EyeOutlined />} onClick={() => handlePreview(templateContent)}>
            Uji Render Preview Dengan Data Contoh
          </Button>
        </div>
      </Modal>

      {/* Modal Live HTML Preview */}
      <Modal
        title="Live Rendered PDF HTML Preview"
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        footer={null}
        width={700}
      >
        <div
          style={{ border: '1px dashed #cbd5e1', padding: 16, borderRadius: 8, backgroundColor: '#ffffff' }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </Modal>
    </Card>
  );
};
