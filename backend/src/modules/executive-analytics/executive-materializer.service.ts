import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, QueryRunner } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { InboxService } from '../inbox/inbox.service';
import { buildExecutiveOverview } from './executive-engines';
import { EXECUTIVE_PERIODS, ExecutiveFact, ExecutiveAction, ExecutiveOverview, KpiTarget, safeExecutiveTarget } from './executive.types';

export const rolesKey = (roles: string[]) => [...new Set(roles.map(r=>r.toUpperCase()))].sort().join(',');
const decode = (data: any) => typeof data === 'string' ? JSON.parse(data) : data;
const dateOnly = (data: any) => data ? String(data).slice(0,10) : null;

/** The only executive analytics component allowed to read operational tables.
 * Batch reconciliation deliberately does not depend on the existing mock queue.
 * Each run is a full replace-by-snapshot, committed atomically under a DB lease.
 */
@Injectable()
export class ExecutiveMaterializer implements OnApplicationBootstrap {
  private readonly logger=new Logger(ExecutiveMaterializer.name);
  constructor(private readonly source: DataSource, @Optional() private readonly inbox?: InboxService) {}

  async onApplicationBootstrap() { await this.scheduledRefresh(); }

  @Cron('0 */5 * * * *')
  async scheduledRefresh(): Promise<void> {
    const enabled=process.env.EXECUTIVE_ANALYTICS_REFRESH_ENABLED;
    if(enabled==='false' || (process.env.NODE_ENV==='production' && enabled!=='true')) return;
    try { await this.refresh(); }
    catch(error) { this.logger.warn(`Executive analytics refresh unavailable (${error?.code || 'REFRESH_FAILED'}). Previous published snapshot retained.`); }
  }

  async refresh(): Promise<{snapshotId:string;factCount:number} | null> {
    const q=this.source.createQueryRunner(); await q.connect();
    const lock='epms_executive_'+createHash('sha256').update(String(this.source.options.database)).digest('hex').slice(0,24);
    let acquired=false;
    try {
      const rows=await q.query('SELECT GET_LOCK(?,0) AS acquired',[lock]);
      acquired=Number(rows[0]?.acquired)===1;
      if(!acquired) return null;
      await q.startTransaction('REPEATABLE READ');
      const asOf=new Date(); const runId=randomUUID();
      const facts=await this.extractFacts(q);
      await q.query("INSERT INTO executive_analytics_runs(id,status,as_of,schema_version,fact_count) VALUES (?,'BUILDING',?,1,?)",[runId,asOf.toISOString().slice(0,23).replace('T',' '),facts.length]);
      for(let i=0;i<facts.length;i+=200) {
        const batch=facts.slice(i,i+200);
        await q.query(`INSERT INTO executive_fact_snapshots(run_id,fact_kind,source_id,amount,occurred_on,attributes) VALUES ${batch.map(()=>'(?,?,?,?,?,?)').join(',')}`,
          batch.flatMap(f=>[runId,f.kind,f.sourceId,f.amount,f.occurredOn,JSON.stringify(f.data)]));
      }
      // Engines consume persisted facts, never the operational query result directly.
      const stored=await q.query("SELECT fact_kind,source_id,amount,DATE_FORMAT(occurred_on,'%Y-%m-%d') AS occurred_on,attributes FROM executive_fact_snapshots WHERE run_id=?",[runId]);
      const persisted:ExecutiveFact[]=stored.map(r=>({kind:r.fact_kind,sourceId:r.source_id,amount:r.amount===null?null:String(r.amount),occurredOn:r.occurred_on instanceof Date?r.occurred_on.toISOString().slice(0,10):dateOnly(r.occurred_on),data:decode(r.attributes)}));
      if(persisted.length!==facts.length) throw new Error('Fact count reconciliation failed');
      const targetRows=await q.query("SELECT metric_code,DATE_FORMAT(start_date,'%Y-%m-%d') AS start_date,DATE_FORMAT(end_date,'%Y-%m-%d') AS end_date,amount,version FROM executive_kpi_targets WHERE scope_key='INSTALLATION' AND currency='IDR' AND approved_at<=NOW()");
      const targets:KpiTarget[]=targetRows.map(r=>({metricCode:r.metric_code,startDate:r.start_date,endDate:r.end_date,amount:String(r.amount),version:Number(r.version)}));
      const history=await q.query(`SELECT s.payload FROM executive_summary_snapshots s JOIN executive_analytics_runs r ON r.id=s.run_id
        WHERE s.period_code='YEAR_TO_DATE' AND s.scope_key='INSTALLATION' AND r.status='PUBLISHED'
        AND r.as_of IN (SELECT MAX(as_of) FROM executive_analytics_runs WHERE status='PUBLISHED' AND as_of >= DATE_SUB(UTC_TIMESTAMP(),INTERVAL 90 DAY) GROUP BY DATE(DATE_ADD(as_of,INTERVAL 7 HOUR))) ORDER BY r.as_of`);
      const previous:ExecutiveOverview[]=history.map(r=>decode(r.payload));
      for(const period of EXECUTIVE_PERIODS) {
        const overview=buildExecutiveOverview(persisted,targets,period,asOf,runId);
        for(const metric of overview.kpis.filter(k=>k.basis==='SNAPSHOT')) {
          const points=new Map<string,typeof metric.trend[number]>();
          for(const old of previous) {
            const kpi=old.kpis.find(k=>k.code===metric.code);
            if(kpi) { const day=new Date(new Date(old.meta.asOf).getTime()+7*3600000).toISOString().slice(0,10); points.set(day,{date:day,actual:kpi.actual,target:kpi.target}); }
          }
          for(const point of metric.trend) points.set(point.date,point);
          metric.trend=[...points.values()].sort((a,b)=>a.date.localeCompare(b.date));
        }
        await q.query("INSERT INTO executive_summary_snapshots(run_id,period_code,scope_key,payload) VALUES (?,?,'INSTALLATION',?)",[runId,period,JSON.stringify(overview)]);
      }
      await this.projectActions(q,runId);
      await q.query("UPDATE executive_analytics_runs SET status='PUBLISHED',published_at=UTC_TIMESTAMP(3) WHERE id=?",[runId]);
      await q.commitTransaction();
      this.logger.log(`Published executive analytics snapshot (${facts.length} facts).`);
      return {snapshotId:runId,factCount:facts.length};
    } catch(error) { if(q.isTransactionActive) await q.rollbackTransaction(); throw error; }
    finally { if(acquired) await q.query('SELECT RELEASE_LOCK(?)',[lock]).catch(()=>undefined); await q.release(); }
  }

  private async extractFacts(q:QueryRunner):Promise<ExecutiveFact[]> {
    const facts:ExecutiveFact[]=[];
    const append=(kind:ExecutiveFact['kind'],rows:any[])=>rows.forEach(row=>{
      const {id,amount,occurredOn,...data}=row;
      facts.push({kind,sourceId:String(id),amount:amount===null || amount===undefined?null:String(amount),occurredOn:dateOnly(occurredOn),data});
    });
    append('OPPORTUNITY',await q.query(`SELECT id,CAST(COALESCE(negotiated_price,estimated_budget) AS CHAR) AS amount,
      DATE_FORMAT(created_at,'%Y-%m-%d') AS occurredOn,status,title,stage,customer_id AS customerId,
      probability_percentage AS probability,DATE_FORMAT(expected_closing_date,'%Y-%m-%d') AS expectedClose,version
      FROM tenders WHERE deleted_at IS NULL`));
    append('CONTRACT',await q.query(`SELECT id,CAST(contract_value AS CHAR) AS amount,status,contract_number AS reference,
      tender_id AS opportunityId,customer_id AS customerId,version FROM contracts WHERE deleted_at IS NULL`));
    append('PROJECT',await q.query(`SELECT p.id,p.name,p.status,p.contract_id AS contractId,p.version,
      DATE_FORMAT(p.end_date,'%Y-%m-%d') AS endDate,u.full_name AS ownerName
      FROM projects p LEFT JOIN users u ON u.id=p.manager_id AND u.deleted_at IS NULL WHERE p.deleted_at IS NULL`));
    append('VENDOR_PAYMENT',await q.query(`SELECT id,CAST(amount_paid AS CHAR) AS amount,
      DATE_FORMAT(payment_date,'%Y-%m-%d') AS occurredOn,invoice_id AS invoiceId,version
      FROM payments WHERE deleted_at IS NULL`));
    append('PROJECT_RISK',await q.query(`SELECT r.id,r.title,r.project_id AS projectId,r.risk_level AS level,r.status,
      r.mitigation_plan AS mitigation,DATE_FORMAT(r.target_date,'%Y-%m-%d') AS targetDate,u.full_name AS ownerName,r.version
      FROM project_risks r JOIN projects p ON p.id=r.project_id AND p.deleted_at IS NULL
      LEFT JOIN users u ON u.id=r.owner_id AND u.deleted_at IS NULL`));
    append('WORKFLOW_TASK',await q.query(`SELECT wt.id,wt.task_key AS taskKey,wt.status,wt.due_at AS dueAt,wt.version
      FROM workflow_tasks wt WHERE wt.deleted_at IS NULL AND wt.status='PENDING'`));
    return facts;
  }

  private async projectActions(q:QueryRunner,runId:string):Promise<void> {
    const principals=await q.query(`SELECT u.id,GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') AS roles
      FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id AND r.deleted_at IS NULL
      WHERE u.is_active=1 AND u.deleted_at IS NULL GROUP BY u.id
      HAVING SUM(r.name IN ('DIRECTOR','ADMIN','SUPER_ADMIN'))>0`);
    for(const principal of principals) {
      const roles=String(principal.roles).split(',');
      let payload:ExecutiveOverview['actions']={items:[],availability:'UNAVAILABLE',asOf:null,note:'Proyeksi To-Do belum tersedia. Buka Pusat Aktivitas untuk status task terkini.'};
      if(this.inbox) {
        try {
          const todos=await this.inbox.getTodos(Number(principal.id),roles);
          const items:ExecutiveAction[]=todos.map(t=>({id:t.todoId,title:t.title,description:t.description || t.projectName || null,
            actionTarget:safeExecutiveTarget(t.actionTarget),dueAt:t.dueAt || null,
            exposure:t.monetaryExposure===undefined || t.monetaryExposure===null?null:String(t.monetaryExposure),ctaLabel:t.ctaLabel || 'Buka tindakan'}));
          items.sort((a,b)=>(a.dueAt||'9999').localeCompare(b.dueAt||'9999'));
          // Canonical Inbox currently tolerates per-source failures. Never label its projection complete.
          payload={items,availability:'PARTIAL',asOf:new Date().toISOString(),note:'Proyeksi To-Do bersifat parsial dan memiliki waktu pembaruan tersendiri. Status, izin, dan maker-checker diperiksa kembali di workspace.'};
        } catch { /* Do not turn an ingestion error into a successful empty task list. */ }
      }
      await q.query('INSERT INTO executive_action_snapshots(run_id,recipient_user_id,roles_key,projected_at,payload) VALUES (?,?,?,UTC_TIMESTAMP(3),?)',[runId,principal.id,rolesKey(roles),JSON.stringify(payload)]);
    }
  }
}
