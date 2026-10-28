/* Operational utility: real EPMS sources only. Never seeds demo business data. */
const path=require('path');
require('reflect-metadata');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
require('ts-node').register({project:path.join(__dirname,'../tsconfig.json'),transpileOnly:true});
const {DataSource}=require('typeorm');
const {CreateExecutiveAnalyticsMart1792886400000}=require('../src/migrations/1792886400000-CreateExecutiveAnalyticsMart');
const {ExecutiveMaterializer}=require('../src/modules/executive-analytics/executive-materializer.service');

async function main(){
  const command=process.argv[2];
  if(!['migrate','refresh'].includes(command))throw new Error('Use: node scripts/executive-analytics.cjs migrate|refresh');
  const host=process.env.DATABASE_HOST||'127.0.0.1';
  if(command==='migrate' && (process.env.NODE_ENV==='production' || !['localhost','127.0.0.1','::1'].includes(host))) throw new Error('This targeted migration utility is for local development. Use the reviewed migration release process elsewhere.');
  const source=new DataSource({type:'mysql',host,port:Number(process.env.DATABASE_PORT||3306),username:process.env.DATABASE_USER,password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME,entities:[],synchronize:false,logging:false});
  await source.initialize();
  try {
    if(command==='migrate') {
      const migration=new CreateExecutiveAnalyticsMart1792886400000();
      const applied=await source.query('SELECT id FROM migrations WHERE name=?',[migration.name]);
      if(applied.length){console.log('Executive analytics migration already applied.');return;}
      const existing=await source.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('executive_analytics_runs','executive_fact_snapshots','executive_kpi_targets','executive_summary_snapshots','executive_action_snapshots')");
      if(existing.length) throw new Error('Partial or unregistered analytics schema detected. Review before continuing; no existing tables are changed.');
      const q=source.createQueryRunner();await q.connect();
      try { await migration.up(q);await q.query('INSERT INTO migrations(timestamp,name) VALUES (?,?)',[1792886400000,migration.name]);console.log('Created five analytics tables; transaction tables untouched.'); } finally { await q.release(); }
    } else {
      const result=await new ExecutiveMaterializer(source).refresh();
      console.log(JSON.stringify({result,actions:'Canonical To-Do projection is populated by the application worker; this standalone command has no Inbox dependency.'}));
    }
  } finally {await source.destroy();}
}
main().catch(error=>{console.error('Executive analytics operation failed:',error.code || (error.message?.startsWith('Use:')?error.message:error.name));process.exitCode=1;});
