import React, { useState, useMemo } from 'react';
import { Drawer, Typography, Spin, Tag, Avatar, Button, Space, Upload, Input } from 'antd';
import {
  BankOutlined,
  UserOutlined,
  EditOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  AuditOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { TenderActivityStream } from './TenderActivityStream';

const { Text } = Typography;
const { TextArea } = Input;

const COLUMNS = [
  { id: 'LEAD', title: 'Lead', color: '#1677ff' },
  { id: 'WAITING_GO_NO_GO', title: 'Waiting GO/NO-GO', color: '#d97706' },
  { id: 'QUALIFICATION', title: 'Qualification', color: '#13c2c2' },
  { id: 'PROPOSAL', title: 'Proposal', color: '#722ed1' },
  { id: 'NEGOTIATION', title: 'Negotiation', color: '#faad14' },
  { id: 'WON', title: 'Won', color: '#52c41a' },
  { id: 'LOST', title: 'Lost', color: '#f5222d' },
];

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'CRITICAL': return 'magenta';
    case 'HIGH': return 'red';
    case 'MEDIUM': return 'orange';
    case 'LOW': return 'green';
    default: return 'default';
  }
};

export interface TenderDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  tender: any;
  action?: string | null;
  isLoading?: boolean;
  targetTenderId?: number | null;

  // Optional interactive callbacks
  onOpenEditModal?: (tender: any) => void;
  onResubmitToPm?: (tender: any) => void;
  onUploadMissingSpk?: (file: File) => boolean | Promise<any>;
  onDiscountDecision?: (tenderId: number, isApproved: boolean) => Promise<void>;
  onDirectorDecision?: (tenderId: number, decision: 'GO' | 'NO_GO') => Promise<void>;
  onOpenGoNoGoSubmitModal?: (tender: any) => void;

  isUploading?: boolean;
  isResubmittingToPm?: boolean;
  isSubmittingDiscount?: boolean;
  isSubmittingDecision?: boolean;
  isSubmittingGoNoGo?: boolean;
  discountNotes?: string;
  setDiscountNotes?: (notes: string) => void;
  goNoGoNotes?: string;
  setGoNoGoNotes?: (notes: string) => void;
}

export const TenderDetailDrawer: React.FC<TenderDetailDrawerProps> = ({
  open,
  onClose,
  tender,
  action,
  isLoading = false,
  targetTenderId,
  onOpenEditModal,
  onResubmitToPm,
  onUploadMissingSpk,
  onDiscountDecision,
  onDirectorDecision,
  onOpenGoNoGoSubmitModal,
  isUploading = false,
  isResubmittingToPm = false,
  isSubmittingDiscount = false,
  isSubmittingDecision = false,
  isSubmittingGoNoGo = false,
  discountNotes,
  setDiscountNotes,
  goNoGoNotes,
  setGoNoGoNotes,
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const userRoles = useMemo(() => {
    if (authLoading || !user?.roles) return [];
    return (user.roles || []).map((r: any) => String(r.name || r).toUpperCase());
  }, [user, authLoading]);
  const isMarketing = userRoles.includes('MARKETING');
  const isDirectorOrExec = !authLoading && userRoles.some((r: string) => ['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(r));

  const [internalDiscountNotes, setInternalDiscountNotes] = useState('');
  const activeDiscountNotes = discountNotes !== undefined ? discountNotes : internalDiscountNotes;
  const handleDiscountNotesChange = (val: string) => {
    if (setDiscountNotes) {
      setDiscountNotes(val);
    } else {
      setInternalDiscountNotes(val);
    }
  };

  const [internalGoNoGoNotes, setInternalGoNoGoNotes] = useState('');
  const activeGoNoGoNotes = goNoGoNotes !== undefined ? goNoGoNotes : internalGoNoGoNotes;
  const handleGoNoGoNotesChange = (val: string) => {
    if (setGoNoGoNotes) {
      setGoNoGoNotes(val);
    } else {
      setInternalGoNoGoNotes(val);
    }
  };

  return (
    <Drawer
      title={<span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Detail Proyek</span>}
      placement="right"
      width={480}
      onClose={onClose}
      open={open}
      bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', overflow: 'hidden' }}
      headerStyle={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px', background: '#ffffff' }}
    >
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
          <Spin size="large" />
          <div style={{ fontSize: 13, color: '#64748b' }}>Memuat data tender #{targetTenderId || ''}...</div>
        </div>
      )}
      {!isLoading && tender && (
        <TenderActivityStream 
          tenderId={tender.id}
          tender={tender}
          headerContent={
            <div>
              {/* 1. PROJECT IDENTITY */}
              <div style={{ marginBottom: 16 }}>
                <Typography.Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 700, fontSize: 18, lineHeight: 1.35 }}>
                  {tender.title}
                </Typography.Title>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                  <BankOutlined style={{ color: '#3b82f6' }} />
                  <span>{tender.customer?.name || `Client ID: ${tender.customer_id}`}</span>
                </div>
              </div>

              {/* 2. KEY METRICS */}
              <div style={{ 
                background: '#ffffff', 
                borderRadius: 12, 
                padding: '16px', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                marginBottom: 16
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                      PIC Marketing
                    </Text>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <Avatar size={20} icon={<UserOutlined />} style={{ background: '#3b82f6', marginRight: 6 }} />
                      <Text strong style={{ color: '#1e3a8a', fontSize: 13 }}>
                        {tender.marketing_pic_name || 'Belum Ditentukan'}
                      </Text>
                    </div>
                  </div>

                  <div>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                      Budget Awal
                    </Text>
                    <div style={{ fontWeight: 700, color: '#334155', marginTop: 4, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      Rp {Number(tender.estimated_budget != null && !isNaN(Number(tender.estimated_budget)) ? tender.estimated_budget : 0).toLocaleString('id-ID')}
                    </div>
                  </div>

                  {tender.negotiated_price != null && !isNaN(Number(tender.negotiated_price)) && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                        Harga Negosiasi
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontWeight: 700, color: '#10b981', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                          Rp {Number(tender.negotiated_price).toLocaleString('id-ID')}
                        </span>
                        {tender.status === 'PENDING_APPROVAL' && (
                          <Tag color="orange" style={{ margin: 0, fontSize: 11, padding: '0 6px', borderRadius: 4, fontWeight: 600 }}>
                            Menunggu Approval
                          </Tag>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                      Prioritas
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag color={getPriorityColor(tender.priority)} style={{ borderRadius: 4, border: 'none', fontWeight: 600, fontSize: 11 }}>
                        {tender.priority || 'MEDIUM'}
                      </Tag>
                    </div>
                  </div>

                  <div>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                      Probabilitas
                    </Text>
                    <div style={{ marginTop: 4, fontWeight: 700, color: '#0284c7', fontSize: 14 }}>
                      {tender.probability_percentage ?? 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. CURRENT STATUS */}
              <div style={{ 
                background: '#ffffff', 
                borderRadius: 12, 
                padding: '12px 16px', 
                border: '1px solid #e2e8f0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: 16
              }}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>STATUS SAAT INI</Text>
                <Tag 
                  color={COLUMNS.find(c => c.id === tender.stage)?.color || 'blue'}
                  style={{ borderRadius: 6, padding: '2px 12px', fontWeight: 700, fontSize: 12, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  {tender.stage}
                </Tag>
              </div>

              {/* 4. CRITICAL ACTION / BLOCKER */}
              {/* CASE B: PM RETURN */}
              {tender.contract_status === 'PM_RETURNED' && (
                <div style={{ 
                  marginBottom: 16, 
                  background: '#fffbe6', 
                  padding: '14px 16px', 
                  borderRadius: 12, 
                  border: '1px solid #ffe58f', 
                  boxShadow: '0 2px 6px rgba(217,119,6,0.08)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Text strong style={{ color: '#d97706', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ExclamationCircleOutlined /> Project Charter Dikembalikan oleh PM
                      </Text>
                      <Text style={{ fontSize: 12, color: '#92400e', marginTop: 2, display: 'block' }}>
                        Project Manager mengembalikan charter untuk penyesuaian operasional/anggaran.
                      </Text>
                    </div>
                    <Space size={8} style={{ flexShrink: 0, marginTop: 4 }}>
                      <Button 
                        size="small" 
                        icon={<EditOutlined />} 
                        onClick={() => onOpenEditModal && onOpenEditModal(tender)}
                        style={{ borderColor: '#d97706', color: '#d97706', borderRadius: 6, fontWeight: 600 }}
                      >
                        Edit Proyek / RAB
                      </Button>
                      <Button 
                        type="primary" 
                        size="small" 
                        icon={<SendOutlined />} 
                        loading={isResubmittingToPm}
                        onClick={() => onResubmitToPm && onResubmitToPm(tender)}
                        style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', borderRadius: 6, fontWeight: 600 }}
                      >
                        Ajukan Ulang ke PM
                      </Button>
                    </Space>
                  </div>
                  {tender.legal_notes && (
                    <div style={{ marginTop: 10, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fef3c7' }}>
                      <Text type="secondary" style={{ fontSize: 11, color: '#d97706', fontWeight: 600, display: 'block', marginBottom: 2 }}>Catatan Project Manager:</Text>
                      <Text italic style={{ color: '#78350f', fontSize: 12 }}>"{tender.legal_notes}"</Text>
                    </div>
                  )}
                </div>
              )}

              {/* CASE A: LEGAL REVISION */}
              {tender.contract_status !== 'PM_RETURNED' && tender.legal_status === 'REVISION_REQUESTED' && (
                <div style={{ 
                  marginBottom: 16, 
                  background: '#fef2f2', 
                  padding: '14px 16px', 
                  borderRadius: 12, 
                  border: '1px solid #fecaca', 
                  boxShadow: '0 2px 6px rgba(239,68,68,0.08)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <Text strong style={{ color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ExclamationCircleOutlined /> Revisi SPK Dibutuhkan
                      </Text>
                      <Text style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2, display: 'block' }}>
                        Tim Legal menolak dokumen SPK terakhir.
                      </Text>
                    </div>
                    <Upload showUploadList={false} beforeUpload={onUploadMissingSpk} accept=".pdf,.xls,.xlsx,.doc,.docx">
                      <Button type="primary" danger size="small" icon={<UploadOutlined />} loading={isUploading} style={{ borderRadius: 6, fontWeight: 600 }}>
                        Upload Revisi SPK
                      </Button>
                    </Upload>
                  </div>
                  {tender.legal_notes && (
                    <div style={{ marginTop: 10, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fee2e2' }}>
                      <Text type="secondary" style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600, display: 'block', marginBottom: 2 }}>Catatan Legal:</Text>
                      <Text italic style={{ color: '#991b1b', fontSize: 12 }}>"{tender.legal_notes}"</Text>
                    </div>
                  )}
                </div>
              )}

              {tender.stage === 'WON' && !tender.spk_file_key && tender.legal_status !== 'REVISION_REQUESTED' && tender.contract_status !== 'PM_RETURNED' && (
                <div style={{ 
                  marginBottom: 16, 
                  background: '#fffbe6', 
                  padding: '14px 16px', 
                  borderRadius: 12, 
                  border: '1px solid #ffe58f', 
                  boxShadow: '0 2px 6px rgba(245,158,11,0.08)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <Text strong style={{ color: '#d46b08', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ExclamationCircleOutlined /> SPK Belum Diunggah
                      </Text>
                      <Text style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2, display: 'block' }}>
                        Grace period sedang berjalan. Unggah dokumen SPK untuk memulai review Legal.
                      </Text>
                    </div>
                    <Upload showUploadList={false} beforeUpload={onUploadMissingSpk} accept=".pdf,.xls,.xlsx,.doc,.docx">
                      <Button type="primary" size="small" icon={<UploadOutlined />} loading={isUploading} style={{ background: '#faad14', borderColor: '#faad14', borderRadius: 6, fontWeight: 600 }}>
                        Upload SPK
                      </Button>
                    </Upload>
                  </div>
                </div>
              )}

              {/* CASE C: DISCOUNT APPROVAL */}
              {isDirectorOrExec && tender.status === 'PENDING_APPROVAL' && (
                <div style={{ 
                  marginBottom: 16, 
                  background: '#fff7ed', 
                  padding: '16px', 
                  borderRadius: 12, 
                  border: '1px solid #fed7aa',
                  boxShadow: '0 2px 8px rgba(194, 65, 12, 0.06)' 
                }}>
                  <Text strong style={{ color: '#c2410c', fontSize: 14, display: 'block', marginBottom: 8 }}>
                    PERSETUJUAN DISKON (DISCOUNT APPROVAL)
                  </Text>
                  
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, background: '#ffffff', padding: '10px 12px', borderRadius: 8, border: '1px solid #ffedd5' }}>
                    <div><strong>Tender:</strong> {tender.title}</div>
                    <div><strong>Customer:</strong> {tender.customer?.name || `Client ID: ${tender.customer_id}`}</div>
                    <div><strong>Budget Awal:</strong> Rp {Number(tender.estimated_budget != null && !isNaN(Number(tender.estimated_budget)) ? tender.estimated_budget : 0).toLocaleString('id-ID')}</div>
                    <div><strong>Harga Negosiasi:</strong> Rp {Number(tender.negotiated_price != null && !isNaN(Number(tender.negotiated_price)) ? tender.negotiated_price : 0).toLocaleString('id-ID')}</div>
                    {tender.estimated_budget && tender.negotiated_price && (
                      <div style={{ marginTop: 4 }}>
                        <strong>Diskon Diajukan:</strong> {(((Number(tender.estimated_budget) - Number(tender.negotiated_price)) / Number(tender.estimated_budget)) * 100).toFixed(1)}% <Tag color="orange" style={{ fontSize: 10, marginLeft: 4 }}>Batas Wewenang: {tender.max_discount_rate || 20}%</Tag>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      Catatan Persetujuan Diskon (Opsional):
                    </Text>
                    <TextArea 
                      rows={2} 
                      placeholder="Berikan alasan atau catatan persetujuan/penolakan diskon..."
                      value={activeDiscountNotes}
                      onChange={(e) => handleDiscountNotesChange(e.target.value)}
                      disabled={isSubmittingDiscount}
                      style={{ borderRadius: 6 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button 
                      danger 
                      size="small" 
                      loading={isSubmittingDiscount}
                      onClick={() => onDiscountDecision && onDiscountDecision(tender.id, false)}
                      style={{ borderRadius: 6, fontWeight: 600 }}
                    >
                      Tolak Diskon
                    </Button>
                    <Button 
                      type="primary" 
                      size="small" 
                      loading={isSubmittingDiscount}
                      onClick={() => onDiscountDecision && onDiscountDecision(tender.id, true)}
                      style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 6, fontWeight: 600 }}
                    >
                      Setujui Diskon
                    </Button>
                  </div>
                </div>
              )}

              {isDirectorOrExec && (action === 'go-nogo' || tender.stage === 'WAITING_GO_NO_GO') && (tender.go_nogo_status === 'PENDING' || !tender.go_nogo_status) && (() => {
                const pack = tender.decisionPack || tender.decision_pack || tender.goNoGoReview || tender.go_nogo_review || null;
                const executiveSummary = pack?.executiveSummary || null;
                const keyConcerns = Array.isArray(pack?.keyConcerns) ? pack.keyConcerns : null;
                const readiness = pack?.readiness || null;
                const marketingRecommendation = pack?.marketingRecommendation || pack?.recommendation || null;
                const marketingRecommendationReason = pack?.marketingRecommendationReason || pack?.recommendationReason || null;
                const submitter = pack?.submittedBy || tender.go_nogo_submitted_by_name || tender.submitted_by_name || tender.submittedByName || null;
                const submittedAt = pack?.submittedAt || tender.go_nogo_submitted_at || tender.submitted_at || tender.submittedAt || null;

                return (
                  <div style={{ 
                    marginBottom: 16, 
                    background: '#ffffff', 
                    padding: '16px', 
                    borderRadius: 12, 
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
                  }}>
                    {/* HEADER */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1d4ed8',
                        fontSize: 18,
                        border: '1px solid #bfdbfe',
                        flexShrink: 0
                      }}>
                        <AuditOutlined />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, letterSpacing: 0.2 }}>
                          GO / NO-GO EXECUTIVE REVIEW
                        </div>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                          Review Executive Decision Pack yang diajukan oleh Marketing.
                        </div>
                      </div>
                    </div>
                    
                    {/* PROJECT SUMMARY CARD */}
                    <div style={{
                      marginBottom: 14,
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      padding: '12px 14px',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5, lineHeight: 1.35 }}>
                            {tender.title}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2, fontWeight: 500 }}>
                            {tender.customer?.name || (tender.customer_id ? `Client ID: ${tender.customer_id}` : 'Customer')}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          {tender.priority && (
                            <Tag 
                              color={tender.priority === 'HIGH' ? 'red' : tender.priority === 'MEDIUM' ? 'orange' : 'blue'}
                              style={{ fontWeight: 600, borderRadius: 4, margin: 0, fontSize: 11 }}
                            >
                              {tender.priority}
                            </Tag>
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: 8,
                        background: '#ffffff',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #f1f5f9',
                      }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Opportunity Value
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginTop: 1 }}>
                            Rp {(Number(tender.estimated_budget) || 0).toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Bid Deadline
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginTop: 1 }}>
                            {(tender.bid_submission_deadline || tender.submission_deadline)
                              ? dayjs(tender.bid_submission_deadline || tender.submission_deadline).format('DD MMM YYYY')
                              : '-'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            PIC Marketing
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {tender.marketing_pic_name || tender.marketingPicName || '-'}
                          </div>
                        </div>
                        {tender.business_sector && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Sector
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#475569', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tender.business_sector}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 1 — RINGKASAN EKSEKUTIF */}
                    {executiveSummary && (
                      <div style={{
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: '12px 14px',
                        marginBottom: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #bfdbfe'
                          }}>1</span>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                            Ringkasan Eksekutif
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12.5,
                          color: '#1e293b',
                          background: '#f8fafc',
                          padding: '10px 12px',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          borderLeft: '3px solid #2563eb',
                          lineHeight: 1.55,
                          marginLeft: 28,
                        }}>
                          {executiveSummary}
                        </div>
                      </div>
                    )}

                    {/* SECTION 2 — CONCERN UTAMA */}
                    {keyConcerns && keyConcerns.length > 0 && (
                      <div style={{
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: '12px 14px',
                        marginBottom: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#fffbeb',
                            color: '#b45309',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #fde68a'
                          }}>2</span>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                            Concern Utama
                          </span>
                        </div>

                        <div style={{ marginLeft: 28 }}>
                          {keyConcerns[0] === 'Tidak ada concern material' ? (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              fontSize: 12,
                              color: '#475569',
                              fontWeight: 500
                            }}>
                              <CheckCircleOutlined style={{ color: '#16a34a' }} />
                              <span>Tidak ada concern material</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {keyConcerns.slice(0, 3).map((concern: string, idx: number) => (
                                <div key={idx} style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  fontSize: 12.5,
                                  color: '#334155',
                                  background: '#f8fafc',
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #f1f5f9'
                                }}>
                                  <span style={{ fontWeight: 700, color: '#b45309', minWidth: 16 }}>{idx + 1}.</span>
                                  <span style={{ lineHeight: 1.45 }}>{concern}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SECTION 3 — KESIAPAN OPPORTUNITY */}
                    {readiness && (
                      <div style={{
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: '12px 14px',
                        marginBottom: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#f0fdf4',
                            color: '#15803d',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #bbf7d0'
                          }}>3</span>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                            Kesiapan Opportunity
                          </span>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: 8,
                          marginLeft: 28,
                        }}>
                          {/* CARD A: Customer Requirement */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            padding: '8px 10px',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
                              Kebutuhan Customer
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                              (Customer Requirement)
                            </div>
                            <Tag
                              color={
                                readiness.customerRequirement === 'CLEAR' ? 'success' :
                                readiness.customerRequirement === 'PARTIAL' ? 'warning' : 'error'
                              }
                              style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}
                            >
                              {readiness.customerRequirement}
                            </Tag>
                          </div>

                          {/* CARD B: Commercial Information */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            padding: '8px 10px',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
                              Informasi Komersial
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                              (Commercial Information)
                            </div>
                            <Tag
                              color={
                                readiness.commercialInformation === 'READY' ? 'success' :
                                readiness.commercialInformation === 'PARTIAL' ? 'warning' : 'error'
                              }
                              style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}
                            >
                              {readiness.commercialInformation}
                            </Tag>
                          </div>

                          {/* CARD C: Timeline */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            padding: '8px 10px',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>
                              Timeline Proyek
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                              (Project Schedule)
                            </div>
                            <Tag
                              color={readiness.timeline === 'FEASIBLE' ? 'success' : 'error'}
                              style={{ fontWeight: 700, fontSize: 11, borderRadius: 4, margin: 0 }}
                            >
                              {readiness.timeline}
                            </Tag>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SECTION 4 — REKOMENDASI MARKETING */}
                    {(() => {
                      const rec = marketingRecommendation;
                      const reason = marketingRecommendationReason;
                      if (!rec && !reason) return null;
                      return (
                        <div style={{
                          background: '#ffffff',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          padding: '12px 14px',
                          marginBottom: 12,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: '#f5f3ff',
                              color: '#7c3aed',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #ddd6fe'
                            }}>4</span>
                            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                              Rekomendasi Marketing
                            </span>
                          </div>

                          <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {rec && (
                              <div>
                                <Tag 
                                  color={rec === 'GO' ? 'success' : 'warning'}
                                  style={{ fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 4, margin: 0 }}
                                >
                                  {rec === 'GO' ? 'GO — LANJUTKAN' : 'REVIEW — PERLU TINJAUAN KHUSUS'}
                                </Tag>
                              </div>
                            )}
                            {reason && (
                              <div style={{
                                background: '#f8fafc',
                                padding: '8px 12px',
                                borderRadius: 6,
                                border: '1px solid #f1f5f9',
                                fontSize: 12,
                                color: '#334155',
                                fontStyle: 'italic',
                                lineHeight: 1.5
                              }}>
                                "{reason}"
                              </div>
                            )}
                            <div style={{
                              fontSize: 11,
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}>
                              <InfoCircleOutlined style={{ color: '#3b82f6', fontSize: 12 }} />
                              <span>Rekomendasi ini bersifat advisory dari Marketing. Keputusan final GO / NO-GO sepenuhnya berada pada Direksi.</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* LEGACY FALLBACK: If no decisionPack, show notes if present */}
                    {!pack && tender.notes && (
                      <div style={{
                        background: '#ffffff',
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: '12px 14px',
                        marginBottom: 12,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#475569', marginBottom: 6 }}>
                          Catatan / Notes Pengajuan
                        </div>
                        <div style={{ fontSize: 12, color: '#334155', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #f1f5f9' }}>
                          "{tender.notes}"
                        </div>
                      </div>
                    )}

                    {/* SUBMISSION METADATA */}
                    {(submitter || submittedAt) && (
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        padding: '8px 12px',
                        marginBottom: 14,
                        fontSize: 11.5,
                        color: '#475569',
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        gap: 6
                      }}>
                        {submitter && (
                          <div><strong>Diajukan oleh:</strong> {submitter}</div>
                        )}
                        {submittedAt && (
                          <div><strong>Diajukan pada:</strong> {dayjs(submittedAt).format('DD MMM YYYY, HH:mm')}</div>
                        )}
                      </div>
                    )}

                    {/* DIRECTOR DECISION SECTION */}
                    <div style={{
                      background: '#ffffff',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      padding: '14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 6, color: '#334155', textTransform: 'uppercase' }}>
                        CATATAN KEPUTUSAN DIRECTOR
                      </Text>
                      <TextArea 
                        rows={2} 
                        placeholder="Berikan alasan atau catatan keputusan GO / NO-GO..."
                        value={activeGoNoGoNotes}
                        onChange={(e) => handleGoNoGoNotesChange(e.target.value)}
                        disabled={isSubmittingDecision}
                        style={{ borderRadius: 6, marginBottom: 12, fontSize: 13 }}
                      />

                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <Button 
                          danger 
                          size="middle" 
                          loading={isSubmittingDecision}
                          onClick={() => onDirectorDecision && onDirectorDecision(tender.id, 'NO_GO')}
                          style={{ borderRadius: 6, fontWeight: 600 }}
                        >
                          REJECT NO_GO
                        </Button>
                        <Button 
                          type="primary" 
                          size="middle" 
                          loading={isSubmittingDecision}
                          onClick={() => onDirectorDecision && onDirectorDecision(tender.id, 'GO')}
                          style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 6, fontWeight: 600 }}
                        >
                          APPROVE GO
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {isMarketing && tender.stage === 'LEAD' && tender.go_nogo_status !== 'GO' && (
                <div style={{ 
                  marginBottom: 16, 
                  background: '#eff6ff', 
                  padding: '12px 16px', 
                  borderRadius: 12, 
                  border: '1px solid #bfdbfe', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(59,130,246,0.06)'
                }}>
                  <div>
                    <Text strong style={{ color: '#1d4ed8', display: 'block', fontSize: 13 }}>
                      {tender.go_nogo_status === 'NO_GO' || tender.revision_status === 'REQUIRED'
                        ? 'Revisi GO / NO GO Review'
                        : 'GO / NO GO Gate Review'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#3b82f6' }}>
                      {tender.go_nogo_status === 'NO_GO' || tender.revision_status === 'REQUIRED'
                        ? 'Perbarui Executive Decision Pack dan ajukan kembali ke Direksi.'
                        : 'Lengkapi Executive Decision Pack dan ajukan tender ke Direksi.'}
                    </Text>
                  </div>
                  <Button 
                    type="primary" 
                    size="small" 
                    loading={isSubmittingGoNoGo}
                    onClick={() => onOpenGoNoGoSubmitModal && onOpenGoNoGoSubmitModal(tender)}
                    style={{ background: '#2563eb', borderColor: '#2563eb', borderRadius: 6, fontWeight: 600 }}
                  >
                    {tender.go_nogo_status === 'NO_GO' || tender.revision_status === 'REQUIRED'
                      ? 'Ajukan Ulang'
                      : 'Ajukan Review'}
                  </Button>
                </div>
              )}

              {/* 5. DECISION HISTORY */}
              {tender.go_nogo_status && tender.go_nogo_status !== 'PENDING' && (
                <div style={{ 
                  marginBottom: 16, 
                  background: tender.go_nogo_status === 'GO' ? '#f0fdf4' : '#fef2f2', 
                  padding: '14px 16px', 
                  borderRadius: 12, 
                  border: `1px solid ${tender.go_nogo_status === 'GO' ? '#bbf7d0' : '#fecaca'}` 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ color: tender.go_nogo_status === 'GO' ? '#166534' : '#991b1b', fontSize: 12, letterSpacing: 0.5 }}>
                      DECISION HISTORY (GO/NO-GO GATE)
                    </Text>
                    <Tag color={tender.go_nogo_status === 'GO' ? 'success' : 'error'} style={{ fontWeight: 700, borderRadius: 6 }}>
                      {tender.go_nogo_status}
                    </Tag>
                  </div>
                  
                  <div style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><strong>Status:</strong> {tender.go_nogo_status === 'GO' ? 'APPROVED (GO)' : 'REJECTED (NO GO)'}</div>
                    {(tender.go_nogo_by_name || tender.go_nogo_by) && (
                      <div><strong>Approved By:</strong> {tender.go_nogo_by_name || tender.go_nogo_user_name || `User ID: ${tender.go_nogo_by}`}</div>
                    )}
                    {tender.go_nogo_at && (
                      <div><strong>Decision Date:</strong> {dayjs(tender.go_nogo_at).format('DD MMM YYYY, HH:mm')}</div>
                    )}
                    {tender.go_nogo_notes && (
                      <div style={{ marginTop: 4, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                        <strong>Decision Notes:</strong> "{tender.go_nogo_notes}"
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          }
        />
      )}
    </Drawer>
  );
};
