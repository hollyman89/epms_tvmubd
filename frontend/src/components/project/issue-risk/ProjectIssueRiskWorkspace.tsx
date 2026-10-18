import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  Segmented,
  Row,
  Col,
  Statistic,
  Space,
  Button,
  Spin,
  Typography,
  message,
} from 'antd';
import {
  WarningOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ProjectIssueItem,
  ProjectRiskItem,
  ProjectIssueStatus,
  ProjectRiskStatus,
  ProjectRiskLevel,
  ProjectIssueRiskService,
} from '@/services/project-issue-risk.service';
import { IssueRegisterTable } from './IssueRegisterTable';
import { RiskRegisterTable } from './RiskRegisterTable';
import { IssueDetailModal } from './IssueModals';
import { RiskDetailModal } from './RiskModals';
import {
  resolveDeepLinkTarget,
  validateDeepLinkRecord,
  isRecordMatchingDomain,
  normalizeIssueRiskListResponse,
} from './issue-risk-presentation.utils';

const { Title, Text } = Typography;

interface ProjectIssueRiskWorkspaceProps {
  projectId: number;
  project?: any;
  onBack?: () => void;
}

export const ProjectIssueRiskWorkspace: React.FC<ProjectIssueRiskWorkspaceProps> = ({
  projectId,
  project,
  onBack,
}) => {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Active register tab: 'issues' | 'risks'
  const initialType = searchParams?.get('type') === 'risk' ? 'risks' : 'issues';
  const [activeTab, setActiveTab] = useState<'issues' | 'risks'>(initialType);

  // Issues State
  const [issues, setIssues] = useState<ProjectIssueItem[]>([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuePage, setIssuePage] = useState(1);
  const [issueLimit, setIssueLimit] = useState(10);
  const [issueFilters, setIssueFilters] = useState<any>({});

  // Risks State
  const [risks, setRisks] = useState<ProjectRiskItem[]>([]);
  const [risksTotal, setRisksTotal] = useState(0);
  const [risksLoading, setRisksLoading] = useState(false);
  const [riskPage, setRiskPage] = useState(1);
  const [riskLimit, setRiskLimit] = useState(10);
  const [riskFilters, setRiskFilters] = useState<any>({});

  // Eligible Owners
  const [eligibleOwners, setEligibleOwners] = useState<{ id: number; name: string; email: string; roles: string[] }[]>([]);

  // Deep-link & detail modal state
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<ProjectIssueItem | null>(null);
  const [selectedRiskDetail, setSelectedRiskDetail] = useState<ProjectRiskItem | null>(null);
  const [highlightedRecordId, setHighlightedRecordId] = useState<number | null>(null);

  const currentUserId = Number((user as any)?.id || (user as any)?.userId || user?.sub || 0);
  const currentUserRoles = useMemo(() => {
    return (user?.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  }, [user]);

  const isAssignedPm = useMemo(() => {
    if (!currentUserRoles.includes('PROJECT_MANAGER')) return false;
    const pmId = project?.managerId ? Number(project.managerId) : null;
    return pmId === currentUserId;
  }, [currentUserRoles, project, currentUserId]);

  // Fetch eligible owners once
  useEffect(() => {
    if (!projectId) return;
    ProjectIssueRiskService.getEligibleOwners(projectId)
      .then((owners) => setEligibleOwners(owners || []))
      .catch(() => setEligibleOwners([]));
  }, [projectId]);

  // Handle Canonical Deep-Link: type=issue|risk & id=:recordId
  useEffect(() => {
    if (!projectId) return;

    const typeParam = searchParams?.get('type');
    const idParam = searchParams?.get('id');
    const { tab, recordId } = resolveDeepLinkTarget(typeParam, idParam);

    setActiveTab(tab);

    if (recordId) {
      setHighlightedRecordId(recordId);

      if (tab === 'issues') {
        ProjectIssueRiskService.getIssueById(projectId, recordId)
          .then((issue) => {
            if (validateDeepLinkRecord(issue, projectId) && isRecordMatchingDomain('issue', issue)) {
              setSelectedIssueDetail(issue);
            } else {
              setHighlightedRecordId(null);
            }
          })
          .catch(() => {
            setHighlightedRecordId(null);
          });
      } else if (tab === 'risks') {
        ProjectIssueRiskService.getRiskById(projectId, recordId)
          .then((risk) => {
            if (validateDeepLinkRecord(risk, projectId) && isRecordMatchingDomain('risk', risk)) {
              setSelectedRiskDetail(risk);
            } else {
              setHighlightedRecordId(null);
            }
          })
          .catch(() => {
            setHighlightedRecordId(null);
          });
      }
    } else {
      setHighlightedRecordId(null);
    }
  }, [projectId, searchParams]);

  const handleTabChange = (val: 'issues' | 'risks') => {
    setActiveTab(val);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('type', val === 'risks' ? 'risk' : 'issue');
      url.searchParams.delete('id');
      window.history.pushState({}, '', url.toString());
    }
    setHighlightedRecordId(null);
  };

  const handleViewIssueDetail = (issue: ProjectIssueItem) => {
    setSelectedIssueDetail(issue);
    setHighlightedRecordId(issue.id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('type', 'issue');
      url.searchParams.set('id', String(issue.id));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleCloseIssueDetail = () => {
    setSelectedIssueDetail(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleViewRiskDetail = (risk: ProjectRiskItem) => {
    setSelectedRiskDetail(risk);
    setHighlightedRecordId(risk.id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('type', 'risk');
      url.searchParams.set('id', String(risk.id));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleCloseRiskDetail = () => {
    setSelectedRiskDetail(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Fetch Issues
  const fetchIssues = useCallback(async () => {
    if (!projectId) return;
    setIssuesLoading(true);
    try {
      const res = await ProjectIssueRiskService.getIssues(projectId, {
        ...issueFilters,
        page: issuePage,
        limit: issueLimit,
      });
      const normalized = normalizeIssueRiskListResponse<ProjectIssueItem>(res);
      setIssues(normalized.data);
      setIssuesTotal(normalized.total);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Gagal memuat data Issues');
    } finally {
      setIssuesLoading(false);
    }
  }, [projectId, issueFilters, issuePage, issueLimit]);

  // Fetch Risks
  const fetchRisks = useCallback(async () => {
    if (!projectId) return;
    setRisksLoading(true);
    try {
      const res = await ProjectIssueRiskService.getRisks(projectId, {
        ...riskFilters,
        page: riskPage,
        limit: riskLimit,
      });
      const normalized = normalizeIssueRiskListResponse<ProjectRiskItem>(res);
      setRisks(normalized.data);
      setRisksTotal(normalized.total);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Gagal memuat data Risks');
    } finally {
      setRisksLoading(false);
    }
  }, [projectId, riskFilters, riskPage, riskLimit]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    fetchRisks();
  }, [fetchRisks]);

  // Real KPI Metrics derived strictly from loaded data
  const issueMetrics = useMemo(() => {
    const openCount = issues.filter((i) => i.status === ProjectIssueStatus.OPEN).length;
    const inProgressCount = issues.filter((i) => i.status === ProjectIssueStatus.IN_PROGRESS).length;
    const resolvedCount = issues.filter((i) => i.status === ProjectIssueStatus.RESOLVED).length;
    const closedCount = issues.filter((i) => i.status === ProjectIssueStatus.CLOSED).length;
    const overdueCount = issues.filter((i) => i.isOverdue).length;

    return {
      total: issuesTotal,
      active: openCount + inProgressCount,
      resolvedOrClosed: resolvedCount + closedCount,
      overdue: overdueCount,
    };
  }, [issues, issuesTotal]);

  const riskMetrics = useMemo(() => {
    const criticalCount = risks.filter((r) => r.riskLevel === ProjectRiskLevel.CRITICAL).length;
    const highCount = risks.filter((r) => r.riskLevel === ProjectRiskLevel.HIGH).length;
    const materializedCount = risks.filter((r) => r.status === ProjectRiskStatus.MATERIALIZED).length;
    const reviewOverdueCount = risks.filter((r) => r.isReviewOverdue).length;

    return {
      total: risksTotal,
      critical: criticalCount,
      high: highCount,
      materialized: materializedCount,
      reviewOverdue: reviewOverdueCount,
    };
  }, [risks, risksTotal]);

  return (
    <div style={{ padding: '0 0 24px 0' }} data-testid="project-issue-risk-workspace">
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            Manajemen Issue & Risiko Proyek
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Register kendala riil (Issues) dan analisis mitigasi ancaman (Risks) sesuai kontrak tata kelola.
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchIssues();
              fetchRisks();
            }}
          >
            Segarkan
          </Button>
          {onBack && (
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
              Kembali ke Ringkasan
            </Button>
          )}
        </Space>
      </div>

      {/* Real Statistics Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #2563eb' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>TOTAL ISSUES</span>}
              value={issueMetrics.total}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #f59e0b' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>ISSUE AKTIF</span>}
              value={issueMetrics.active}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #ef4444' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>ISSUE OVERDUE</span>}
              value={issueMetrics.overdue}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #10b981' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>ISSUE SELESAI</span>}
              value={issueMetrics.resolvedOrClosed}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#059669' }}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #6366f1' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>TOTAL RISKS</span>}
              value={riskMetrics.total}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #dc2626' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>RISIKO KRITIS</span>}
              value={riskMetrics.critical}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #ea580c' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>RISIKO TINGGI</span>}
              value={riskMetrics.high}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#ea580c' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} md={3}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #8b5cf6' }}>
            <Statistic
              title={<span style={{ fontSize: 11, fontWeight: 600 }}>MATERIALIZED</span>}
              value={riskMetrics.materialized}
              valueStyle={{ fontSize: 20, fontWeight: 700, color: '#7c3aed' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Register Switcher */}
      <Card style={{ borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: 20 }}>
          <Segmented
            size="large"
            value={activeTab}
            onChange={(val) => handleTabChange(val as 'issues' | 'risks')}
            options={[
              {
                value: 'issues',
                label: (
                  <Space size={6} style={{ padding: '4px 12px' }}>
                    <WarningOutlined />
                    <span style={{ fontWeight: 600 }}>Daftar Issue (Issue Register)</span>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>({issuesTotal})</span>
                  </Space>
                ),
              },
              {
                value: 'risks',
                label: (
                  <Space size={6} style={{ padding: '4px 12px' }}>
                    <SafetyCertificateOutlined />
                    <span style={{ fontWeight: 600 }}>Daftar Risiko (Risk Register)</span>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>({risksTotal})</span>
                  </Space>
                ),
              },
            ]}
          />
        </div>

        {activeTab === 'issues' ? (
          <IssueRegisterTable
            projectId={projectId}
            issues={issues}
            loading={issuesLoading}
            total={issuesTotal}
            page={issuePage}
            limit={issueLimit}
            filters={issueFilters}
            onFilterChange={setIssueFilters}
            onPaginationChange={(p, l) => {
              setIssuePage(p);
              setIssueLimit(l);
            }}
            onRefresh={fetchIssues}
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            isAssignedPm={isAssignedPm}
            eligibleOwners={eligibleOwners}
            highlightedId={highlightedRecordId}
            onViewDetail={handleViewIssueDetail}
          />
        ) : (
          <RiskRegisterTable
            projectId={projectId}
            risks={risks}
            loading={risksLoading}
            total={risksTotal}
            page={riskPage}
            limit={riskLimit}
            filters={riskFilters}
            onFilterChange={setRiskFilters}
            onPaginationChange={(p, l) => {
              setRiskPage(p);
              setRiskLimit(l);
            }}
            onRefresh={fetchRisks}
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            isAssignedPm={isAssignedPm}
            eligibleOwners={eligibleOwners}
            highlightedId={highlightedRecordId}
            onViewDetail={handleViewRiskDetail}
          />
        )}
      </Card>

      {/* Deep-Link & Table Row Detail Modals */}
      {selectedIssueDetail && (
        <IssueDetailModal
          open={Boolean(selectedIssueDetail)}
          onClose={handleCloseIssueDetail}
          issue={selectedIssueDetail}
        />
      )}

      {selectedRiskDetail && (
        <RiskDetailModal
          open={Boolean(selectedRiskDetail)}
          onClose={handleCloseRiskDetail}
          risk={selectedRiskDetail}
        />
      )}
    </div>
  );
};
