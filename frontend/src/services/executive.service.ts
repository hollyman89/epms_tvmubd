import { apiClient } from '@/lib/axios';

export type ExecutivePeriod='YEAR_TO_DATE'|'THIS_MONTH'|'LAST_MONTH'|'THIS_QUARTER'|'LAST_QUARTER';
export type DataAvailability='AVAILABLE'|'PARTIAL'|'UNAVAILABLE';
export interface ExecutiveMetric {
  code:string;label:string;unit:'IDR'|'PERCENT';basis:'SNAPSHOT'|'PERIOD';
  actual:string|null;target:string|null;targetVersion:number|null;variance:string|null;attainmentPct:string|null;
  availability:DataAvailability;reason:string|null;definition:string;evidence:string[];
  trend:Array<{date:string;actual:string|null;target:string|null}>;
}
export interface ExecutiveOverview {
  meta:{schemaVersion:1;snapshotId:string;asOf:string;generatedAt:string;timezone:string;scope:string;currency:string;
    period:{type:ExecutivePeriod;startDate:string;endDate:string};freshness:'FRESH'|'STALE';availability:DataAvailability;
    sources:Array<{name:string;availability:DataAvailability;reason:string|null}>};
  kpis:ExecutiveMetric[];
  brief:Array<{text:string;evidence:string[];tone:'NEUTRAL'|'WARNING'}>;
  flow:{mode:'SNAPSHOT';conversionRate:null;reason:string;stages:Array<{code:string;label:string;value:string|null;availability:DataAvailability;note:string}>};
  risks:{coverage:'PARTIAL';evaluatedRules:string[];unavailableRules:string[];items:Array<{id:string;title:string;severity:'HIGH'|'CRITICAL'|'MEDIUM';exposure:string|null;exposureBasis:string;owner:string;dueOn:string|null;reason:string;actionTarget:string|null;evidence:string[]}>};
  sla:{basis:string;overdue:number;withoutDeadline:number;availability:DataAvailability;note:string};
  forecast:{label:string;amount:string|null;nominal:string|null;horizonEnd:string;availability:DataAvailability;method:string;assumptions:string[];covered:number;excluded:number};
  actions:{availability:DataAvailability;asOf:string|null;note:string;items:Array<{id:string;title:string;description:string|null;actionTarget:string|null;dueAt:string|null;exposure:string|null;ctaLabel:string}>};
}

export async function getExecutiveOverview(period:ExecutivePeriod):Promise<ExecutiveOverview> {
  const response=await apiClient.get('/executive/overview',{params:{period}});
  const payload=response.data?.data ?? response.data;
  if(payload?.meta?.schemaVersion!==1 || !Array.isArray(payload.kpis) || !payload.actions || !payload.risks) throw new Error('Format data BI belum sesuai.');
  return payload;
}
