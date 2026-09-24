'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Spin,
  Alert,
  Progress,
  List,
  Space,
  Badge,
  Table,
} from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  FileDoneOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  RightCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProjectService } from '@/services/project.service';
import type { ProjectDetailItem } from './ProjectDetailDrawer';
import { useAuth } from '@/context/AuthContext';

const { Title, Text } = Typography;

export interface ProjectProgressDashboardProps {
  project: ProjectDetailItem;
  onOpenLedger: () => void;
  onOpenVerification: () => void;
}

export const ProjectProgressDashboard: React.FC<ProjectProgressDashboardProps> = ({
  project,
  onOpenLedger,
  onOpenVerification,
}) => {
  const { user, isSuperAdmin } = useAuth();
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [baselineData, setBaselineData] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);

  // RBAC Setup
  const userRoles: string[] = user?.roles || [];
  const isPmo = userRoles.some(r => r === 'PMO' || r === 'SUPER_ADMIN');
  const isHeadOfOps = userRoles.some(r => r === 'HEAD_OF_OPERATIONS');
  
  const canVerify = isPmo || isHeadOfOps || isSuperAdmin;

  useEffect(() => {
    fetchDashboardData();
  }, [project.projectId, project.id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const pId = Number(project.projectId || project.id);
      
      const [baselineRes, scheduleRes, logsRes] = await Promise.all([
        ProjectService.getProjectBaseline(pId),
        ProjectService.getProjectSchedule(pId),
        ProjectService.getProgressLogs(pId)
      ]);

      setBaselineData(baselineRes);
      setScheduleData(scheduleRes);
      setProgressLogs(logsRes);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Gagal memuat data progress dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Derived Metrics
  const pendingLogs = useMemo(() => progressLogs.filter((l: any) => l.status === 'PENDING_VERIFICATION'), [progressLogs]);
  const officialLogs = useMemo(() => progressLogs.filter((l: any) => l.status === 'OFFICIAL'), [progressLogs]);
  const criticalLogs = useMemo(() => progressLogs.filter((l: any) => 
    l.eventType === 'CRITICAL_CLAIM' || 
    ['FAT_PASSED', 'SAT_PASSED', 'BAST_SUBMITTED', 'COMMISSIONING'].includes(l.eventType) ||
    l.isMilestone
  ), [progressLogs]);

  const downwardCount = officialLogs.filter((l: any) => l.progressDelta < 0).length;
  
  const lastOfficialUpdate = officialLogs.length > 0 ? officialLogs[0].effectiveDate || officialLogs[0].createdAt : null;

  const tasksList = scheduleData?.tasks || [];
  const completedTasksCount = tasksList.filter((t: any) => t.status === 'COMPLETED' || Number(t.progress || 0) === 100).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spin tip="Memuat Project Execution Dashboard..." size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message="API Error" description={error} showIcon />;
  }

  const hasBaseline = baselineData?.hasActiveBaseline;
  const overallProgress = baselineData?.overallProgress || 0;
  const baseline = baselineData?.baseline;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      
      {/* 1. Empty / Edge State for Baseline */}
      {!hasBaseline && (
        <Alert 
          type="warning" 
          showIcon 
          message="Tidak Ada Baseline Aktif"
          description="Proyek ini belum memiliki baseline aktif. Referensi pelaksanaan (Project Execution Reference) belum terbentuk. Progress tidak dapat dihitung secara formal."
        />
      )}

      {/* 2. Top Execution Summary & Overall Progress */}
      <Card 
        bordered={false} 
        style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <Space size={8} style={{ marginBottom: 4 }}>
              <BarChartOutlined style={{ color: '#059669', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16, color: '#0f172a' }}>Execution Summary</Text>
              <Tag color="success" style={{ fontWeight: 700, borderRadius: 6, margin: 0 }}>
                {project.status || 'IN_PROGRESS'}
              </Tag>
            </Space>
          </div>
          <Space>
            <Button size="small" icon={<HistoryOutlined />} onClick={onOpenLedger}>
              View Progress History
            </Button>
            {pendingLogs.length > 0 && (
              <Button 
                size="small" 
                type="primary" 
                danger 
                onClick={onOpenVerification}
              >
                Verify {pendingLogs.length} Claims
              </Button>
            )}
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>OVERALL PROGRESS</Text>
              <div style={{ fontSize: 32, fontWeight: 800, color: overallProgress === 100 ? '#059669' : '#0f172a', lineHeight: 1.2, marginTop: 4 }}>
                {Number(overallProgress).toFixed(2)}%
              </div>
              <Progress percent={overallProgress} showInfo={false} strokeColor="#059669" size="small" style={{ marginBottom: 8 }} />
              {hasBaseline && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Calculated from <Tag color="blue" style={{ fontSize: 10, margin: '0 4px', lineHeight: '14px' }}>Baseline V{baseline.versionNumber}</Tag>
                </Text>
              )}
            </div>
          </Col>
          <Col xs={24} md={16}>
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Last Official Update</Text>
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                  {lastOfficialUpdate ? dayjs(lastOfficialUpdate).format('DD MMM YYYY') : '—'}
                </Text>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Pending Verification</Text>
                <Badge count={pendingLogs.length} showZero color={pendingLogs.length > 0 ? 'red' : '#94a3b8'} />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Tasks Completed</Text>
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                  {completedTasksCount} / {tasksList.length}
                </Text>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Critical Claims</Text>
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{criticalLogs.length} events</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Downward Corrections</Text>
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{downwardCount} events</Text>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {/* 3. Baseline Summary */}
        <Col xs={24} md={12}>
          <Card bordered={false} style={{ height: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '16px' }}>
            <div style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 14 }}>Baseline Summary</Text>
            </div>
            {hasBaseline ? (
              <div>
                <Space size={8} style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 18 }}>Baseline V{baseline.versionNumber}</Text>
                  <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>ACTIVE</Tag>
                </Space>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Activation Date</Text>
                    <Text strong style={{ fontSize: 12 }}>{dayjs(baseline.activatedAt).format('DD MMM YYYY, HH:mm')}</Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Weight</Text>
                    <Text strong style={{ fontSize: 12 }}>{baseline.totalWeightPercentage.toFixed(2)}%</Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>WBS Items</Text>
                    <Text strong style={{ fontSize: 12 }}>{baseline.wbsItemCount} items</Text>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <Tag color="blue" style={{ width: '100%', textAlign: 'center', fontWeight: 600, padding: '4px 0' }}>
                    BASELINE = EXECUTION REFERENCE
                  </Tag>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <Text type="secondary">Belum ada Baseline V1</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* 4. Pending Verification Summary */}
        <Col xs={24} md={12}>
          <Card bordered={false} style={{ height: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '0' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ fontSize: 14 }}>
                <ClockCircleOutlined style={{ marginRight: 6, color: '#f59e0b' }} />
                Pending Verification
              </Text>
              {pendingLogs.length > 0 && (
                <Tag color="error" style={{ margin: 0, fontWeight: 600 }}>{pendingLogs.length} claims pending</Tag>
              )}
            </div>
            
            {pendingLogs.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={pendingLogs.slice(0, 3)}
                style={{ padding: '0 16px' }}
                renderItem={(item: any) => (
                  <List.Item
                    actions={[
                      <a key="verify" onClick={onOpenVerification}>Verify</a>
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong style={{ fontSize: 13 }}>{item.taskName}</Text>}
                      description={
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          <span style={{ color: item.progressDelta >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {item.progressDelta >= 0 ? '+' : ''}{item.progressDelta}%
                          </span> • {item.eventType} • {dayjs(item.createdAt).format('DD MMM')} by {item.submitterName || 'Unknown'}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Text type="secondary">0 claims pending</Text>
              </div>
            )}
            
            {pendingLogs.length > 0 && (
              <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                {!canVerify ? (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Pending PMO/Management verification (Cannot verify own claims)
                  </Text>
                ) : (
                  <a onClick={onOpenVerification} style={{ fontSize: 12, fontWeight: 600 }}>View All Pending Claims <RightCircleOutlined /></a>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 5. WBS / Task Progress (Summary View) */}
      <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '16px' }}>
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 14 }}>WBS & Task Progress Summary</Text>
        </div>
        <Table 
          dataSource={tasksList} 
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="small"
          scroll={{ x: 'max-content' }}
        >
          <Table.Column title="Task Name" dataIndex="name" key="name" render={(text, record: any) => (
            <Space>
              <Text strong={record.isMilestone} style={{ color: record.isMilestone ? '#0f172a' : 'inherit' }}>
                {record.wbsCode ? `${record.wbsCode} - ` : ''}{text}
              </Text>
              {record.isMilestone && <Tag color="purple" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>Milestone</Tag>}
            </Space>
          )} />
          <Table.Column title="Status" dataIndex="status" key="status" render={(status, record: any) => {
            const hasPending = pendingLogs.some((l: any) => l.taskId === record.id);
            return (
              <Space>
                <Tag color={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'processing' : 'default'}>
                  {status}
                </Tag>
                {hasPending && <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>Pending Claim</Tag>}
              </Space>
            );
          }} />
          <Table.Column title="Official Progress" dataIndex="progress" key="progress" render={(progress) => (
            <div style={{ width: 120 }}>
              <Progress percent={Number(progress) || 0} size="small" strokeColor={progress === 100 ? '#10b981' : '#3b82f6'} />
            </div>
          )} />
        </Table>
      </Card>

      {/* 6. Recent Critical Events */}
      <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 14 }}>
            <FileDoneOutlined style={{ marginRight: 6, color: '#ef4444' }} />
            Recent Critical Events
          </Text>
          <a onClick={onOpenLedger} style={{ fontSize: 12 }}>View Ledger</a>
        </div>
        
        {criticalLogs.length > 0 ? (
          <Table
            dataSource={criticalLogs.slice(0, 5)}
            rowKey="id"
            pagination={false}
            size="small"
          >
            <Table.Column title="Date" dataIndex="createdAt" key="createdAt" render={(d) => dayjs(d).format('DD MMM YYYY')} />
            <Table.Column title="Task" dataIndex="taskName" key="taskName" />
            <Table.Column title="Event Type" dataIndex="eventType" key="eventType" render={(type) => (
              <Tag color="magenta" style={{ fontWeight: 600 }}>{type}</Tag>
            )} />
            <Table.Column title="Progress" key="progress" render={(_, record: any) => (
              <Text strong>{record.previousProgress}% → {record.reportedProgress}%</Text>
            )} />
            <Table.Column title="Status" dataIndex="status" key="status" render={(s) => (
              <Tag color={s === 'OFFICIAL' ? 'success' : s === 'PENDING_VERIFICATION' ? 'warning' : 'error'}>
                {s}
              </Tag>
            )} />
          </Table>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <Text type="secondary">No critical events recorded yet.</Text>
          </div>
        )}
      </Card>

      {/* 7. Progress Trend (Lightweight Chronological) */}
      <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '16px' }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 14 }}>
            <CheckCircleOutlined style={{ marginRight: 6, color: '#10b981' }} />
            Official Progress Trend
          </Text>
        </div>
        
        {officialLogs.length > 0 ? (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
            {[...officialLogs].reverse().slice(-10).map((log: any, idx: number) => (
              <div key={log.id} style={{ minWidth: 140, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{dayjs(log.effectiveDate || log.createdAt).format('DD MMM YYYY')}</Text>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: '4px 0' }}>
                  {log.taskName?.substring(0, 15)}{log.taskName?.length > 15 ? '...' : ''}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12 }}>+{log.progressDelta}%</Text>
                  <Tag color="success" style={{ margin: 0, padding: '0 4px', fontSize: 10 }}>OFFICIAL</Tag>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <Text type="secondary">No official progress events yet.</Text>
          </div>
        )}
      </Card>

    </div>
  );
};

export default ProjectProgressDashboard;
