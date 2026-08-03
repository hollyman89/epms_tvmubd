"use client";
import React, { useState } from 'react';
import { Form, Input, InputNumber, Button, Card, Typography, Select, message } from 'antd';
import { ProcurementService } from '@/services';

const { Title } = Typography;

export default function CreatePRPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { itemName: string, quantity: number, estimatedUnitPrice: number }) => {
    setLoading(true);
    try {
      // Mapping values to API expected payload structure
      const payload = {
        projectId: 1, // hardcoded project ID for now
        totalEstimatedAmount: values.estimatedUnitPrice * values.quantity,
        items: [
          {
            itemName: values.itemName,
            quantity: values.quantity,
            estimatedUnitPrice: values.estimatedUnitPrice
          }
        ]
      };
      await ProcurementService.createPurchaseRequest(payload);
      message.success('Purchase Request berhasil dibuat!');
      form.resetFields();
    } catch (error) {
      console.error(error);
      message.error('Gagal membuat Purchase Request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <Title level={3} className="mb-6">Buat Purchase Request (PR)</Title>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item 
            label="Nama Item" 
            name="itemName" 
            rules={[{ required: true, message: 'Nama item wajib diisi' }]}
          >
            <Input placeholder="Masukkan nama barang/jasa" />
          </Form.Item>

          <Form.Item 
            label="Jumlah (Quantity)" 
            name="quantity" 
            rules={[{ required: true, message: 'Jumlah wajib diisi' }]}
          >
            <InputNumber min={1} className="w-full" placeholder="Masukkan jumlah" />
          </Form.Item>

          <Form.Item 
            label="Estimasi Harga Satuan" 
            name="estimatedUnitPrice" 
            rules={[{ required: true, message: 'Harga wajib diisi' }]}
          >
            <InputNumber min={0} className="w-full" placeholder="Contoh: 15000000" />
          </Form.Item>

          <Form.Item label="Vendor Rekomendasi (Opsional)" name="vendor">
            <Select placeholder="Pilih Vendor">
              <Select.Option value="1">PT Maju Bersama</Select.Option>
              <Select.Option value="2">CV Teknologi Indah</Select.Option>
              <Select.Option value="3">PT Global Karya</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item className="mt-8">
            <Button type="primary" htmlType="submit" loading={loading} block>
              Submit Purchase Request
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
