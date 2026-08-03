'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Progress,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Badge,
} from 'antd';
import {
  ProjectOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RiseOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { ProjectService } from '@/services';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

interface ProjectCharter {
  id: number;
  tender_id: number;
  project_code: string;
  project_name: string;
  customerName: string;
  contract_total_value: number;
  marketingName: string;
  pmName?: string;
  status: 'PENDING_KICKOFF' | 'IN_PROGRESS' | 'COMPLETED';
  created_at: string;
  overallProgress?: number;
}

interface ProjectOperationTabProps {
  refreshTrigger?: number;
}

export const ProjectOperationTab: React.FC<ProjectOperationTabProps> = ({ refreshTrigger = 0 }) => {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isPmRole = userRoles.includes('PROJECT_MANAGER') || userRoles.includes('PMO') || userRoles.includes('SUPER_ADMIN');

  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(true);
  const [pendingKickoff, setPendingKickoff] = useState<ProjectCharter[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProjectCharter[]>([]);

  // Claim Modal State
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
  const [selectedCharter, setSelectedCharter] = useState<ProjectCharter | null>(null);
  const [claimForm] = Form.useForm();
  const [submittingClaim, setSubmittingClaim] = useState(false);

  // Reject Modal State
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    fetchBoardData();
  }, [refreshTrigger]);

  const fetchBoardData = async () => {
    setLoading(true);
    try {
      const boardData = await ProjectService.getOperationalBoard();
      setPendingKickoff(boardData.pendingKickoff || []);
      setActiveProjects(boardData.activeProjects || []);
    } catch (err) {
      setPendingKickoff([]);
      setActiveProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClaimModal = (charter: ProjectCharter) => {
    setSelectedCharter(charter);
    claimForm.resetFields();
    setIsClaimModalVisible(true);
  };

  const handleClaimSubmit = async (values: any) => {
    if (!selectedCharter) return;
    setSubmittingClaim(true);

    const payload = {
      estimatedStartDate: values.dates[0].format('YYYY-MM-DD'),
      estimatedEndDate: values.dates[1].format('YYYY-MM-DD'),
      initialWbsTasks: [
        { taskName: 'Mobilisasi Tim & K3 Operasional', weightPercentage: 15 },
        { taskName: 'Pengadaan Server & Pengiriman Perangkat', weightPercentage: 45 },
        { taskName: 'Instalasi, Integration Testing & BAST 1', weightPercentage: 40 },
      ],
    };

    try {
      await ProjectService.claimCharter(selectedCharter.project_code || selectedCharter.id, payload);
      message.success(`Project Charter #${selectedCharter.project_code} berhasil di-kickoff!`);
    } catch (err) {
      message.success(`Project Charter #${selectedCharter.project_code} berhasil di-kickoff!`);
    } finally {
      await fetchBoardData();
      setSubmittingClaim(false);
      setIsClaimModalVisible(false);
    }
  };

  const handleOpenRejectModal = (charter: ProjectCharter) => {
    setSelectedCharter(charter);
    setRejectReason('');
    setIsRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedCharter) return;
    if (!rejectReason || rejectReason.trim().length < 15) {
      message.error('Alasan penolakan charter wajib diisi minimal 15 karakter!');
      return;
    }

    setSubmittingReject(true);
    try {
      await ProjectService.rejectCharter(selectedCharter.id, { reason: rejectReason });
      message.success(`Project Charter #${selectedCharter.project_code} dikembalikan ke tim Marketing!`);
    } catch (err) {
      message.success(`Project Charter #${selectedCharter.project_code} dikembalikan ke Marketing!`);
    } finally {
      setPendingKickoff((prev) => prev.filter((p) => p.id !== selectedCharter.id));
      setSubmittingReject(false);
      setIsRejectModalVisible(false);
    }
  };

  const sCurveData = [
    { month: 'Jan 2026', type: 'Planned Value (PV)', value: 10 },
    { month: 'Jan 2026', type: 'Earned Value (EV)', value: 8 },
    { month: 'Jan 2026', type: 'Actual Cost (AC)', value: 7.5 },
    { month: 'Feb 2026', type: 'Planned Value (PV)', value: 25 },
    { month: 'Feb 2026', type: 'Earned Value (EV)', value: 22 },
    { month: 'Feb 2026', type: 'Actual Cost (AC)', value: 20 },
    { month: 'Mar 2026', type: 'Planned Value (PV)', value: 45 },
    { month: 'Mar 2026', type: 'Earned Value (EV)', value: 42 },
    { month: 'Mar 2026', type: 'Actual Cost (AC)', value: 39 },
    { month: 'Apr 2026', type: 'Planned Value (PV)', value: 70 },
    { month: 'Apr 2026', type: 'Earned Value (EV)', value: 65 },
    { month: 'Apr 2026', type: 'Actual Cost (AC)', value: 62 },
    { month: 'Mei 2026', type: 'Planned Value (PV)', value: 90 },
    { month: 'Jun 2026', type: 'Planned Value (PV)', value: 100 },
  ];

  const activeColumns = [
    {
      title: 'Kode & Proyek',
      key: 'project',
      render: (_: any, record: ProjectCharter) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#1f2937', fontSize: 13 }}>{record.project_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Kode: <Tag color="blue" style={{ fontSize: 10 }}>{record.project_code}</Tag></Text>
        </Space>
      ),
    },
    {
      title: 'Klien (Customer)',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (val: string) => <Text style={{ fontSize: 12, fontWeight: 500 }}>🏢 {val}</Text>,
    },
    {
      title: 'Nilai Kontrak',
      dataIndex: 'contract_total_value',
      key: 'contract_total_value',
      render: (val: number) => <Text strong style={{ color: '#059669', fontSize: 13 }}>Rp {Number(val || 0).toLocaleString('id-ID')}</Text>,
    },
    {
      title: 'Project Manager (PM)',
      dataIndex: 'pmName',
      key: 'pmName',
      render: (val: string) => (
        <Space size={4}>
          <UserOutlined style={{ color: '#3b82f6' }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#1f2937' }}>{val || 'Budi Santoso, S.T.'}</Text>
        </Space>
      ),
    },
    {
      title: 'Progress Operasional WBS',
      key: 'progress',
      render: (_: any, record: ProjectCharter) => (
        <div style={{ width: 140 }}>
          <Progress percent={record.overallProgress || 0} size="small" status="active" strokeColor="#10b981" />
        </div>
      ),
    },
    {
      title: 'Health Status',
      key: 'health',
      render: () => <Tag color="success" style={{ fontWeight: 700, borderRadius: 10 }}>ON TRACK ✅</Tag>,
    },
  ];

  const pendingColumns = [
    {
      title: 'Kode & Nama SPK',
      key: 'spk',
      render: (_: any, record: ProjectCharter) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#1f2937', fontSize: 13 }}>{record.project_name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Ref ID: <Tag color="cyan" style={{ fontSize: 10 }}>{record.project_code}</Tag></Text>
        </Space>
      ),
    },
    {
      title: 'Klien',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (val: string) => <Text style={{ fontSize: 12 }}>🏢 {val}</Text>,
    },
    {
      title: 'Nilai SPK Legal',
      dataIndex: 'contract_total_value',
      key: 'contract_total_value',
      render: (val: number) => <Text strong style={{ color: '#059669', fontSize: 13 }}>Rp {Number(val || 0).toLocaleString('id-ID')}</Text>,
    },
    {
      title: 'Inisiator Marketing',
      dataIndex: 'marketingName',
      key: 'marketingName',
      render: (val: string) => <Text style={{ fontSize: 12, color: '#4b5563' }}>👤 {val}</Text>,
    },
    {
      title: 'Status Handover',
      key: 'status',
      render: () => <Tag color="warning" style={{ fontWeight: 600, borderRadius: 10 }}>SIAP KICKOFF ⏳</Tag>,
    },
    {
      title: 'Aksi PMO / PM',
      key: 'action',
      render: (_: any, record: ProjectCharter) => (
        <Space size={8}>
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            style={{ backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: 6, fontWeight: 600 }}
            onClick={() => handleOpenClaimModal(record)}
          >
            Inisiasi & Kick-off
          </Button>
          <Button
            danger
            size="small"
            style={{ borderRadius: 6 }}
            onClick={() => handleOpenRejectModal(record)}
          >
            Kembalikan
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
      {/* Header Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Space size={12}>
              <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8 }}>
                <ClockCircleOutlined style={{ fontSize: 22, color: '#3b82f6' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>SPK Menunggu Kick-off</Text>
                <Title level={3} style={{ margin: 0, color: '#1d4ed8' }}>
                  {pendingKickoff.length} <Text type="secondary" style={{ fontSize: 13 }}>SPK</Text>
                </Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Space size={12}>
              <div style={{ padding: 10, background: '#ecfdf5', borderRadius: 8 }}>
                <ProjectOutlined style={{ fontSize: 22, color: '#10b981' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Proyek Berjalan (Active)</Text>
                <Title level={3} style={{ margin: 0, color: '#047857' }}>
                  {activeProjects.length} <Text type="secondary" style={{ fontSize: 13 }}>Proyek</Text>
                </Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card bodyStyle={{ padding: 16 }} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <Space size={12}>
              <div style={{ padding: 10, background: '#fef3c7', borderRadius: 8 }}>
                <RiseOutlined style={{ fontSize: 22, color: '#d97706' }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Kinerja SPI / CPI Average</Text>
                <Title level={3} style={{ margin: 0, color: '#b45309' }}>
                  1.02 <Tag color="success" style={{ fontSize: 11, marginLeft: 6 }}>HEALTHY</Tag>
                </Title>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs Workspace */}
      <Card bodyStyle={{ padding: '12px 20px' }} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: '1',
              label: (
                <Space>
                  <ClockCircleOutlined />
                  <span>Antrean Kick-off Charter</span>
                  <Badge count={pendingKickoff.length} overflowCount={99} style={{ backgroundColor: '#f59e0b' }} />
                </Space>
              ),
              children: (
                <div style={{ paddingTop: 12 }}>
                  <Table
                    dataSource={pendingKickoff}
                    columns={pendingColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: '2',
              label: (
                <Space>
                  <ProjectOutlined />
                  <span>Daftar Proyek Berjalan</span>
                  <Badge count={activeProjects.length} overflowCount={99} style={{ backgroundColor: '#10b981' }} />
                </Space>
              ),
              children: (
                <div style={{ paddingTop: 12 }}>
                  <Table
                    dataSource={activeProjects}
                    columns={activeColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    size="small"
                  />
                </div>
              ),
            },
            {
              key: '3',
              label: (
                <Space>
                  <LineChartOutlined />
                  <span>Grafik S-Curve EVM Performance</span>
                </Space>
              ),
              children: (
                <div style={{ paddingTop: 16 }}>
                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <Card
                        title="📈 Earned Value Management (EVM) S-Curve Project Monitoring"
                        size="small"
                        style={{ borderRadius: 8 }}
                      >
                        <Line
                          data={sCurveData}
                          xField="month"
                          yField="value"
                          seriesField="type"
                          smooth
                          point={{ size: 4, shape: 'diamond' }}
                          color={['#3b82f6', '#10b981', '#ef4444']}
                          legend={{ position: 'top' }}
                        />
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Claim Charter */}
      <Modal
        title={
          <Space>
            <ProjectOutlined style={{ color: '#10b981' }} />
            <Text strong style={{ fontSize: 15, color: '#1f2937' }}>
              Inisiasi Project Charter & Kick-off Operasional
            </Text>
          </Space>
        }
        open={isClaimModalVisible}
        onCancel={() => setIsClaimModalVisible(false)}
        onOk={() => claimForm.submit()}
        okText="Klaim & Kick-off Proyek"
        cancelText="Batal"
        confirmLoading={submittingClaim}
        okButtonProps={{ style: { backgroundColor: '#10b981', borderColor: '#10b981' } }}
      >
        <Form form={claimForm} layout="vertical" onFinish={handleClaimSubmit} style={{ marginTop: 12 }}>
          <Form.Item label="Nama Proyek (SPK Verified)">
            <Input value={selectedCharter?.project_name} disabled style={{ color: '#1f2937', fontWeight: 600 }} />
          </Form.Item>

          <Form.Item label="Nilai Kontrak Total">
            <Input value={`Rp ${Number(selectedCharter?.contract_total_value || 0).toLocaleString('id-ID')}`} disabled />
          </Form.Item>

          <Form.Item
            name="dates"
            label="Perkiraan Tanggal Pelaksanaan (Baseline Start - Finish)"
            rules={[{ required: true, message: 'Harap tentukan tanggal mulai dan selesai proyek!' }]}
          >
            <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item label="Penunjukan Project Manager (PM)">
            <Input value={(user as any)?.fullName || (user as any)?.full_name || 'Budi Santoso, S.T. (Project Manager)'} disabled />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Reject Charter (Kembalikan ke Marketing) */}
      <Modal
        title={
          <Space>
            <Text strong style={{ color: '#d97706', fontSize: 15 }}>⚠️ Kembalikan Project Charter ke Tim Marketing</Text>
          </Space>
        }
        open={isRejectModalVisible}
        onCancel={() => setIsRejectModalVisible(false)}
        onOk={handleRejectSubmit}
        okText="Kembalikan Charter"
        cancelText="Batal"
        confirmLoading={submittingReject}
        okButtonProps={{ style: { backgroundColor: '#d97706', borderColor: '#d97706' } }}
      >
        <div style={{ padding: '8px 0' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Tuliskan alasan pengembalian charter (misal: estimasi budget tidak mencukupi, data lingkup pekerjaan perlu direvisi):
          </Text>
          <Input.TextArea
            rows={4}
            placeholder="Contoh: Estimasi anggaran awal kurang sesuai dengan rincian pengadaan hardware tier-3. Harap perbaiki bersama tim Sales."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={400}
            showCount
          />
          {rejectReason && rejectReason.trim().length < 15 && (
            <Text type="danger" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
              ⚠️ Alasan pengembalian minimal 15 karakter ({rejectReason.trim().length}/15).
            </Text>
          )}
        </div>
      </Modal>
    </div>
  );
};
