"use client";

import React, { useEffect, useState } from 'react';
import { MainLayout } from '../../../../components/MainLayout';
import { ProtectedRoute } from '../../../../components/ProtectedRoute';
import { useParams, useRouter } from 'next/navigation';
import { Card, Skeleton, message, Typography, Button, Space, Modal, Descriptions, Row, Col, Tag, Divider, Form, Input, DatePicker, Tooltip } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../context/AuthContext';
import dayjs from 'dayjs';
import { TenderActivityStream } from '../../../../components/TenderActivityStream';
import { apiClient } from '@/lib/axios';

const { Title, Text } = Typography;

export default function TenderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  // ─── STATE ────────────────────────────────────────────────────────────────────
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refetch = () => setRefreshKey(k => k + 1);

  // Edit State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();
  const [updating, setUpdating] = useState(false);
  // ─── END STATE ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchTenderDetail = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const response = await apiClient.get(`/marketing/tenders/${id}`);
        const result = response.data?.data || response.data;
        if (!result) {
          throw new Error('Data tidak ditemukan dari API');
        }
        setData(result);
      } catch (err: any) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.message || err.message);
        if (err.response?.status !== 404) {
          message.error('Gagal memuat data tender');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTenderDetail();
  }, [id, refreshKey]);

  // ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
  const formatCurrency = (amount: any): string => {
    if (amount === null || amount === undefined || amount === 0 || amount === '0') return '-';
    const num = Number(amount);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString: any): string => {
    if (!dateString) return '-';
    let parsed = dayjs(dateString);
    if (!parsed.isValid()) {
      parsed = dayjs(new Date(dateString));
    }
    if (!parsed.isValid()) return '-';
    return parsed.format('DD MMM YYYY');
  };
  // ─── END FORMAT HELPERS ───────────────────────────────────────────────────────

  // ─── EDIT TENDER ──────────────────────────────────────────────────────────────
  const openEditModal = () => {
    editForm.setFieldsValue({
      source: data?.source,
      projectLocation: data?.projectLocation,
      picCustomerName: data?.picCustomerName,
      picCustomerPhone: data?.picCustomerPhone,
      notes: data?.notes,
      bidSubmissionDeadline: data?.bidSubmissionDeadline ? dayjs(data.bidSubmissionDeadline) : null,
    });
    setIsEditModalVisible(true);
  };

  const handleEditSubmit = async (values: any) => {
    try {
      setUpdating(true);
      await apiClient.patch(`/marketing/tenders/${id}`, {
        ...values,
        bidSubmissionDeadline: values.bidSubmissionDeadline ? values.bidSubmissionDeadline.format('YYYY-MM-DD') : null,
      });
      message.success('Data Tender berhasil diperbarui');
      setIsEditModalVisible(false);
      refetch();
    } catch (err: any) {
      console.error('ERROR (Edit Tender):', err.response?.data || err.message);
      message.error('Gagal menyimpan perubahan: ' + (err.response?.data?.message || 'Terjadi kesalahan sistem'));
    } finally {
      setUpdating(false);
    }
  };
  // ─── END EDIT TENDER ──────────────────────────────────────────────────────────

  // ─── MARK WON / LOST ─────────────────────────────────────────────────────────
  const handleMarkWon = async () => {
    Modal.confirm({
      title: 'Tandai sebagai WON?',
      content: 'Tindakan ini akan mengubah status Tender menjadi WON dan secara otomatis membuat Proposal serta Kontrak baru.',
      okText: 'Ya, WON',
      okButtonProps: { style: { backgroundColor: '#52c41a', borderColor: '#52c41a' } },
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await apiClient.patch(`/marketing/tenders/${id}/status`, { stage: 'Won' });
          message.success('Status Tender berhasil diperbarui menjadi WON ✅');
          refetch();
        } catch (err: any) {
          console.error('ERROR (Mark WON):', err.response?.data || err.message);
          message.error('Gagal: ' + (err.response?.data?.message || 'Terjadi kesalahan sistem'));
        }
      }
    });
  };

  const handleMarkLost = async () => {
    Modal.confirm({
      title: 'Tandai sebagai LOST?',
      content: 'Tindakan ini akan mengubah status Tender menjadi LOST.',
      okText: 'Ya, LOST',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await apiClient.patch(`/marketing/tenders/${id}/status`, { stage: 'Lost' });
          message.success('Status Tender berhasil diperbarui menjadi LOST');
          refetch();
        } catch (err: any) {
          console.error('ERROR (Mark LOST):', err.response?.data || err.message);
          message.error('Gagal: ' + (err.response?.data?.message || 'Terjadi kesalahan sistem'));
        }
      }
    });
  };
  // ─── END MARK WON / LOST ─────────────────────────────────────────────────────

  // ─── RENDER STATES ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER', 'MARKETING']}>
        <MainLayout>
          <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
        </MainLayout>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return (
      <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER', 'MARKETING']}>
        <MainLayout>
          <Space direction="vertical" size="large" style={{ display: 'flex' }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/sales')}>
              Back to Sales Pipeline
            </Button>
            <Card>
              <Text type="secondary">
                {error ? `Error: ${error}` : 'Tender tidak ditemukan.'}
              </Text>
            </Card>
          </Space>
        </MainLayout>
      </ProtectedRoute>
    );
  }
  // ─── END RENDER STATES ────────────────────────────────────────────────────────

  const isDone = data.status === 'WON' || data.status === 'LOST';

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER', 'MARKETING']}>
      <MainLayout>
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>

            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/sales')}>
              Back to Sales Pipeline
            </Button>

          <div style={{ marginBottom: 24, marginTop: 8 }}>
            <Title level={2} style={{ margin: 0, fontWeight: 'bold' }}>{data?.title ?? '-'}</Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color={data.status === 'WON' ? 'green' : data.status === 'LOST' ? 'red' : 'blue'}>
                {data.status ?? '-'}
              </Tag>
              {data.stage && (
                <Tag color={
                  data.stage.toUpperCase() === 'QUALIFICATION' ? 'blue' :
                  data.stage.toUpperCase() === 'NEGOTIATION' ? 'orange' :
                  data.stage.toUpperCase() === 'WON' ? 'green' :
                  data.stage.toUpperCase() === 'LOST' ? 'red' :
                  'default'
                }>
                  {data.stage}
                </Tag>
              )}
            </Space>
          </div>

          <Row gutter={24} style={{ display: 'flex', alignItems: 'stretch' }}>
            <Col xs={24} lg={16} style={{ display: 'flex', flexDirection: 'column' }}>
              <Card title="Informasi Tender" size="small" bordered={true} style={{ marginBottom: 16 }}>
                <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="Customer">{data?.customerName ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Project Name">{data?.title ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Procurement Type">{data?.procurementType ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Source">{data?.source ?? '-'}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card title="Timeline & Nilai" size="small" bordered={true} style={{ marginBottom: 16 }}>
                <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="Stage">
                    {data.stage ? (
                      <Tag color={
                        data.stage.toUpperCase() === 'QUALIFICATION' ? 'blue' :
                        data.stage.toUpperCase() === 'NEGOTIATION' ? 'orange' :
                        data.stage.toUpperCase() === 'WON' ? 'green' :
                        data.stage.toUpperCase() === 'LOST' ? 'red' :
                        'default'
                      }>
                        {data.stage}
                      </Tag>
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Priority">{data?.priority ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Expected Closing Date">{formatDate(data?.expectedClosingDate)}</Descriptions.Item>
                  <Descriptions.Item label="Bid Submission Deadline">{formatDate(data?.bidSubmissionDeadline)}</Descriptions.Item>
                  <Descriptions.Item label="Estimated Budget">{formatCurrency(data?.estimatedBudget)}</Descriptions.Item>
                  <Descriptions.Item label="Probability">{data?.probabilityPercentage ?? 0}%</Descriptions.Item>
                </Descriptions>

                {/* Posisi Tombol Baru di Bawah */}
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                  <Space size="middle">
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      disabled={isDone}
                      onClick={handleMarkWon}
                      style={!isDone ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {}}
                    >
                      Tandai WON
                    </Button>
                    <Button
                      type="primary"
                      danger
                      icon={<CloseCircleOutlined />}
                      disabled={isDone}
                      onClick={handleMarkLost}
                    >
                      Tandai LOST
                    </Button>
                  </Space>
                </div>
              </Card>

              <Card title="Detail Lokasi & PIC" size="small" bordered={true} style={{ marginBottom: 16 }}>
                <Descriptions column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                  <Descriptions.Item label="Marketing PIC">{data?.marketingPicName ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="PIC Customer">{data?.picCustomerName ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Project Location">{data?.projectLocation ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Notes">{data?.notes ?? '-'}</Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            
            <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 'calc(100vh - 200px)', minHeight: 500, flex: 1 }}>
                <TenderActivityStream tenderId={id as string} />
              </div>
            </Col>
          </Row>

        </Space>

        <Modal
          title="Edit Data Tender"
          open={isEditModalVisible}
          onCancel={() => setIsEditModalVisible(false)}
          onOk={() => editForm.submit()}
          confirmLoading={updating}
          okText="Simpan Perubahan"
          cancelText="Batal"
          width={600}
        >
          <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
            <Form.Item label="Source" name="source">
              <Input placeholder="Contoh: LPSE, Referensi, dll" />
            </Form.Item>
            <Form.Item label="Project Location" name="projectLocation">
              <Input placeholder="Lokasi Proyek" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="PIC Customer Name" name="picCustomerName">
                  <Input placeholder="Nama PIC dari pihak Customer" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="PIC Customer Phone" name="picCustomerPhone">
                  <Input placeholder="Nomor Telepon PIC" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Bid Submission Deadline" name="bidSubmissionDeadline">
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
            <Form.Item label="Notes" name="notes">
              <Input.TextArea rows={4} placeholder="Catatan tambahan..." />
            </Form.Item>
          </Form>
        </Modal>

      </MainLayout>
    </ProtectedRoute>
  );
}
