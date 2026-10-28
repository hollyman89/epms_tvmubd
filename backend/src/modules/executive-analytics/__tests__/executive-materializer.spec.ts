import { ExecutiveMaterializer } from '../executive-materializer.service';

describe('Executive snapshot publication safety',()=>{
  it('does not publish a partial run and releases its lease after a source failure',async()=>{
    const runner:any={connect:jest.fn(),release:jest.fn(),startTransaction:jest.fn().mockImplementation(()=>{runner.isTransactionActive=true;}),rollbackTransaction:jest.fn(),commitTransaction:jest.fn(),query:jest.fn(async(sql:string)=>{
      if(sql.includes('GET_LOCK')) return [{acquired:1}];
      if(sql.includes('RELEASE_LOCK'))return [{released:1}];
      throw new Error('source failure');
    })};
    const service=new ExecutiveMaterializer({createQueryRunner:()=>runner,options:{database:'isolated-test'}} as any);
    await expect(service.refresh()).rejects.toThrow('source failure');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
    expect(runner.query.mock.calls.some(([sql])=>sql.includes("status='PUBLISHED'"))).toBe(false);
    expect(runner.query.mock.calls.some(([sql])=>sql.includes('RELEASE_LOCK'))).toBe(true);
    expect(runner.release).toHaveBeenCalled();
  });
  it('skips a concurrent refresh without creating facts',async()=>{
    const query=jest.fn().mockResolvedValue([{acquired:0}]);
    const runner={connect:jest.fn(),release:jest.fn(),query,startTransaction:jest.fn()};
    expect(await new ExecutiveMaterializer({createQueryRunner:()=>runner,options:{database:'isolated-test'}} as any).refresh()).toBeNull();
    expect(runner.startTransaction).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
