import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, Typography, Tag, Avatar, Modal, Upload, Button, message, Input, InputNumber, Radio, Drawer, Spin, Dropdown, Form, Select, DatePicker, Space} from 'antd';
import { UserOutlined, ClockCircleOutlined, UploadOutlined, LockOutlined, ExclamationCircleOutlined, EditOutlined, DeleteOutlined, EyeOutlined, BankOutlined, SendOutlined } from '@ant-design/icons';
import { TenderActivityStream } from './TenderActivityStream';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '@/lib/axios';
import { queryClient, updateAllTenderCaches, removeTenderFromCache } from '../lib/queryClient';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.xls', '.xlsx', '.doc', '.docx'];
const ALLOWED_DOC_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const COLUMNS = [
  { id: 'LEAD', title: 'Lead', color: '#1677ff' },
  { id: 'WAITING_GO_NO_GO', title: 'Waiting GO/NO-GO', color: '#d97706' },
  { id: 'QUALIFICATION', title: 'Qualification', color: '#13c2c2' },
  { id: 'PROPOSAL', title: 'Proposal', color: '#722ed1' },
  { id: 'NEGOTIATION', title: 'Negotiation', color: '#faad14' },
  { id: 'WON', title: 'Won', color: '#52c41a' },
  { id: 'LOST', title: 'Lost', color: '#f5222d' },
];

const getStageBorderColor = (stage: string) => {
  switch (stage) {
    case 'LEAD': return '#3b82f6';
    case 'WAITING_GO_NO_GO': return '#f59e0b';
    case 'QUALIFICATION': return '#2dd4bf';
    case 'PROPOSAL': return '#8b5cf6';
    case 'NEGOTIATION': return '#eab308';
    case 'WON': return '#22c55e';
    case 'LOST': return '#ef4444';
    default: return '#e2e8f0';
  }
};

interface KanbanCardProps {
  item: any;
  colId: string;
  isDragging: boolean;
  highlightedTenderId: number | string | null;
  isSuperAdmin: boolean;
  onSelectCard: (item: any) => void;
  onOpenEditModal: (item: any) => void;
  onConfirmDelete: (item: any) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  item,
  colId,
  isDragging,
  highlightedTenderId,
  isSuperAdmin,
  onSelectCard,
  onOpenEditModal,
  onConfirmDelete,
}) => {
  const picName = item.marketing_pic_name && item.marketing_pic_name !== '-' && item.marketing_pic_name !== 'System'
    ? item.marketing_pic_name
    : (item.marketingPicName && item.marketingPicName !== '-' && item.marketingPicName !== 'System'
      ? item.marketingPicName
      : (item.marketing_pic?.full_name || 'Lukas Kurniawan (MARKETING)'));

  return (
    <Card 
      size="small" 
      bordered={true}
      onClick={() => onSelectCard(item)}
      style={{ 
        boxShadow: item.id === highlightedTenderId 
          ? '0 0 16px rgba(24, 144, 255, 0.6)' 
          : isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
        cursor: item.isLocked ? 'not-allowed' : 'pointer',
        borderRadius: 12,
        opacity: item.isLocked ? 0.7 : 1,
        border: item.id === highlightedTenderId
          ? '2px solid #1677ff'
          : item.isLocked ? '1px solid #ff4d4f' : '1px solid #e2e8f0',
        padding: '12px 12px 12px 12px',
        background: item.id === highlightedTenderId ? '#e6f4ff' : '#ffffff',
        borderLeft: `6px solid ${getStageBorderColor(item.stage || colId)}`,
        transition: 'all 0.3s ease'
      }}
      bodyStyle={{ padding: 0 }}
    >
      {/* HEADER (Baris Atas) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        {/* KIRI ATAS: Judul Proyek & Nama Klien */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: 1.3, wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={item.title}>
            {item.isLocked && <LockOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />}
            {item.title}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.customer?.name || `Client ID: ${item.customer_id}`}
          </div>
        </div>

        {/* KANAN ATAS: Priority Badge & Menu 3 Dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Priority Badge */}
          <div style={{ 
            padding: '2px 8px', 
            borderRadius: 9999, 
            fontSize: '11px', 
            fontWeight: 600, 
            border: `1px solid ${item.priority === 'HIGH' ? '#fecdd3' : '#fed7aa'}`,
            background: item.priority === 'HIGH' ? '#fff1f2' : '#fff7ed',
            color: item.priority === 'HIGH' ? '#e11d48' : '#ea580c'
          }}>
            {item.priority}
          </div>

          {/* Menu 3 Dots (Lihat Detail, Edit, Hapus) */}
          <Dropdown 
            menu={{ 
              items: [
                { key: 'detail', label: 'Lihat Detail', icon: <EyeOutlined /> },
                { key: 'edit', label: 'Edit', icon: <EditOutlined /> },
                ...(isSuperAdmin ? [
                  { type: 'divider' as const },
                  { key: 'delete', label: <span style={{ color: '#dc2626', fontWeight: 600 }}>Hapus (Admin)</span>, icon: <DeleteOutlined style={{ color: '#dc2626' }} /> }
                ] : [])
              ],
              onClick: (e) => {
                e.domEvent.stopPropagation();
                if (e.key === 'detail') {
                  onSelectCard(item);
                } else if (e.key === 'edit') {
                  onOpenEditModal(item);
                } else if (e.key === 'delete') {
                  onConfirmDelete(item);
                }
              }
            }} 
            trigger={['click']}
          >
            <div 
              style={{ color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
            </div>
          </Dropdown>
        </div>
      </div>

      {/* ALERTS / STATUS BADGES (PM Return / SPK Badge / Approval / Legal Revision) */}
      {((item.contract_status === 'PM_RETURNED' || item.contractStatus === 'PM_RETURNED') || item.status === 'PENDING_APPROVAL' || (item.stage === 'WON' && !item.spk_file_key) || (item.legal_status === 'REVISION_REQUESTED' && item.contract_status !== 'PM_RETURNED' && item.contractStatus !== 'PM_RETURNED')) && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {/* PM Return Badge */}
          {(item.contract_status === 'PM_RETURNED' || item.contractStatus === 'PM_RETURNED') && (
            <div style={{ 
              padding: '2px 8px', 
              borderRadius: 9999, 
              fontSize: '11px', 
              fontWeight: 700, 
              border: '1px solid #ffe58f', 
              background: '#fffbe6', 
              color: '#d97706',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              ↩ DIKEMBALIKAN PM
            </div>
          )}
          {item.status === 'PENDING_APPROVAL' && (
            <div style={{ fontSize: '11px', padding: '4px 8px', background: '#fff7ed', color: '#c2410c', borderRadius: 4, display: 'inline-block' }}>
              Menunggu Approval Diskon
            </div>
          )}
          {item.stage === 'WON' && !item.spk_file_key && (
            <div style={{ fontSize: '11px', padding: '4px 8px', background: '#fffbeb', color: '#b45309', borderRadius: 9999, display: 'inline-block', border: '1px solid #fde68a', fontWeight: 500 }}>
              {item.grace_deadline ? `SPK: sisa ${Math.max(0, Math.ceil((new Date(item.grace_deadline).getTime() - Date.now()) / 3600000))} jam` : 'Awaiting SPK'}
            </div>
          )}
          {item.legal_status === 'REVISION_REQUESTED' && item.contract_status !== 'PM_RETURNED' && item.contractStatus !== 'PM_RETURNED' && (
            <div style={{ fontSize: '11px', padding: '4px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: 9999, display: 'inline-block', border: '1px solid #fca5a5', fontWeight: 500 }}>
              Revisi Legal
            </div>
          )}
        </div>
      )}

      {/* KIRI-KANAN BAWAH */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8 }}>
        {/* KIRI BAWAH: Avatar PIC + Nama PIC */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar size={24} icon={<UserOutlined />} style={{ background: '#1e293b' }} />
            <div style={{ position: 'absolute', bottom: 0, right: -2, width: 8, height: 8, background: '#10b981', borderRadius: '50%', border: '2px solid white' }} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
            {picName}
          </div>
        </div>
        
        {/* KANAN BAWAH: Harga Proyek & Waktu */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0, marginLeft: 'auto' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            Budget Awal: <span style={{ fontWeight: 600, color: '#334155' }}>Rp {Number(item.estimated_budget != null && !isNaN(Number(item.estimated_budget)) ? item.estimated_budget : 0).toLocaleString('id-ID')}</span>
          </div>

          {item.negotiated_price != null && !isNaN(Number(item.negotiated_price)) && (
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
              Harga Negosiasi: Rp {Number(item.negotiated_price).toLocaleString('id-ID')}
            </div>
          )}

          {item.status === 'PENDING_APPROVAL' && (
            <Tag color="orange" style={{ margin: '2px 0 0 0', fontSize: '10px', lineHeight: '16px', padding: '0 4px', borderRadius: 3, fontWeight: 600 }}>
              Menunggu Approval
            </Tag>
          )}

          {item.bid_submission_deadline && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: '#6b7280', background: '#f9fafb', padding: '2px 6px', borderRadius: 4, border: '1px solid #f3f4f6', marginTop: 2 }}>
              <ClockCircleOutlined style={{ fontSize: '10px' }} /> 
              <span>{new Date(item.bid_submission_deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

interface KanbanColumnProps {
  column: { id: string; title: string; color: string };
  items: any[];
  highlightedTenderId: number | string | null;
  isSuperAdmin: boolean;
  onSelectCard: (item: any) => void;
  onOpenEditModal: (item: any) => void;
  onConfirmDelete: (item: any) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  items = [],
  highlightedTenderId,
  isSuperAdmin,
  onSelectCard,
  onOpenEditModal,
  onConfirmDelete,
}) => {
  return (
    <div style={{ minWidth: 300, background: '#f5f5f5', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `2px solid ${column.color}`, paddingBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>{column.title}</Title>
        <Tag color={column.color} style={{ margin: 0, borderRadius: 12 }}>{items.length}</Tag>
      </div>
      
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flex: 1,
              minHeight: 100,
              background: snapshot.isDraggingOver ? '#e6f7ff' : 'transparent',
              transition: 'background-color 0.2s ease',
              borderRadius: 8
            }}
          >
            {items.map((item, index) => (
              <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index} isDragDisabled={item.isLocked || item.status === 'PENDING_APPROVAL'}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      marginBottom: 12,
                      ...provided.draggableProps.style,
                    }}
                  >
                    <KanbanCard
                      item={item}
                      colId={column.id}
                      isDragging={snapshot.isDragging}
                      highlightedTenderId={highlightedTenderId}
                      isSuperAdmin={isSuperAdmin}
                      onSelectCard={onSelectCard}
                      onOpenEditModal={onOpenEditModal}
                      onConfirmDelete={onConfirmDelete}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export const KanbanBoard = ({ tenders, onStageChange }: { tenders: any[], onStageChange: (id: number, stage: string) => void }) => {
  const data = useMemo(() => {
    const grouped: Record<string, any[]> = {
      LEAD: [], WAITING_GO_NO_GO: [], QUALIFICATION: [], PROPOSAL: [], NEGOTIATION: [], WON: [], LOST: []
    };
    (tenders || []).forEach(t => {
      let stage = t.stage?.toUpperCase() || 'LEAD';
      if (!grouped[stage]) stage = 'LEAD';
      const itemCopy = { ...t };
      if (stage === 'LOST') {
        itemCopy.isLocked = true;
      }
      grouped[stage].push(itemCopy);
    });
    return grouped;
  }, [tenders]);
  
  const [pendingMove, setPendingMove] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResubmittingToPm, setIsResubmittingToPm] = useState(false);
  const [isProcessingDrag, setIsProcessingDrag] = useState(false);
  const [isSubmittingGoNoGo, setIsSubmittingGoNoGo] = useState(false);
  const [goNoGoNotes, setGoNoGoNotes] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [highlightedTenderId, setHighlightedTenderId] = useState<number | null>(null);

  const { user } = useAuth();
  const userRoles = (user?.roles || []).map((r: any) => String(r).toUpperCase());
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  const isMarketing = userRoles.includes('MARKETING');
  const isDirectorOrExec = userRoles.some((r: string) => ['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'].includes(r));

  // Edit Modal State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingTender, setEditingTender] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();

  const handleOpenEditModal = (tender: any) => {
    setEditingTender(tender);
    editForm.setFieldsValue({
      title: tender.title,
      estimated_budget: tender.estimated_budget,
      priority: tender.priority || 'MEDIUM',
      bid_submission_deadline: tender.bid_submission_deadline ? dayjs(tender.bid_submission_deadline) : null,
    });
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      const payload = {
        projectName: values.title,
        estimatedBudget: Number(values.estimated_budget),
        priority: values.priority,
        bidSubmissionDeadline: values.bid_submission_deadline ? values.bid_submission_deadline.format('YYYY-MM-DD') : null,
      };
      await apiClient.patch(`/marketing/tenders/${editingTender.id}`, payload);
      message.success(`Tender #${editingTender.id} berhasil diperbarui.`);
      
      // Update cache dengan format snake_case yang diharapkan UI
      updateAllTenderCaches(queryClient, editingTender.id, {
        title: values.title,
        estimated_budget: Number(values.estimated_budget),
        priority: values.priority,
        bid_submission_deadline: payload.bidSubmissionDeadline,
      });
      setIsEditModalVisible(false);
      setEditingTender(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epms:refetch_all'));
      }
    } catch (err: any) {
      if (err.name !== 'ValidationError') {
        const errMsg = err.response?.data?.message || 'Gagal memperbarui tender.';
        message.error(errMsg);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleSubmitGoNoGoReview = async (tenderId: number) => {
    setIsSubmittingGoNoGo(true);
    try {
      const res = await apiClient.post(`/marketing/tenders/${tenderId}/submit-go-no-go`);
      message.success(res.data?.message || 'Tender berhasil diajukan untuk GO / NO GO review');
      
      if (drawerTender && drawerTender.id === tenderId) {
        setDrawerTender({
          ...drawerTender,
          stage: 'WAITING_GO_NO_GO',
          go_nogo_status: 'PENDING'
        });
      }

      updateAllTenderCaches(queryClient, tenderId, { stage: 'WAITING_GO_NO_GO', go_nogo_status: 'PENDING' });
      if (onStageChange) onStageChange(tenderId, 'WAITING_GO_NO_GO');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epms:refetch_all'));
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Gagal mengajukan GO/NO-GO review';
      message.error(errMsg);
    } finally {
      setIsSubmittingGoNoGo(false);
    }
  };

  const handleDirectorDecision = async (tenderId: number, decision: 'GO' | 'NO_GO') => {
    setIsSubmittingDecision(true);
    try {
      const payload = { decision, notes: goNoGoNotes.trim() || undefined };
      const res = await apiClient.post(`/marketing/tenders/${tenderId}/go-no-go`, payload);

      const isGo = decision === 'GO';
      const nextStage = isGo ? 'QUALIFICATION' : 'LEAD';
      const nextGoNoGoStatus = isGo ? 'GO' : 'NO_GO';
      const nextRevisionStatus = isGo ? 'NOT_REQUIRED' : 'REQUIRED';

      message.success(res.data?.message || `Keputusan ${decision} berhasil disimpan`);

      if (drawerTender && drawerTender.id === tenderId) {
        setDrawerTender({
          ...drawerTender,
          stage: nextStage,
          go_nogo_status: nextGoNoGoStatus,
          revision_status: nextRevisionStatus,
          go_nogo_notes: payload.notes || null,
        });
      }

      updateAllTenderCaches(queryClient, tenderId, {
        stage: nextStage,
        go_nogo_status: nextGoNoGoStatus,
        revision_status: nextRevisionStatus,
        go_nogo_notes: payload.notes || null
      });

      if (onStageChange) onStageChange(tenderId, nextStage);
      setGoNoGoNotes('');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epms:refetch_all'));
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Gagal memproses keputusan GO/NO-GO';
      message.error(errMsg);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleConfirmDelete = (tender: any) => {
    Modal.confirm({
      title: 'Hapus Tender ini?',
      icon: <ExclamationCircleOutlined style={{ color: '#dc2626' }} />,
      content: `Apakah Anda yakin ingin menghapus tender "${tender.title}"? Tindakan ini akan menghapus tender secara Soft Delete (Khusus Super Admin).`,
      okText: 'Hapus (Soft Delete)',
      okType: 'danger',
      cancelText: 'Batal',
      async onOk() {
        try {
          await apiClient.delete(`/marketing/tenders/${tender.id}`);
          message.success(`Tender "${tender.title}" berhasil dihapus.`);

          // Immediate UI update for current actor (optimistic cache update)
          removeTenderFromCache(queryClient, tender.id);

          // Background synchronization with server. Not primary UI update mechanism.
          queryClient.invalidateQueries({ queryKey: ['tenders'] });
        } catch (err: any) {
          const errMsg = err.response?.data?.message || 'Gagal menghapus tender.';
          message.error(`Penghapusan Gagal: ${errMsg}`);
        }
      }
    });
  };

  // Drawer State
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTender, setDrawerTender] = useState<any>(null);

  // Modal Upload State (Proposal)
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Nego Modal State
  const [isNegoModalVisible, setIsNegoModalVisible] = useState(false);
  const [negoNote, setNegoNote] = useState('');
  const [negoPrice, setNegoPrice] = useState<number | undefined>(undefined);
  const [negoOption, setNegoOption] = useState<'TETAP' | 'UBAH'>('TETAP');

  // WON Modal State
  const [isWonModalVisible, setIsWonModalVisible] = useState(false);
  const [spkFile, setSpkFile] = useState<File | null>(null);

  // Lost Modal State
  const [isLostModalVisible, setIsLostModalVisible] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostNote, setLostNote] = useState('');

  // React 18 Strict Mode compatibility for dnd
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRealtimeUpdated = (e: any) => {
      const tId = Number(e.detail?.tenderId);
      if (tId) {
        setHighlightedTenderId(tId);
        setTimeout(() => {
          setHighlightedTenderId(null);
        }, 4000);
      }
    };
    window.addEventListener('tender:realtime_updated', handleRealtimeUpdated);
    return () => {
      window.removeEventListener('tender:realtime_updated', handleRealtimeUpdated);
    };
  }, []);

  // Synchronize drawerTender when tenders prop updates in realtime
  useEffect(() => {
    if (drawerVisible && drawerTender?.id) {
      const updated = (tenders || []).find((t: any) => t.id === drawerTender.id);
      if (updated) {
        setDrawerTender(updated);
      }
    }
  }, [tenders, drawerVisible]);

  const executeMove = (
    sourceColumn: string, 
    destColumn: string, 
    sourceIndex: number, 
    destIndex: number, 
    movedItem: any,
    extraCacheUpdates?: Record<string, any>,
    options?: { skipOnStageChange?: boolean }
  ) => {
    if (sourceColumn !== destColumn) {
      const originalStage = movedItem.stage || sourceColumn;
      const originalStatus = movedItem.status;
      const originalNegoPrice = movedItem.negotiated_price;

      // Instant Optimistic UI Update in React Query cache (IMMUTABLE, do NOT mutate movedItem directly)
      updateAllTenderCaches(queryClient, movedItem.id, { 
        stage: destColumn,
        ...(extraCacheUpdates || {})
      });

      // Background API & Rollback Safety Net
      if (!options?.skipOnStageChange && onStageChange) {
        setIsProcessingDrag(true);
        Promise.resolve(onStageChange(movedItem.id, destColumn))
          .catch(err => {
            console.error('Drag & Drop API Failed. Rolling back card position...', err);
            updateAllTenderCaches(queryClient, movedItem.id, { 
              stage: originalStage,
              status: originalStatus,
              negotiated_price: originalNegoPrice
            });
            message.error('Gagal mengubah status tender di server. Kartu dikembalikan ke posisi semula.');
          })
          .finally(() => {
            setIsProcessingDrag(false);
          });
      }
    }
  };

  const onDragEnd = (result: any) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;
    
    const sourceArr = Array.from(data[sourceColumn]);
    const movedItem = sourceArr[source.index];

    // Lock Logic
    if (movedItem.isLocked) {
      message.warning('Kartu ini sudah berstatus LOST dan dikunci permanen.');
      return;
    }

    // GO / NO GO Gate Drag Protection
    if ((sourceColumn === 'LEAD' || sourceColumn === 'WAITING_GO_NO_GO') && destColumn !== 'LEAD' && destColumn !== 'WAITING_GO_NO_GO' && destColumn !== 'LOST' && movedItem.go_nogo_status !== 'GO') {
      message.warning('Tender belum melewati GO/NO GO Gate. Ajukan review terlebih dahulu.');
      return;
    }
    
    // Cegat jika targetnya adalah PROPOSAL
    if (destColumn === 'PROPOSAL' && sourceColumn !== 'PROPOSAL') {
      setPendingMove({ source, destination, movedItem });
      setIsModalVisible(true);
      return;
    }

    // Cegat jika targetnya adalah NEGOTIATION
    if (destColumn === 'NEGOTIATION' && sourceColumn !== 'NEGOTIATION') {
      setPendingMove({ source, destination, movedItem });
      setIsNegoModalVisible(true);
      return;
    }

    // Cegat jika targetnya adalah WON
    if (destColumn === 'WON' && sourceColumn !== 'WON') {
      setPendingMove({ source, destination, movedItem });
      setIsWonModalVisible(true);
      return;
    }

    // Cegat jika targetnya adalah LOST
    if (destColumn === 'LOST' && sourceColumn !== 'LOST') {
      setPendingMove({ source, destination, movedItem });
      setIsLostModalVisible(true);
      return;
    }
    
    executeMove(sourceColumn, destColumn, source.index, destination.index, movedItem);
  };

  // --- HANDLERS FOR PROPOSAL ---
  const handleConfirmUpload = async () => {
    if (!selectedFile) {
      message.error('Silakan unggah dokumen penawaran terlebih dahulu.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      await apiClient.post(`/marketing/tenders/${pendingMove.movedItem.id}/upload-proposal`, formData);
      message.success('Dokumen proposal berhasil diunggah!');
      
      executeMove(pendingMove.source.droppableId, pendingMove.destination.droppableId, pendingMove.source.index, pendingMove.destination.index, pendingMove.movedItem);
      
      setIsModalVisible(false);
      setSelectedFile(null);
      setPendingMove(null);
    } catch (error: any) {
      console.error('Upload Error:', error);
      const errMsg = error.response?.data?.message || error.message || 'Gagal mengunggah dokumen proposal.';
      message.error(`Gagal: ${errMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setIsModalVisible(false);
    setSelectedFile(null);
    setPendingMove(null);
  };

  // --- HANDLERS FOR NEGOTIATION ---
  const handleConfirmNego = async () => {
    if (!negoNote || negoNote.trim().length < 10) {
      message.error('Catatan negosiasi wajib diisi minimal 10 karakter.');
      return;
    }

    if (negoOption === 'UBAH') {
      if (
        negoPrice === undefined || 
        negoPrice === null || 
        typeof negoPrice !== 'number' || 
        isNaN(negoPrice) || 
        !isFinite(negoPrice) || 
        negoPrice <= 0
      ) {
        message.error('Harga baru wajib diisi dengan nominal angka yang lebih besar dari 0.');
        return;
      }
    }

    setIsUploading(true);
    try {
      const targetTender = pendingMove?.movedItem;
      if (!targetTender) {
        message.error('Data tender tidak ditemukan.');
        return;
      }

      // 1. Determine Target Price
      let targetPrice: number;
      if (negoOption === 'UBAH') {
        targetPrice = Number(negoPrice);
      } else {
        const existingPrice = targetTender.negotiated_price != null && !isNaN(Number(targetTender.negotiated_price))
          ? Number(targetTender.negotiated_price)
          : Number(targetTender.estimated_budget || 0);
        targetPrice = existingPrice;
      }

      // 2. Call Negotiate API
      const negoRes = await apiClient.patch(`/marketing/tenders/${targetTender.id}/negotiate`, {
        new_price: targetPrice,
        reason: negoNote.trim()
      });

      // 3. Extract actual saved data from response (handling Axios data.data or data structure)
      const resPayload = negoRes?.data?.data ?? negoRes?.data;
      const actualData = resPayload?.data ?? resPayload;
      const savedNegotiatedPrice = actualData?.negotiated_price != null && !isNaN(Number(actualData.negotiated_price))
        ? Number(actualData.negotiated_price)
        : targetPrice;
      const savedStatus = actualData?.status || (resPayload?.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'NEGOTIATION');
      const savedStage = actualData?.stage || 'NEGOTIATION';

      // 4. Activity Logging (with resilience: if logging fails, do NOT revert price)
      try {
        await apiClient.post(`/marketing/tenders/${targetTender.id}/activities`, {
          content: `Catatan Negosiasi: ${negoNote.trim()}`
        });
      } catch (actErr: any) {
        console.warn('Gagal mencatat aktivitas negosiasi setelah harga tersimpan:', actErr);
        message.warning('Harga negosiasi berhasil disimpan, namun catatan aktivitas sistem gagal dibuat.');
      }

      message.success('Kartu dipindahkan ke Negotiation.');

      // 5. Update Cache and Move Card
      // For UBAH: skipOnStageChange = true because /negotiate already updated stage and status.
      // For TETAP: preserve existing flow (skipOnStageChange = false).
      const shouldSkipOnStageChange = negoOption === 'UBAH';

      executeMove(
        pendingMove.source.droppableId,
        pendingMove.destination.droppableId,
        pendingMove.source.index,
        pendingMove.destination.index,
        targetTender,
        {
          negotiated_price: savedNegotiatedPrice,
          status: savedStatus,
          stage: savedStage
        },
        { skipOnStageChange: shouldSkipOnStageChange }
      );

      setIsNegoModalVisible(false);
      setNegoNote('');
      setNegoOption('TETAP');
      setNegoPrice(undefined);
      setPendingMove(null);
    } catch (error: any) {
      console.error('Nego Error:', error);
      const errMsg = error.response?.data?.message || error.message || 'Gagal menyimpan negosiasi.';
      message.error(`Gagal: ${errMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelNego = () => {
    setIsNegoModalVisible(false);
    setNegoNote('');
    setNegoOption('TETAP');
    setNegoPrice(undefined);
    setPendingMove(null);
  };

  // --- HANDLERS FOR WON (SPK Upload) ---
  const handleConfirmWon = async (isGracePeriod: boolean) => {
    if (!pendingMove) return;

    if (!isGracePeriod && !spkFile) {
      message.error('File SPK wajib diunggah atau pilih Grace Period.');
      return;
    }

    setIsUploading(true);
    try {
      if (isGracePeriod) {
        await apiClient.patch(`/marketing/tenders/${pendingMove.movedItem.id}/grace-period`, {});
        message.success('Grace period SPK diaktifkan 2x24 jam.');
      } else if (spkFile) {
        const formData = new FormData();
        formData.append('file', spkFile);

        console.log('[FRONTEND] Uploading SPK for tender:', pendingMove.movedItem.id);

        const uploadRes = await apiClient.post(
          `/marketing/tenders/${pendingMove.movedItem.id}/upload-spk`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        console.log('[FRONTEND] Upload success:', uploadRes.data);
        message.success(uploadRes.data?.message || 'SPK berhasil diupload!');

        const spkKey = uploadRes.data?.fileKey || uploadRes.data?.spk_file_key || `contracts/${spkFile.name}`;
        const spkUrl = uploadRes.data?.url || uploadRes.data?.spk_url;

        // Update movedItem properties before moving to WON column
        pendingMove.movedItem.spk_file_key = spkKey;
        pendingMove.movedItem.spk_verification_status = 'PENDING_REVIEW';
        if (spkUrl) pendingMove.movedItem.spk_file_url = spkUrl;

        // Sync with global React Query caches
        updateAllTenderCaches(queryClient, pendingMove.movedItem.id, {
          spk_file_key: spkKey,
          spk_verification_status: 'PENDING_REVIEW',
          spk_file_url: spkUrl,
        });
      }

      executeMove(pendingMove.source.droppableId, pendingMove.destination.droppableId, pendingMove.source.index, pendingMove.destination.index, pendingMove.movedItem);
      
      setIsWonModalVisible(false);
      setSpkFile(null);
      setPendingMove(null);
    } catch (error: any) {
      console.error('[FRONTEND] Upload SPK ERROR:');
      console.error('Status Code:', error?.response?.status);
      console.error('Response Data:', error?.response?.data);
      console.error('Full Error:', error);

      const errorMsg = error?.response?.data?.message || error?.message || 'Gagal mengunggah SPK.';
      message.error(`Gagal upload: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelWon = () => {
    setIsWonModalVisible(false);
    setSpkFile(null);
    setPendingMove(null);
  };

  const handleResubmitToPm = async (tender: any) => {
    const charterIdentifier = tender?.contract_id || tender?.contract_number || tender?.id;
    if (!charterIdentifier) {
      message.error('ID Kontrak / Charter tidak ditemukan.');
      return;
    }

    setIsResubmittingToPm(true);
    try {
      const res = await apiClient.patch(`/project/charters/${charterIdentifier}/resubmit`, {});
      message.success(res.data?.message || 'Project Charter berhasil diajukan ulang ke antrean Kick-off PM!');

      // Update drawer state
      if (drawerTender && drawerTender.id === tender.id) {
        setDrawerTender({
          ...drawerTender,
          contract_status: 'ACTIVE',
          contractStatus: 'ACTIVE',
        });
      }

      // Update React Query caches
      updateAllTenderCaches(queryClient, tender.id, {
        contract_status: 'ACTIVE',
        contractStatus: 'ACTIVE',
      });
      queryClient.invalidateQueries({ queryKey: ['tenders'] });

      // Refetch all global data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('epms:refetch_all'));
      }
    } catch (err: any) {
      console.error('Resubmit to PM Error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Gagal mengajukan ulang charter ke PM.';
      message.error(errMsg);
    } finally {
      setIsResubmittingToPm(false);
    }
  };

  const handleUploadMissingSpk = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const mime = file.type?.toLowerCase();
    const isExtAllowed = ALLOWED_DOC_EXTENSIONS.includes(ext);
    const isMimeAllowed = !mime || ALLOWED_DOC_MIME_TYPES.includes(mime);

    if (!isExtAllowed || !isMimeAllowed) {
      message.error('Format file SPK harus PDF, Excel, atau Word.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 20 * 1024 * 1024) {
      message.error('Ukuran file maksimal adalah 20 MB.');
      return Upload.LIST_IGNORE;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('[FRONTEND] Uploading missing SPK for tender:', drawerTender?.id);

      const uploadRes = await apiClient.post(
        `/marketing/tenders/${drawerTender.id}/upload-spk`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('[FRONTEND] Upload missing SPK success:', uploadRes.data);
      message.success(uploadRes.data?.message || 'SPK berhasil diupload!');
      setDrawerTender({ ...drawerTender, spk_file_key: file.name, spk_file_url: uploadRes.data?.url || uploadRes.data?.spk_url, legal_status: 'DRAFT' });
      
      // Update data di KanbanBoard agar badge Revisi hilang dari card list
      updateAllTenderCaches(queryClient, drawerTender.id, { spk_file_key: file.name, legal_status: 'DRAFT' });

      onStageChange(drawerTender.id, 'WON'); // Refresh parent data
    } catch (error: any) {
      console.error('[FRONTEND] Upload missing SPK ERROR:');
      console.error('Status Code:', error?.response?.status);
      console.error('Response Data:', error?.response?.data);
      console.error('Full Error:', error);

      const errorMsg = error?.response?.data?.message || error?.message || 'Gagal mengunggah SPK.';
      message.error(`Gagal upload: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
    return false;
  };

  // --- HANDLERS FOR LOST ---
  const handleConfirmLost = async () => {
    if (!lostReason) {
      message.error('Alasan kalah wajib dipilih.');
      return;
    }
    setIsUploading(true);
    try {
      const fullNote = `Alasan Lost: ${lostReason}` + (lostNote.trim() ? `\nCatatan Tambahan: ${lostNote.trim()}` : '');
      await apiClient.post(`/marketing/tenders/${pendingMove.movedItem.id}/activities`, {
        content: fullNote
      });
      message.success('Kartu ditandai LOST dan dikunci permanen.');
      
      pendingMove.movedItem.isLocked = true;

      executeMove(pendingMove.source.droppableId, pendingMove.destination.droppableId, pendingMove.source.index, pendingMove.destination.index, pendingMove.movedItem);
      
      setIsLostModalVisible(false);
      setLostReason('');
      setLostNote('');
      setPendingMove(null);
    } catch (error: any) {
      console.error('Lost Error:', error);
      message.error('Gagal memproses status Lost.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelLost = () => {
    setIsLostModalVisible(false);
    setLostReason('');
    setLostNote('');
    setPendingMove(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'magenta';
      case 'HIGH': return 'red';
      case 'MEDIUM': return 'orange';
      case 'LOW': return 'green';
      default: return 'default';
    }
  };
  
  if (!isBrowser) return null;

  if (typeof window !== 'undefined') {
    const now = new Date().toISOString();
    console.log(`[${now}] KANBAN RENDER`, { dataKeys: Object.keys(data) });
    console.log('KANBAN RENDER', data);
  }

  return (
    <Spin spinning={isProcessingDrag} tip="Memproses perpindahan...">
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        <DragDropContext key={tenders?.map(t => `${t.id}:${t.stage}:${t.go_nogo_status}`).join('|') || 'empty'} onDragEnd={onDragEnd}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            items={data[col.id] || []}
            highlightedTenderId={highlightedTenderId}
            isSuperAdmin={isSuperAdmin}
            onSelectCard={(selected) => {
              setDrawerTender(selected);
              setDrawerVisible(true);
            }}
            onOpenEditModal={handleOpenEditModal}
            onConfirmDelete={handleConfirmDelete}
          />
        ))}
      </DragDropContext>

      {/* Modal Upload Proposal */}
      <Modal
        title="Peringatan Wajib Dokumen!"
        open={isModalVisible}
        onCancel={handleCancelUpload}
        footer={[
          <Button key="cancel" onClick={handleCancelUpload} disabled={isUploading}>
            Batal
          </Button>,
          <Button key="submit" type="primary" onClick={handleConfirmUpload} loading={isUploading}>
            Konfirmasi & Pindahkan
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>Unggah Dokumen Penawaran (Proposal) sebelum melanjutkan perpindahan kartu ini.</Text>
        </div>
        <Upload
          beforeUpload={(file) => {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            const mime = file.type?.toLowerCase();
            const isExtAllowed = ALLOWED_DOC_EXTENSIONS.includes(ext);
            const isMimeAllowed = !mime || ALLOWED_DOC_MIME_TYPES.includes(mime);

            if (!isExtAllowed || !isMimeAllowed) {
              message.error('Format file proposal harus PDF, Excel, atau Word.');
              return Upload.LIST_IGNORE;
            }
            if (file.size > 20 * 1024 * 1024) {
              message.error('Ukuran file maksimal adalah 20 MB.');
              return Upload.LIST_IGNORE;
            }
            setSelectedFile(file);
            return false;
          }}
          maxCount={1}
          onRemove={() => setSelectedFile(null)}
          accept=".pdf,.xls,.xlsx,.doc,.docx"
        >
          <Button icon={<UploadOutlined />}>Pilih File Proposal</Button>
        </Upload>
      </Modal>

      <Modal
        title="Selamat Bernegosiasi!"
        open={isNegoModalVisible}
        onCancel={handleCancelNego}
        footer={[
          <Button key="cancel" onClick={handleCancelNego} disabled={isUploading}>
            Batal
          </Button>,
          <Button key="submit" type="primary" onClick={handleConfirmNego} loading={isUploading}>
            Simpan & Pindahkan
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>Apakah ada penyesuaian harga hasil negosiasi?</Text>
          <div style={{ marginTop: 8 }}>
            <Radio.Group value={negoOption} onChange={e => setNegoOption(e.target.value)}>
              <Radio value="TETAP">Harga Tetap</Radio>
              <Radio value="UBAH">Update Harga Baru</Radio>
            </Radio.Group>
          </div>
        </div>

        {negoOption === 'UBAH' && (
          <div style={{ marginBottom: '16px' }}>
            <Text>Harga Baru (Rp):</Text>
            <InputNumber 
              value={negoPrice} 
              onChange={value => setNegoPrice(value as number)} 
              style={{ width: '100%', marginTop: 4 }} 
              min={1}
              placeholder="Masukkan nominal harga baru (contoh: 95.000.000)"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => {
                const cleaned = value ? value.replace(/[^\d]/g, '') : '';
                return cleaned ? Number(cleaned) : (undefined as any);
              }}
              status={
                pendingMove && negoPrice && 
                ((pendingMove.movedItem.estimated_budget - negoPrice) / pendingMove.movedItem.estimated_budget) * 100 > (pendingMove.movedItem.max_discount_rate || 20) 
                ? 'warning' : ''
              }
            />
            {pendingMove && negoPrice && ((pendingMove.movedItem.estimated_budget - negoPrice) / pendingMove.movedItem.estimated_budget) * 100 > (pendingMove.movedItem.max_discount_rate || 20) && (
              <Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                Diskon ini di atas batas wewenang Anda ({(pendingMove.movedItem.max_discount_rate || 20)}%). Butuh persetujuan Atasan.
              </Text>
            )}
          </div>
        )}

        <div style={{ marginBottom: '8px' }}>
          <Text>Catatan Tambahan:</Text>
        </div>
        <TextArea
          rows={3}
          placeholder="Catatan negosiasi (contoh: klien minta termin pembayaran 3x)..."
          value={negoNote}
          onChange={(e) => setNegoNote(e.target.value)}
        />
      </Modal>

      {/* Modal WON (SPK Upload) */}
      <Modal
        title="Selamat! Buktikan Kemenangan Ini (Upload SPK)"
        open={isWonModalVisible}
        onCancel={handleCancelWon}
        footer={[
          <Button key="grace" onClick={() => handleConfirmWon(true)} disabled={isUploading}>
            Upload Nanti (Grace Period 2x24 Jam)
          </Button>,
          <Button key="submit" type="primary" onClick={() => handleConfirmWon(false)} loading={isUploading}>
            Upload SPK & Menang
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>Silakan unggah Surat Perintah Kerja (SPK) atau bukti Chat valid yang menunjukkan proyek ini resmi dimenangkan.</Text>
        </div>
        <Upload.Dragger
          name="file"
          multiple={false}
          maxCount={1}
          beforeUpload={(file) => {
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            const mime = file.type?.toLowerCase();
            const isExtAllowed = ALLOWED_DOC_EXTENSIONS.includes(ext);
            const isMimeAllowed = !mime || ALLOWED_DOC_MIME_TYPES.includes(mime);

            if (!isExtAllowed || !isMimeAllowed) {
              message.error('Format file SPK harus PDF, Excel, atau Word.');
              return Upload.LIST_IGNORE;
            }
            if (file.size > 20 * 1024 * 1024) {
              message.error('Ukuran file maksimal adalah 20 MB.');
              return Upload.LIST_IGNORE;
            }
            setSpkFile(file);
            return false;
          }}
          onRemove={() => setSpkFile(null)}
          accept=".pdf,.xls,.xlsx,.doc,.docx"
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">Klik atau seret file (Drag & Drop) SPK ke area ini</p>
          <p className="ant-upload-hint">Upload menyimpan file secara permanen ke server (PDF, Excel, & Word).</p>
        </Upload.Dragger>
      </Modal>

      {/* Modal Lost */}
      <Modal
        title="Validasi Kartu LOST"
        open={isLostModalVisible}
        onCancel={handleCancelLost}
        footer={[
          <Button key="cancel" onClick={handleCancelLost} disabled={isUploading}>
            Batal
          </Button>,
          <Button key="submit" type="primary" danger onClick={handleConfirmLost} loading={isUploading}>
            Konfirmasi & Kunci Permanen
          </Button>,
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text strong>Pilih alasan kekalahan (wajib):</Text>
          <Radio.Group 
            onChange={(e) => setLostReason(e.target.value)} 
            value={lostReason} 
            style={{ display: 'flex', flexDirection: 'column', marginTop: 8, gap: 8 }}
          >
            <Radio value="Harga Kalah">Harga Kalah</Radio>
            <Radio value="Spesifikasi Tidak Sesuai">Spesifikasi Tidak Sesuai</Radio>
            <Radio value="Klien Pilih Vendor Lain">Klien Pilih Vendor Lain</Radio>
          </Radio.Group>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <Text>Catatan Tambahan (Opsional):</Text>
        </div>
        <TextArea
          rows={3}
          placeholder="Berikan detail lebih lanjut jika ada..."
          value={lostNote}
          onChange={(e) => setLostNote(e.target.value)}
        />
      </Modal>

      {/* Drawer: Project Detail & Activity Stream */}
      <Drawer
        title={<span style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Detail Proyek</span>}
        placement="right"
        width={480}
        onClose={() => {
          setDrawerVisible(false);
          setDrawerTender(null);
        }}
        open={drawerVisible}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc', overflow: 'hidden' }}
        headerStyle={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px', background: '#ffffff' }}
      >
        {drawerTender && (
          <TenderActivityStream 
            tenderId={drawerTender.id}
            tender={drawerTender}
            headerContent={
              <div>
                {/* 1. PROJECT IDENTITY */}
                <div style={{ marginBottom: 16 }}>
                  <Typography.Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 700, fontSize: 18, lineHeight: 1.35 }}>
                    {drawerTender.title}
                  </Typography.Title>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#64748b', fontSize: 13, fontWeight: 500 }}>
                    <BankOutlined style={{ color: '#3b82f6' }} />
                    <span>{drawerTender.customer?.name || `Client ID: ${drawerTender.customer_id}`}</span>
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
                          {drawerTender.marketing_pic_name || 'Belum Ditentukan'}
                        </Text>
                      </div>
                    </div>

                    <div>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                        Budget Awal
                      </Text>
                      <div style={{ fontWeight: 700, color: '#334155', marginTop: 4, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                        Rp {Number(drawerTender.estimated_budget != null && !isNaN(Number(drawerTender.estimated_budget)) ? drawerTender.estimated_budget : 0).toLocaleString('id-ID')}
                      </div>
                    </div>

                    {drawerTender.negotiated_price != null && !isNaN(Number(drawerTender.negotiated_price)) && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                          Harga Negosiasi
                        </Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontWeight: 700, color: '#10b981', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                            Rp {Number(drawerTender.negotiated_price).toLocaleString('id-ID')}
                          </span>
                          {drawerTender.status === 'PENDING_APPROVAL' && (
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
                        <Tag color={getPriorityColor(drawerTender.priority)} style={{ borderRadius: 4, border: 'none', fontWeight: 600, fontSize: 11 }}>
                          {drawerTender.priority || 'MEDIUM'}
                        </Tag>
                      </div>
                    </div>

                    <div>
                      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                        Probabilitas
                      </Text>
                      <div style={{ marginTop: 4, fontWeight: 700, color: '#0284c7', fontSize: 14 }}>
                        {drawerTender.probability_percentage ?? 0}%
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
                    color={COLUMNS.find(c => c.id === drawerTender.stage)?.color || 'blue'}
                    style={{ borderRadius: 6, padding: '2px 12px', fontWeight: 700, fontSize: 12, border: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  >
                    {drawerTender.stage}
                  </Tag>
                </div>

                {/* 4. CRITICAL ACTION / BLOCKER */}
                {/* CASE B: PM RETURN */}
                {drawerTender.contract_status === 'PM_RETURNED' && (
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
                          onClick={() => handleOpenEditModal(drawerTender)}
                          style={{ borderColor: '#d97706', color: '#d97706', borderRadius: 6, fontWeight: 600 }}
                        >
                          Edit Proyek / RAB
                        </Button>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<SendOutlined />} 
                          loading={isResubmittingToPm}
                          onClick={() => handleResubmitToPm(drawerTender)}
                          style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', borderRadius: 6, fontWeight: 600 }}
                        >
                          Ajukan Ulang ke PM
                        </Button>
                      </Space>
                    </div>
                    {drawerTender.legal_notes && (
                      <div style={{ marginTop: 10, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fef3c7' }}>
                        <Text type="secondary" style={{ fontSize: 11, color: '#d97706', fontWeight: 600, display: 'block', marginBottom: 2 }}>Catatan Project Manager:</Text>
                        <Text italic style={{ color: '#78350f', fontSize: 12 }}>"{drawerTender.legal_notes}"</Text>
                      </div>
                    )}
                  </div>
                )}

                {/* CASE A: LEGAL REVISION */}
                {drawerTender.contract_status !== 'PM_RETURNED' && drawerTender.legal_status === 'REVISION_REQUESTED' && (
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
                      <Upload showUploadList={false} beforeUpload={handleUploadMissingSpk} accept=".pdf,.xls,.xlsx,.doc,.docx">
                        <Button type="primary" danger size="small" icon={<UploadOutlined />} loading={isUploading} style={{ borderRadius: 6, fontWeight: 600 }}>
                          Upload Revisi SPK
                        </Button>
                      </Upload>
                    </div>
                    {drawerTender.legal_notes && (
                      <div style={{ marginTop: 10, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #fee2e2' }}>
                        <Text type="secondary" style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600, display: 'block', marginBottom: 2 }}>Catatan Legal:</Text>
                        <Text italic style={{ color: '#991b1b', fontSize: 12 }}>"{drawerTender.legal_notes}"</Text>
                      </div>
                    )}
                  </div>
                )}

                {drawerTender.stage === 'WON' && !drawerTender.spk_file_key && drawerTender.legal_status !== 'REVISION_REQUESTED' && drawerTender.contract_status !== 'PM_RETURNED' && (
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
                      <Upload showUploadList={false} beforeUpload={handleUploadMissingSpk} accept=".pdf,.xls,.xlsx,.doc,.docx">
                        <Button type="primary" size="small" icon={<UploadOutlined />} loading={isUploading} style={{ background: '#faad14', borderColor: '#faad14', borderRadius: 6, fontWeight: 600 }}>
                          Upload SPK
                        </Button>
                      </Upload>
                    </div>
                  </div>
                )}

                {isDirectorOrExec && drawerTender.stage === 'WAITING_GO_NO_GO' && (drawerTender.go_nogo_status === 'PENDING' || !drawerTender.go_nogo_status) && (
                  <div style={{ 
                    marginBottom: 16, 
                    background: '#ffffff', 
                    padding: '16px', 
                    borderRadius: 12, 
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)' 
                  }}>
                    <Text strong style={{ color: '#0f172a', fontSize: 14, display: 'block', marginBottom: 8 }}>
                      GO / NO-GO REVIEW (DECISION EXECUTIVE)
                    </Text>
                    
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                      <div><strong>Tender:</strong> {drawerTender.title}</div>
                      <div><strong>Customer:</strong> {drawerTender.customer?.name || `Client ID: ${drawerTender.customer_id}`}</div>
                      <div><strong>Value:</strong> Rp {(Number(drawerTender.estimated_budget) || 0).toLocaleString('id-ID')}</div>
                      <div><strong>Risk / Priority:</strong> <Tag color={getPriorityColor(drawerTender.priority)} style={{ fontSize: 10 }}>{drawerTender.priority || 'MEDIUM'}</Tag></div>
                      <div><strong>Recommendation / Notes:</strong> {drawerTender.notes || '-'}</div>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                        Catatan Pertimbangan (Opsional):
                      </Text>
                      <TextArea 
                        rows={2} 
                        placeholder="Berikan alasan atau catatan keputusan GO / NO-GO..."
                        value={goNoGoNotes}
                        onChange={(e) => setGoNoGoNotes(e.target.value)}
                        disabled={isSubmittingDecision}
                        style={{ borderRadius: 6 }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <Button 
                        danger 
                        size="small" 
                        loading={isSubmittingDecision}
                        onClick={() => handleDirectorDecision(drawerTender.id, 'NO_GO')}
                        style={{ borderRadius: 6, fontWeight: 600 }}
                      >
                        REJECT NO_GO
                      </Button>
                      <Button 
                        type="primary" 
                        size="small" 
                        loading={isSubmittingDecision}
                        onClick={() => handleDirectorDecision(drawerTender.id, 'GO')}
                        style={{ background: '#16a34a', borderColor: '#16a34a', borderRadius: 6, fontWeight: 600 }}
                      >
                        APPROVE GO
                      </Button>
                    </div>
                  </div>
                )}

                {isMarketing && drawerTender.stage === 'LEAD' && (drawerTender.go_nogo_status === 'PENDING' || !drawerTender.go_nogo_status) && drawerTender.go_nogo_status !== 'GO' && drawerTender.go_nogo_status !== 'NO_GO' && (
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
                      <Text strong style={{ color: '#1d4ed8', display: 'block', fontSize: 13 }}>GO / NO GO Gate Review</Text>
                      <Text style={{ fontSize: 11, color: '#3b82f6' }}>Ajukan tender ini ke Direksi untuk review keputusan.</Text>
                    </div>
                    <Button 
                      type="primary" 
                      size="small" 
                      loading={isSubmittingGoNoGo}
                      onClick={() => handleSubmitGoNoGoReview(drawerTender.id)}
                      style={{ background: '#2563eb', borderColor: '#2563eb', borderRadius: 6, fontWeight: 600 }}
                    >
                      Ajukan Review
                    </Button>
                  </div>
                )}

                {/* 5. DECISION HISTORY */}
                {drawerTender.go_nogo_status && drawerTender.go_nogo_status !== 'PENDING' && (
                  <div style={{ 
                    marginBottom: 16, 
                    background: drawerTender.go_nogo_status === 'GO' ? '#f0fdf4' : '#fef2f2', 
                    padding: '14px 16px', 
                    borderRadius: 12, 
                    border: `1px solid ${drawerTender.go_nogo_status === 'GO' ? '#bbf7d0' : '#fecaca'}` 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text strong style={{ color: drawerTender.go_nogo_status === 'GO' ? '#166534' : '#991b1b', fontSize: 12, letterSpacing: 0.5 }}>
                        DECISION HISTORY (GO/NO-GO GATE)
                      </Text>
                      <Tag color={drawerTender.go_nogo_status === 'GO' ? 'success' : 'error'} style={{ fontWeight: 700, borderRadius: 6 }}>
                        {drawerTender.go_nogo_status}
                      </Tag>
                    </div>
                    
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div><strong>Status:</strong> {drawerTender.go_nogo_status === 'GO' ? 'APPROVED (GO)' : 'REJECTED (NO GO)'}</div>
                      {(drawerTender.go_nogo_by_name || drawerTender.go_nogo_by) && (
                        <div><strong>Approved By:</strong> {drawerTender.go_nogo_by_name || drawerTender.go_nogo_user_name || `User ID: ${drawerTender.go_nogo_by}`}</div>
                      )}
                      {drawerTender.go_nogo_at && (
                        <div><strong>Decision Date:</strong> {dayjs(drawerTender.go_nogo_at).format('DD MMM YYYY, HH:mm')}</div>
                      )}
                      {drawerTender.go_nogo_notes && (
                        <div style={{ marginTop: 4, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                          <strong>Decision Notes:</strong> "{drawerTender.go_nogo_notes}"
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

      {/* Modal Edit Tender */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#3b82f6' }} />
            <span>Edit Data Tender #{editingTender?.id}</span>
          </div>
        }
        open={isEditModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingTender(null);
        }}
        confirmLoading={editLoading}
        okText="Simpan Perubahan"
        cancelText="Batal"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Nama Proyek / Tender"
            rules={[{ required: true, message: 'Nama proyek wajib diisi' }]}
          >
            <Input placeholder="Contoh: Renovasi Ruang Direksi" />
          </Form.Item>

          <Form.Item
            name="estimated_budget"
            label="Perkiraan Anggaran (Rp)"
            rules={[{ required: true, message: 'Anggaran wajib diisi' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
              parser={(value: any) => value!.replace(/Rp\s?|(\.*)/g, '')}
              placeholder="100000000"
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Prioritas Proyek"
          >
            <Select>
              <Option value="HIGH">HIGH (Tinggi)</Option>
              <Option value="MEDIUM">MEDIUM (Sedang)</Option>
              <Option value="LOW">LOW (Rendah)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="bid_submission_deadline"
            label="Deadline Penawaran"
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
    </Spin>
  );
};
