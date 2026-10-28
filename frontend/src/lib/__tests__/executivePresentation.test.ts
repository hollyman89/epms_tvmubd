import { executiveDate, executiveMoney, executiveTarget } from '../executivePresentation';
describe('Executive BI presentation',()=>{
  it('keeps unknown separate from a real zero',()=>{expect(executiveMoney(null)).toBe('—');expect(executiveMoney('0.00')).toBe('Rp0');});
  it('formats exact large amounts without losing integer precision',()=>{expect(executiveMoney('9007199254740993.25')).toBe('Rp9.007.199.254.740.993,25');});
  it('rejects non-numeric fallback values',()=>{expect(executiveMoney('unavailable')).toBe('—');});
  it('uses Jakarta for a UTC date boundary',()=>{expect(executiveDate('2026-10-24T18:00:00Z')).toContain('25');});
  it('rejects external and malformed task destinations',()=>{expect(executiveTarget('//other.example')).toBeNull();expect(executiveTarget('/sales\\evil')).toBeNull();expect(executiveTarget('/governance/tasks?taskId=17')).toBe('/governance/tasks?taskId=17');});
});
