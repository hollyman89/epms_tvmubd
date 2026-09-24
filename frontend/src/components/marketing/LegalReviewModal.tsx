"use client";

import React, { useState } from 'react';
import { Modal, Form, Select, Input, message } from 'antd';
import { apiClient } from '@/lib/axios';

const { Option } = Select;
const { TextArea } = Input;

export interface LegalReviewModalProps {
  open: boolean;
  contract: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LegalReviewModal: React.FC<LegalReviewModalProps> = ({
  open,
  contract,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLegalReview = async (values: any) => {
    if (!contract || !contract.proposal_id) {
      message.error('Invalid contract or missing proposal ID');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/legal/contracts/review', {
        proposalId: contract.proposal_id,
        legalStatus: values.legalStatus,
        legalNotes: values.legalNotes,
      });
      message.success('Legal review submitted successfully');
      form.resetFields();
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error submitting review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Legal Contract Review"
      open={open}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
    >
      <div style={{ marginBottom: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
        <p><strong>Contract No:</strong> {contract?.contract_number}</p>
        <p><strong>Customer:</strong> {contract?.customer?.name}</p>
        <p><strong>Proposal Amount:</strong> Rp {contract?.proposal?.proposed_amount || 0}</p>
      </div>
      <Form form={form} layout="vertical" onFinish={handleLegalReview}>
        <Form.Item name="legalStatus" label="Legal Decision" rules={[{ required: true }]}>
          <Select placeholder="Select Decision">
            <Option value="APPROVED">APPROVE Contract</Option>
            <Option value="REJECTED">REJECT Contract</Option>
            <Option value="ON_REVIEW">KEEP on Review</Option>
          </Select>
        </Form.Item>
        <Form.Item name="legalNotes" label="Legal Notes (Optional)">
          <TextArea rows={4} placeholder="Type any feedback or clauses to revise..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
