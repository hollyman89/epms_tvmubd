import React, { useState, useEffect } from 'react';
import { Input, Button, Avatar, Typography, message, Skeleton, Timeline, Tag, Tabs, Empty } from 'antd';
import { 
  UserOutlined, 
  SendOutlined, 
  InfoCircleFilled, 
  EyeOutlined, 
  DownloadOutlined, 
  SwapOutlined, 
  FilePdfOutlined, 
  CheckCircleFilled, 
  MessageFilled,
  AppstoreOutlined,
  HistoryOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { apiClient } from '@/lib/axios';

dayjs.extend(relativeTime);
const { Text } = Typography;

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'HIGH': return 'error';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'default';
    default: return 'default';
  }
};

export const TenderActivityStream = ({ 
  tenderId,
  tender,
  headerContent
}: { 
  tenderId: string | number;
  tender?: any;
  headerContent?: React.ReactNode;
}) => {
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

  const handleDownload = async (filename: string, action: 'view' | 'download', type: 'proposal' | 'contract' = 'proposal') => {
    try {
      const endpoint = type === 'contract'
        ? `/marketing/tenders/contracts/${filename}`
        : `/marketing/tenders/proposals/${filename}`;

      const response = await apiClient.get(endpoint, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] as string || 'application/pdf' }));
      
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
        {headerContent}
        <Skeleton active avatar paragraph={{ rows: 6 }} style={{ marginTop: headerContent ? 20 : 0 }} />
      </div>
    );
  }

  const renderTimelineItems = () => {
    return (
      <Timeline
        mode="left"
        items={activities.map((item) => {
          const isSystem = item.type === 'SYSTEM';
          
          // Detect Proposal Upload
          const proposalMatch = item.content.match(/Proposal document uploaded: (.+?)\. Stage updated to PROPOSAL\./);
          const proposalFileName = proposalMatch ? proposalMatch[1] : null;

          // Detect SPK Upload (Initial or Revision with filename in parentheses)
          const spkMatch = item.content.match(/Dokumen (?:revisi )?SPK \((.+?)\) berhasil diunggah\./);
          const spkFileName = spkMatch ? spkMatch[1] : null;
          const isRevisionSpk = item.content.includes('Dokumen revisi SPK');
          
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
          } else if (proposalFileName) {
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
                    {item.user?.fullName || (isSystem ? 'Sistem' : 'User')}
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
                ) : proposalFileName ? (
                  <div>
                    <Text style={{ color: '#64748b', fontSize: 14, display: 'block', marginBottom: 12 }}>
                      Dokumen proposal baru telah diunggah.
                    </Text>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button type="primary" ghost size="small" icon={<EyeOutlined />} onClick={() => handleDownload(proposalFileName, 'view', 'proposal')} style={{ borderRadius: 6 }}>
                        Lihat PDF
                      </Button>
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(proposalFileName, 'download', 'proposal')} style={{ borderRadius: 6 }}>
                        Unduh
                      </Button>
                    </div>
                  </div>
                ) : spkFileName ? (
                  <div>
                    <Text style={{ color: '#64748b', fontSize: 14, display: 'block', marginBottom: 12 }}>
                      {isRevisionSpk ? 'Dokumen revisi SPK telah diunggah.' : 'Dokumen SPK telah diunggah.'}
                    </Text>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button type="primary" ghost size="small" icon={<EyeOutlined />} onClick={() => handleDownload(spkFileName, 'view', 'contract')} style={{ borderRadius: 6 }}>
                        Lihat PDF
                      </Button>
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(spkFileName, 'download', 'contract')} style={{ borderRadius: 6 }}>
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
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      
      {/* Scrollable Content Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '90px' }}>
        {headerContent}

        {tender ? (
          <Tabs
            defaultActiveKey="overview"
            className="project-detail-tabs"
            items={[
              {
                key: 'overview',
                label: <span style={{ fontWeight: 600 }}><AppstoreOutlined /> Overview</span>,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Project Summary Card */}
                    <div style={{ 
                      background: '#ffffff', 
                      borderRadius: 12, 
                      padding: '16px', 
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 12 }}>
                        Informasi Proyek
                      </Text>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Customer</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {tender.customer?.name || (tender.customer_id ? `Client ID: ${tender.customer_id}` : '-')}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Sektor Industri</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {tender.customer?.business_sector || tender.business_sector || '-'}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Nilai Anggaran</Text>
                          <Text strong style={{ fontSize: 13, color: '#10b981' }}>
                            Rp {(Number(tender.estimated_budget) || 0).toLocaleString('id-ID')}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>PIC Marketing</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {tender.marketing_pic_name || 'Belum Ditentukan'}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Prioritas</Text>
                          <div style={{ marginTop: 2 }}>
                            <Tag color={getPriorityColor(tender.priority)} style={{ borderRadius: 4, margin: 0, fontWeight: 600, fontSize: 11 }}>
                              {tender.priority || 'MEDIUM'}
                            </Tag>
                          </div>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Probabilitas Menang</Text>
                          <Text strong style={{ fontSize: 13, color: '#0284c7' }}>
                            {tender.probability_percentage ?? 0}%
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Deadline Penawaran</Text>
                          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {tender.bid_submission_deadline ? dayjs(tender.bid_submission_deadline).format('DD MMM YYYY') : '-'}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Status Dokumen SPK</Text>
                          <Text strong style={{ fontSize: 13, color: tender.spk_file_key ? '#16a34a' : (tender.stage === 'WON' ? '#d97706' : '#64748b') }}>
                            {tender.spk_file_key ? 'Sudah Diunggah' : (tender.stage === 'WON' ? 'Menunggu Upload SPK' : 'Belum Tersedia')}
                          </Text>
                        </div>
                        {tender.legal_status && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Status Review Legal</Text>
                            <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                              {tender.legal_status}
                            </Text>
                          </div>
                        )}
                        {tender.created_at && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Dibuat Pada</Text>
                            <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
                              {dayjs(tender.created_at).format('DD MMM YYYY, HH:mm')}
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ringkasan Catatan Marketing Singkat (Jika ada) */}
                    {tender.notes && (
                      <div style={{ 
                        background: '#ffffff', 
                        borderRadius: 12, 
                        padding: '14px 16px', 
                        border: '1px solid #e2e8f0',
                        borderLeft: '4px solid #94a3b8'
                      }}>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          Catatan Marketing
                        </Text>
                        <Text italic style={{ color: '#475569', fontSize: 13 }}>"{tender.notes}"</Text>
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: 'activity',
                label: <span style={{ fontWeight: 600 }}><HistoryOutlined /> Activity</span>,
                children: (
                  <div style={{ background: '#ffffff', borderRadius: 12, padding: '16px', border: '1px solid #e2e8f0' }}>
                    <Typography.Title level={5} style={{ color: '#64748b', marginTop: 0, marginBottom: 16, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                      Riwayat Aktivitas
                    </Typography.Title>

                    {activities && activities.length > 0 ? (
                      renderTimelineItems()
                    ) : (
                      <Empty 
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={<Text type="secondary" style={{ fontSize: 12 }}>Belum ada riwayat aktivitas untuk proyek ini.</Text>}
                        style={{ margin: '24px 0' }}
                      />
                    )}
                  </div>
                )
              },
              {
                key: 'notes',
                label: <span style={{ fontWeight: 600 }}><FileTextOutlined /> Notes</span>,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {tender.notes && (
                      <div style={{ 
                        background: '#ffffff', 
                        borderRadius: 12, 
                        padding: '16px', 
                        border: '1px solid #e2e8f0',
                        borderLeft: '4px solid #3b82f6'
                      }}>
                        <Text strong style={{ fontSize: 13, color: '#1e3a8a', display: 'block', marginBottom: 6 }}>
                          Catatan / Rekomendasi Marketing
                        </Text>
                        <Text style={{ color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
                          "{tender.notes}"
                        </Text>
                      </div>
                    )}

                    {tender.legal_notes && (
                      tender.contract_status === 'PM_RETURNED' || tender.contractStatus === 'PM_RETURNED' ? (
                        <div style={{ 
                          background: '#fffbe6', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid #fef3c7',
                          borderLeft: '4px solid #d97706'
                        }}>
                          <Text strong style={{ fontSize: 13, color: '#b45309', display: 'block', marginBottom: 6 }}>
                            Catatan Project Manager
                          </Text>
                          <Text style={{ color: '#78350f', fontSize: 13, lineHeight: 1.6 }}>
                            "{tender.legal_notes}"
                          </Text>
                        </div>
                      ) : (
                        <div style={{ 
                          background: '#ffffff', 
                          borderRadius: 12, 
                          padding: '16px', 
                          border: '1px solid #fee2e2',
                          borderLeft: '4px solid #ef4444'
                        }}>
                          <Text strong style={{ fontSize: 13, color: '#991b1b', display: 'block', marginBottom: 6 }}>
                            Catatan Tim Legal
                          </Text>
                          <Text style={{ color: '#7f1d1d', fontSize: 13, lineHeight: 1.6 }}>
                            "{tender.legal_notes}"
                          </Text>
                        </div>
                      )
                    )}

                    {!tender.notes && !tender.legal_notes && (
                      <div style={{ background: '#ffffff', borderRadius: 12, padding: '24px', border: '1px solid #e2e8f0' }}>
                        <Empty 
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={<Text type="secondary" style={{ fontSize: 12 }}>Belum ada catatan untuk proyek ini.</Text>}
                          style={{ margin: '16px 0' }}
                        />
                      </div>
                    )}
                  </div>
                )
              }
            ]}
          />
        ) : (
          <div>
            <Typography.Title level={5} style={{ color: '#64748b', marginTop: headerContent ? 8 : 0, marginBottom: 20, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
              Riwayat Aktivitas
            </Typography.Title>
            {renderTimelineItems()}
          </div>
        )}
      </div>

      {/* Modern Messenger Chat Input Area */}
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
        boxShadow: '0 -4px 20px rgba(0,0,0,0.02)',
        zIndex: 10
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
