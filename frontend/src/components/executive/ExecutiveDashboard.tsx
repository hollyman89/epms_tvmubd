'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { ExecutiveMetric, ExecutivePeriod, getExecutiveOverview } from '@/services/executive.service';
import { executiveDate, executiveMoney, executiveTarget } from '@/lib/executivePresentation';
import styles from './ExecutiveDashboard.module.css';

const PERIODS:Array<{value:ExecutivePeriod;label:string}>=[
  {value:'YEAR_TO_DATE',label:'Tahun berjalan'},{value:'THIS_MONTH',label:'Bulan ini'},
  {value:'LAST_MONTH',label:'Bulan lalu'},{value:'THIS_QUARTER',label:'Kuartal ini'},{value:'LAST_QUARTER',label:'Kuartal lalu'},
];
const metricValue=(metric:ExecutiveMetric,value:string|null,compact=false)=>value===null?'—':metric.unit==='PERCENT'?`${Number(value).toLocaleString('id-ID',{maximumFractionDigits:2})}%`:executiveMoney(value,compact);

function MetricTrend({metric}:{metric:ExecutiveMetric}) {
  const points=metric.trend;
  const known=points.filter(p=>p.actual!==null);
  const area=useRef<HTMLDivElement>(null);
  const [chartWidth,setChartWidth]=useState(600);
  useEffect(()=>{if(!area.current)return;const observer=new ResizeObserver(entries=>setChartWidth(Math.max(250,entries[0].contentRect.width)));observer.observe(area.current);return()=>observer.disconnect();},[metric.code,known.length]);
  if(!known.length) return <div className={styles.chartEmpty}><span className={styles.emptySymbol}>↗</span><strong>Tren belum tersedia</strong><p>{metric.reason || 'Belum ada histori yang terverifikasi untuk periode ini.'}</p></div>;
  if(known.length===1) return <div className={styles.singlePoint}><div className={styles.pointMark}/><strong>{metricValue(metric,known[0].actual,true)}</strong><span>{executiveDate(known[0].date)}</span><p>{metric.basis==='SNAPSHOT'?'Satu posisi tersimpan. Tren akan terbentuk dari pembaruan data berikutnya.':'Satu periode memiliki data pembayaran. Bulan tanpa histori terverifikasi tidak diisi nol.'}</p></div>;
  const width=chartWidth,height=220,left=58,right=20,top=22,bottom=40;
  const values=points.flatMap(p=>[p.actual===null?0:Number(p.actual),p.target===null?0:Number(p.target)]);
  const min=Math.min(0,...values),max=Math.max(...values,1)*1.12;
  const x=(i:number)=>left+i*(width-left-right)/Math.max(points.length-1,1);
  const y=(n:number)=>height-bottom-((n-min)/(max-min))*(height-top-bottom);
  const seriesPath=(key:'actual'|'target')=>{let connected=false;return points.map((p,i)=>{if(p[key]===null){connected=false;return '';}const v=`${connected?'L':'M'}${x(i)},${y(Number(p[key]))}`;connected=true;return v;}).join(' ');};
  const hasTargets=points.some(p=>p.target!==null);
  return <>
    <div className={styles.chartLegend}><span><i/>Realisasi</span>{hasTargets && <span>┄ Target</span>}<span>Nilai dalam {metric.unit==='IDR'?'Rp miliar':'persen'}</span></div>
    <div ref={area}>
    <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Tren ${metric.label}; data kosong tidak disamakan dengan nol`}>
      {[0,0.5,1].map(p=>{const v=min+(max-min)*p;return <g key={p}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} className={styles.gridLine}/><text x={left-10} y={y(v)+4} textAnchor="end">{new Intl.NumberFormat('id-ID',{maximumFractionDigits:1}).format(v/(metric.unit==='IDR'?1e9:1))}</text></g>;})}
      {hasTargets && <path d={seriesPath('target')} className={styles.trendLine} style={{stroke:'#8093b0',strokeDasharray:'5 4'}}/>}
      <path d={seriesPath('actual')} className={styles.trendLine}/>
      {points.map((point,i)=><g key={point.date}>{point.actual!==null && <circle cx={x(i)} cy={y(Number(point.actual))} r="4" className={styles.trendDot}><title>{executiveDate(point.date)}: {metricValue(metric,point.actual)}</title></circle>}{(i===0 || i===points.length-1 || i%Math.ceil(points.length/4)===0) && <text x={x(i)} y={height-14} textAnchor={i===0?'start':i===points.length-1?'end':'middle'}>{new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:metric.basis==='SNAPSHOT'?'numeric':undefined,month:'short'}).format(new Date(point.date+'T00:00:00+07:00'))}</text>}</g>)}
    </svg>
    </div>
    <details className={styles.details}><summary>Lihat nilai per tanggal</summary><div className={styles.dataRows}>{points.map(p=><div key={p.date}><span>{executiveDate(p.date)}</span><strong>{p.actual===null?'Histori belum tersedia':metricValue(metric,p.actual)}</strong></div>)}</div></details>
  </>;
}

export function ExecutiveDashboard() {
  const {user}=useAuth();
  const [period,setPeriod]=useState<ExecutivePeriod>('YEAR_TO_DATE');
  const [selectedMetric,setSelectedMetric]=useState('OPEN_PIPELINE');
  const roleKey=(user?.roles||[]).map(String).sort().join(',');
  const query=useQuery({queryKey:['executive-bi',user?.sub,roleKey,period],queryFn:()=>getExecutiveOverview(period),enabled:!!user,staleTime:60000,refetchInterval:60000,retry:1});
  const data=query.data;
  const metric=useMemo(()=>data?.kpis.find(k=>k.code===selectedMetric)||data?.kpis[0],[data,selectedMetric]);
  const stale=data?.meta.freshness==='STALE'||query.isError;
  const header=<header className={styles.header}><div><span className={styles.eyebrow}>EPMS · KINERJA BISNIS</span><h1>Executive Dashboard</h1><p>Kinerja, risiko, dan keputusan yang membutuhkan perhatian.</p></div><div className={styles.controls}><label htmlFor="executive-period">Periode realisasi<select id="executive-period" value={period} onChange={e=>setPeriod(e.target.value as ExecutivePeriod)}>{PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label><button type="button" className={styles.refresh} onClick={()=>query.refetch()} disabled={query.isFetching}>{query.isFetching?'Memuat…':'↻ Muat ulang'}</button></div></header>;
  return <main className={styles.page}>
    {header}
    {!data && query.isPending && <section className={styles.loading} role="status"><div className={styles.loadingBar}/><h2>Menyiapkan ringkasan bisnis</h2><p>Memuat data analytics EPMS yang tersimpan.</p></section>}
    {!data && query.isError && <section className={styles.error} role="alert"><h2>Ringkasan BI belum dapat ditampilkan</h2><p>{(query.error as any)?.response?.data?.message || query.error.message}</p><p>Angka bisnis tidak ditampilkan sampai data berhasil dimuat.</p><button type="button" className={styles.refresh} onClick={()=>query.refetch()}>Coba lagi</button></section>}
    {data && <>
      <div className={styles.context}><span>Seluruh portofolio EPMS · IDR</span><span>{executiveDate(data.meta.period.startDate)} – {executiveDate(data.meta.period.endDate)}</span><span className={stale?styles.staleBadge:styles.neutralBadge}>{stale?'Data perlu diperbarui':'Cakupan data sebagian'}</span><span>Data per {executiveDate(data.meta.asOf,true)}</span></div>
      {query.isError && <div className={styles.warning} role="alert">Pembaruan gagal. Data terakhir tetap ditampilkan dengan waktu pembaruannya.</div>}
      <section className={styles.brief} aria-label="Ringkasan direksi"><div className={styles.briefHeading}>RINGKASAN DIREKSI<span>Berdasarkan data yang tersedia</span></div><ul>{data.brief.map((b,i)=><li key={i} className={b.tone==='WARNING'?styles.briefWarning:undefined}>{b.text}</li>)}</ul></section>
      <section className={styles.kpiGrid} aria-label="Indikator kinerja utama">{data.kpis.map(k=><button key={k.code} type="button" className={`${styles.kpi} ${k.actual===null?styles.unavailable:''}`} aria-pressed={k.code===metric?.code} onClick={()=>setSelectedMetric(k.code)}>
        <span className={styles.kpiTop}><span>{k.label}</span><span className={styles.kpiKind}>{k.basis==='SNAPSHOT'?'Posisi saat ini':'Periode terpilih'}</span></span>
        <strong className={styles.kpiValue} title={metricValue(k,k.actual)}>{k.actual===null?'Belum tersedia':metricValue(k,k.actual,true)}</strong>
        {k.actual!==null ? <><span className={styles.kpiTarget}>{k.target===null?'Target belum ditetapkan':`Target ${metricValue(k,k.target,true)}`}</span>{k.variance!==null && <span className={styles.kpiVariance}>Selisih {metricValue(k,k.variance,true)}{k.attainmentPct!==null?` · ${Number(k.attainmentPct).toLocaleString('id-ID')}% pencapaian`:''}</span>}{k.availability==='PARTIAL' && <span className={styles.kpiPartial}>Nilai sebagian · periksa cakupan</span>}</>:<span className={styles.kpiReason}>{k.reason}</span>}
      </button>)}</section>
      <div className={styles.mainGrid}>
        <section className={styles.panel}><div className={styles.panelHead}><div><h2>{metric?.label}</h2><p>{metric?.basis==='SNAPSHOT'?'Histori posisi yang tersimpan · maksimum 90 hari':'Realisasi pada periode terpilih'}</p></div><span className={styles.smallBadge}>Tren</span></div>{metric && <><MetricTrend metric={metric}/><div className={styles.definition}>{metric.definition}{metric.reason && <p>{metric.reason}</p>}</div><details className={styles.details}><summary>Definisi dan sumber angka</summary><p>Versi definisi 1 · {metric.evidence.length} referensi sumber tersimpan.</p><p>{metric.targetVersion?`Versi target ${metric.targetVersion}.`:'Belum ada target yang disetujui untuk basis tanggal ini.'}</p>{metric.evidence.length>0 && <p className={styles.evidence}>{metric.evidence.slice(0,12).join(' · ')}{metric.evidence.length>12?' …':''}</p>}</details></>}</section>
        <section className={styles.panel} aria-label="Tindakan yang diperlukan"><div className={styles.panelHead}><div><h2>Keputusan & tindakan</h2><p>To-Do yang ditujukan kepada Anda</p></div><span className={styles.smallBadge}>Cakupan parsial</span></div>
          {data.actions.availability==='UNAVAILABLE'?<div className={styles.actionEmpty}><strong>Tindakan belum dapat dipastikan</strong><p>{data.actions.note}</p></div>:data.actions.items.length===0?<div className={styles.actionEmpty}><strong>Belum ada tindakan yang terproyeksi</strong><p>Daftar kosong ini bukan pernyataan bahwa seluruh keputusan telah selesai. Periksa To-Do untuk cakupan lengkap.</p></div>:<div className={styles.actionList}>{data.actions.items.slice(0,5).map(action=><article key={action.id} className={styles.action}><strong>{action.title}</strong>{action.description && <p>{action.description}</p>}<div className={styles.actionMeta}><span>Tenggat: {executiveDate(action.dueAt)}</span>{action.exposure!==null && <span>Nilai terkait: {executiveMoney(action.exposure,true)}</span>}</div>{executiveTarget(action.actionTarget)?<Link className={styles.actionLink} href={executiveTarget(action.actionTarget)!}>{action.ctaLabel} →</Link>:<span className={styles.muted}>Tujuan tindakan belum tersedia.</span>}</article>)}</div>}
          {data.actions.asOf && <p className={styles.footnote}>To-Do diperbarui {executiveDate(data.actions.asOf,true)}. Status dan izin diperiksa kembali saat tindakan dibuka.</p>}
          <Link className={styles.actionLink} href="/inbox">Buka To-Do lengkap →</Link>
        </section>
      </div>
      <div className={styles.mainGrid}>
        <section className={styles.panel}><div className={styles.panelHead}><div><h2>Dari peluang menjadi kas</h2><p>Posisi nilai bisnis · setiap tahap memiliki basis berbeda</p></div></div><div className={styles.flow}>{data.flow.stages.map((stage,i)=><div className={styles.flowStage} key={stage.code}><span className={styles.stageIndex}>0{i+1}</span><h3>{stage.label}</h3><strong>{stage.value===null?'Belum tersedia':executiveMoney(stage.value,true)}</strong><p>{stage.note}</p></div>)}</div><p className={styles.footnote}>{data.flow.reason} Nilai antar-tahap tidak dijumlahkan.</p></section>
        <section className={styles.panel}><div className={styles.panelHead}><div><h2>Risiko prioritas</h2><p>Temuan yang memerlukan peninjauan</p></div></div>{data.risks.items.length===0?<div className={styles.actionEmpty}><strong>Tidak ada temuan pada indikator yang dievaluasi</strong><p>Kondisi kas, piutang, dan margin belum dapat dinyatakan aman.</p></div>:data.risks.items.slice(0,5).map(risk=><article key={risk.id} className={styles.risk}><div><span className={risk.severity==='CRITICAL'?styles.critical:styles.riskBadge}>{risk.severity==='CRITICAL'?'Kritis':'Perlu perhatian'}</span><h3>{risk.title}</h3><p>{risk.owner} · {executiveDate(risk.dueOn)}</p><p>{risk.reason}</p></div>{risk.exposure!==null && <strong title={risk.exposureBasis}>{executiveMoney(risk.exposure,true)}<small>Nilai kontrak terkait</small></strong>}{executiveTarget(risk.actionTarget) && <Link className={styles.riskLink} href={executiveTarget(risk.actionTarget)!}>Tinjau proyek →</Link>}</article>)}<details className={styles.details}><summary>Cakupan risiko yang belum dinilai</summary><ul>{data.risks.unavailableRules.map(r=><li key={r}>{r}</li>)}</ul></details></section>
      </div>
      <div className={styles.bottomGrid}>
        <section className={styles.panel}><div className={styles.panelHead}><div><h2>{data.forecast.label}</h2><p>Proyeksi berbasis asumsi sumber EPMS</p></div><span className={styles.smallBadge}>s.d. {executiveDate(data.forecast.horizonEnd)}</span></div><strong className={styles.forecastValue}>{data.forecast.amount===null?'Belum dapat dihitung':executiveMoney(data.forecast.amount,true)}</strong><p className={styles.footnote}>{data.forecast.covered} peluang memiliki nilai, probabilitas, dan tanggal penutupan dalam horizon; {data.forecast.excluded} peluang tidak tercakup.</p><details className={styles.details} open><summary>Asumsi dan batasan proyeksi</summary><ul>{data.forecast.assumptions.map(a=><li key={a}>{a}</li>)}</ul></details></section>
        <section className={styles.panel}><div className={styles.panelHead}><div><h2>Tenggat keputusan</h2><p>Task workflow pada seluruh portofolio</p></div></div><div className={styles.slaNumbers}><div><strong>{data.sla.overdue}</strong><span>Melewati tenggat</span></div><div><strong>{data.sla.withoutDeadline}</strong><span>Belum memiliki tenggat</span></div></div><p className={styles.footnote}>{data.sla.note}</p></section>
      </div>
      <details className={`${styles.panel} ${styles.sources}`}><summary>Ketersediaan sumber data</summary><div className={styles.sourceGrid}>{data.meta.sources.map(s=><div key={s.name}><span>{s.name}</span><strong className={s.availability==='AVAILABLE'?styles.sourceAvailable:styles.muted}>{s.availability==='AVAILABLE'?'Terhubung':'Belum terhubung'}</strong></div>)}</div><p className={styles.footnote}>Nilai yang belum tersedia tidak diganti dengan nol. Seluruh angka yang ditampilkan berasal dari data EPMS.</p></details>
      <footer className={styles.footer}><span>EPMS · Executive Business Intelligence</span><span>Realisasi, posisi saat ini, dan proyeksi ditampilkan dengan basis masing-masing.</span></footer>
    </>}
  </main>;
}
