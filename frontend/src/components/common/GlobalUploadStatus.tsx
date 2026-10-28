"use client";

import React, { useState } from 'react';
import { Card, Progress, Button, Typography, Space, Tooltip, Tag } from 'antd';
import {
  CloudUploadOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  ReloadOutlined,
  CloseOutlined,
  DownOutlined,
  UpOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useUploadTasks, UploadTask } from '@/lib/uploadTaskManager';

const { Text } = Typography;

export const GlobalUploadStatus: React.FC = () => {
  const { tasks, retryTask, dismissTask } = useUploadTasks();
  const [collapsed, setCollapsed] = useState(false);

  if (!tasks || tasks.length === 0) {
    return null;
  }

  const uploadingCount = tasks.filter((t) => t.status === 'UPLOADING').length;
  const failedCount = tasks.filter((t) => t.status === 'FAILED').length;
  const successCount = tasks.filter((t) => t.status === 'SUCCESS').length;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1050,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        pointerEvents: 'auto',
      }}
      data-testid="global-upload-status"
    >
      <Card
        size="small"
        styles={{
          body: { padding: collapsed ? 0 : '8px 12px', maxHeight: 360, overflowY: 'auto' },
          header: { padding: '8px 12px', background: '#fafafa', borderBottom: collapsed ? 'none' : '1px solid #f0f0f0' },
        }}
        style={{
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          borderRadius: 8,
          border: '1px solid #d9d9d9',
          overflow: 'hidden',
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Space size={6}>
              <CloudUploadOutlined style={{ color: '#1677ff', fontSize: 16 }} />
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
                Pengunggahan Berkas
              </Text>
              {uploadingCount > 0 && (
                <Tag color="processing" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                  {uploadingCount} aktif
                </Tag>
              )}
              {failedCount > 0 && (
                <Tag color="error" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                  {failedCount} gagal
                </Tag>
              )}
            </Space>
            <Button
              type="text"
              size="small"
              icon={collapsed ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ width: 24, height: 24, color: '#64748b' }}
              aria-label={collapsed ? 'Perluas status pengunggahan' : 'Ciutkan status pengunggahan'}
            />
          </div>
        }
      >
        {!collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.map((task: UploadTask) => (
              <div
                key={task.id}
                data-testid={`upload-task-${task.id}`}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: task.status === 'FAILED' ? '#fff1f0' : task.status === 'SUCCESS' ? '#f6ffed' : '#f8fafc',
                  border: `1px solid ${
                    task.status === 'FAILED' ? '#ffccc7' : task.status === 'SUCCESS' ? '#b7eb8f' : '#e2e8f0'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                    {task.flowLabel}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined style={{ fontSize: 10 }} />}
                    onClick={() => dismissTask(task.id)}
                    style={{ width: 18, height: 18, color: '#94a3b8' }}
                    aria-label="Tutup notifikasi tugas ini"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <FileTextOutlined style={{ color: '#2563eb', fontSize: 13, flexShrink: 0 }} />
                  <Tooltip title={task.fileName}>
                    <Text
                      ellipsis
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#0f172a',
                        maxWidth: 260,
                      }}
                    >
                      {task.fileName}
                    </Text>
                  </Tooltip>
                </div>

                {task.status === 'UPLOADING' && (
                  <div>
                    <Progress
                      percent={task.progress}
                      status="active"
                      size="small"
                      showInfo={task.progress !== undefined}
                      strokeColor="#1677ff"
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        <LoadingOutlined spin style={{ marginRight: 4 }} />
                        {task.progress !== undefined ? `Mengunggah (${task.progress}%)` : 'Mengunggah ke server...'}
                      </Text>
                    </div>
                  </div>
                )}

                {task.status === 'SUCCESS' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 13 }} />
                    <Text style={{ fontSize: 11, color: '#389e0d', fontWeight: 500 }}>
                      Selesai diunggah dan tersimpan.
                    </Text>
                  </div>
                )}

                {task.status === 'FAILED' && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                      <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 13, marginTop: 2, flexShrink: 0 }} />
                      <Text type="danger" style={{ fontSize: 11, lineHeight: '14px', wordBreak: 'break-word' }}>
                        {task.error || 'Gagal mengunggah berkas.'}
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                      <Button
                        size="small"
                        type="primary"
                        danger
                        ghost
                        icon={<ReloadOutlined />}
                        onClick={() => retryTask(task.id)}
                        style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                      >
                        Coba Lagi
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
