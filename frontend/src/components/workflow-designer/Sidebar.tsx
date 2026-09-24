import React from 'react';
import { Typography, List, Card } from 'antd';
import { 
  PlayCircleOutlined, 
  CheckSquareOutlined, 
  FileSearchOutlined, 
  CheckCircleOutlined,
  ForkOutlined,
  SettingOutlined,
  PauseCircleOutlined,
  BellOutlined,
  ApartmentOutlined,
  StopOutlined
} from '@ant-design/icons';

const { Title } = Typography;

export const NODE_TYPES = [
  { type: 'START', label: 'Start', icon: <PlayCircleOutlined style={{ color: '#52c41a' }} /> },
  { type: 'TASK', label: 'Task', icon: <CheckSquareOutlined style={{ color: '#1890ff' }} /> },
  { type: 'REVIEW', label: 'Review', icon: <FileSearchOutlined style={{ color: '#faad14' }} /> },
  { type: 'APPROVAL', label: 'Approval', icon: <CheckCircleOutlined style={{ color: '#722ed1' }} /> },
  { type: 'CONDITION', label: 'Condition', icon: <ForkOutlined style={{ color: '#eb2f96' }} /> },
  { type: 'ROUTING', label: 'Routing', icon: <ApartmentOutlined style={{ color: '#13c2c2' }} /> },
  { type: 'SYSTEM_ACTION', label: 'System Action', icon: <SettingOutlined style={{ color: '#595959' }} /> },
  { type: 'WAIT', label: 'Wait', icon: <PauseCircleOutlined style={{ color: '#fa8c16' }} /> },
  { type: 'NOTIFICATION', label: 'Notification', icon: <BellOutlined style={{ color: '#a0d911' }} /> },
  { type: 'SUBPROCESS', label: 'Subprocess', icon: <ApartmentOutlined style={{ color: '#2f54eb' }} /> },
  { type: 'END', label: 'End', icon: <StopOutlined style={{ color: '#f5222d' }} /> },
];

export const Sidebar: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: string, label: string) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{ width: 250, borderRight: '1px solid #f0f0f0', padding: 16, background: '#fafafa', overflowY: 'auto' }}>
      <Title level={5} style={{ marginBottom: 16 }}>Node Palette</Title>
      
      <List
        dataSource={NODE_TYPES}
        renderItem={item => (
          <List.Item style={{ padding: '4px 0', border: 'none' }}>
            <Card
              size="small"
              style={{ 
                width: '100%', 
                cursor: readOnly ? 'not-allowed' : 'grab',
                opacity: readOnly ? 0.6 : 1,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              bodyStyle={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}
              onDragStart={(event) => onDragStart(event, item.type, item.label)}
              draggable={!readOnly}
            >
              {item.icon}
              <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};
