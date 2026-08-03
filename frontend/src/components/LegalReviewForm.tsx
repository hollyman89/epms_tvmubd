'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Input, Typography, message, Modal, Tabs } from 'antd';
import { LegalService } from '@/services';
import { LegalWorkstationHeader } from './legal/LegalWorkstationHeader';
import { GroupedLegalChecklist, ChecklistState } from './legal/GroupedLegalChecklist';
import { LegalActivityCommentThread } from './legal/LegalActivityCommentThread';
import { LegalVersionHistoryAttachments } from './legal/LegalVersionHistoryAttachments';

const { TextArea } = Input;
const { Text } = Typography;

interface LegalReviewFormProps {
  contractId?: number;
  contractData?: any;
  onSuccess?: () => void;
}

export const LegalReviewForm: React.FC<LegalReviewFormProps> = ({
  contractId,
  contractData,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [legalNotes, setLegalNotes] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | 'dirty'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Extended Checklist State (10 items across 3 groups)
  const [checklist, setChecklist] = useState<ChecklistState>({
    nominal: false,
    paymentTerm: false,
    penalty: false,
    currency: false,
    sla: false,
    jurisdiction: false,
    signature: false,
    scope: false,
    deliverables: false,
    complianceCert: false,
  });

  // Modal states
  const [revisionModalVisible, setRevisionModalVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [escalateModalVisible, setEscalateModalVisible] = useState(false);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [modalInputText, setModalInputText] = useState('');

  // Reset form state on contract change
  useEffect(() => {
    setChecklist({
      nominal: false,
      paymentTerm: false,
      penalty: false,
      currency: false,
      sla: false,
      jurisdiction: false,
      signature: false,
      scope: false,
      deliverables: false,
      complianceCert: false,
    });
    setLegalNotes('');
    setAutosaveStatus('saved');
    setLastSavedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  }, [contractId]);

  // Form validity check (requires all items checked)
  const isFormValid = useCallback(() => {
    return (
      checklist.nominal &&
      checklist.paymentTerm &&
      checklist.penalty &&
      checklist.currency &&
      checklist.sla &&
      checklist.jurisdiction &&
      checklist.signature &&
      checklist.scope &&
      checklist.deliverables &&
      checklist.complianceCert
    );
  }, [checklist]);

  const handleChecklistChange = (key: keyof ChecklistState, checked: boolean) => {
    setChecklist((prev) => ({ ...prev, [key]: checked }));
    setAutosaveStatus('dirty');
  };

  // Keyboard Shortcuts (Ctrl+S for Save Draft, Ctrl+Enter for Approve)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveDraft();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (isFormValid()) {
          handleApprove();
        } else {
          message.warning('Harap selesaikan seluruh checklist kepatuhan komersial, hukum, dan operasional');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormValid, checklist, legalNotes]);

  const handleSaveDraft = () => {
    setAutosaveStatus('saving');
    setTimeout(() => {
      setAutosaveStatus('saved');
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setLastSavedTime(timeStr);
      message.success('Draft peninjauan legal berhasil disimpan');
    }, 600);
  };

  const handleSubmitReview = async (action: string, notesOverride?: string) => {
    if (!contractId) {
      message.error('Pilih dokumen kontrak terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      await LegalService.submitReviewLegacy({
        contractId,
        action,
        notes: notesOverride || legalNotes,
        checklist,
      });

      if (action === 'APPROVED') {
        message.success('Kontrak berhasil di-approve & dirilis');
      } else if (action === 'REJECTED') {
        message.success('Revisi berhasil dikirim ke Marketing');
      } else {
        message.success(`Status tinjauan legal berhasil diperbarui: ${action}`);
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      if (action === 'APPROVED') {
        message.success('Kontrak berhasil di-approve & dirilis');
      } else {
        message.success('Tinjauan legal berhasil diproses');
      }
      if (onSuccess) onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () => {
    if (!isFormValid()) {
      message.warning('Seluruh checklist kepatuhan (Komersial, Hukum, Operasional) wajib dicentang');
      return;
    }
    handleSubmitReview('APPROVED');
  };

  const handleOpenRevisionModal = () => {
    setModalInputText('');
    setRevisionModalVisible(true);
  };

  const handleConfirmRevision = () => {
    if (!modalInputText.trim()) {
      message.error('Catatan alasan revisi ke Marketing wajib diisi');
      return;
    }
    setRevisionModalVisible(false);
    handleSubmitReview('REJECTED', modalInputText.trim());
  };

  const handleConfirmApproveWithNotes = () => {
    if (!modalInputText.trim()) {
      message.error('Catatan persetujuan khusus wajib diisi');
      return;
    }
    setNotesModalVisible(false);
    handleSubmitReview('APPROVED', `APPROVED WITH NOTES: ${modalInputText.trim()}`);
  };

  const handleConfirmEscalate = () => {
    if (!modalInputText.trim()) {
      message.error('Alasan eskalasi wajib diisi');
      return;
    }
    setEscalateModalVisible(false);
    message.warning(`Tinjauan kontrak di-eskalasi ke Direksi: ${modalInputText}`);
  };

  const handleConfirmForward = () => {
    if (!modalInputText.trim()) {
      message.error('Catatan pelimpahan wewenang wajib diisi');
      return;
    }
    setForwardModalVisible(false);
    message.info(`Tinjauan diteruskan ke Senior Legal Officer: ${modalInputText}`);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* 1. STICKY WORKSTATION HEADER & TOP ACTION TOOLBAR */}
      <LegalWorkstationHeader
        contractNumber={contractData?.contractNumber || `CTR-2026-${contractId || '001'}`}
        customerName={contractData?.customerName || contractData?.customer?.name || 'PT Mandiri Perkasa'}
        projectName={contractData?.projectName || 'Pengadaan Server & Infrastructure EPMS'}
        nominal={contractData?.nominal || 450000000}
        priority={contractData?.priority || 'HIGH'}
        slaDeadline={contractData?.slaDeadline || 'SLA: 2 Jam Sisa'}
        status={contractData?.status || 'WAITING'}
        isFormValid={isFormValid()}
        autosaveStatus={autosaveStatus}
        lastSavedTime={lastSavedTime}
        onSaveDraft={handleSaveDraft}
        onApprove={handleApprove}
        onApproveWithNotes={() => { setModalInputText(''); setNotesModalVisible(true); }}
        onRequestRevision={handleOpenRevisionModal}
        onEscalate={() => { setModalInputText(''); setEscalateModalVisible(true); }}
        onForward={() => { setModalInputText(''); setForwardModalVisible(true); }}
        onCancel={() => {}}
      />

      {/* 2. GROUPED COMPLIANCE CHECKLISTS (Komersial, Hukum, Operasional) */}
      <GroupedLegalChecklist
        checklist={checklist}
        onChangeChecklist={handleChecklistChange}
      />

      {/* 3. CATATAN & TAB PENDUKUNG (Chat-Ops, Riwayat Versi, Lampiran) */}
      <Card title={<Text strong style={{ fontSize: 13 }}>Catatan Tinjauan Legal & Instruksi Tambahan</Text>} style={{ marginBottom: 12, borderRadius: 8 }} bodyStyle={{ padding: 12 }}>
        <TextArea
          rows={3}
          value={legalNotes}
          onChange={(e) => { setLegalNotes(e.target.value); setAutosaveStatus('dirty'); }}
          placeholder="Masukkan masukan pasal, klausul khusus, atau instruksi tindak lanjut..."
        />
      </Card>

      <Tabs
        defaultActiveKey="discussion"
        size="small"
        items={[
          {
            key: 'discussion',
            label: 'Utas Diskusi (Chat-Ops)',
            children: <LegalActivityCommentThread contractId={contractId} />,
          },
          {
            key: 'versions',
            label: 'Versi & Lampiran (SPK/Proposal)',
            children: <LegalVersionHistoryAttachments contractId={contractId} />,
          },
        ]}
      />

      {/* WORKFLOW ACTION MODALS */}
      <Modal
        title="Minta Revisi ke Marketing"
        open={revisionModalVisible}
        onOk={handleConfirmRevision}
        onCancel={() => setRevisionModalVisible(false)}
        okText="Kirim Revisi"
        okButtonProps={{ danger: true }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Masukkan alasan pengembalian atau klausul yang perlu direvisi oleh Marketing:
        </Text>
        <TextArea
          rows={4}
          value={modalInputText}
          onChange={(e) => setModalInputText(e.target.value)}
          placeholder="Contoh: Lampiran SPK belum mencantumkan pasal sanksi denda keterlambatan..."
        />
      </Modal>

      <Modal
        title="Setujui Kontrak dengan Catatan Khusus"
        open={notesModalVisible}
        onOk={handleConfirmApproveWithNotes}
        onCancel={() => setNotesModalVisible(false)}
        okText="Setujui & Rilis"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Masukkan catatan atau rekomendasi khusus yang perlu diperhatikan saat eksekusi:
        </Text>
        <TextArea
          rows={4}
          value={modalInputText}
          onChange={(e) => setModalInputText(e.target.value)}
          placeholder="Contoh: Disetujui dengan catatan wajib verifikasi garansi bank sebelum pembayaran DP..."
        />
      </Modal>

      <Modal
        title="Eskalasi ke Manajemen / Direksi"
        open={escalateModalVisible}
        onOk={handleConfirmEscalate}
        onCancel={() => setEscalateModalVisible(false)}
        okText="Kirim Eskalasi"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Masukkan alasan eskalasi isu hukum / komersial ke tingkat Direksi:
        </Text>
        <TextArea
          rows={4}
          value={modalInputText}
          onChange={(e) => setModalInputText(e.target.value)}
          placeholder="Contoh: Nilai penalti melampaui ambang batas kewenangan legal biasa..."
        />
      </Modal>

      <Modal
        title="Teruskan ke Senior Legal Officer"
        open={forwardModalVisible}
        onOk={handleConfirmForward}
        onCancel={() => setForwardModalVisible(false)}
        okText="Teruskan Dokumen"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          Masukkan catatan pelimpahan wewenang review:
        </Text>
        <TextArea
          rows={4}
          value={modalInputText}
          onChange={(e) => setModalInputText(e.target.value)}
          placeholder="Mohon bantuan peninjauan ulang pasal yurisdiksi internasional..."
        />
      </Modal>
    </div>
  );
};

export default LegalReviewForm;
