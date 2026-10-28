import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { ExecutiveFact, ExecutiveKpi, ExecutiveOverview, ExecutivePeriod, ExecutiveRisk, KpiTarget, PeriodWindow, jakartaDay, periodWindow } from './executive.types';

const OPEN_TERMINAL = ['WON', 'LOST', 'CANCELLED'];
const FINISHED_PROJECTS = ['COMPLETED', 'CLOSED', 'CANCELLED'];
const money = (facts: ExecutiveFact[]) => facts.reduce((sum, fact) => sum.plus(fact.amount ?? '0'), new Decimal(0)).toFixed(2);
const keys = (facts: ExecutiveFact[]) => facts.map(f => `${f.kind}:${f.sourceId}`);
const openOpportunities = (facts: ExecutiveFact[]) => facts.filter(f => f.kind === 'OPPORTUNITY' && !OPEN_TERMINAL.includes(f.data.status));
const activeContracts = (facts: ExecutiveFact[]) => facts.filter(f => f.kind === 'CONTRACT' && f.data.status === 'ACTIVE');
const inside = (day: string | null, p: PeriodWindow) => !!day && day >= p.startDate && day <= p.endDate;

@Injectable()
export class ExecutiveKpiService {
  calculate(facts: ExecutiveFact[], targets: KpiTarget[], period: PeriodWindow, asOf: Date): ExecutiveKpi[] {
    const measured = (code: string, label: string, rows: ExecutiveFact[], basis: 'PERIOD' | 'SNAPSHOT', definition: string): ExecutiveKpi => {
      const missing = rows.some(r => r.amount === null);
      const known = rows.filter(r => r.amount !== null);
      const actual = missing && !known.length ? null : money(known);
      // Snapshot targets must explicitly use the cut-off day, never a period-flow target.
      const target = targets.filter(t => t.metricCode === code && t.startDate === (basis === 'SNAPSHOT' ? jakartaDay(asOf) : period.startDate) && t.endDate === (basis === 'SNAPSHOT' ? jakartaDay(asOf) : period.endDate)).sort((a,b) => b.version-a.version)[0];
      const comparable = actual !== null && !missing && !!target;
      return {
        code, label, unit: 'IDR', basis, actual, target: target?.amount ?? null, targetVersion: target?.version ?? null,
        variance: comparable ? new Decimal(actual).minus(target.amount).toFixed(2) : null,
        attainmentPct: comparable && new Decimal(target.amount).gt(0) ? new Decimal(actual).div(target.amount).times(100).toFixed(2) : null,
        availability: missing ? (known.length ? 'PARTIAL' : 'UNAVAILABLE') : 'AVAILABLE',
        reason: missing ? 'Sebagian nilai sumber belum diisi; angka yang tersedia belum mewakili keseluruhan.' : null,
        definition, evidence: keys(rows), trend: basis === 'SNAPSHOT' ? [{date: jakartaDay(asOf), actual, target: target?.amount ?? null}] : [],
      };
    };
    const payments = facts.filter(f => f.kind === 'VENDOR_PAYMENT' && inside(f.occurredOn, period));
    const paid = measured('VENDOR_DISBURSEMENTS', 'Pembayaran vendor', payments, 'PERIOD', 'Kas keluar yang tercatat pada pembayaran vendor dalam periode terpilih; bukan penerimaan pelanggan atau biaya yang diakui.');
    // Missing historical buckets are not fabricated as zero; future months are never actuals.
    const months = new Map<string, ExecutiveFact[]>();
    for (const fact of payments) { const month = fact.occurredOn.slice(0,7); months.set(month, [...(months.get(month) || []), fact]); }
    let cursor = period.startDate.slice(0,7) + '-01';
    while(cursor <= period.endDate) {
      const rows = months.get(cursor.slice(0,7));
      paid.trend.push({date: cursor, actual: rows ? money(rows) : null, target: null});
      const d = new Date(cursor + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth()+1); cursor = d.toISOString().slice(0,10);
    }
    const unavailable = (code: string, label: string, reason: string, unit: 'IDR' | 'PERCENT' = 'IDR'): ExecutiveKpi => ({code,label,unit,basis:'PERIOD',actual:null,target:null,targetVersion:null,variance:null,attainmentPct:null,availability:'UNAVAILABLE',reason,definition:reason,evidence:[],trend:[]});
    return [
      measured('OPEN_PIPELINE','Peluang bisnis terbuka',openOpportunities(facts),'SNAPSHOT','Nilai negosiasi atau estimasi peluang yang belum WON/LOST/CANCELLED pada cut-off. Ini posisi saat ini, bukan kontrak baru dalam periode.'),
      measured('ACTIVE_CONTRACT_VALUE','Nilai kontrak aktif',activeContracts(facts),'SNAPSHOT','Nilai kontrak berstatus ACTIVE, dihitung satu kali per kontrak. Bukan backlog revenue dan bukan pendapatan diakui.'),
      paid,
      unavailable('RECOGNIZED_REVENUE','Pendapatan diakui','Sumber posting pengakuan pendapatan belum terhubung.'),
      unavailable('CUSTOMER_COLLECTIONS','Penerimaan pelanggan','Sumber penerimaan pelanggan dan alokasinya belum terhubung.'),
      unavailable('GROSS_MARGIN','Margin kotor','Memerlukan pendapatan diakui dan biaya terkait pada basis yang sama.','PERCENT'),
    ];
  }
}

@Injectable()
export class BusinessFlowEngine {
  calculate(kpis: ExecutiveKpi[]): ExecutiveOverview['flow'] {
    const stage = (code: string, label: string, metric: string, note: string) => {
      const kpi = kpis.find(k=>k.code===metric);
      return {code,label,value:kpi?.actual ?? null,availability:kpi?.availability ?? 'UNAVAILABLE' as const,note};
    };
    return {mode:'SNAPSHOT',conversionRate:null,reason:'Posisi nilai bisnis, bukan funnel konversi. Histori cohort dan alokasi kontrak–invoice pelanggan belum tersedia.',stages:[
      stage('PIPELINE','Pipeline terbuka','OPEN_PIPELINE','Peluang yang masih terbuka'),
      stage('CONTRACT','Kontrak aktif','ACTIVE_CONTRACT_VALUE','Satu nilai per kontrak'),
      {code:'INVOICE',label:'Invoice pelanggan',value:null,availability:'UNAVAILABLE',note:'Sumber piutang pelanggan belum terhubung'},
      stage('PAYMENT','Penerimaan pelanggan','CUSTOMER_COLLECTIONS','Terpisah dari pembayaran vendor'),
    ]};
  }
}

@Injectable()
export class SlaEngine {
  calculate(facts: ExecutiveFact[], asOf: Date): ExecutiveOverview['sla'] {
    const tasks = facts.filter(f=>f.kind==='WORKFLOW_TASK' && f.data.status==='PENDING');
    const withoutDeadline = tasks.filter(f=>!f.data.dueAt).length;
    const overdue = tasks.filter(f=>f.data.dueAt && new Date(f.data.dueAt).getTime()<asOf.getTime()).length;
    return {basis:'PERSISTED_DUE_DATE',overdue,withoutDeadline,availability:withoutDeadline?'PARTIAL':'AVAILABLE',note:'Evaluasi tenggat resmi task. Kalender kerja, pause dan episode rework belum diproyeksikan; hasil ini bukan pengukuran SLA jam kerja.'};
  }
}

@Injectable()
export class RiskEngine {
  calculate(facts: ExecutiveFact[], asOf: Date, sla: ExecutiveOverview['sla']): ExecutiveOverview['risks'] {
    const today=jakartaDay(asOf);
    const contracts = new Map(facts.filter(f=>f.kind==='CONTRACT').map(f=>[f.sourceId,f]));
    const items: ExecutiveRisk[]=[];
    // One risk per overdue project; contract value is never falsely called expected loss.
    for(const project of facts.filter(f=>f.kind==='PROJECT' && !FINISHED_PROJECTS.includes(f.data.status) && f.data.endDate && f.data.endDate<today)) {
      const contract = contracts.get(String(project.data.contractId));
      items.push({id:`PROJECT_DUE:${project.sourceId}`,title:project.data.name, severity:'HIGH',exposure:contract?.amount ?? null,exposureBasis:'Nilai kontrak terkait; bukan estimasi kerugian. Dapat tumpang tindih antarproyek.',owner:project.data.ownerName || 'PM belum ditetapkan',dueOn:project.data.endDate,reason:'Tanggal selesai rencana telah lewat dan proyek belum selesai.',actionTarget:`/project-delivery?projectId=${project.sourceId}`,evidence:keys([project,...(contract?[contract]:[])])});
    }
    for(const risk of facts.filter(f=>f.kind==='PROJECT_RISK' && ['HIGH','CRITICAL'].includes(f.data.level) && !['CLOSED','CANCELLED'].includes(f.data.status))) {
      items.push({id:`REGISTERED_RISK:${risk.sourceId}`,title:risk.data.title,severity:risk.data.level,exposure:null,exposureBasis:'Nilai dampak finansial belum tersedia.',owner:risk.data.ownerName || 'Owner belum tersedia',dueOn:risk.data.targetDate,reason:risk.data.mitigation || 'Tinjau mitigasi risiko yang dicatat pemilik proyek.',actionTarget:`/project-delivery?projectId=${risk.data.projectId}`,evidence:keys([risk])});
    }
    items.sort((a,b)=>(a.severity==='CRITICAL'?-1:1)-(b.severity==='CRITICAL'?-1:1)||(a.dueOn||'9999').localeCompare(b.dueOn||'9999'));
    const missingDates = facts.filter(f=>f.kind==='PROJECT' && !FINISHED_PROJECTS.includes(f.data.status) && !f.data.endDate).length;
    return {items,evaluatedRules:['Tanggal selesai proyek','Risiko HIGH/CRITICAL tercatat','Tenggat task workflow'],unavailableRules:[
      'Piutang pelanggan lewat jatuh tempo: sumber AR belum terhubung.',
      'Shortfall kas dan erosi margin: sumber kas/revenue/cost belum lengkap.',
      ...(missingDates?[`${missingDates} proyek aktif belum memiliki tanggal selesai.`]:[]),
      ...(sla.withoutDeadline?[`${sla.withoutDeadline} task belum memiliki tenggat.`]:[]),
    ],coverage:'PARTIAL'};
  }
}

@Injectable()
export class ForecastEngine {
  calculate(facts: ExecutiveFact[], asOf: Date): ExecutiveOverview['forecast'] {
    const start=jakartaDay(asOf), end=jakartaDay(new Date(asOf.getTime()+90*86400000));
    const open=openOpportunities(facts);
    const rows=open.filter(f=>f.amount!==null && f.data.expectedClose>=start && f.data.expectedClose<=end && f.data.probability!==null && Number.isFinite(Number(f.data.probability)) && Number(f.data.probability)>=0 && Number(f.data.probability)<=100);
    const excluded=open.length-rows.length;
    const weighted=rows.reduce((v,f)=>v.plus(new Decimal(f.amount).times(f.data.probability).div(100)),new Decimal(0));
    return {label:'Potensi kontrak 90 hari',amount:rows.length?weighted.toFixed(2):null,nominal:rows.length?money(rows):null,horizonEnd:end,availability:rows.length?(excluded?'PARTIAL':'AVAILABLE'):'UNAVAILABLE',method:'ASSUMPTION_BASED',covered:rows.length,excluded,assumptions:[
      'Nilai peluang × probabilitas yang diisi di EPMS; belum dikalibrasi terhadap histori kemenangan.',
      'Hanya peluang dengan tanggal penutupan dalam 90 hari dan nilai/probabilitas yang valid.',
      'Ini potensi kontrak, bukan forecast pendapatan atau saldo kas. Forecast kas menunggu sumber AR, AP terjadwal, dan saldo awal.',
    ]};
  }
}

@Injectable()
export class ExecutiveSummaryGenerator {
  generate(kpis: ExecutiveKpi[], risks: ExecutiveOverview['risks'], sla: ExecutiveOverview['sla']): ExecutiveOverview['brief'] {
    const brief: ExecutiveOverview['brief']=[];
    const comparable=kpis.find(k=>k.variance!==null);
    if(comparable) brief.push({text:`${comparable.label}: realisasi Rp${new Decimal(comparable.actual).toFixed(0)} terhadap target Rp${new Decimal(comparable.target).toFixed(0)}.`,evidence:[`KPI:${comparable.code}`],tone:'NEUTRAL'});
    else brief.push({text:kpis.some(k=>k.target!==null)?'Target tersedia, tetapi data realisasi belum cukup lengkap untuk menilai pencapaiannya.':'Target yang disetujui untuk periode ini belum tersedia; pencapaian terhadap target belum dapat dinilai.',evidence:['TARGET_COVERAGE'],tone:'NEUTRAL'});
    if(risks.items.length) brief.push({text:`${risks.items.length} temuan risiko proyek memerlukan peninjauan. Nilai kontrak terkait tidak sama dengan estimasi kerugian.`,evidence:risks.items.map(r=>r.id),tone:'WARNING'});
    else brief.push({text:'Tidak ditemukan proyek melewati tanggal selesai atau risiko HIGH/CRITICAL pada cakupan yang dievaluasi. Risiko kas dan margin belum dapat disimpulkan.',evidence:['PROJECT_DUE','REGISTERED_RISK'],tone:'NEUTRAL'});
    if(sla.overdue) brief.push({text:`${sla.overdue} task workflow melewati tenggat resminya. Tinjau penanggung jawab dan keputusan yang tertahan.`,evidence:['WORKFLOW_DUE'],tone:'WARNING'});
    else brief.push({text:'Sumber pendapatan diakui dan penerimaan pelanggan belum terhubung. Pembayaran vendor ditampilkan terpisah sebagai kas keluar.',evidence:['SOURCE_COVERAGE'],tone:'NEUTRAL'});
    return brief;
  }
}

export function buildExecutiveOverview(facts: ExecutiveFact[], targets: KpiTarget[], type: ExecutivePeriod, asOf: Date, snapshotId: string): ExecutiveOverview {
  const period=periodWindow(type,asOf);
  const kpis=new ExecutiveKpiService().calculate(facts,targets,period,asOf);
  const sla=new SlaEngine().calculate(facts,asOf);
  const risks=new RiskEngine().calculate(facts,asOf,sla);
  return {meta:{schemaVersion:1,snapshotId,asOf:asOf.toISOString(),generatedAt:new Date().toISOString(),timezone:'Asia/Jakarta',scope:'INSTALLATION',currency:'IDR',period,freshness:'FRESH',availability:'PARTIAL',sources:[
    ...['Peluang','Kontrak','Proyek','Pembayaran vendor','Risiko proyek','Task workflow'].map(name=>({name,availability:'AVAILABLE' as const,reason:null})),
    ...['Pengakuan pendapatan','Penerimaan pelanggan','Biaya pengakuan margin'].map(name=>({name,availability:'UNAVAILABLE' as const,reason:'Sumber belum terhubung'})),
  ]},kpis,flow:new BusinessFlowEngine().calculate(kpis),risks,sla,forecast:new ForecastEngine().calculate(facts,asOf),brief:new ExecutiveSummaryGenerator().generate(kpis,risks,sla)};
}
