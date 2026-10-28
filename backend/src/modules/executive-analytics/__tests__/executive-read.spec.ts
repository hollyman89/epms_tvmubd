import { ExecutiveReadService } from '../executive-read.service';
import { buildExecutiveOverview } from '../executive-engines';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

describe('Executive analytics read boundary',()=>{
  it('reads only persisted analytics and scopes personal actions to user and exact roles',async()=>{
    const payload=buildExecutiveOverview([],[],'YEAR_TO_DATE',new Date('2020-01-01'),'published-run');
    const query=jest.fn().mockResolvedValueOnce([{payload:JSON.stringify(payload),run_id:'published-run'}]).mockResolvedValueOnce([]);
    const result=await new ExecutiveReadService({query} as any).overview('YEAR_TO_DATE',{userId:7,roles:['DIRECTOR']});
    expect(result.meta.freshness).toBe('STALE');
    expect(result.actions.availability).toBe('UNAVAILABLE');
    expect(query.mock.calls[1][1]).toEqual(['published-run',7,'DIRECTOR']);
    for(const [sql] of query.mock.calls) {
      expect(sql.trim().startsWith('SELECT')).toBe(true);
      expect(sql).not.toMatch(/\b(tenders|contracts|projects|payments|invoices|workflow_tasks)\b/i);
    }
  });
  it('fails closed when the mart is absent without requesting operational data',async()=>{
    const query=jest.fn().mockRejectedValue({code:'ER_NO_SUCH_TABLE'});
    await expect(new ExecutiveReadService({query} as any).overview('YEAR_TO_DATE',{userId:1,roles:['DIRECTOR']})).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it.each([{userId:1,roles:['FINANCE']},{userId:1,roles:['DIRECTOR'],companyId:2},{userId:1,roles:['DIRECTOR'],tenantId:'other'},{userId:0,roles:['DIRECTOR']}])('rejects unsupported identity/scope before querying (%j)',async principal=>{
    const query=jest.fn();
    await expect(new ExecutiveReadService({query} as any).overview('YEAR_TO_DATE',principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
});
