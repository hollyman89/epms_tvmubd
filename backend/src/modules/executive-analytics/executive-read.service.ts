import { Inject, Injectable, ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExecutiveOverview, ExecutivePeriod } from './executive.types';

export const EXECUTIVE_READER='EXECUTIVE_ANALYTICS_READER';
const decode=(value:any)=>typeof value==='string'?JSON.parse(value):value;
export const executiveRolesKey=(roles:string[])=>[...new Set(roles.map(r=>r.toUpperCase()))].sort().join(',');

/** Read boundary: fixed, parameterized SELECTs on published analytics tables ONLY. */
@Injectable()
export class ExecutiveReadService {
  constructor(@Inject(EXECUTIVE_READER) private readonly reader:DataSource) {}
  async overview(period:ExecutivePeriod,principal:{userId?:number;id?:number;roles?:string[];tenantId?:string;companyId?:number}):Promise<ExecutiveOverview> {
    if(!principal.roles?.some(r=>['DIRECTOR','ADMIN','SUPER_ADMIN'].includes(r.toUpperCase()))) throw new ForbiddenException();
    // This installation has no source-level legal-entity dimension. Do not pretend to support multi-tenant slicing.
    if((principal.tenantId && principal.tenantId!=='default') || (principal.companyId && Number(principal.companyId)!==1)) throw new ForbiddenException('Executive scope is not configured for this organization.');
    const userId=Number(principal.userId ?? principal.id);
    if(!Number.isSafeInteger(userId)||userId<=0) throw new ForbiddenException();
    try {
      const rows=await this.reader.query(`SELECT s.payload,r.id AS run_id FROM executive_summary_snapshots s
        JOIN executive_analytics_runs r ON r.id=s.run_id
        WHERE r.status='PUBLISHED' AND s.scope_key='INSTALLATION' AND s.period_code=?
        ORDER BY r.as_of DESC,r.id DESC LIMIT 1`,[period]);
      if(!rows.length) throw new ServiceUnavailableException('Snapshot BI belum tersedia. Jalankan migrasi dan refresh analytics.');
      const result:ExecutiveOverview=decode(rows[0].payload);
      const age=Date.now()-new Date(result.meta.asOf).getTime();
      result.meta.freshness=age>15*60*1000 || age<0?'STALE':'FRESH';
      const actionRows=await this.reader.query('SELECT payload FROM executive_action_snapshots WHERE run_id=? AND recipient_user_id=? AND roles_key=?',[rows[0].run_id,userId,executiveRolesKey(principal.roles)]);
      result.actions=actionRows.length?decode(actionRows[0].payload):{items:[],availability:'UNAVAILABLE',asOf:null,note:'Proyeksi tindakan untuk identitas dan peran Anda belum tersedia. Buka Pusat Aktivitas.'};
      return result;
    } catch(error) {
      if(error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Analytics belum dapat dibaca. Data transaksi tidak digunakan sebagai pengganti.');
    }
  }
}
