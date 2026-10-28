export function executiveMoney(value:string|null,compact=false):string {
  if(value===null || value===undefined || !/^-?\d+(\.\d+)?$/.test(value)) return '—';
  if(compact) {
    const n=Number(value),abs=Math.abs(n);
    const [scale,unit]=abs>=1e12?[1e12,'triliun']:abs>=1e9?[1e9,'miliar']:abs>=1e6?[1e6,'juta']:[1,''];
    return `Rp${new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n/Number(scale))}${unit?' '+unit:''}`;
  }
  const [whole,fraction='00']=value.split('.');
  return 'Rp'+new Intl.NumberFormat('id-ID').format(BigInt(whole))+(Number(fraction)?','+fraction.padEnd(2,'0'):'');
}
export function executiveDate(value:string|null,withTime=false):string {
  if(!value) return 'Belum ditetapkan';
  const parsed=new Date(value.length===10?value+'T00:00:00+07:00':value);
  if(!Number.isFinite(parsed.getTime())) return 'Belum tersedia';
  return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit'}:{})}).format(parsed)+(withTime?' WIB':'');
}
export function executiveTarget(value:string|null):string|null {
  return value && /^\/(sales|procurement|project-delivery|governance\/tasks|legal\/review|finance\/(invoices|payments))(\?|$)/.test(value) && !/[\\\r\n]/.test(value)?value:null;
}
