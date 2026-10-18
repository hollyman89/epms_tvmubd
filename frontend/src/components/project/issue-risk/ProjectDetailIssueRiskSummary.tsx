import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Spin,
  Empty,
  Row,
  Col,
  Statistic,
  List,
} from 'antd';
import {
  WarningOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import {
  ProjectIssueItem,
  ProjectRiskItem,
  ProjectIssueStatus,
  ProjectRiskLevel,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';
import { normalizeIssueRiskListResponse } from './issue-risk-presentation.utils';

const { Title, Text } = Typography;

interface ProjectDetailIssueRiskSummaryProps {
  projectId: number;
  onOpenWorkspace?: () => void;
}

export const ProjectDetailIssueRiskSummary: React.FC<ProjectDetailIssueRiskSummaryProps> = ({
  projectId,
  onOpenWorkspace,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<ProjectIssueItem[]>([]);
  const [risks, setRisks] = useState<ProjectRiskItem[]>([]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.allSettled([
      ProjectIssueRiskService.getIssues(projectId, { limit: 10 }),
      ProjectIssueRiskService.getRisks(projectId, { limit: 10 }),
    ]).then(([issueRes, riskRes]) => {
      if (issueRes.status === 'fulfilled') {
        setIssues(normalizeIssueRiskListResponse<ProjectIssueItem>(issueRes.value).data);
      }
      if (riskRes.status === 'fulfilled') {
        setRisks(normalizeIssueRiskListResponse<ProjectRiskItem>(riskRes.value).data);
      }
      setLoading(false);
    });
  }, [projectId]);

  const openIssues = issues.filter((i) => [ProjectIssueStatus.OPEN, ProjectIssueStatus.IN_PROGRESS].includes(i.status));
  const criticalOrHighRisks = risks.filter((r) => [ProjectRiskLevel.CRITICAL, ProjectRiskLevel.HIGH].includes(r.riskLevel as any));

  const handleOpenWorkspace = () => {
    if (onOpenWorkspace) {
      onOpenWorkspace();
    } else {
      router.push(`/project-delivery?view=workspace&projectId=${projectId}&section=issue-risk`);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Spin />
          <span style={{ color: '#64748b', fontSize: 14 }}>Memuat ringkasan Issue & Risiko proyek...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="project-detail-issue-risk-summary">
      {/* Top Banner & CTA */}
      <Card
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: 10,
          border: 'none',
        }}
        bodyStyle={{ padding: 18 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningOutlined style={{ color: '#f59e0b' }} />
              Live Issue &amp; Risk Register
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4 }}>
              Ringkasan kendala operasional dan analisis ancaman aktif dari data riil proyek.
            </div>
          </div>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={handleOpenWorkspace}
            style={{ backgroundColor: '#2563eb', fontWeight: 600, height: 36, borderRadius: 6 }}
            data-testid="cta-open-issue-risk-workspace"
          >
            Buka di Workspace Proyek
          </Button>
        </div>
      </Card>

      {/* Metrics Row */}
      <Row gutter={[12, 12]}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #2563eb' }}>
            <Statistic title="Total Issue" value={issues.length} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
            <Statistic title="Issue Aktif" value={openIssues.length} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#d97706' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #6366f1' }}>
            <Statistic title="Total Risiko" value={risks.length} valueStyle={{ fontSize: 20, fontWeight: 700 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderTop: '3px solid #ef4444' }}>
            <Statistic title="Risiko Kritis/Tinggi" value={criticalOrHighRisks.length} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }} />
          </Card>
        </Col>
      </Row>

      {/* Active Issues List */}
      <Card
        size="small"
        title={
          <Space size={6}>
            <WarningOutlined style={{ color: '#d97706' }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Issue Aktif Memerlukan Tindakan ({openIssues.length})</span>
          </Space>
        }
        style={{ borderRadius: 8 }}
      >
        {openIssues.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada Issue aktif yang belum terselesaikan." style={{ margin: '12px 0' }} />
        ) : (
          <List
            size="small"
            dataSource={openIssues.slice(0, 5)}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '8px 4px' }}
                actions={[
                  <Tag key="sev" color={item.severity === 'CRITICAL' ? 'red' : item.severity === 'HIGH' ? 'orange' : 'gold'}>
                    {item.severity}
                  </Tag>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={8}>
                      <Text strong style={{ fontSize: 13 }}>{item.issueNumber}</Text>
                      <Tag color="blue">{item.status}</Tag>
                      {item.isOverdue && <Tag color="error">OVERDUE</Tag>}
                    </Space>
                  }
                  description={<span style={{ fontSize: 12, color: '#475569' }}>{item.title}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Critical & High Risks List */}
      <Card
        size="small"
        title={
          <Space size={6}>
            <SafetyCertificateOutlined style={{ color: '#dc2626' }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Risiko Signifikan / Kritis ({criticalOrHighRisks.length})</span>
          </Space>
        }
        style={{ borderRadius: 8 }}
      >
        {criticalOrHighRisks.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada risiko berlevel HIGH atau CRITICAL." style={{ margin: '12px 0' }} />
        ) : (
          <List
            size="small"
            dataSource={criticalOrHighRisks.slice(0, 5)}
            renderItem={(item) => (
              <List.Item
                style={{ padding: '8px 4px' }}
                actions={[
                  <Tag key="lvl" color={item.riskLevel === 'CRITICAL' ? 'red' : 'orange'} style={{ fontWeight: 700 }}>
                    {item.riskLevel} (Skor {item.riskScore})
                  </Tag>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={8}>
                      <Text strong style={{ fontSize: 13 }}>{item.riskNumber}</Text>
                      <Tag>{item.status}</Tag>
                    </Space>
                  }
                  description={<span style={{ fontSize: 12, color: '#475569' }}>{item.title}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
};
