"use client";

import React from 'react';
import { Card, Table, Typography, Space, Tooltip } from 'antd';
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
    <Card
      title={
        <Space size={8}>
          <ClockCircleOutlined style={{ color: '#faad14', fontSize: 16 }} />
          <Text strong style={{ fontSize: 13, color: '#1f2329' }}>
            Tender yang Perlu Perhatian (Action Items)
          </Text>
          <Tooltip title="Diprioritaskan berdasarkan tender yang paling lama menunggu (FIFO Overdue)">
            <InfoCircleOutlined style={{ color: '#8f959e', fontSize: 12, cursor: 'pointer' }} />
          </Tooltip>
        </Space>
      }
      style={{
        borderRadius: 10,
        border: '1px solid #ffe7ba',
        boxShadow: '0 2px 8px rgba(250, 173, 20, 0.08)',
        marginTop: 24,
        marginBottom: 24,
        overflow: 'hidden',
      }}
      headStyle={{
        backgroundColor: '#fffbe6',
        borderBottom: '1px solid #ffe7ba',
        padding: '10px 16px',
      }}
      bodyStyle={{ padding: 0 }}
    >
      <Table 
        dataSource={actionItemsData} 
        columns={actionItemsColumns} 
        rowKey="id" 
        pagination={false} 
        size="small"
      />
    </Card>
  );
};
