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
  const { user, isPmo, isHeadOfOperations } = useAuth();
  
  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [baselineData, setBaselineData] = useState<any>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [controlData, setControlData] = useState<any>(null);

  // RBAC Setup - Canonical business actors: PMO, HEAD_OF_OPERATIONS
  const canVerify = isPmo || isHeadOfOperations;

  useEffect(() => {
    fetchDashboardData();
  }, [project.projectId, project.id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const pId = Number(project.projectId || project.id);
      
      const [baselineRes, scheduleRes, logsRes, controlRes] = await Promise.all([
        ProjectService.getProjectBaseline(pId),
        ProjectService.getProjectSchedule(pId),
        ProjectService.getProgressLogs(pId),
        ProjectService.getProjectControl(pId).catch((err) => {
          console.warn('Failed to load project control data:', err);
          return null;
        }),
      ]);

      setBaselineData(baselineRes);
      setScheduleData(scheduleRes);
      setProgressLogs(logsRes);
      setControlData(controlRes);
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

      {/* 1b. Baseline Data Integrity Warning (R1-22, R1-23) */}
      {hasBaseline && baselineData?.dataIntegrityStatus === 'INVALID_BASELINE' && (
        <Alert 
          type="error" 
          showIcon 
          message="Integritas Baseline Cacat (INVALID_BASELINE)"
          description={`Baseline V${baseline?.versionNumber} memiliki anomali bobot hierarki: Total bobot leaf terdaftar ${baselineData?.leafWeightPercentage ?? 'tidak 100'}% (seharusnya tepat 100.00%). Progress proyek matematis tidak dapat mencapai penyelesaian penuh. Diperlukan remediasi baseline.`}
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
              {baselineData?.dataIntegrityStatus === 'INVALID_BASELINE' && (
                <Tag color="error" style={{ fontWeight: 700, borderRadius: 6, margin: 0 }}>
                  BASELINE CACAT ({baselineData?.leafWeightPercentage}%)
                </Tag>
              )}
            </Space>
          </div>
          <Space>
            <Button size="small" icon={<HistoryOutlined />} onClick={onOpenLedger}>
              View Progress History
            </Button>
            {pendingLogs.length > 0 && canVerify && (
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
              <Progress percent={overallProgress} showInfo={false} strokeColor={baselineData?.dataIntegrityStatus === 'INVALID_BASELINE' ? '#e11d48' : '#059669'} size="small" style={{ marginBottom: 8 }} />
              {hasBaseline && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Calculated from <Tag color="blue" style={{ fontSize: 10, margin: '0 4px', lineHeight: '14px' }}>Baseline V{baseline.versionNumber}</Tag>
                  {baselineData?.dataIntegrityStatus === 'INVALID_BASELINE' && (
                    <Tag color="error" style={{ fontSize: 10, margin: '0 4px', lineHeight: '14px', fontWeight: 700 }}>
                      INVALID BASELINE
                    </Tag>
                  )}
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

      {/* 5. Kontrol Proyek: Rencana vs Aktual (R1-34, R1-35, R1-36) */}
      <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Space size={8}>
            <BarChartOutlined style={{ color: '#2563eb', fontSize: 16 }} />
            <Text strong style={{ fontSize: 14 }}>Kontrol Proyek: Rencana vs Aktual</Text>
            {controlData?.planComparisonAvailable === false && (
              <Tag color="error" style={{ fontWeight: 600, margin: 0 }}>
                {controlData.planComparisonUnavailableReason === 'INVALID_BASELINE'
                  ? 'Integritas Baseline Cacat'
                  : 'Perbandingan Rencana Tidak Tersedia'}
              </Tag>
            )}
            {controlData?.planComparisonAvailable && controlData.project?.progressHealth && (
              <Tag
                color={
                  controlData.project.progressHealth === 'AHEAD'
                    ? 'success'
                    : controlData.project.progressHealth === 'BEHIND'
                    ? 'error'
                    : 'blue'
                }
                style={{ fontWeight: 700, margin: 0 }}
              >
                {controlData.project.progressHealth === 'AHEAD' && `LEBIH CEPAT (+${controlData.project.progressVariancePp} pp)`}
                {controlData.project.progressHealth === 'BEHIND' && `TERLAMBAT (${controlData.project.progressVariancePp} pp)`}
                {controlData.project.progressHealth === 'ON_PLAN' && `SESUAI RENCANA (${controlData.project.progressVariancePp ?? 0} pp)`}
              </Tag>
            )}
          </Space>
        </div>

        {/* Ringkasan Kemajuan & Jadwal Proyek (R1-34, R1-36) */}
        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px 14px' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Progress Rencana</Text>
              <Text strong style={{ fontSize: 15, color: '#2563eb' }}>
                {controlData?.project?.plannedProgress !== null && controlData?.project?.plannedProgress !== undefined
                  ? `${controlData.project.plannedProgress.toFixed(2)}%`
                  : 'N/A'}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Progress Aktual</Text>
              <Text strong style={{ fontSize: 15, color: '#059669' }}>
                {controlData?.project?.actualProgress !== null && controlData?.project?.actualProgress !== undefined
                  ? `${controlData.project.actualProgress.toFixed(2)}%`
                  : `${overallProgress.toFixed(2)}%`}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Deviasi Progress</Text>
              <Text
                strong
                style={{
                  fontSize: 15,
                  color:
                    controlData?.project?.progressVariancePp > 0
                      ? '#059669'
                      : controlData?.project?.progressVariancePp < 0
                      ? '#e11d48'
                      : '#64748b',
                }}
              >
                {controlData?.project?.progressVariancePp !== null && controlData?.project?.progressVariancePp !== undefined
                  ? `${controlData.project.progressVariancePp > 0 ? '+' : ''}${controlData.project.progressVariancePp.toFixed(2)} pp`
                  : 'N/A'}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Mulai Rencana</Text>
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                {controlData?.project?.plannedStart ? dayjs(controlData.project.plannedStart).format('DD MMM YYYY') : 'N/A'}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Mulai Aktual</Text>
              <Text strong style={{ fontSize: 13, color: controlData?.project?.actualStart ? '#059669' : '#64748b' }}>
                {controlData?.project?.actualStart ? dayjs(controlData.project.actualStart).format('DD MMM YYYY') : 'N/A'}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Selesai Rencana</Text>
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                {controlData?.project?.plannedFinish ? dayjs(controlData.project.plannedFinish).format('DD MMM YYYY') : 'N/A'}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Selesai Aktual</Text>
              <Text strong style={{ fontSize: 13, color: '#64748b' }}>
                N/A (Belum Dimodelkan)
              </Text>
            </div>
          </div>
        </div>

        {/* Tabel Detail Tugas: Rencana vs Aktual */}
        <Table 
          dataSource={controlData?.tasks && controlData.tasks.length > 0 ? controlData.tasks : tasksList} 
          rowKey={(r: any) => r.taskId || r.id}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 'max-content' }}
        >
          <Table.Column title="Tugas" dataIndex="name" key="name" render={(text, record: any) => (
            <Space>
              <Text strong={record.isMilestone} style={{ color: record.isMilestone ? '#0f172a' : 'inherit' }}>
                {record.code || record.wbsCode ? `${record.code || record.wbsCode} - ` : ''}{text}
              </Text>
              {record.isMilestone && <Tag color="purple" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>Milestone</Tag>}
            </Space>
          )} />
          <Table.Column title="Bobot" key="weight" render={(_, record: any) => (
            <Text style={{ fontSize: 12 }}>{record.weight !== undefined && record.weight !== null ? `${record.weight}%` : '—'}</Text>
          )} />
          <Table.Column title="Progress Rencana" key="plannedProgress" render={(_, record: any) => (
            <Text style={{ fontSize: 12 }}>{record.plannedProgress !== undefined && record.plannedProgress !== null ? `${record.plannedProgress}%` : 'N/A'}</Text>
          )} />
          <Table.Column title="Progress Aktual" key="actualProgress" render={(_, record: any) => {
            const val = record.actualProgress !== undefined ? record.actualProgress : record.progress;
            return (
              <div style={{ width: 90 }}>
                <Progress percent={Number(val) || 0} size="small" strokeColor={Number(val) === 100 ? '#10b981' : '#3b82f6'} format={(p) => `${p}%`} />
              </div>
            );
          }} />
          <Table.Column title="Deviasi Progress" key="progressVariancePp" render={(_, record: any) => {
            if (record.progressVariancePp === null || record.progressVariancePp === undefined) return <Text style={{ fontSize: 12, color: '#94a3b8' }}>N/A</Text>;
            const v = Number(record.progressVariancePp);
            const color = v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#64748b';
            return <Text strong style={{ fontSize: 12, color }}>{v > 0 ? `+${v}` : v} pp</Text>;
          }} />
          <Table.Column title="Mulai Rencana" key="plannedStart" render={(_, record: any) => {
            const d = record.plannedStart || record.startDate;
            return <Text style={{ fontSize: 12 }}>{d ? dayjs(d).format('DD MMM YYYY') : 'N/A'}</Text>;
          }} />
          <Table.Column title="Mulai Aktual" key="actualStart" render={(_, record: any) => {
            return (
              <div>
                <Text strong={Boolean(record.actualStart)} style={{ fontSize: 12, color: record.actualStart ? '#0f172a' : '#94a3b8' }}>
                  {record.actualStart ? dayjs(record.actualStart).format('DD MMM YYYY') : 'N/A'}
                </Text>
                {record.startVarianceDays !== null && record.startVarianceDays !== undefined && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: record.startVarianceDays > 0 ? '#ef4444' : record.startVarianceDays < 0 ? '#10b981' : '#64748b' }}>
                    ({record.startVarianceDays > 0 ? `+${record.startVarianceDays}` : record.startVarianceDays} hr)
                  </span>
                )}
                {record.startDelayDays > 0 && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: '#f59e0b' }}>
                    (Terlambat Mulai {record.startDelayDays} hr)
                  </span>
                )}
              </div>
            );
          }} />
          <Table.Column title="Selesai Rencana" key="plannedFinish" render={(_, record: any) => {
            const d = record.plannedFinish || record.endDate || record.plannedDate;
            return <Text style={{ fontSize: 12 }}>{d ? dayjs(d).format('DD MMM YYYY') : 'N/A'}</Text>;
          }} />
          <Table.Column title="Selesai Aktual" key="actualFinish" render={(_, record: any) => {
            const af = record.actualFinish || (record.isMilestone ? record.actualDate : null);
            const varDays = record.finishVarianceDays !== null && record.finishVarianceDays !== undefined
              ? record.finishVarianceDays
              : (record.isMilestone ? record.milestoneVarianceDays : null);
            return (
              <div>
                <Text strong={Boolean(af)} style={{ fontSize: 12, color: af ? '#10b981' : '#94a3b8' }}>
                  {af ? dayjs(af).format('DD MMM YYYY') : 'N/A'}
                </Text>
                {varDays !== null && varDays !== undefined && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: varDays > 0 ? '#ef4444' : varDays < 0 ? '#10b981' : '#64748b' }}>
                    ({varDays > 0 ? `+${varDays}` : varDays} hr)
                  </span>
                )}
                {record.overdueDays > 0 && (
                  <span style={{ fontSize: 10, marginLeft: 4, color: '#ef4444', fontWeight: 600 }}>
                    (Terlambat {record.overdueDays} hr)
                  </span>
                )}
              </div>
            );
          }} />
          <Table.Column title="Status" key="status" render={(_, record: any) => {
            const taskId = record.taskId || record.id;
            const taskObj = tasksList.find((t: any) => t.id === taskId);
            const status = record.status || taskObj?.status || 'PLANNED';
            const hasPending = pendingLogs.some((l: any) => l.taskId === taskId);
            return (
              <Space>
                <Tag color={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'processing' : 'default'}>
                  {status}
                </Tag>
                {hasPending && <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>Pending Claim</Tag>}
              </Space>
            );
          }} />
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
