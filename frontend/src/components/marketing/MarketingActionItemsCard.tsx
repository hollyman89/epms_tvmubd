"use client";

import React from 'react';
import { Card, Table, Typography, Space, Tooltip, Tag } from 'antd';
import { ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface MarketingActionItemsCardProps {
  actionItemsData: any[];
  actionItemsColumns: any[];
}

export const MarketingActionItemsCard: React.FC<MarketingActionItemsCardProps> = ({
  actionItemsData,
  actionItemsColumns
}) => {
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
              {actionItemsData.length} Tender Perlu Tindakan
            </Tag>
          </div>
        }
        bodyStyle={{ padding: 0 }}
      >
        <Table 
          className="action-items-table"
          dataSource={actionItemsData} 
          columns={actionItemsColumns} 
          rowKey="id" 
          pagination={false} 
          size="middle"
          scroll={{ x: 780 }}
        />
      </Card>
    </div>
  );
};
