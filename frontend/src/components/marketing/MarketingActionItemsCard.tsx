"use client";

import React, { useState, useMemo } from 'react';
import { Card, Table, Typography, Space, Tooltip, Tag, Input, Select, Button, Empty } from 'antd';
import {
  ClockCircleOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface MarketingActionItemsCardProps {
  actionItemsData: any[];
  actionItemsColumns: any[];
}

export const MarketingActionItemsCard: React.FC<MarketingActionItemsCardProps> = ({
  actionItemsData,
  actionItemsColumns,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Derive counts for condition filter options
  const counts = useMemo(() => {
    const total = actionItemsData?.length || 0;
    let overdue = 0;
    let upcoming = 0;
    let stuck = 0;

    for (const item of actionItemsData || []) {
      const cond = item.actionItemEvaluation?.conditionType;
      if (cond === 'OVERDUE') overdue++;
      else if (cond === 'UPCOMING_DEADLINE') upcoming++;
      else if (cond === 'STUCK') stuck++;
    }

    return { all: total, overdue, upcoming, stuck };
  }, [actionItemsData]);

  // Derive unique stages for stage filter
  const stageOptions = useMemo(() => {
    const stages = new Set<string>();
    (actionItemsData || []).forEach((item: any) => {
      if (item.stage) stages.add(item.stage.toUpperCase());
    });
    const opts = Array.from(stages).map((st) => ({
      value: st,
      label: st,
    }));
    return [{ value: 'ALL', label: 'Semua Stage' }, ...opts];
  }, [actionItemsData]);

  // Derive unique customers for customer filter
  const customerOptions = useMemo(() => {
    const customers = new Set<string>();
    (actionItemsData || []).forEach((item: any) => {
      const name = item.customer?.name || (item.customer_id ? `ID: ${item.customer_id}` : null);
      if (name) customers.add(name);
    });
    const opts = Array.from(customers).sort().map((c) => ({
      value: c,
      label: c,
    }));
    return [{ value: 'ALL', label: 'Semua Pelanggan' }, ...opts];
  }, [actionItemsData]);

  // Apply filters and search
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (actionItemsData || []).filter((item: any) => {
      // 1. Condition filter
      if (conditionFilter !== 'ALL') {
        const itemCond = item.actionItemEvaluation?.conditionType;
        if (itemCond !== conditionFilter) return false;
      }

      // 2. Stage filter
      if (stageFilter !== 'ALL') {
        const itemStage = (item.stage || '').toUpperCase();
        if (itemStage !== stageFilter.toUpperCase()) return false;
      }

      // 3. Customer filter
      if (customerFilter !== 'ALL') {
        const itemCust = item.customer?.name || (item.customer_id ? `ID: ${item.customer_id}` : '');
        if (itemCust !== customerFilter) return false;
      }

      // 4. Search filter (title, TND code, raw ID, customer)
      if (q) {
        const title = (item.title || '').toLowerCase();
        const code = `tnd-${String(item.id || '').padStart(4, '0')}`.toLowerCase();
        const rawId = String(item.id || '');
        const customer = (item.customer?.name || '').toLowerCase();
        if (!title.includes(q) && !code.includes(q) && !rawId.includes(q) && !customer.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [actionItemsData, searchQuery, conditionFilter, stageFilter, customerFilter]);

  const hasActiveFilters = searchQuery !== '' || conditionFilter !== 'ALL' || stageFilter !== 'ALL' || customerFilter !== 'ALL';

  const resetFilters = () => {
    setSearchQuery('');
    setConditionFilter('ALL');
    setStageFilter('ALL');
    setCustomerFilter('ALL');
    setCurrentPage(1);
  };

  if (!actionItemsData || actionItemsData.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .action-items-card {
          background: #FFFFFF !important;
          border-radius: 14px !important;
          border: 1px solid #E2E8F0 !important;
          border-left: 4px solid #F59E0B !important;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
          overflow: hidden;
        }
        .action-items-card .ant-card-head {
          background: #FFFFFF !important;
          border-bottom: 1px solid #F1F5F9 !important;
          padding: 12px 20px !important;
          min-height: 48px !important;
        }
        .action-items-table .ant-table-thead > tr > th {
          background-color: #F8FAFC !important;
          color: #475569 !important;
          font-weight: 600 !important;
          font-size: 11.5px !important;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #E2E8F0 !important;
          padding: 12px 16px !important;
          white-space: nowrap;
        }
        .action-items-table .ant-table-thead > tr > th::before {
          display: none !important;
        }
        .action-items-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #F1F5F9 !important;
          padding: 12px 16px !important;
          font-size: 12.5px;
        }
        .action-items-table .ant-table-tbody > tr:hover > td {
          background-color: #F8FAFC !important;
        }
        .action-items-toolbar {
          padding: 10px 16px;
          background-color: #FAFAFA;
          border-bottom: 1px solid #F1F5F9;
          display: flex;
          align-items: center;
          justifyContent: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .action-items-table .ant-pagination {
          padding: 12px 16px !important;
          margin: 0 !important;
        }
      `}} />
      <Card
        className="action-items-card"
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <Space size={8} align="center">
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  backgroundColor: '#FFFBEB',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <ClockCircleOutlined />
              </div>
              <Text strong style={{ fontSize: 13.5, color: '#0F172A' }}>
                Tender yang Perlu Perhatian (Action Items)
              </Text>
              <Tooltip title="Diprioritaskan berdasarkan tender yang paling lama menunggu atau mendekati jatuh tempo (FIFO Overdue)">
                <InfoCircleOutlined style={{ color: '#94A3B8', fontSize: 12, cursor: 'pointer' }} />
              </Tooltip>
            </Space>

            <Tag
              style={{
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                margin: 0,
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #FDE68A',
                padding: '2px 8px',
              }}
            >
              {hasActiveFilters
                ? `${filteredData.length} dari ${actionItemsData.length} Tender Perlu Tindakan`
                : `${actionItemsData.length} Tender Perlu Tindakan`}
            </Tag>
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        <div className="action-items-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 }}>
            <Input
              placeholder="Cari nama tender atau pelanggan..."
              prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              allowClear
              style={{ width: 250, maxWidth: '100%', borderRadius: 6 }}
            />

            <Select
              value={conditionFilter}
              onChange={(val) => {
                setConditionFilter(val);
                setCurrentPage(1);
              }}
              style={{ minWidth: 160, borderRadius: 6 }}
              options={[
                { value: 'ALL', label: `Semua Kondisi (${counts.all})` },
                { value: 'OVERDUE', label: `Overdue (${counts.overdue})` },
                { value: 'UPCOMING_DEADLINE', label: `Mendekati Batas (${counts.upcoming})` },
                { value: 'STUCK', label: `Stuck 0% (${counts.stuck})` },
              ]}
            />

            {stageOptions.length > 2 && (
              <Select
                value={stageFilter}
                onChange={(val) => {
                  setStageFilter(val);
                  setCurrentPage(1);
                }}
                style={{ minWidth: 130, borderRadius: 6 }}
                options={stageOptions}
              />
            )}

            {customerOptions.length > 2 && (
              <Select
                value={customerFilter}
                onChange={(val) => {
                  setCustomerFilter(val);
                  setCurrentPage(1);
                }}
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 160, maxWidth: 220, borderRadius: 6 }}
                options={customerOptions}
              />
            )}

            {hasActiveFilters && (
              <Button
                size="middle"
                type="text"
                icon={<ReloadOutlined style={{ fontSize: 12 }} />}
                onClick={resetFilters}
                style={{ color: '#64748B', fontSize: 12 }}
              >
                Reset Filter
              </Button>
            )}
          </div>
        </div>

        <Table 
          className="action-items-table"
          dataSource={filteredData} 
          columns={actionItemsColumns} 
          rowKey="id" 
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredData.length,
            showSizeChanger: true,
            pageSizeOptions: ['10', '25', '50', '100'],
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showTotal: (total, range) => `Menampilkan ${range[0]}–${range[1]} dari ${total}`,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="middle"
          scroll={{ x: 800 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada tender yang memerlukan tindakan untuk filter ini."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};
