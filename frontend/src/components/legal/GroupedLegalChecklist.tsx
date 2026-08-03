'use client';

import React from 'react';
import { Checkbox, Typography, Collapse } from 'antd';

const { Text } = Typography;

export interface ChecklistState {
  nominal: boolean;
  paymentTerm: boolean;
  penalty: boolean;
  currency: boolean;
  sla: boolean;
  jurisdiction: boolean;
  signature: boolean;
  scope: boolean;
  deliverables: boolean;
  complianceCert: boolean;
}

interface GroupedLegalChecklistProps {
  checklist: ChecklistState;
  onChangeChecklist: (key: keyof ChecklistState, checked: boolean) => void;
}

export const GroupedLegalChecklist: React.FC<GroupedLegalChecklistProps> = ({
  checklist,
  onChangeChecklist,
}) => {
  // Pemastian Boolean Eksplisit & Fallback Safe State
  const safeChecklist: ChecklistState = {
    nominal: Boolean(checklist?.nominal),
    paymentTerm: Boolean(checklist?.paymentTerm),
    penalty: Boolean(checklist?.penalty),
    currency: Boolean(checklist?.currency),
    sla: Boolean(checklist?.sla),
    jurisdiction: Boolean(checklist?.jurisdiction),
    signature: Boolean(checklist?.signature),
    scope: Boolean(checklist?.scope),
    deliverables: Boolean(checklist?.deliverables),
    complianceCert: Boolean(checklist?.complianceCert),
  };

  // 1. Kalkulasi Kepatuhan Komersial (4 items)
  const commCount =
    (safeChecklist.nominal ? 1 : 0) +
    (safeChecklist.paymentTerm ? 1 : 0) +
    (safeChecklist.penalty ? 1 : 0) +
    (safeChecklist.currency ? 1 : 0);
  const commTotal = 4;
  const commPercent = Math.round((commCount / commTotal) * 100);

  // 2. Kalkulasi Kepatuhan Hukum (3 items)
  const legalCount =
    (safeChecklist.sla ? 1 : 0) +
    (safeChecklist.jurisdiction ? 1 : 0) +
    (safeChecklist.signature ? 1 : 0);
  const legalTotal = 3;
  const legalPercent = Math.round((legalCount / legalTotal) * 100);

  // 3. Kalkulasi Kepatuhan Operasional (3 items)
  const opsCount =
    (safeChecklist.scope ? 1 : 0) +
    (safeChecklist.deliverables ? 1 : 0) +
    (safeChecklist.complianceCert ? 1 : 0);
  const opsTotal = 3;
  const opsPercent = Math.round((opsCount / opsTotal) * 100);

  // Kalkulasi Total Keseluruhan (10 items)
  const checkedTotal = commCount + legalCount + opsCount;
  const grandTotal = 10;
  const percentTotal = Math.round((checkedTotal / grandTotal) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Header Minimalis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <Text strong style={{ fontSize: 14, color: '#0f172a' }}>Checklist Review</Text>
        <Text style={{ fontSize: 13, color: '#64748b' }}>{checkedTotal} / {grandTotal} Completed</Text>
      </div>

      {/* 2. Kategori Accordion */}
      <Collapse
        defaultActiveKey={['commercial', 'legal', 'operational']}
        ghost
        expandIconPosition="end"
        style={{ padding: 0 }}
        items={[
          {
            key: 'commercial',
            style: { borderBottom: '1px solid #f1f5f9', paddingBottom: 4, marginBottom: 4 },
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Text strong style={{ fontSize: 13, color: '#334155' }}>Kepatuhan Komersial</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>{commCount}/{commTotal}</Text>
              </div>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 4, paddingTop: 4, paddingBottom: 8 }}>
                <Checkbox checked={safeChecklist.nominal} onChange={(e) => onChangeChecklist('nominal', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Nominal & Nilai Kontrak Sesuai Hasil Negosiasi Sistem</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.paymentTerm} onChange={(e) => onChangeChecklist('paymentTerm', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Termin Pembayaran & Skema Bank Sesuai Ketentuan EPMS</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.penalty} onChange={(e) => onChangeChecklist('penalty', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Klausul Denda Keterlambatan (1‰ per Hari) Tercantum Jelas</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.currency} onChange={(e) => onChangeChecklist('currency', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Mata Uang & Klausul Fluktuasi Kurs Sesuai Standar Perusahaan</span>
                </Checkbox>
              </div>
            ),
          },
          {
            key: 'legal',
            style: { borderBottom: '1px solid #f1f5f9', paddingBottom: 4, marginBottom: 4 },
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Text strong style={{ fontSize: 13, color: '#334155' }}>Kepatuhan Hukum</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>{legalCount}/{legalTotal}</Text>
              </div>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 4, paddingTop: 4, paddingBottom: 8 }}>
                <Checkbox checked={safeChecklist.sla} onChange={(e) => onChangeChecklist('sla', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Klausul SLA & Tanggung Jawab Hukum Terakomodasi Resmi</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.jurisdiction} onChange={(e) => onChangeChecklist('jurisdiction', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Yurisdiksi Pengadilan & Hukum Republik Indonesia Terdaftar</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.signature} onChange={(e) => onChangeChecklist('signature', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Keabsahan Tanda Tangan & Stempel Digital Pejabat Berwenang</span>
                </Checkbox>
              </div>
            ),
          },
          {
            key: 'operational',
            style: { paddingBottom: 4 },
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Text strong style={{ fontSize: 13, color: '#334155' }}>Kepatuhan Operasional</Text>
                <Text style={{ fontSize: 12, color: '#94a3b8' }}>{opsCount}/{opsTotal}</Text>
              </div>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 4, paddingTop: 4, paddingBottom: 8 }}>
                <Checkbox checked={safeChecklist.scope} onChange={(e) => onChangeChecklist('scope', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Rincian Lingkup Pekerjaan (Scope of Work) Sesuai SPK/Proposal</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.deliverables} onChange={(e) => onChangeChecklist('deliverables', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Jadwal Serah Terima & Milestone Berita Acara (GR) Terdefinisi</span>
                </Checkbox>
                <Checkbox checked={safeChecklist.complianceCert} onChange={(e) => onChangeChecklist('complianceCert', e.target.checked)} style={{ alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>Lampiran Sertifikat Kepatuhan K3 & Perizinan Berusaha Lengkap</span>
                </Checkbox>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
