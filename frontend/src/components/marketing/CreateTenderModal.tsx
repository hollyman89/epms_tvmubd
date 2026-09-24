"use client";

import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Form, Input, InputNumber, DatePicker, Select, Steps, Button, Row, Col, Space, Typography, message } from 'antd';
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/axios';
import CustomerForm, { CustomerFormPayload } from '../CustomerForm';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const BUSINESS_SECTORS = [
  'Konstruksi / Building',
  'Infrastruktur / Civil',
  'Mekanikal & Elektrikal',
  'Teknologi Informasi & Telekomunikasi',
  'Energi & Pertambangan',
  'Minyak & Gas (Oil & Gas)',
  'Pengadaan Barang & Logistik',
  'Jasa Konsultasi / Professional Services',
  'Fasilitas Kesehatan / Farmasi',
  'Manufaktur & Industri',
];

export interface CreateTenderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (newTender?: any) => void;
  customers: any[];
  users: any[];
  currentUser?: any;
}

export const CreateTenderModal: React.FC<CreateTenderModalProps> = ({
  open,
  onClose,
  onSuccess,
  customers = [],
  users = [],
  currentUser,
}) => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isCustomSector, setIsCustomSector] = useState<boolean>(false);
  const [isCustomSource, setIsCustomSource] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Create Customer States
  const [customerList, setCustomerList] = useState<any[]>(customers);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState<boolean>(false);
  const [isQuickCreateSubmitting, setIsQuickCreateSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (customers) {
      setCustomerList(customers);
    }
  }, [customers]);

  const handleNext = async () => {
    try {
      await form.validateFields([
        'projectName',
        'estimatedBudget',
        'customerId',
        'expectedClosingDate',
        'bidSubmissionDeadline',
      ]);
      setCurrentStep(1);
    } catch (err) {
      // Validation error handled automatically by Ant Design Form
    }
  };

  const handleCustomerChange = (customerId: number) => {
    const selectedCustomer = customerList.find((c: any) => c.id === customerId);
    if (selectedCustomer) {
      const sector = selectedCustomer.business_sector;
      const isCustom = sector && !BUSINESS_SECTORS.includes(sector);
      setIsCustomSector(!!isCustom);

      form.setFieldsValue({
        picCustomerName: selectedCustomer.contact_person || selectedCustomer.name || '',
        picCustomerPhone: selectedCustomer.phone || '',
        picCustomerEmail: selectedCustomer.email || '',
        businessSectorSelect: isCustom ? 'Lainnya' : (sector || undefined),
        businessSectorCustom: isCustom ? sector : undefined,
      });
    }
  };

  const handleQuickCreateCustomer = async (payload: CustomerFormPayload) => {
    try {
      setIsQuickCreateSubmitting(true);
      const response = await apiClient.post('/customers', payload);
      const newCustomer = response.data?.data || response.data;
      
      if (!newCustomer || !newCustomer.id) {
        throw new Error('Data Customer baru tidak ditemukan pada response server');
      }

      message.success('Customer baru berhasil ditambahkan!');

      // 1. Tambahkan customer baru ke list lokal agar langsung ada di dropdown
      setCustomerList(prev => {
        const exists = prev.some(c => c.id === newCustomer.id);
        if (exists) return prev;
        return [newCustomer, ...prev];
      });

      // 2. Invalidate React Query cache agar sinkron dengan server di background
      queryClient.invalidateQueries({ queryKey: ['customers'] });

      // 3. Auto-select customerId di form utama Opportunity
      form.setFieldsValue({
        customerId: newCustomer.id,
      });

      // 4. Auto-fill data PIC & Sektor secara langsung
      const sector = newCustomer.business_sector;
      const isCustom = sector && !BUSINESS_SECTORS.includes(sector);
      setIsCustomSector(!!isCustom);

      form.setFieldsValue({
        picCustomerName: newCustomer.contact_person || newCustomer.name || '',
        picCustomerPhone: newCustomer.phone || '',
        picCustomerEmail: newCustomer.email || '',
        businessSectorSelect: isCustom ? 'Lainnya' : (sector || undefined),
        businessSectorCustom: isCustom ? sector : undefined,
      });

      // 5. Tutup modal Quick Create
      setIsQuickCreateOpen(false);
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.message || 'Gagal menambahkan customer baru');
      } else {
        message.error(error.message || 'Gagal menambahkan customer baru');
      }
    } finally {
      setIsQuickCreateSubmitting(false);
    }
  };

  const handleCreateTender = async (values: any) => {
    setIsSubmitting(true);
    const hide = message.loading('Saving opportunity...', 0);
    try {
      const payload = {
        customerId: Number(values.customerId),
        projectName: values.projectName,
        marketingPicId: values.marketingPicId ? Number(values.marketingPicId) : undefined,
        picCustomerName: values.picCustomerName,
        picCustomerPhone: values.picCustomerPhone,
        picCustomerEmail: values.picCustomerEmail,
        businessSector: values.businessSectorSelect === 'Lainnya' 
          ? values.businessSectorCustom 
          : values.businessSectorSelect,
        stage: values.stage || 'LEAD',
        probabilityPercentage: values.probabilityPercentage || 0,
        priority: values.priority || 'MEDIUM',
        source: values.sourceSelect === 'Lainnya' ? values.sourceCustom : values.sourceSelect,
        notes: values.notes,
        estimatedBudget: values.estimatedBudget,
        expectedClosingDate: values.expectedClosingDate ? values.expectedClosingDate.toISOString() : undefined,
        procurementType: values.procurementType || 'TENDER',
        projectLocation: values.projectLocation,
        bidSubmissionDeadline: values.bidSubmissionDeadline ? values.bidSubmissionDeadline.toISOString() : undefined,
      };

      const response = await apiClient.post('/marketing/tenders', payload);
      const resData = response.data?.data || response.data || {};

      hide();
      message.success('Tender berhasil dibuat!');
      form.resetFields();
      setCurrentStep(0);
      setIsCustomSector(false);
      setIsCustomSource(false);

      if (onSuccess) {
        onSuccess(resData);
      }
      onClose();
    } catch (err: any) {
      hide();
      const errMsg = err.response?.data?.message || 'Error creating opportunity';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create Marketing Opportunity"
      open={open}
      onCancel={() => {
        onClose();
        setCurrentStep(0);
      }}
      width={800}
      footer={[
        <Button key="back" onClick={onClose}>
          Cancel
        </Button>,
        currentStep > 0 && (
          <Button key="prev" onClick={() => setCurrentStep(currentStep - 1)}>
            Previous
          </Button>
        ),
        currentStep < 1 && (
          <Button key="next" type="primary" onClick={handleNext}>
            Next
          </Button>
        ),
        currentStep === 1 && (
          <Button key="submit" type="primary" onClick={() => form.submit()} loading={isSubmitting} disabled={isSubmitting}>
            Create Opportunity
          </Button>
        ),
      ].filter(Boolean)}
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Steps.Step title="Project Basic Info" />
        <Steps.Step title="Technical Details" />
      </Steps>

      <Form form={form} layout="vertical" onFinish={handleCreateTender}>
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="projectName" label="Project Name" rules={[{ required: true, message: 'Please enter project name' }]}>
                <Input placeholder="e.g. IT Infrastructure Project 2026" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="estimatedBudget" label="Estimated Budget (Rp)" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  addonBefore="Rp"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={value => value!.replace(/\./g, '') as any}
                  onKeyPress={(event) => {
                    if (!/[0-9]/.test(event.key)) {
                      event.preventDefault();
                    }
                  }}
                  placeholder="150.000.000"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Customer" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item 
                    name="customerId" 
                    noStyle 
                    rules={[{ required: true, message: 'Please select customer' }]}
                  >
                    <Select 
                      placeholder="Select Customer" 
                      showSearch 
                      optionFilterProp="children" 
                      onChange={handleCustomerChange}
                      style={{ width: 'calc(100% - 85px)' }}
                    >
                      {customerList.map((c: any) => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                    </Select>
                  </Form.Item>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsQuickCreateOpen(true)}
                    style={{ width: '85px', backgroundColor: '#1677ff', borderColor: '#1677ff', fontWeight: 600 }}
                  >
                    New
                  </Button>
                </Space.Compact>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="marketingPicId" label="Marketing PIC">
                <Select placeholder="Select PIC (Optional, defaults to you)" showSearch optionFilterProp="children" allowClear>
                  {users.map((u: any) => <Option key={u.id} value={u.id}>{u.full_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="expectedClosingDate" label="Expected Closing Date" rules={[{ required: true, message: 'Harap isi tanggal' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bidSubmissionDeadline" label="Bid Submission Deadline" rules={[{ required: true, message: 'Harap isi deadline' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                <Select>
                  <Option value="LOW">Low</Option>
                  <Option value="MEDIUM">Medium</Option>
                  <Option value="HIGH">High</Option>
                  <Option value="CRITICAL">Critical</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="procurementType" label="Procurement Type" initialValue="TENDER">
                <Select>
                  <Option value="TENDER">Tender</Option>
                  <Option value="DIRECT_APPOINTMENT">Direct Appointment</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="picCustomerName" label="PIC Customer Name" tooltip="Otomatis terisi dari Master Data Customer (SSOT)">
                <Input readOnly placeholder="Terisi otomatis saat memilih Customer" style={{ backgroundColor: '#f8fafc' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="picCustomerPhone" label="PIC Customer Phone" tooltip="Otomatis terisi dari Master Data Customer (SSOT)">
                <Input readOnly placeholder="Terisi otomatis saat memilih Customer" style={{ backgroundColor: '#f8fafc' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Business Sector" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', width: '100%' }}>
                  <Form.Item name="businessSectorSelect" style={{ width: isCustomSector ? '40%' : '100%', margin: 0 }}>
                    <Select
                      showSearch
                      placeholder="Select Sector"
                      dropdownMatchSelectWidth={false}
                      popupMatchSelectWidth={false}
                      onChange={(val) => setIsCustomSector(val === 'Lainnya')}
                    >
                      {BUSINESS_SECTORS.map(sector => (
                        <Option key={sector} value={sector}>{sector}</Option>
                      ))}
                      <Option value="Lainnya">Lainnya</Option>
                    </Select>
                  </Form.Item>
                  {isCustomSector && (
                    <Form.Item name="businessSectorCustom" style={{ width: '60%', margin: 0, paddingLeft: '8px' }} rules={[{ required: true, message: 'Harap diisi' }]}>
                      <Input placeholder="Ketik sektor lain" />
                    </Form.Item>
                  )}
                </div>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Source (Asal Prospek)" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', width: '100%' }}>
                  <Form.Item name="sourceSelect" initialValue="LPSE" style={{ width: isCustomSource ? '40%' : '100%', margin: 0 }}>
                    <Select onChange={(val) => setIsCustomSource(val === 'Lainnya')}>
                      <Option value="LPSE">LPSE / e-Procurement</Option>
                      <Option value="Referensi Internal">Referensi Internal</Option>
                      <Option value="Referensi Eksternal">Referensi Eksternal</Option>
                      <Option value="Direct Call / Email">Direct Call / Email</Option>
                      <Option value="Website / Social Media">Website / Social Media</Option>
                      <Option value="Lainnya">Lainnya</Option>
                    </Select>
                  </Form.Item>
                  {isCustomSource && (
                    <Form.Item name="sourceCustom" style={{ width: '60%', margin: 0, paddingLeft: '8px' }} rules={[{ required: true, message: 'Harap diisi' }]}>
                      <Input placeholder="Ketik sumber lain" />
                    </Form.Item>
                  )}
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="projectLocation" label="Project Location">
                <Input placeholder="e.g. Jakarta Selatan" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional details about this opportunity..." />
              </Form.Item>
            </Col>
          </Row>
        </div>
      </Form>

      {isQuickCreateOpen && (
        <Modal
          title={
            <Space align="center" size={8}>
              <UserAddOutlined style={{ color: '#1677ff', fontSize: 18 }} />
              <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
                Quick Create Customer
              </Text>
            </Space>
          }
          open={isQuickCreateOpen}
          onCancel={() => setIsQuickCreateOpen(false)}
          width={720}
          style={{ top: 40, maxWidth: '95vw' }}
          footer={null}
          destroyOnClose
        >
          <CustomerForm
            onSubmit={handleQuickCreateCustomer}
            onCancel={() => setIsQuickCreateOpen(false)}
            isSubmitting={isQuickCreateSubmitting}
            marketingPics={users}
            userRole={currentUser?.roles?.[0] || 'MARKETING'}
            submitText="Simpan Customer"
          />
        </Modal>
      )}
    </Modal>
  );
};
