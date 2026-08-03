import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, Typography, Tag, Avatar, Tooltip, Modal, Upload, Button, message, Input, InputNumber, Radio, Drawer, Divider, Space, Spin, Dropdown, Form, Select, DatePicker, Popconfirm } from 'antd';
import { UserOutlined, ClockCircleOutlined, UploadOutlined, LockOutlined, PaperClipOutlined, FilePdfOutlined, ExclamationCircleOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { TenderActivityStream } from './TenderActivityStream';
import dayjs from 'dayjs';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '@/lib/axios';
import { queryClient, updateAllTenderCaches } from '../lib/queryClient';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const COLUMNS = [
  { id: 'LEAD', title: 'Lead', color: '#1677ff' },
  { id: 'QUALIFICATION', title: 'Qualification', color: '#13c2c2' },
  { id: 'PROPOSAL', title: 'Proposal', color: '#722ed1' },
  { id: 'NEGOTIATION', title: 'Negotiation', color: '#faad14' },
  { id: 'WON', title: 'Won', color: '#52c41a' },
  { id: 'LOST', title: 'Lost', color: '#f5222d' },
];

const getStageBorderColor = (stage: string) => {
  switch (stage) {
    case 'LEAD': return '#3b82f6';
    case 'QUALIFICATION': return '#2dd4bf';
    case 'PROPOSAL': return '#8b5cf6';
    case 'NEGOTIATION': return '#eab308';
    case 'WON': return '#22c55e';
    case 'LOST': return '#ef4444';
    default: return '#e2e8f0';
  }
};

export const KanbanBoard = ({ tenders, onStageChange }: { tenders: any[], onStageChange: (id: number, stage: string) => void }) => {
  const [data, setData] = useState<Record<string, any[]>>({
    LEAD: [], QUALIFICATION: [], PROPOSAL: [], NEGOTIATION: [], WON: [], LOST: []
  });
  
  const [pendingMove, setPendingMove] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingDrag, setIsProcessingDrag] = useState(false);

  const { user } = useAuth();
  const userRoles = (user?.roles || []).map((r: any) => String(r).toUpperCase());
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');

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
          updateAllTenderCaches(queryClient, tender.id, { isDeleted: true });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('epms:refetch_all'));
          }
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
    
    // Group tenders by stage with fresh object copies
    const grouped: Record<string, any[]> = {
      LEAD: [], QUALIFICATION: [], PROPOSAL: [], NEGOTIATION: [], WON: [], LOST: []
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
    
    setData(grouped);
  }, [tenders, JSON.stringify((tenders || []).map(t => `${t.id}:${t.stage}:${t.version || t.updated_at || ''}`))]);

  const executeMove = (sourceColumn: string, destColumn: string, sourceIndex: number, destIndex: number, movedItem: any) => {
    const newSourceArr = Array.from(data[sourceColumn]);
    const newDestArr = Array.from(data[destColumn]);
    
    newSourceArr.splice(sourceIndex, 1);
    
    if (sourceColumn === destColumn) {
      newSourceArr.splice(destIndex, 0, movedItem);
      setData(prev => ({ ...prev, [sourceColumn]: newSourceArr }));
    } else {
      const originalStage = movedItem.stage || sourceColumn;
      movedItem.stage = destColumn;
      newDestArr.splice(destIndex, 0, movedItem);

      // 1. Instant Optimistic UI Update (< 50ms)
      setData(prev => ({
        ...prev,
        [sourceColumn]: newSourceArr,
        [destColumn]: newDestArr
      }));
      
      // Update global React Query caches instantly
      updateAllTenderCaches(queryClient, movedItem.id, { stage: destColumn });

      // 2. Background API & Rollback Safety Net
      if (onStageChange) {
        setIsProcessingDrag(true);
        Promise.resolve(onStageChange(movedItem.id, destColumn))
          .catch(err => {
            // Rollback on failure (500, 404, 409 Conflict)
            console.error('⚠️ Drag & Drop API Failed. Rolling back card position...', err);
            movedItem.stage = originalStage;
            setData(prev => {
              const revertSource = Array.from(prev[sourceColumn] || []);
              const revertDest = Array.from(prev[destColumn] || []).filter(item => item.id !== movedItem.id);
              revertSource.splice(sourceIndex, 0, movedItem);
              return {
                ...prev,
                [sourceColumn]: revertSource,
                [destColumn]: revertDest,
              };
            });
            updateAllTenderCaches(queryClient, movedItem.id, { stage: originalStage });
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
    if (negoNote.trim().length < 10) {
      message.error('Catatan negosiasi wajib diisi minimal 10 karakter.');
      return;
    }
    setIsUploading(true);
    try {
      // 1. Call Negotiate API
      if (negoOption === 'UBAH' && negoPrice !== undefined) {
        await apiClient.patch(`/marketing/tenders/${pendingMove.movedItem.id}/negotiate`, {
          new_price: Number(negoPrice),
          reason: negoNote
        });
      }

      // 2. Add Activity
      await apiClient.post(`/marketing/tenders/${pendingMove.movedItem.id}/activities`, {
        content: `Catatan Negosiasi: ${negoNote.trim()}`
      });
      message.success('Kartu dipindahkan ke Negotiation.');
      
      executeMove(pendingMove.source.droppableId, pendingMove.destination.droppableId, pendingMove.source.index, pendingMove.destination.index, pendingMove.movedItem);
      
      setIsNegoModalVisible(false);
      setNegoNote('');
      setNegoOption('TETAP');
      setNegoPrice(undefined);
      setPendingMove(null);
    } catch (error: any) {
      console.error('Nego Error:', error);
      const errMsg = error.response?.data?.message || error.message || 'Gagal menambahkan catatan negosiasi.';
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

        console.log('🚀 [FRONTEND] Uploading SPK for tender:', pendingMove.movedItem.id);

        const uploadRes = await apiClient.post(
          `/marketing/tenders/${pendingMove.movedItem.id}/upload-spk`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        console.log('✅ [FRONTEND] Upload success:', uploadRes.data);
        message.success(uploadRes.data?.message || 'SPK berhasil diupload!');
      }

      executeMove(pendingMove.source.droppableId, pendingMove.destination.droppableId, pendingMove.source.index, pendingMove.destination.index, pendingMove.movedItem);
      
      setIsWonModalVisible(false);
      setSpkFile(null);
      setPendingMove(null);
    } catch (error: any) {
      console.error('❌ [FRONTEND] Upload SPK ERROR:');
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

  const handleUploadMissingSpk = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('🚀 [FRONTEND] Uploading missing SPK for tender:', drawerTender?.id);

      const uploadRes = await apiClient.post(
        `/marketing/tenders/${drawerTender.id}/upload-spk`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('✅ [FRONTEND] Upload missing SPK success:', uploadRes.data);
      message.success(uploadRes.data?.message || 'SPK berhasil diupload!');
      setDrawerTender({ ...drawerTender, spk_file_key: file.name, spk_file_url: uploadRes.data?.url || uploadRes.data?.spk_url, legal_status: 'DRAFT' });
      
      // Update data di KanbanBoard agar badge Revisi hilang dari card list
      setData(prev => {
        const newData = { ...prev };
        if (newData['WON']) {
          newData['WON'] = newData['WON'].map(item => 
            item.id === drawerTender.id ? { ...item, spk_file_key: file.name, legal_status: 'DRAFT' } : item
          );
        }
        return newData;
      });

      onStageChange(drawerTender.id, 'WON'); // Refresh parent data
    } catch (error: any) {
      console.error('❌ [FRONTEND] Upload missing SPK ERROR:');
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

  return (
    <Spin spinning={isProcessingDrag} tip="Memproses perpindahan...">
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        <DragDropContext onDragEnd={onDragEnd}>
        {COLUMNS.map(col => (
          <div key={col.id} style={{ minWidth: 300, background: '#f5f5f5', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: `2px solid ${col.color}`, paddingBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>{col.title}</Title>
              <Tag color={col.color} style={{ margin: 0, borderRadius: 12 }}>{data[col.id]?.length || 0}</Tag>
            </div>
            
            <Droppable droppableId={col.id}>
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
                  {data[col.id]?.map((item, index) => (
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
                            <Card 
                              size="small" 
                              bordered={true}
                              onClick={() => {
                                setDrawerTender(item);
                                setDrawerVisible(true);
                              }}
                              style={{ 
                                boxShadow: snapshot.isDragging ? '0 8px 16px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.05)',
                                cursor: item.isLocked ? 'not-allowed' : 'pointer',
                                borderRadius: 12,
                                opacity: item.isLocked ? 0.7 : 1,
                                border: item.isLocked ? '1px solid #ff4d4f' : '1px solid #e2e8f0',
                                padding: '12px 12px 12px 12px',
                                background: '#ffffff',
                                borderLeft: `6px solid ${getStageBorderColor(item.stage || col.id)}` 
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
                                        e.domEvent.stopPropagation(); // Mencegah klik masuk ke modal/drawer
                                        if (e.key === 'detail') {
                                          setDrawerTender(item);
                                          setDrawerVisible(true);
                                        } else if (e.key === 'edit') {
                                          handleOpenEditModal(item);
                                        } else if (e.key === 'delete') {
                                          handleConfirmDelete(item);
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

                              {/* ALERTS (Jika Ada - SPK Badge / Approval) */}
                              {(item.status === 'PENDING_APPROVAL' || (item.stage === 'WON' && !item.spk_file_key) || item.legal_status === 'REVISION_REQUESTED') && (
                                <div style={{ marginTop: 8 }}>
                                  {item.status === 'PENDING_APPROVAL' && (
                                    <div style={{ fontSize: '11px', padding: '4px 8px', background: '#fff7ed', color: '#c2410c', borderRadius: 4, display: 'inline-block', marginBottom: 4 }}>
                                      ⏳ Menunggu Approval Diskon
                                    </div>
                                  )}
                                  {item.stage === 'WON' && !item.spk_file_key && (
                                    <div style={{ fontSize: '11px', padding: '4px 8px', background: '#fffbeb', color: '#b45309', borderRadius: 9999, display: 'inline-block', border: '1px solid #fde68a', fontWeight: 500, marginRight: 4 }}>
                                      {item.grace_deadline ? `⏳ SPK: sisa ${Math.max(0, Math.ceil((new Date(item.grace_deadline).getTime() - Date.now()) / 3600000))} jam` : '⏳ Awaiting SPK'}
                                    </div>
                                  )}
                                  {item.legal_status === 'REVISION_REQUESTED' && (
                                    <div style={{ fontSize: '11px', padding: '4px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: 9999, display: 'inline-block', border: '1px solid #fca5a5', fontWeight: 500 }}>
                                      ⚠️ Revisi Legal
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* TENGAH: Garis Pemisah (Hairline Separator) */}
                              {/* KIRI-KANAN BAWAH */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6', flexWrap: 'wrap', gap: 8 }}>
                                {/* KIRI BAWAH: Avatar PIC + Nama PIC */}
                                {(() => {
                                  const picName = item.marketing_pic_name && item.marketing_pic_name !== '-' && item.marketing_pic_name !== 'System'
                                    ? item.marketing_pic_name
                                    : (item.marketingPicName && item.marketingPicName !== '-' && item.marketingPicName !== 'System'
                                      ? item.marketingPicName
                                      : (item.marketing_pic?.full_name || 'Lukas Kurniawan (MARKETING)'));
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                      <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <Avatar size={24} icon={<UserOutlined />} style={{ background: '#1e293b' }} />
                                        <div style={{ position: 'absolute', bottom: 0, right: -2, width: 8, height: 8, background: '#10b981', borderRadius: '50%', border: '2px solid white' }} />
                                      </div>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                                        {picName}
                                      </div>
                                    </div>
                                  );
                                })()}
                                
                                {/* KANAN BAWAH: Harga Proyek & Waktu */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 'auto' }}>
                                  {/* Harga (WAJIB Hitam / Abu-abu Tua) */}
                                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                                    Rp {(Number(item.estimated_budget) || 0).toLocaleString('id-ID')}
                                  </div>

                                  {/* Tanggal Deadline */}
                                  {item.bid_submission_deadline && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: '#6b7280', background: '#f9fafb', padding: '2px 6px', borderRadius: 4, border: '1px solid #f3f4f6' }}>
                                      <ClockCircleOutlined style={{ fontSize: '10px' }} /> 
                                      <span>{new Date(item.bid_submission_deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Card>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
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
            const isAllowed = file.type === 'application/pdf' || 
                              file.type === 'application/msword' || 
                              file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                              file.name.endsWith('.pdf') || 
                              file.name.endsWith('.doc') || 
                              file.name.endsWith('.docx');
                              
            if (!isAllowed) {
              message.error('Hanya menerima file berformat .pdf, .doc, atau .docx');
              return Upload.LIST_IGNORE;
            }
            setSelectedFile(file);
            return false;
          }}
          maxCount={1}
          onRemove={() => setSelectedFile(null)}
          accept=".pdf,.doc,.docx"
        >
          <Button icon={<UploadOutlined />}>Pilih File Proposal</Button>
        </Upload>
      </Modal>

      <Modal
        title="Selamat Bernegosiasi! 🤝"
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
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
              status={
                pendingMove && negoPrice && 
                ((pendingMove.movedItem.estimated_budget - negoPrice) / pendingMove.movedItem.estimated_budget) * 100 > (pendingMove.movedItem.max_discount_rate || 20) 
                ? 'warning' : ''
              }
            />
            {pendingMove && negoPrice && ((pendingMove.movedItem.estimated_budget - negoPrice) / pendingMove.movedItem.estimated_budget) * 100 > (pendingMove.movedItem.max_discount_rate || 20) && (
              <Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                ⚠️ Diskon ini di atas batas wewenang Anda ({(pendingMove.movedItem.max_discount_rate || 20)}%). Butuh persetujuan Atasan.
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
        title="🎉 Selamat! Buktikan Kemenangan Ini (Upload SPK)"
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
            setSpkFile(file);
            return false;
          }}
          onRemove={() => setSpkFile(null)}
          accept=".pdf,.png,.jpg,.jpeg"
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">Klik atau seret file (Drag & Drop) SPK ke area ini</p>
          <p className="ant-upload-hint">Upload menyimpan file secara permanen ke server (PDF & Gambar).</p>
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
        title={drawerTender ? <span style={{ fontWeight: 600, color: '#1e293b' }}>Detail Proyek</span> : 'Detail Proyek'}
        placement="right"
        width={500}
        onClose={() => {
          setDrawerVisible(false);
          setDrawerTender(null);
        }}
        open={drawerVisible}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}
        headerStyle={{ borderBottom: '1px solid #f1f5f9' }}
      >
        {drawerTender && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Modern Project Identity Card */}
            <div style={{ padding: '24px 24px 0 24px', flexShrink: 0 }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', 
                borderRadius: '16px', 
                padding: '20px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02)',
                border: '1px solid #e2e8f0',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative background element */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
                
                <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16, color: '#0f172a', fontWeight: 700 }}>
                  {drawerTender.title}
                </Typography.Title>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Customer</Text>
                    <div style={{ fontWeight: 600, color: '#334155', marginTop: 4 }}>
                      {drawerTender.customer?.name || `Client ID: ${drawerTender.customer_id}`}
                    </div>
                  </div>
                  
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Budget</Text>
                    <div style={{ fontWeight: 700, color: '#10b981', marginTop: 4, fontSize: 15 }}>
                      Rp {(Number(drawerTender.estimated_budget) || 0).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: 16 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>PIC Marketing</Text>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                      <Avatar size={20} icon={<UserOutlined />} style={{ background: '#3b82f6', marginRight: 8 }} />
                      <Text strong style={{ color: '#1e3a8a', fontSize: 13 }}>{drawerTender.marketing_pic_name || 'Belum Ditentukan'}</Text>
                    </div>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Prioritas</Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag color={getPriorityColor(drawerTender.priority)} style={{ borderRadius: '4px', border: 'none', fontWeight: 600 }}>
                        {drawerTender.priority || 'MEDIUM'}
                      </Tag>
                    </div>
                  </div>
                </div>

                {drawerTender.notes && (
                  <div style={{ 
                    marginTop: 16, 
                    background: '#f1f5f9', 
                    borderRadius: '8px', 
                    padding: '12px 16px',
                    borderLeft: '4px solid #94a3b8'
                  }}>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>📝 Catatan / Alasan PIC</Text>
                    <Text italic style={{ color: '#475569', fontSize: 13 }}>"{drawerTender.notes}"</Text>
                  </div>
                )}

                {drawerTender.legal_status === 'REVISION_REQUESTED' && (
                  <div style={{ 
                    marginTop: 16, 
                    background: '#fef2f2', 
                    borderRadius: '8px', 
                    padding: '12px 16px',
                    borderLeft: '4px solid #ef4444'
                  }}>
                    <Text type="secondary" style={{ fontSize: 11, color: '#b91c1c', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>⚠️ Catatan Revisi Legal</Text>
                    <Text italic style={{ color: '#991b1b', fontSize: 13 }}>"{drawerTender.legal_notes}"</Text>
                  </div>
                )}

                <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>STATUS SAAT INI</Text>
                  <Tag 
                    color={COLUMNS.find(c => c.id === drawerTender.stage)?.color || 'blue'}
                    style={{ borderRadius: '6px', padding: '2px 12px', fontWeight: 600, border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                  >
                    {drawerTender.stage}
                  </Tag>
                </div>

                {drawerTender.stage === 'WON' && !drawerTender.spk_file_key && (
                  <div style={{ marginTop: 16, background: '#fffbe6', padding: '12px 16px', borderRadius: 8, border: '1px solid #ffe58f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong style={{ color: '#d46b08', display: 'block' }}><ExclamationCircleOutlined /> SPK Belum Diunggah</Text>
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Grace period sedang berjalan.</Text>
                    </div>
                    <Upload showUploadList={false} beforeUpload={handleUploadMissingSpk} accept=".pdf,.png,.jpg,.jpeg">
                      <Button type="primary" size="small" icon={<UploadOutlined />} loading={isUploading} style={{ background: '#faad14', borderColor: '#faad14' }}>
                        Upload SPK
                      </Button>
                    </Upload>
                  </div>
                )}

                {drawerTender.legal_status === 'REVISION_REQUESTED' && (
                  <div style={{ marginTop: 16, background: '#fef2f2', padding: '12px 16px', borderRadius: 8, border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text strong style={{ color: '#b91c1c', display: 'block' }}><ExclamationCircleOutlined /> Revisi SPK Dibutuhkan</Text>
                      <Text style={{ fontSize: 12, color: '#7f1d1d' }}>Tim Legal menolak dokumen SPK terakhir.</Text>
                    </div>
                    <Upload showUploadList={false} beforeUpload={handleUploadMissingSpk} accept=".pdf,.png,.jpg,.jpeg">
                      <Button type="primary" danger size="small" icon={<UploadOutlined />} loading={isUploading}>
                        Upload Revisi SPK
                      </Button>
                    </Upload>
                  </div>
                )}

              </div>
            </div>
            
            {/* The Activity Stream takes up the rest of the height */}
            <div style={{ flex: 1, background: '#f8fafc', overflow: 'hidden' }}>
              <TenderActivityStream tenderId={drawerTender.id} />
            </div>
          </div>
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
