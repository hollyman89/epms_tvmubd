'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Tag, Typography, Space, Button, Tooltip, Popover, Badge, Spin, Breadcrumb } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  SyncOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const { Title, Text } = Typography;

export interface BpmnNodeMetadata {
  nodeId: string;
  nodeName: string;
  assignedRole: string;
  approverName: string;
  timeSpent: string;
  status: 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED';
  comments?: string;
}

interface BpmnWorkflowVisualizerProps {
  workflowInstanceId?: number;
}

export const BpmnWorkflowVisualizer: React.FC<BpmnWorkflowVisualizerProps> = ({
  workflowInstanceId = 101,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeNodeId, setActiveNodeId] = useState<string>('Node_Approval_PM');
  const [metadata, setMetadata] = useState<BpmnNodeMetadata | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchVisualizerData();
    setupWebSocket();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [workflowInstanceId]);

  const fetchVisualizerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get(`http://localhost:4000/api/v1/workflow/visualizer/${workflowInstanceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data?.data;
      if (data) {
        if (data.activeNodeId) setActiveNodeId(data.activeNodeId);
        if (data.activeNodeMetadata) setMetadata(data.activeNodeMetadata);
        if (data.history) setHistory(data.history);
      }
    } catch (err) {
      setActiveNodeId(null);
      setMetadata(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const socket = io('http://localhost:4000/notifications', {
      transports: ['websocket'],
      auth: { token: `Bearer ${token}` },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', { room: `room:workflow:${workflowInstanceId}` });
    });

    socket.on('workflow_step_updated', (payload: any) => {
      if (payload.activeNodeId) {
        setActiveNodeId(payload.activeNodeId);
        fetchVisualizerData();
      }
    });
  };

  const nodes = [
    { id: 'Node_Start', label: 'Pengajuan PR', type: 'start' },
    { id: 'Node_Approval_PM', label: 'Review PM', type: 'task', role: 'PROCUREMENT_MANAGER' },
    { id: 'Node_Approval_Finance', label: 'Review Finance', type: 'task', role: 'FINANCE_MANAGER' },
    { id: 'Node_Approval_Director', label: 'Approval Direksi', type: 'task', role: 'DIRECTOR' },
    { id: 'Node_End', label: 'Selesai & Rilis PO', type: 'end' },
  ];

  return (
    <Card
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <PlayCircleOutlined style={{ color: '#10b981' }} />
            <Text strong style={{ fontSize: 14 }}>BPMN 2.0 Live Workflow Visualizer</Text>
            <Tag color="green">Real-time WebSocket Active</Tag>
          </Space>
          <Space>
            <Button icon={<ZoomInOutlined />} onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.5))} size="small" />
            <Button icon={<ZoomOutOutlined />} onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.6))} size="small" />
            <Button icon={<FullscreenOutlined />} onClick={() => setZoomLevel(1)} size="small">Fit View</Button>
            <Button icon={<SyncOutlined />} onClick={fetchVisualizerData} size="small">Refresh</Button>
          </Space>
        </div>
      }
      style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <Spin spinning={loading}>
        {/* CSS Pulse Animation Style */}
        <style>{`
          @keyframes pulseRing {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          .active-bpmn-node {
            animation: pulseRing 1.8s infinite;
            border: 2px solid #10b981 !important;
            background-color: #ecfdf5 !important;
          }
        `}</style>

        {/* BPMN Canvas Container */}
        <div style={{ overflow: 'auto', padding: '24px 16px', background: '#fafafa', borderRadius: 8, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 32,
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease',
            }}
          >
            {nodes.map((node, index) => {
              const isActive = node.id === activeNodeId;
              const isStart = node.type === 'start';
              const isEnd = node.type === 'end';

              return (
                <React.Fragment key={node.id}>
                  <Popover
                    title={<Text strong style={{ fontSize: 13 }}>{metadata?.nodeName || node.label}</Text>}
                    content={
                      isActive ? (
                        <div style={{ maxWidth: 260 }}>
                          <p style={{ margin: '2px 0', fontSize: 11 }}>👤 <strong>Assigned:</strong> {metadata?.approverName}</p>
                          <p style={{ margin: '2px 0', fontSize: 11 }}>⏱️ <strong>Time Spent:</strong> {metadata?.timeSpent}</p>
                          <p style={{ margin: '2px 0', fontSize: 11 }}>💬 <strong>Catatan:</strong> {metadata?.comments}</p>
                        </div>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 11 }}>Node status: Inactive / Completed</Text>
                      )
                    }
                  >
                    <div
                      className={isActive ? 'active-bpmn-node' : ''}
                      style={{
                        padding: isStart || isEnd ? '12px 16px' : '14px 20px',
                        borderRadius: isStart || isEnd ? 30 : 10,
                        backgroundColor: isStart ? '#e0f2fe' : isEnd ? '#fef3c7' : '#ffffff',
                        border: isStart ? '2px solid #0284c7' : isEnd ? '2px solid #d97706' : '1px solid #d1d5db',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        minWidth: 120,
                      }}
                    >
                      <Text strong style={{ fontSize: 12, color: isActive ? '#065f46' : '#1f2937' }}>
                        {node.label}
                      </Text>
                      {isActive && <Badge status="processing" style={{ marginLeft: 6 }} />}
                    </div>
                  </Popover>

                  {/* Flow Arrow */}
                  {index < nodes.length - 1 && (
                    <div style={{ width: 40, height: 2, backgroundColor: index === 0 ? '#10b981' : '#cbd5e1', position: 'relative' }}>
                      <div
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: -4,
                          width: 0,
                          height: 0,
                          borderTop: '5px solid transparent',
                          borderBottom: '5px solid transparent',
                          borderLeft: `8px solid ${index === 0 ? '#10b981' : '#cbd5e1'}`,
                        }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Node Metadata Footer Panel */}
        {metadata && (
          <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <Text strong style={{ fontSize: 13, color: '#166534', display: 'block', marginBottom: 4 }}>
              📌 Informasi Node Aktif BPMN: {metadata.nodeName}
            </Text>
            <Space size={16} wrap style={{ fontSize: 11, color: '#15803d' }}>
              <span>👤 <strong>Penanggung Jawab:</strong> {metadata.approverName}</span>
              <span>⏱️ <strong>Durasi di Node:</strong> {metadata.timeSpent}</span>
              <span>💬 <strong>Instruksi:</strong> {metadata.comments}</span>
            </Space>
          </div>
        )}
      </Spin>
    </Card>
  );
};
