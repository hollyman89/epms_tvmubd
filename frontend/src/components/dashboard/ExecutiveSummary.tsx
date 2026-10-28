import React, { useMemo } from 'react';
import { Skeleton } from 'antd';
import {
  AuditOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import styles from './ExecutiveSummary.module.css';
import { ExecutiveSummaryResponse } from '@/services/dashboard.service';
import { TodoItem } from '@/services/inbox.service';
import { formatCurrency, formatNumber } from '@/lib/formatters';

export interface ExperimentalExecutiveSummarySnapshot {
  executiveBrief?: { attentionItems?: string[] };
  marketing?: {
    openDealsCount?: number;
    openPipelineValue?: number;
  };
  contracts?: {
    contractAwardedValue?: number;
  };
  projects?: ExecutiveSummaryResponse['currentSnapshot']['projects'] & {
    contractAwardedValue?: number;
    underExecutionValue?: number;
  };
  accountsPayable?: ExecutiveSummaryResponse['currentSnapshot']['accountsPayable'] & {
    outstandingLiabilityBalance?: number;
  };
  approvals?: ExecutiveSummaryResponse['currentSnapshot']['approvals'];
  legal?: ExecutiveSummaryResponse['currentSnapshot']['legal'];
}

export interface ExperimentalExecutiveSummaryMetrics {
  marketing?: ExecutiveSummaryResponse['periodMetrics']['marketing'] & {
    wonValue?: number;
  };
  accountsPayable?: ExecutiveSummaryResponse['periodMetrics']['accountsPayable'];
  vendorPayments?: ExecutiveSummaryResponse['periodMetrics']['vendorPayments'];
  procurement?: ExecutiveSummaryResponse['periodMetrics']['procurement'] & {
    materialFulfillmentRate?: number;
    serviceFulfillmentRate?: number;
  };
}

export interface ExtendedExecutiveSummaryResponse {
  meta: ExecutiveSummaryResponse['meta'];
  periodMetrics?: ExperimentalExecutiveSummaryMetrics;
  currentSnapshot?: ExperimentalExecutiveSummarySnapshot;
}

export interface ExecutiveSummaryProps {
  greetingPrefix: string;
  userName: string;
  userRole?: string | null;
  summaryData: ExtendedExecutiveSummaryResponse | null;
  todos?: TodoItem[];
  todosLoading?: boolean;
  todosError?: string | null;
  loading?: boolean;
  error?: string | null;
  referenceDate?: Date;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  greetingPrefix,
  userName,
  userRole,
  summaryData,
  todos = [],
  todosLoading = false,
  todosError = null,
  loading = false,
  error = null,
  referenceDate = new Date(),
}) => {
  // Indonesian Date Formatting for Executive Header & Date Card
  const { dayName, formattedDate } = useMemo(() => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    const d = referenceDate;
    const dName = `${days[d.getDay()]},`;
    const fDate = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    return { dayName: dName, formattedDate: fDate };
  }, [referenceDate]);

  // Executive Attention Calculation from canonical Inbox Todos
  const overdueTasksCount = useMemo(() => {
    const now = Date.now();
    return todos.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now).length;
  }, [todos]);

  const pendingTasksCount = useMemo(() => {
    return todos.length;
  }, [todos]);

  // Derived Factual Bullet Statements from Validated Canonical Data
  const summaryBullets = useMemo(() => {
    if (!summaryData) return [];

    const bullets: Array<{ text: React.ReactNode; tone: 'default' | 'attention' | 'success' }> = [];
    const pMetrics = summaryData.periodMetrics;
    const cSnapshot = summaryData.currentSnapshot;

    // Priority 0: Deterministic Attention Statements from Backend (Phase 1+2)
    const backendAttention = summaryData.currentSnapshot?.executiveBrief?.attentionItems;
    if (backendAttention && backendAttention.length > 0) {
      return backendAttention.slice(0, 3).map((item) => ({
        text: item,
        tone: item.includes('melewati') || item.includes('belum') ? ('attention' as const) : ('default' as const),
      }));
    }

    // 1. Proyek Aktif (Canonical Current Snapshot)
    const activeProjects = cSnapshot?.projects?.activeProjects;
    const planningProjects = cSnapshot?.projects?.planningProjects;
    const inProgressProjects = cSnapshot?.projects?.inProgressProjects;
    if (activeProjects !== undefined && activeProjects !== null) {
      bullets.push({
        text: (
          <>
            <span className={styles.bulletHighlight}>{formatNumber(activeProjects)} proyek aktif</span> berjalan dalam siklus operasional ({formatNumber(planningProjects ?? 0)} perencanaan, {formatNumber(inProgressProjects ?? 0)} pelaksanaan).
          </>
        ),
        tone: 'default',
      });
    }

    // 2. Won Bookings (Period Flow)
    const wonDeals = pMetrics?.marketing?.wonDeals;
    const wonValue = pMetrics?.marketing?.wonValue;
    if (wonValue !== undefined && wonValue !== null) {
      bullets.push({
        text: (
          <>
            Tercatat <span className={styles.bulletHighlight}>{formatNumber(wonDeals ?? 0)} tender berstatus WON</span> dengan nilai <span className={styles.bulletHighlight}>{formatCurrency(wonValue)}</span> pada periode terpilih.
          </>
        ),
        tone: 'success',
      });
    } else if (wonDeals !== undefined && wonDeals !== null && wonDeals > 0) {
      bullets.push({
        text: (
          <>
            Tercatat <span className={styles.bulletHighlight}>{formatNumber(wonDeals)} tender berstatus WON</span> pada periode berjalan.
          </>
        ),
        tone: 'success',
      });
    } else if (wonDeals === 0) {
      bullets.push({
        text: <>Belum ada tender berstatus WON pada periode berjalan.</>,
        tone: 'default',
      });
    }

    // 3. Open Commercial Pipeline Snapshot (BLK-02)
    const openDealsCount = cSnapshot?.marketing?.openDealsCount;
    const openPipelineValue = cSnapshot?.marketing?.openPipelineValue;
    const totalDeals = pMetrics?.marketing?.totalDeals;
    if (openDealsCount !== undefined && openDealsCount !== null && openPipelineValue !== undefined && openPipelineValue !== null) {
      bullets.push({
        text: (
          <>
            Peluang komersial aktif tercatat <span className={styles.bulletHighlight}>{formatNumber(openDealsCount)} tender</span> dengan potensi nilai <span className={styles.bulletHighlight}>{formatCurrency(openPipelineValue)}</span>.
          </>
        ),
        tone: 'default',
      });
    } else if (totalDeals !== undefined && totalDeals !== null) {
      bullets.push({
        text: (
          <>
            Aktivitas komersial mencatat <span className={styles.bulletHighlight}>{formatNumber(totalDeals)} tender diajukan</span> pada periode berjalan.
          </>
        ),
        tone: 'default',
      });
    }

    // 4. Komitmen Pengadaan (Period Flow - BLK-03)
    const poCount = pMetrics?.procurement?.poCount;
    const completedPoCount = pMetrics?.procurement?.completedPoCount ?? 0;
    const matRate = pMetrics?.procurement?.materialFulfillmentRate;
    const srvRate = pMetrics?.procurement?.serviceFulfillmentRate;
    if (poCount !== undefined && poCount !== null) {
      const fulfillmentDetail =
        matRate !== null && matRate !== undefined
          ? ` (realisasi material ${matRate}%${srvRate !== null && srvRate !== undefined ? `, jasa ${srvRate}%` : ', jasa N/A'})`
          : ` (${formatNumber(completedPoCount)} PO material selesai)`;
      bullets.push({
        text: (
          <>
            Pengadaan berjalan dengan komitmen <span className={styles.bulletHighlight}>{formatNumber(poCount)} Purchase Order</span>{fulfillmentDetail}.
          </>
        ),
        tone: 'default',
      });
    }

    // 5. Executive Attention (Personal Actions with strict loading & error guards)
    if (todosLoading) {
      bullets.push({
        text: <span style={{ color: 'var(--dash-text-muted, #64748b)' }}>Memuat status tindakan prioritas...</span>,
        tone: 'default',
      });
    } else if (todosError) {
      bullets.push({
        text: <span style={{ color: 'var(--dash-danger, #ef4444)' }}>Informasi tindakan prioritas belum dapat dimuat dari server.</span>,
        tone: 'attention',
      });
    } else if (pendingTasksCount > 0) {
      bullets.push({
        text: (
          <>
            Terdapat <span className={styles.bulletHighlight}>{formatNumber(pendingTasksCount)} tindakan prioritas</span> yang menunggu keputusan Anda
            {overdueTasksCount > 0 ? (
              <span style={{ color: 'var(--dash-danger, #ef4444)', fontWeight: 600 }}> ({formatNumber(overdueTasksCount)} melewati tenggat)</span>
            ) : (
              <span> (seluruhnya dalam tenggat waktu)</span>
            )}
            .
          </>
        ),
        tone: overdueTasksCount > 0 ? 'attention' : 'default',
      });
    } else {
      bullets.push({
        text: <>Saat ini tidak ada tindakan yang menunggu keputusan Anda.</>,
        tone: 'default',
      });
    }

    return bullets;
  }, [summaryData, pendingTasksCount, overdueTasksCount, todosLoading, todosError]);

  return (
    <div className={styles.container}>
      {/* 1. Left: Executive Welcome Banner */}
      <div className={styles.welcomeCard}>
        <div className={styles.welcomeCityscape} />
        <div className={styles.welcomeContent}>
          <div className={styles.welcomeTop}>
            <span className={styles.welcomeGreeting}>{greetingPrefix}</span>
            <ThunderboltOutlined className={styles.welcomeSparkle} />
          </div>
          <div>
            <h2 className={styles.welcomeName}>{userName}</h2>
            <p className={styles.welcomeSubtitle}>
              Berikut ringkasan kondisi bisnis EPMS per {formattedDate}.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Middle: Executive Summary Factual Condition & Attention */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryHeader}>
          <div className={styles.summaryHeaderLeft}>
            <div className={styles.summaryIconBox}>
              <AuditOutlined />
            </div>
            <span className={styles.summaryTitle}>Executive Summary</span>
          </div>
        </div>

        {loading && !summaryData ? (
          <div style={{ padding: '8px 0' }}>
            <Skeleton active paragraph={{ rows: 4, width: ['100%', '90%', '85%', '70%'] }} title={false} />
          </div>
        ) : error ? (
          <div style={{ color: 'var(--dash-danger, #ef4444)', fontSize: 13, padding: '12px 0' }}>
            Ringkasan eksekutif belum tersedia dari server.
          </div>
        ) : (
          <>
            <ul className={styles.bulletList}>
              {summaryBullets.map((b, idx) => (
                <li key={`summary-bullet-${idx}`} className={styles.bulletItem}>
                  <span
                    className={`${styles.bulletDot} ${
                      b.tone === 'attention'
                        ? styles.bulletDotAttention
                        : b.tone === 'success'
                        ? styles.bulletDotSuccess
                        : ''
                    }`}
                  />
                  <span className={styles.bulletText}>{b.text}</span>
                </li>
              ))}
            </ul>

            {/* Financial Overview Strip (Phase 1+2) */}
            <div className={styles.financialStrip}>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Open Pipeline</span>
                <span className={styles.financialValue}>
                  {summaryData?.currentSnapshot?.marketing?.openPipelineValue !== undefined
                    ? formatCurrency(summaryData.currentSnapshot.marketing.openPipelineValue)
                    : 'N/A'}
                </span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Contract Awarded</span>
                <span className={styles.financialValue}>
                  {summaryData?.currentSnapshot?.contracts?.contractAwardedValue !== undefined
                    ? formatCurrency(summaryData.currentSnapshot.contracts.contractAwardedValue)
                    : summaryData?.currentSnapshot?.projects?.contractAwardedValue !== undefined
                    ? formatCurrency(summaryData.currentSnapshot.projects.contractAwardedValue)
                    : 'N/A'}
                </span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Under Execution</span>
                <span className={styles.financialValue}>
                  {summaryData?.currentSnapshot?.projects?.underExecutionValue !== undefined
                    ? formatCurrency(summaryData.currentSnapshot.projects.underExecutionValue)
                    : 'N/A'}
                </span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Outstanding AP</span>
                <span className={styles.financialValue}>
                  {summaryData?.currentSnapshot?.accountsPayable?.outstandingLiabilityBalance !== undefined
                    ? formatCurrency(summaryData.currentSnapshot.accountsPayable.outstandingLiabilityBalance)
                    : 'N/A'}
                </span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Revenue</span>
                <span className={styles.financialMuted}>Belum tersedia</span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Cash Collected</span>
                <span className={styles.financialMuted}>Belum tersedia</span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Margin</span>
                <span className={styles.financialMuted}>Belum tersedia</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Right: Date & Quick Calendar Card */}
      <div className={styles.dateCard}>
        <div className={styles.dateDay}>{dayName}</div>
        <div className={styles.dateValue}>{formattedDate}</div>
        <div className={styles.dateIconBox} title="Kalender Hari Ini">
          <CalendarOutlined />
        </div>
      </div>
    </div>
  );
};
