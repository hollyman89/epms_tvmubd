import { buildExecutiveOverview, ForecastEngine, ExecutiveKpiService, SlaEngine } from '../executive-engines';
import { ExecutiveFact, jakartaDay, periodWindow, safeExecutiveTarget } from '../executive.types';

// Isolated calculation fixtures only. Never inserted into an EPMS database.
const now=new Date('2026-10-25T01:00:00Z');
const fact=(kind:ExecutiveFact['kind'],sourceId:string,amount:string|null,data:Record<string,any>={},occurredOn:string|null=null):ExecutiveFact=>({kind,sourceId,amount,data,occurredOn});

describe('Executive BI financial semantics',()=>{
  it('counts one contract once despite multiple linked projects and excludes terminal pipeline',()=>{
    const result=buildExecutiveOverview([
      fact('CONTRACT','1','100.00',{status:'ACTIVE'}),
      fact('PROJECT','10',null,{contractId:'1',status:'IN_PROGRESS',endDate:'2026-11-01'}),
      fact('PROJECT','11',null,{contractId:'1',status:'IN_PROGRESS',endDate:'2026-11-01'}),
      fact('OPPORTUNITY','1','200.00',{status:'WON'}),fact('OPPORTUNITY','2','50.00',{status:'NEW'}),
    ],[],'YEAR_TO_DATE',now,'test');
    expect(result.kpis.find(k=>k.code==='ACTIVE_CONTRACT_VALUE').actual).toBe('100.00');
    expect(result.kpis.find(k=>k.code==='OPEN_PIPELINE').actual).toBe('50.00');
    expect(result.flow.conversionRate).toBeNull();
  });
  it('preserves cents and never substitutes vendor payments for revenue or customer cash',()=>{
    const result=buildExecutiveOverview([fact('VENDOR_PAYMENT','1','0.10',{},'2026-10-01'),fact('VENDOR_PAYMENT','2','0.20',{},'2026-10-24'),fact('VENDOR_PAYMENT','3','900.00',{},'2026-11-01')],[],'THIS_MONTH',now,'test');
    expect(result.kpis.find(k=>k.code==='VENDOR_DISBURSEMENTS').actual).toBe('0.30');
    for(const code of ['RECOGNIZED_REVENUE','CUSTOMER_COLLECTIONS','GROSS_MARGIN']) expect(result.kpis.find(k=>k.code===code)).toMatchObject({actual:null,availability:'UNAVAILABLE'});
    expect(result.kpis.find(k=>k.code==='VENDOR_DISBURSEMENTS').trend).toEqual([{date:'2026-10-01',actual:'0.30',target:null}]);
  });
  it('distinguishes missing values, known zero, and absent historical buckets',()=>{
    const result=buildExecutiveOverview([fact('OPPORTUNITY','1',null,{status:'NEW'})],[],'YEAR_TO_DATE',now,'test');
    expect(result.kpis[0]).toMatchObject({actual:null,availability:'UNAVAILABLE'});
    expect(result.kpis.find(k=>k.code==='ACTIVE_CONTRACT_VALUE').actual).toBe('0.00');
    expect(result.kpis.find(k=>k.code==='VENDOR_DISBURSEMENTS').trend.every(p=>p.actual===null)).toBe(true);
    expect(result.risks.coverage).toBe('PARTIAL');
  });
  it('does not divide by zero targets or apply period targets to snapshot balances',()=>{
    const result=new ExecutiveKpiService().calculate([fact('OPPORTUNITY','1','50.00',{status:'NEW'})],[
      {metricCode:'OPEN_PIPELINE',startDate:'2026-01-01',endDate:'2026-10-25',amount:'100',version:1},
      {metricCode:'VENDOR_DISBURSEMENTS',startDate:'2026-01-01',endDate:'2026-10-25',amount:'0',version:1},
    ],periodWindow('YEAR_TO_DATE',now),now);
    expect(result[0].target).toBeNull();
    expect(result.find(k=>k.code==='VENDOR_DISBURSEMENTS')).toMatchObject({attainmentPct:null,variance:'0.00'});
  });
  it('uses source probabilities only within the forecast horizon, not as revenue',()=>{
    const result=new ForecastEngine().calculate([
      fact('OPPORTUNITY','1','1000',{status:'NEW',expectedClose:'2026-11-01',probability:25}),
      fact('OPPORTUNITY','2','500',{status:'NEW',expectedClose:null,probability:100}),
      fact('OPPORTUNITY','3','700',{status:'WON',expectedClose:'2026-11-01',probability:100}),
    ],now);
    expect(result).toMatchObject({amount:'250.00',nominal:'1000.00',covered:1,excluded:1,availability:'PARTIAL',method:'ASSUMPTION_BASED'});
  });
  it('does not turn absent SLA deadlines into compliance',()=>{
    expect(new SlaEngine().calculate([fact('WORKFLOW_TASK','1',null,{status:'PENDING',dueAt:null}),fact('WORKFLOW_TASK','2',null,{status:'PENDING',dueAt:'2026-10-24T00:00:00Z'})],now)).toMatchObject({overdue:1,withoutDeadline:1,availability:'PARTIAL'});
  });
  it('uses Jakarta boundaries across month, quarter, and year transitions',()=>{
    const rollover=new Date('2025-12-31T18:00:00Z');
    expect(jakartaDay(rollover)).toBe('2026-01-01');
    expect(periodWindow('LAST_MONTH',rollover)).toMatchObject({startDate:'2025-12-01',endDate:'2025-12-31'});
    expect(periodWindow('LAST_QUARTER',rollover)).toMatchObject({startDate:'2025-10-01',endDate:'2025-12-31'});
  });
  it('allows only recognized internal entity destinations',()=>{
    expect(safeExecutiveTarget('/governance/tasks?taskId=1&projectId=2')).toBe('/governance/tasks?taskId=1&projectId=2');
    for(const unsafe of ['https://example.com','//example.com','/sales\\evil','/unknown?taskId=1']) expect(safeExecutiveTarget(unsafe)).toBeNull();
  });
});
