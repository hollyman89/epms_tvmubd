import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Row, Col, Space, Typography, message } from 'antd';

const { Option } = Select;
const { Text } = Typography;

export const BUSINESS_SECTORS = [
  'Telekomunikasi & Internet',
  'Teknologi Informasi & Software',
  'Perbankan & Keuangan',
  'Energi & Sumber Daya Mineral',
  'Konstruksi & Infrastruktur',
  'Manufaktur & Industri',
  'Pemerintahan & BUMN',
  'Kesehatan & Farmasi',
  'Pendidikan',
  'Properti & Real Estate',
  'Pariwisata & Perhotelan'
];

export interface CustomerFormPayload {
  name: string;
  company?: string;
  contact_person: string;
  phone: string;
  email?: string;
  business_sector?: string;
  city?: string;
  status?: string;
  marketing_pic_id?: number | null;
}

export interface MarketingPic {
  id: number;
  full_name: string;
}

export interface CustomerFormProps {
  onSubmit: (payload: CustomerFormPayload) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  marketingPics?: MarketingPic[];
  userRole?: string | null;
  submitText?: string;
}

export const CustomerForm: React.FC<CustomerFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting = false,
  marketingPics = [],
  userRole,
  submitText = 'Simpan Customer',
}) => {
  const [form] = Form.useForm();
  const [isCustomSector, setIsCustomSector] = useState<boolean>(false);

  useEffect(() => {
    form.setFieldsValue({
      status: userRole === 'MARKETING' ? 'PROSPECT' : 'Active'
    });
  }, [userRole, form]);

  const handleFinish = async () => {
    try {
      const values = await form.validateFields();

      const payload: CustomerFormPayload = {
        ...values,
        business_sector: values.business_sector_select === 'Lainnya' 
          ? values.business_sector_custom 
          : values.business_sector_select,
        marketing_pic_id: values.marketing_pic_id ? Number(values.marketing_pic_id) : null
      };

      delete (payload as any).business_sector_select;
      delete (payload as any).business_sector_custom;

      await onSubmit(payload);
    } catch (error: any) {
      if (error.errorFields) {
        message.error('Harap perbaiki isian form yang ditandai dengan warna merah.');
        return;
      }
      throw error;
    }
  };

  return (
    <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
      <Row gutter={[16, 12]}>
        <Col xs={24} sm={12}>
          <Form.Item name="name" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Customer Name</Text>} extra="Minimal 3 karakter" rules={[
            { required: true, message: 'Nama Customer wajib diisi' },
            { min: 3, message: 'Minimal 3 karakter' },
            { max: 100, message: 'Maksimal 100 karakter' }
          ]}>
            <Input placeholder="e.g. PT Teknologi Cerdas" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="company" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Legal Company</Text>} rules={[
            { required: true, message: 'Legal Company wajib diisi' },
            { min: 3, message: 'Minimal 3 karakter' },
            { max: 150, message: 'Maksimal 150 karakter' }
          ]}>
            <Input placeholder="e.g. PT Teknologi Cerdas Indonesia" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 12]}>
        <Col xs={24} sm={12}>
          <Form.Item name="contact_person" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Contact Person</Text>} rules={[{ required: true, message: 'Contact Person wajib diisi' }]}>
            <Input placeholder="Name of contact person" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="phone" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Phone Number</Text>} extra="Contoh: 081234567890 atau +6281234567890 (Min. 10 digit)" rules={[
            { required: true, message: 'Nomor Telepon wajib diisi' },
            { pattern: /^(0|\+62)[0-9]+$/, message: 'Hanya angka, diawali 0 atau +62' },
            { min: 10, message: 'Minimal 10 digit' },
            { max: 15, message: 'Maksimal 15 digit' }
          ]}>
            <Input placeholder="e.g. 08123456789" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 12]}>
        <Col xs={24} sm={12}>
          <Form.Item name="email" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Email Address</Text>} rules={[{ type: 'email', message: 'Format email tidak valid' }]}>
            <Input placeholder="email@company.com" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Business Sector</Text>} style={{ marginBottom: 0 }} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="business_sector_select" style={{ width: isCustomSector ? '40%' : '100%', margin: 0 }} rules={[{ required: true, message: 'Harap pilih sektor' }]}>
                <Select 
                  showSearch 
                  placeholder="Select Sector" 
                  dropdownMatchSelectWidth={false}
                  popupMatchSelectWidth={false}
                  dropdownStyle={{ borderRadius: 8 }}
                  style={{ borderRadius: 8 }}
                  onChange={(val) => setIsCustomSector(val === 'Lainnya')}
                >
                  {BUSINESS_SECTORS.map(sector => (
                    <Option key={sector} value={sector}>{sector}</Option>
                  ))}
                  <Option value="Lainnya">Lainnya</Option>
                </Select>
              </Form.Item>
              {isCustomSector && (
                <Form.Item name="business_sector_custom" style={{ width: '60%', margin: 0 }} rules={[{ required: true, message: 'Harap diisi' }]}>
                  <Input placeholder="Ketik sektor lain" style={{ borderRadius: 8 }} />
                </Form.Item>
              )}
            </Space.Compact>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 12]}>
        <Col span={8}>
          <Form.Item name="city" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>City</Text>}>
            <Input placeholder="e.g. Jakarta" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="status" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Status</Text>} initialValue="Active">
            <Select disabled={userRole === 'MARKETING'} dropdownStyle={{ borderRadius: 8 }} style={{ borderRadius: 8 }}>
              {userRole !== 'MARKETING' && <Option value="Active">Active</Option>}
              {userRole !== 'MARKETING' && <Option value="Inactive">Inactive</Option>}
              <Option value="PROSPECT">PROSPECT</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="marketing_pic_id" label={<Text strong style={{ fontSize: 12, color: '#334155' }}>Marketing PIC</Text>}>
            <Select placeholder="Select PIC" allowClear dropdownStyle={{ borderRadius: 8 }} style={{ borderRadius: 8 }}>
              {marketingPics.map(pic => (
                <Option key={pic.id} value={pic.id}>{pic.full_name}</Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row justify="end" gutter={12} style={{ marginTop: 24 }}>
        {onCancel && (
          <Col>
            <Button style={{ borderRadius: 8 }} onClick={onCancel} disabled={isSubmitting}>
              Batal
            </Button>
          </Col>
        )}
        <Col>
          <Button 
            type="primary" 
            loading={isSubmitting} 
            disabled={isSubmitting}
            onClick={handleFinish}
            style={{ 
              backgroundColor: '#1677ff', 
              borderColor: '#1677ff', 
              borderRadius: 8, 
              fontWeight: 600,
              boxShadow: '0 2px 6px rgba(22, 119, 255, 0.2)'
            }}
          >
            {isSubmitting ? "Menyimpan..." : submitText}
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default CustomerForm;
