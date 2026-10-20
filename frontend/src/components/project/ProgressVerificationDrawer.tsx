'use client';

import React, { useState } from 'react';
import { Drawer, Typography, Button, Space, Tag, Modal, Input, message, Form, Row, Col } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  DownloadOutlined,
  CalendarOutlined,
  UserOutlined,
  BarChartOutlined,
  MessageOutlined,
  PaperClipOutlined,
  CheckSquareOutlined,
  AppstoreOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { ProjectService } from '@/services';
import { downloadSecureDocument } from '@/lib/fileDelivery';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

interface ProgressVerificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: number;
  pendingLogs: any[]; // These are logs with status 'PENDING_VERIFICATION'
  currentUserId: number;
  canVerify: boolean;
}

export const ProgressVerificationDrawer: React.FC<ProgressVerificationDrawerProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId,
  pendingLogs,
  currentUserId,
  canVerify,
}) => {
  const [verifyingLogId, setVerifyingLogId] = useState<number | null>(null);
  const [selectedRejectLogId, setSelectedRejectLogId] = useState<number | null>(null);
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectForm] = Form.useForm();
  
  const handleApprove = async (logId: number) => {
    try {
      setVerifyingLogId(logId);
      await ProjectService.verifyProgressLog(projectId, logId, { decision: 'APPROVE' });
      message.success('Progress claim approved successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to approve claim:', error);
      message.error(error?.response?.data?.message || 'Failed to approve claim');
    } finally {
      setVerifyingLogId(null);
    }
  };

  const handleDownloadEvidence = async (docId: number, fileName: string) => {
    try {
      setDownloadingDocId(docId);
      await downloadSecureDocument(docId, fileName);
    } catch (err: any) {
      console.error('Failed to download evidence:', err);
      message.error(err?.response?.data?.message || 'Gagal mengunduh berkas bukti');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleRejectClick = (logId: number) => {
    setSelectedRejectLogId(logId);
    setIsSubmittingReject(false);
    setIsRejectModalOpen(true);
  };

  const submitReject = async (values: { reason: string }) => {
    if (!selectedRejectLogId) return;
    try {
      setIsSubmittingReject(true);
      await ProjectService.verifyProgressLog(projectId, selectedRejectLogId, { 
        decision: 'REJECT', 
        rejectionReason: values.reason 
      });
      message.success('Progress claim rejected');
      setIsRejectModalOpen(false);
      rejectForm.resetFields();
      setSelectedRejectLogId(null);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to reject claim:', error);
      message.error(error?.response?.data?.message || 'Failed to reject claim');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || typeof bytes !== 'number' || bytes <= 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatMimeType = (mime?: string | null, fileName?: string | null) => {
    const lowerMime = (mime || '').toLowerCase();
    const lowerName = (fileName || '').toLowerCase();
    if (lowerMime.includes('png') || lowerName.endsWith('.png')) return 'PNG Image';
    if (lowerMime.includes('jpeg') || lowerMime.includes('jpg') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'JPEG Image';
    if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) return 'PDF Document';
    if (lowerMime.includes('excel') || lowerMime.includes('spreadsheet') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return 'Spreadsheet';
    if (lowerMime.includes('word') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'Word Document';
    return mime || null;
  };

  const getEvidenceIcon = (mime?: string | null, fileName?: string | null) => {
    const lowerMime = (mime || '').toLowerCase();
    const lowerName = (fileName || '').toLowerCase();
    if (lowerMime.includes('image') || lowerMime.includes('png') || lowerMime.includes('jpeg') || lowerMime.includes('jpg') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
      return <FileImageOutlined style={{ fontSize: 18, color: '#2563eb' }} />;
    }
    if (lowerMime.includes('pdf') || lowerName.endsWith('.pdf')) {
      return <FilePdfOutlined style={{ fontSize: 18, color: '#dc2626' }} />;
    }
    return <FileTextOutlined style={{ fontSize: 18, color: '#2563eb' }} />;
  };

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                backgroundColor: '#eff6ff',
                border: '1px solid #dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckSquareOutlined style={{ fontSize: 19, color: '#2563eb' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
                Verify Pending Progress Claims
              </div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                Review the progress claim details, evidence, and make a verification decision.
              </div>
            </div>
          </div>
        }
        width={640}
        open={isOpen}
        onClose={onClose}
        styles={{
          body: {
            backgroundColor: '#f8fafc',
            padding: '16px 20px',
          },
          header: {
            borderBottom: '1px solid #e2e8f0',
            padding: '16px 20px',
          },
        }}
      >
        {pendingLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Text type="secondary" style={{ fontSize: 14 }}>No pending progress claims to verify.</Text>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {pendingLogs.map((log) => {
              const submitterId = Number(log.submittedBy ?? log.submitted_by ?? 0);
              const isSubmitter = submitterId > 0 && submitterId === Number(currentUserId);
              const allowVerify = canVerify && !isSubmitter;

              const taskTitle =
                log.taskName ||
                log.task_name ||
                log.taskCode ||
                log.task_code ||
                (log.taskId || log.task_id ? `Task #${log.taskId || log.task_id}` : 'Task');

              const submitterDisplay =
                log.submitterName ||
                log.submitter_name ||
                (submitterId > 0 ? `User ID ${submitterId}` : 'Submitter');

              const dateVal =
                log.createdAt || log.created_at || log.effectiveDate || log.effective_date;

              const prevProg = Number(log.previousProgress ?? log.previous_progress ?? 0);
              const repProg = Number(log.reportedProgress ?? log.reported_progress ?? 0);
              const eventType = log.eventType || log.event_type || 'TASK_COMPLETION';
              const reasonText = log.reason || '';

              return (
                <div
                  key={log.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: 18,
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {/* 1. Task Information */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '10px 14px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <AppstoreOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        Task Information
                      </span>
                    </div>
                    <div style={{ padding: '14px 16px', backgroundColor: '#ffffff' }}>
                      <Row gutter={16} align="middle">
                        <Col span={16}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Task
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>
                            {taskTitle}
                          </div>
                        </Col>
                        <Col span={8} style={{ borderLeft: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Type
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <Tag
                              style={{
                                backgroundColor: '#fffbeb',
                                borderColor: '#fef3c7',
                                color: '#b45309',
                                fontWeight: 600,
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 4,
                                margin: 0,
                              }}
                            >
                              {eventType}
                            </Tag>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>

                  {/* 2. Request Details */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '10px 14px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UserOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        Request Details
                      </span>
                    </div>
                    <div style={{ padding: '14px 16px', backgroundColor: '#ffffff' }}>
                      <Row gutter={16} align="middle">
                        <Col span={12}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Requested By
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>
                            {submitterDisplay}
                          </div>
                        </Col>
                        <Col span={12} style={{ borderLeft: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <CalendarOutlined style={{ fontSize: 18, color: '#64748b' }} />
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Request Date
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                                {dateVal ? dayjs(dateVal).format('DD MMM YYYY HH:mm') : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>

                  {/* 3. Progress Change */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '10px 14px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BarChartOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        Progress Change
                      </span>
                    </div>
                    <div style={{ padding: '14px 16px', backgroundColor: '#ffffff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                            Previous Progress
                          </div>
                          <div
                            style={{
                              padding: '5px 14px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              fontSize: 14,
                              fontWeight: 600,
                              color: '#1e293b',
                              display: 'inline-block',
                            }}
                          >
                            {prevProg}%
                          </div>
                        </div>

                        <div style={{ marginTop: 18, color: '#94a3b8', fontSize: 16 }}>
                          <ArrowRightOutlined />
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                            New Progress
                          </div>
                          <div
                            style={{
                              padding: '5px 14px',
                              backgroundColor: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: 6,
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#2563eb',
                              display: 'inline-block',
                            }}
                          >
                            {repProg}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Reason / Remarks */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '10px 14px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MessageOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        Reason / Remarks
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px', backgroundColor: '#ffffff' }}>
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #f1f5f9',
                          borderRadius: 6,
                          fontSize: 13,
                          color: reasonText ? '#1e293b' : '#94a3b8',
                          lineHeight: 1.5,
                        }}
                      >
                        {reasonText || 'Belum ada data'}
                      </div>
                    </div>
                  </div>

                  {/* 5. Supporting Evidence */}
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '10px 14px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PaperClipOutlined style={{ fontSize: 12, color: '#2563eb' }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        Supporting Evidence
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px', backgroundColor: '#ffffff' }}>
                      {log.evidence && log.evidence.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {log.evidence.map((ev: any) => {
                            const docId = ev.documentId || ev.document_id || ev.id;
                            const fileName = ev.fileName || ev.file_name || `Document #${docId}`;
                            
                            const metaParts: string[] = [];
                            const mimeLabel = formatMimeType(ev.mimeType, fileName);
                            if (mimeLabel) metaParts.push(mimeLabel);
                            const sizeLabel = formatFileSize(ev.fileSize);
                            if (sizeLabel) metaParts.push(sizeLabel);
                            if (ev.createdAt) metaParts.push(dayjs(ev.createdAt).format('DD MMM YYYY HH:mm'));

                            return (
                              <div
                                key={ev.id || docId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 8,
                                  gap: 12,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: 6,
                                      backgroundColor: '#eff6ff',
                                      border: '1px solid #dbeafe',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {getEvidenceIcon(ev.mimeType, fileName)}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: '#0f172a',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={fileName}
                                    >
                                      {fileName}
                                    </div>
                                    {metaParts.length > 0 && (
                                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                        {metaParts.join(' • ')}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <Button
                                  icon={<DownloadOutlined />}
                                  style={{
                                    borderColor: '#bfdbfe',
                                    color: '#2563eb',
                                    backgroundColor: '#ffffff',
                                    fontWeight: 500,
                                    borderRadius: 6,
                                    fontSize: 12,
                                    height: 32,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    flexShrink: 0,
                                  }}
                                  loading={downloadingDocId === docId}
                                  onClick={() => handleDownloadEvidence(docId, fileName)}
                                >
                                  Download
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ padding: '8px 0', color: '#94a3b8', fontSize: 13 }}>
                          Belum ada data bukti pendukung.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 6. Footer Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 12,
                      marginTop: 4,
                      paddingTop: 12,
                    }}
                  >
                    {isSubmitter && canVerify && (
                      <Text type="warning" style={{ fontSize: 12, marginRight: 'auto' }}>
                        You cannot verify your own submission (SoD).
                      </Text>
                    )}
                    <Space size={12}>
                      <Button
                        icon={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
                        disabled={!allowVerify || verifyingLogId === log.id || isSubmittingReject}
                        onClick={() => handleRejectClick(log.id)}
                        style={{
                          borderColor: '#fca5a5',
                          color: '#dc2626',
                          backgroundColor: '#ffffff',
                          borderRadius: 6,
                          fontWeight: 500,
                          height: 36,
                          padding: '0 16px',
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        disabled={!allowVerify}
                        loading={verifyingLogId === log.id && !isRejectModalOpen}
                        onClick={() => handleApprove(log.id)}
                        style={{
                          backgroundColor: '#2563eb',
                          borderColor: '#2563eb',
                          borderRadius: 6,
                          fontWeight: 500,
                          height: 36,
                          padding: '0 20px',
                        }}
                      >
                        Approve
                      </Button>
                    </Space>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Drawer>

      <Modal
        title="Reject Progress Claim"
        open={isRejectModalOpen}
        onCancel={() => {
          setIsRejectModalOpen(false);
          setSelectedRejectLogId(null);
          setIsSubmittingReject(false);
          rejectForm.resetFields();
        }}
        onOk={() => rejectForm.submit()}
        confirmLoading={isSubmittingReject}
        okButtonProps={{ danger: true }}
        okText="Reject Claim"
      >
        <Form form={rejectForm} layout="vertical" onFinish={submitReject}>
          <Form.Item
            name="reason"
            label="Rejection Reason"
            rules={[{ required: true, message: 'Please provide a reason for rejection' }]}
          >
            <TextArea rows={4} placeholder="Explain why this claim is rejected..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

