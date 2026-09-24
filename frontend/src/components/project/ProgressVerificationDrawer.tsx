'use client';

import React, { useState } from 'react';
import { Drawer, Typography, Button, Space, Card, Tag, Modal, Input, message, Form, Row, Col } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { ProjectService } from '@/services';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
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

  const handleRejectClick = (logId: number) => {
    setVerifyingLogId(logId);
    setIsRejectModalOpen(true);
  };

  const submitReject = async (values: { reason: string }) => {
    if (!verifyingLogId) return;
    try {
      await ProjectService.verifyProgressLog(projectId, verifyingLogId, { 
        decision: 'REJECT', 
        rejectionReason: values.reason 
      });
      message.success('Progress claim rejected');
      setIsRejectModalOpen(false);
      rejectForm.resetFields();
      onSuccess();
    } catch (error: any) {
      console.error('Failed to reject claim:', error);
      message.error(error?.response?.data?.message || 'Failed to reject claim');
    } finally {
      setVerifyingLogId(null);
    }
  };

  return (
    <>
      <Drawer
        title="Verify Pending Progress Claims"
        width={600}
        open={isOpen}
        onClose={onClose}
      >
        {pendingLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">No pending progress claims to verify.</Text>
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {pendingLogs.map((log) => {
              // SoD Rule: Submitter cannot verify their own claim
              const isSubmitter = log.submittedBy === currentUserId;
              const allowVerify = canVerify && !isSubmitter;

              return (
                <Card key={log.id} size="small" title={`Task: ${log.taskName || log.taskCode}`}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Row>
                      <Col span={12}>
                        <Text type="secondary">Requested By:</Text>
                        <div><Text strong>{log.submitterName || `User ID ${log.submittedBy}`}</Text></div>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Date:</Text>
                        <div><Text>{dayjs(log.createdAt).format('DD MMM YYYY HH:mm')}</Text></div>
                      </Col>
                    </Row>
                    
                    <Row style={{ marginTop: 8 }}>
                      <Col span={12}>
                        <Text type="secondary">Progress Change:</Text>
                        <div>
                          <Tag color="default">{log.previousProgress}%</Tag>
                          {' -> '}
                          <Tag color="processing">{log.reportedProgress}%</Tag>
                        </div>
                      </Col>
                      <Col span={12}>
                        <Text type="secondary">Type:</Text>
                        <div><Tag color={log.progressDelta < 0 ? 'error' : 'warning'}>{log.eventType}</Tag></div>
                      </Col>
                    </Row>

                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Reason / Remarks:</Text>
                      <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                        <Text>{log.reason}</Text>
                      </div>
                    </div>

                    {log.evidence && log.evidence.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">Evidence:</Text>
                        <div>
                          {log.evidence.map((ev: any) => (
                            <Button 
                              key={ev.id} 
                              type="link" 
                              icon={<FileTextOutlined />}
                              size="small"
                              style={{ padding: 0 }}
                              // In real implementation, this would trigger document download
                            >
                              {ev.fileName || `Document ${ev.documentId}`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      {isSubmitter && canVerify && (
                        <Text type="warning" style={{ marginRight: 16 }}>
                          You cannot verify your own submission (SoD).
                        </Text>
                      )}
                      <Space>
                        <Button 
                          danger 
                          icon={<CloseCircleOutlined />} 
                          disabled={!allowVerify || verifyingLogId === log.id}
                          onClick={() => handleRejectClick(log.id)}
                        >
                          Reject
                        </Button>
                        <Button 
                          type="primary" 
                          icon={<CheckCircleOutlined />}
                          disabled={!allowVerify}
                          loading={verifyingLogId === log.id && !isRejectModalOpen}
                          onClick={() => handleApprove(log.id)}
                        >
                          Approve
                        </Button>
                      </Space>
                    </div>
                  </Space>
                </Card>
              );
            })}
          </Space>
        )}
      </Drawer>

      <Modal
        title="Reject Progress Claim"
        open={isRejectModalOpen}
        onCancel={() => {
          setIsRejectModalOpen(false);
          setVerifyingLogId(null);
          rejectForm.resetFields();
        }}
        onOk={() => rejectForm.submit()}
        confirmLoading={verifyingLogId !== null && isRejectModalOpen}
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
