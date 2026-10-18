import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message, Space, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/axios';

const { Option } = Select;
const { Text } = Typography;

interface EditCustomerModalProps {
  visible: boolean;
  customer: any;
  onClose: () => void;
  onSuccess: () => void;
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({ visible, customer, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && customer) {
      form.setFieldsValue({
        name: customer.name,
        company: customer.company,
        contact_person: customer.contact_person,
        phone: customer.phone,
        email: customer.email,
        business_sector: customer.business_sector,
        status: customer.status ? customer.status.toUpperCase() : undefined,
      });
    } else {
      form.resetFields();
    }
  }, [visible, customer, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);
      
      await apiClient.patch(`/customers/${customer.id}`, values);
      
      message.success('Customer berhasil diupdate');
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('Harap perbaiki isian form yang ditandai dengan warna merah.');
        return;
      }
      if (error.response) {
        message.error(error.response?.data?.message || 'Gagal mengupdate customer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space align="center" size={8}>
          <EditOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
            Edit Data Customer
          </Text>
        </Space>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={isSubmitting}
      okText={isSubmitting ? "Menyimpan..." : "Update Customer"}
      okButtonProps={{ 
        disabled: isSubmitting,
        style: {
          backgroundColor: '#2563eb',
          borderColor: '#2563eb',
          borderRadius: 8,
          fontWeight: 600,
        }
      }}
      cancelButtonProps={{
        style: { borderRadius: 8 }
      }}
      width={700}
      style={{ maxWidth: '95vw', top: 50 }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item 
          name="name" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Customer Name</Text>} 
          rules={[
            { required: true, message: 'Name wajib diisi' },
            { min: 3, message: 'Minimal 3 karakter' }
          ]}
        >
          <Input placeholder="Nama customer" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item 
          name="company" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Legal Company</Text>} 
          rules={[{ required: true, message: 'Legal Company wajib diisi' }]}
        >
          <Input placeholder="Legal Company" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item 
          name="contact_person" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Contact Person</Text>} 
          rules={[{ required: true, message: 'Contact Person wajib diisi' }]}
        >
          <Input placeholder="Contact Person" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item 
          name="phone" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Phone Number</Text>} 
          rules={[
            { required: true, message: 'Phone wajib diisi' },
            { pattern: /^(\+62|0)[0-9]{9,14}$/, message: 'Format nomor telepon Indonesia tidak valid (+62 atau 0)' }
          ]}
        >
          <Input placeholder="Contoh: 08123456789" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item 
          name="email" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Email Address</Text>} 
          rules={[{ type: 'email', message: 'Format email tidak valid' }]}
        >
          <Input placeholder="email@company.com" style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item 
          name="business_sector" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Business Sector</Text>}
        >
          <Select placeholder="Pilih sektor" allowClear dropdownStyle={{ borderRadius: 8 }} style={{ borderRadius: 8 }}>
            <Option value="Telekomunikasi & Internet">Telekomunikasi & Internet</Option>
            <Option value="Teknologi Informasi & Software">Teknologi Informasi & Software</Option>
            <Option value="Transportasi & Logistik">Transportasi & Logistik</Option>
            <Option value="Konstruksi">Konstruksi</Option>
            <Option value="Finansial">Finansial</Option>
            <Option value="Lainnya">Lainnya</Option>
          </Select>
        </Form.Item>

        <Form.Item 
          name="status" 
          label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Status</Text>}
        >
          <Select placeholder="Pilih status" allowClear dropdownStyle={{ borderRadius: 8 }} style={{ borderRadius: 8 }}>
            <Option value="ACTIVE">ACTIVE</Option>
            <Option value="INACTIVE">INACTIVE</Option>
            <Option value="PROSPECT">PROSPECT</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditCustomerModal;
