'use client';

import React, { useState } from 'react';
import { Card, Input, Tabs, Tag, Space, Typography, Badge, Select, Empty, Tooltip } from 'antd';
import { SearchOutlined, ClockCircleOutlined, FilterOutlined, FileTextOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';

const { Text } = Typography;

export interface TaskQueueItem {
  id: number;
  contractNumber: string;
  customerName: string;
  projectName?: string;
  nominal?: number;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  slaDeadline?: string;
  status: 'WAITING' | 'REVISION' | 'APPROVED';
  legalStatusText?: string;
}

interface LegalTaskQueueProps {
  contracts: TaskQueueItem[];
  selectedContractId?: number;
  onSelectContract: (id: number) => void;
  loading?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeTab?: string;
  onTabChange?: (key: string) => void;
}

export const LegalTaskQueue: React.FC<LegalTaskQueueProps> = ({
  contracts,
  selectedContractId,
  onSelectContract,
  loading = false,
  isCollapsed = false,
  onToggleCollapse,
  activeTab: activeTabProp,
  onTabChange,
}) => {
  const activeTab = activeTabProp || 'WAITING';
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const handleTabChange = (key: string) => {
    onTabChange?.(key);
  };

  const filteredContracts = contracts.filter((item) => {
    if (activeTab === 'WAITING' && item.status !== 'WAITING') return false;
    if (activeTab === 'REVISION' && item.status !== 'REVISION') return false;
    if (activeTab === 'APPROVED' && item.status !== 'APPROVED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = item.contractNumber?.toLowerCase().includes(q);
      const matchCust = item.customerName?.toLowerCase().includes(q);
      const matchProj = item.projectName?.toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchProj) return false;
    }

    if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;
    return true;
  });

  const countWaiting = contracts.filter((c) => c.status === 'WAITING').length;
  const countRevision = contracts.filter((c) => c.status === 'REVISION').length;
  const countApproved = contracts.filter((c) => c.status === 'APPROVED').length;

  const tabItems = [
    {
      key: 'WAITING',
      label: (
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          Menunggu Review <Badge count={countWaiting} offset={[4, -2]} style={{ backgroundColor: '#1677ff', fontSize: 10 }} />
        </span>
      ),
    },
    {
      key: 'REVISION',
      label: (
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          Revisi <Badge count={countRevision} offset={[4, -2]} style={{ backgroundColor: '#ff8800', fontSize: 10 }} />
        </span>
      ),
    },
    {
      key: 'APPROVED',
      label: (
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          Disetujui <Badge count={countApproved} offset={[4, -2]} style={{ backgroundColor: '#00b578', fontSize: 10 }} />
        </span>
      ),
    },
    {
      key: 'ALL',
      label: <span style={{ fontSize: 12 }}>Semua ({contracts.length})</span>,
    },
  ];

  const formatRupiah = (val?: number) => {
    if (!val) return 'Rp 50.000.000';
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'WAITING':
        return <Tag style={{ borderRadius: 10, fontSize: 10, color: '#1677ff', backgroundColor: '#e8f3ff', border: 'none', fontWeight: 600 }}>Menunggu</Tag>;
      case 'REVISION':
        return <Tag style={{ borderRadius: 10, fontSize: 10, color: '#ff8800', backgroundColor: '#fff7e6', border: 'none', fontWeight: 600 }}>Revisi</Tag>;
      case 'APPROVED':
        return <Tag style={{ borderRadius: 10, fontSize: 10, color: '#00b578', backgroundColor: '#e6f8f1', border: 'none', fontWeight: 600 }}>Disetujui</Tag>;
      default:
        return <Tag style={{ borderRadius: 10, fontSize: 10 }}>{status}</Tag>;
    }
  };

  return (
    <Card
      title={
        <div 
          onClick={onToggleCollapse}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <Space size={8} style={{ overflow: 'hidden' }}>
            <FileTextOutlined style={{ color: '#ffffff', fontSize: 15 }} />
            {!isCollapsed && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                Antrean Tugas Legal
              </span>
            )}
          </Space>
          <Space size={8}>
            {!isCollapsed && (
              <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.75)', fontWeight: 500 }}>
                {filteredContracts.length} Dokumen
              </span>
            )}
            <Tooltip title={isCollapsed ? 'Tampilkan Antrean (Keluar Focus Mode)' : 'Focus Mode (Sembunyikan Antrean)'}>
              {isCollapsed ? (
                <MenuUnfoldOutlined style={{ color: '#ffffff', fontSize: 15 }} />
              ) : (
                <MenuFoldOutlined style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 15 }} />
              )}
            </Tooltip>
          </Space>
        </div>
      }
      headStyle={{
        backgroundColor: '#102A43',
        padding: '10px 14px',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        minHeight: 'auto'
      }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: '1px solid #dee0e3',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}
      bodyStyle={{ flex: 1, padding: isCollapsed ? 0 : '12px 14px', overflow: 'hidden', display: isCollapsed ? 'none' : 'flex', flexDirection: 'column' }}
    >
      {/* 1. Status Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="small"
        style={{ marginBottom: 8 }}
      />

      {/* 2. Search & Priority Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <Input
          placeholder="Cari No. Kontrak / Klien..."
          prefix={<SearchOutlined style={{ color: '#8f959e', fontSize: 12 }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
          style={{ flex: 1, borderRadius: 6, backgroundColor: '#f5f6f7', border: '1px solid #dee0e3', fontSize: 11 }}
        />
        <Select
          value={priorityFilter}
          onChange={setPriorityFilter}
          size="small"
          style={{ width: 84, fontSize: 11 }}
          suffixIcon={<FilterOutlined style={{ fontSize: 10, color: '#8f959e' }} />}
        >
          <Select.Option value="ALL">Semua</Select.Option>
          <Select.Option value="HIGH">High</Select.Option>
          <Select.Option value="MEDIUM">Med</Select.Option>
          <Select.Option value="LOW">Low</Select.Option>
        </Select>
      </div>

      {/* 3. Ultra-Dense Scrollable Card List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, paddingRight: 2 }}>
        {filteredContracts.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada antrean dokumen" />
        ) : (
          filteredContracts.map((item) => {
            const isSelected = item.id === selectedContractId;
            return (
              <div
                key={item.id}
                onClick={() => onSelectContract(item.id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: isSelected ? '1.5px solid #1677ff' : '1px solid #e5e7eb',
                  backgroundColor: isSelected ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                {/* Header Row: Contract Number & Status Tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text strong style={{ color: isSelected ? '#0958d9' : '#0f172a', fontSize: 12, letterSpacing: '-0.2px' }}>
                    {item.contractNumber}
                  </Text>
                  <Space size={4}>
                    {item.priority === 'HIGH' && (
                      <Tag style={{ borderRadius: 10, fontSize: 9, color: '#f53f3f', backgroundColor: '#ffece6', border: 'none', fontWeight: 700, margin: 0, padding: '0 5px' }}>HIGH</Tag>
                    )}
                    {renderStatusTag(item.status)}
                  </Space>
                </div>

                {/* Second Row: Customer & Nominal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 11, color: '#334155', fontWeight: 500 }} ellipsis={{ tooltip: item.customerName }}>
                    {item.customerName}
                  </Text>
                  <Text strong style={{ fontSize: 11, color: '#059669' }}>
                    {formatRupiah(item.nominal)}
                  </Text>
                </div>

                {/* Third Row: Project & SLA */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 10, color: '#64748b', flex: 1, marginRight: 6 }} ellipsis={{ tooltip: item.projectName }}>
                    {item.projectName || 'Pengadaan Infrastructure'}
                  </Text>
                  <Tooltip title="SLA Review Legal">
                    <Tag color="cyan" icon={<ClockCircleOutlined style={{ fontSize: 9 }} />} style={{ fontSize: 9, margin: 0, padding: '0 4px', borderRadius: 4, border: 'none' }}>
                      {item.slaDeadline || 'SLA 2 Jam'}
                    </Tag>
                  </Tooltip>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
