import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import axios from 'axios';

const { Option } = Select;

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
      
      const token = localStorage.getItem('access_token');
      await axios.patch(`http://localhost:4000/api/v1/customers/${customer.id}`, values, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
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
      title="Edit Customer"
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={isSubmitting}
      okText={isSubmitting ? "Menyimpan..." : "Update"}
      okButtonProps={{ disabled: isSubmitting }}
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item 
          name="name" 
          label="Name" 
          rules={[
            { required: true, message: 'Name wajib diisi' },
            { min: 3, message: 'Minimal 3 karakter' }
          ]}
        >
          <Input placeholder="Nama customer" />
        </Form.Item>

        <Form.Item 
          name="company" 
          label="Legal Company" 
          rules={[{ required: true, message: 'Legal Company wajib diisi' }]}
        >
          <Input placeholder="Legal Company" />
        </Form.Item>

        <Form.Item 
          name="contact_person" 
          label="Contact Person" 
          rules={[{ required: true, message: 'Contact Person wajib diisi' }]}
        >
          <Input placeholder="Contact Person" />
        </Form.Item>

        <Form.Item 
          name="phone" 
          label="Phone Number" 
          rules={[
            { required: true, message: 'Phone wajib diisi' },
            { pattern: /^(\+62|0)[0-9]{9,14}$/, message: 'Format nomor telepon Indonesia tidak valid (+62 atau 0)' }
          ]}
        >
          <Input placeholder="Contoh: 08123456789" />
        </Form.Item>

        <Form.Item 
          name="email" 
          label="Email Address" 
          rules={[{ type: 'email', message: 'Format email tidak valid' }]}
        >
          <Input placeholder="email@company.com" />
        </Form.Item>

        <Form.Item 
          name="business_sector" 
          label="Business Sector"
        >
          <Select placeholder="Pilih sektor" allowClear>
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
          label="Status"
        >
          <Select placeholder="Pilih status" allowClear>
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
