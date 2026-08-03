'use client';

import React, { useState } from 'react';
import { Card, Input, Button, Timeline, Avatar, Typography, Space, Tag } from 'antd';
import { SendOutlined, UserOutlined, MessageOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { LegalCommentRenderer } from './LegalCommentRenderer';

const { Text } = Typography;

export interface CommentItem {
  id: number;
  userName: string;
  userRole: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}

interface LegalActivityCommentThreadProps {
  contractId?: number;
}

export const LegalActivityCommentThread: React.FC<LegalActivityCommentThreadProps> = ({ contractId }) => {
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: 1,
      userName: 'Lukas (Marketing Staff)',
      userRole: 'MARKETING',
      content: 'Dokumen SPK & Proposal resmi telah diunggah. Mohon tim Legal dapat meninjau klausul termin pembayaran DP 30%.',
      createdAt: '2 jam yang lalu',
    },
    {
      id: 2,
      userName: 'Legal Specialist',
      userRole: 'LEGAL',
      content: 'Klausul SLA denda keterlambatan 1‰ per hari telah dikonfirmasi sesuai standar tata kelola EPMS perusahaan.',
      createdAt: '1 jam yang lalu',
    },
  ]);

  const [inputComment, setInputComment] = useState('');

  const handleSendComment = () => {
    if (!inputComment.trim()) return;
    const newComment: CommentItem = {
      id: Date.now(),
      userName: 'Legal Officer (Anda)',
      userRole: 'LEGAL',
      content: inputComment.trim(),
      createdAt: 'Baru saja',
    };
    setComments([...comments, newComment]);
    setInputComment('');
  };

  return (
    <Card
      title={
        <Space>
          <MessageOutlined style={{ color: '#1677ff' }} />
          <Text strong style={{ fontSize: 13 }}>Diskusi Legal & Marketing (Chat-Ops)</Text>
        </Space>
      }
      style={{ marginBottom: 12, borderRadius: 8, minHeight: 260 }}
      bodyStyle={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* FASE 4 FIX: Scrollable Area dengan Minimum Height 200px agar Pesan Lega & Terbaca Jelas */}
      <div style={{ flex: 1, minHeight: 190, maxHeight: 280, overflowY: 'auto', marginBottom: 12, paddingRight: 6 }}>
        <Timeline
          items={comments.map((item) => ({
            dot: <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: item.userRole === 'LEGAL' ? '#1677ff' : '#fa8c16' }} />,
            children: (
              <div style={{ backgroundColor: '#fafafa', padding: '8px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Space size={6}>
                    <Text strong style={{ fontSize: 12 }}>{item.userName}</Text>
                    <Tag color={item.userRole === 'LEGAL' ? 'blue' : 'orange'} style={{ fontSize: 10, margin: 0 }}>{item.userRole}</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <ClockCircleOutlined /> {item.createdAt}
                  </Text>
                </div>
                {/* TASK D FIX: LegalCommentRenderer with DOMPurify ALLOWED_TAGS */}
                <LegalCommentRenderer content={item.content} />
              </div>
            ),
          }))}
        />
      </div>

      {/* Input box Chat-Ops */}
      <div style={{ display: 'flex', gap: 6, paddingTop: 4, borderTop: '1px solid #f0f0f0' }}>
        <Input
          placeholder="Tulis pesan / instruksi hukum..."
          value={inputComment}
          onChange={(e) => setInputComment(e.target.value)}
          onPressEnter={handleSendComment}
          size="small"
        />
        <Button type="primary" size="small" icon={<SendOutlined />} onClick={handleSendComment}>
          Kirim
        </Button>
      </div>
    </Card>
  );
};
