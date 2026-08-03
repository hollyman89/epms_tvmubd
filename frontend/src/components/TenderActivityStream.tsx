import React, { useState, useEffect } from 'react';
import { Card, Input, Button, List, Avatar, Typography, message, Skeleton, Timeline, Tag } from 'antd';
import { UserOutlined, SendOutlined, InfoCircleFilled, EyeOutlined, DownloadOutlined, SwapOutlined, FilePdfOutlined, CheckCircleFilled, MessageFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { apiClient } from '@/lib/axios';

dayjs.extend(relativeTime);
const { Text } = Typography;

export const TenderActivityStream = ({ tenderId }: { tenderId: string | number }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchActivities = async () => {
    try {
      const response = await apiClient.get(`/marketing/tenders/${tenderId}/activities`);
      const result = response.data?.data || response.data;
      setActivities(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to fetch activities', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenderId) {
      fetchActivities();
      const interval = setInterval(fetchActivities, 10000);
      return () => clearInterval(interval);
    }
  }, [tenderId]);

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/marketing/tenders/${tenderId}/activities`, { content: comment });
      setComment('');
      fetchActivities();
    } catch (err) {
      message.error('Failed to send comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (filename: string, action: 'view' | 'download') => {
    try {
      const response = await apiClient.get(`/marketing/tenders/proposals/${filename}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] as string }));
      
      if (action === 'view') {
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      message.error('Gagal mengambil dokumen.');
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      
      {/* Activity Timeline Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: '80px' }}>
        <Typography.Title level={5} style={{ color: '#64748b', marginBottom: 24, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
          Riwayat Aktivitas
        </Typography.Title>
        <Timeline
          mode="left"
          items={activities.map((item) => {
            const isSystem = item.type === 'SYSTEM';
            
            // Detect Proposal Upload
            const proposalMatch = item.content.match(/Proposal document uploaded: (.+?)\. Stage updated to PROPOSAL\./);
            const fileName = proposalMatch ? proposalMatch[1] : null;
            
            // Detect Stage Change
            const stageChangeMatch = item.content.match(/Tender stage changed from (.+?) to (.+?)$/);
            const isStageChange = !!stageChangeMatch;

            // Detect WON/LOST
            const isWonLost = item.content.includes('Tender marked as WON') || item.content.includes('Tender marked as LOST');

            let dotIcon = <InfoCircleFilled style={{ fontSize: '16px', color: '#94a3b8' }} />;
            let dotColor = '#94a3b8';

            if (!isSystem) {
              dotIcon = <Avatar size={28} icon={<UserOutlined />} src={item.user?.avatarUrl} style={{ background: '#3b82f6', border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />;
              dotColor = 'transparent';
            } else if (fileName) {
              dotIcon = <div style={{ background: '#ef4444', width: 28, height: 28, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 6px rgba(239,68,68,0.4)', color: 'white' }}><FilePdfOutlined /></div>;
              dotColor = 'transparent';
            } else if (isStageChange) {
              dotIcon = <div style={{ background: '#f59e0b', width: 28, height: 28, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 6px rgba(245,158,11,0.4)', color: 'white' }}><SwapOutlined /></div>;
              dotColor = 'transparent';
            } else if (isWonLost) {
              const isWon = item.content.includes('WON');
              dotIcon = <div style={{ background: isWon ? '#10b981' : '#ef4444', width: 28, height: 28, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: `0 2px 6px ${isWon ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, color: 'white' }}><CheckCircleFilled /></div>;
              dotColor = 'transparent';
            } else if (item.content.includes('Catatan Negosiasi')) {
              dotIcon = <div style={{ background: '#8b5cf6', width: 28, height: 28, borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 6px rgba(139,92,246,0.4)', color: 'white' }}><MessageFilled /></div>;
              dotColor = 'transparent';
            }

            return {
              color: dotColor,
              dot: dotIcon,
              children: (
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  border: '1px solid #f1f5f9',
                  marginLeft: 8,
                  marginBottom: 8,
                  transition: 'all 0.3s ease',
                  cursor: 'default',
                  position: 'relative'
                }}
                className="activity-card"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text strong style={{ fontSize: 13, color: '#334155' }}>
                      {isSystem ? 'Sistem' : (item.user?.fullName || 'User')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>
                      {dayjs(item.created_at).fromNow()}
                    </Text>
                  </div>
                  
                  {isStageChange && stageChangeMatch ? (
                    <div>
                      <Text style={{ color: '#64748b', fontSize: 14 }}>Tender berpindah dari </Text>
                      <Tag color="default">{stageChangeMatch[1]}</Tag>
                      <Text style={{ color: '#64748b', fontSize: 14 }}> ke </Text>
                      <Tag color="processing">{stageChangeMatch[2]}</Tag>
                    </div>
                  ) : fileName ? (
                    <div>
                      <Text style={{ color: '#64748b', fontSize: 14, display: 'block', marginBottom: 12 }}>
                        Dokumen proposal baru telah diunggah.
                      </Text>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button type="primary" ghost size="small" icon={<EyeOutlined />} onClick={() => handleDownload(fileName, 'view')} style={{ borderRadius: 6 }}>
                          Lihat PDF
                        </Button>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(fileName, 'download')} style={{ borderRadius: 6 }}>
                          Unduh
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Text style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
                      {item.content}
                    </Text>
                  )}
                </div>
              )
            };
          })}
        />
      </div>

      {/* Modern Chat Input Area */}
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        background: 'rgba(255, 255, 255, 0.85)', 
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(226, 232, 240, 0.8)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.02)'
      }}>
        <Input.TextArea
          placeholder="Ketik catatan tambahan..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          style={{ 
            borderRadius: '20px', 
            padding: '10px 16px',
            background: '#f1f5f9',
            border: '1px solid transparent',
            boxShadow: 'none',
            fontSize: 14,
            resize: 'none'
          }}
          className="messenger-input"
        />
        <Button 
          type="primary" 
          shape="circle"
          icon={<SendOutlined style={{ marginLeft: 2 }} />} 
          onClick={handleSubmit} 
          loading={submitting}
          style={{ 
            height: 44, 
            width: 44, 
            minWidth: 44,
            background: comment.trim() ? '#3b82f6' : '#cbd5e1',
            borderColor: comment.trim() ? '#3b82f6' : '#cbd5e1',
            boxShadow: comment.trim() ? '0 4px 12px rgba(59,130,246,0.4)' : 'none',
            transition: 'all 0.3s ease'
          }}
        />
      </div>

      <style>{`
        .activity-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
          border-color: #e2e8f0 !important;
        }
        .messenger-input:focus {
          background: #ffffff !important;
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1) !important;
        }
        .ant-timeline-item-tail {
          border-left: 2px dashed #e2e8f0 !important;
        }
      `}</style>
    </div>
  );
};
