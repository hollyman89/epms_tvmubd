import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

export const WorkflowDesigner: React.FC = () => {
  return (
    <div style={{ padding: 24, background: '#fff', borderRadius: 8, minHeight: 600 }}>
      <Title level={3}>Workflow Designer</Title>
      <p>Halaman ini sedang dalam pengembangan.</p>
    </div>
  );
};
