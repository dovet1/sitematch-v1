/** Read-only backfill throughput and classification budget check. */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { chargedUsage, type UsageRow } from '../src/lib/planning-intelligence/budget'
loadEnvConfig(process.cwd())
async function main() {
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}})
 const snapshot=new Date().toISOString(); const month=snapshot.slice(0,7)+'-01T00:00:00Z'
 const results=await Promise.all([
  db.rpc('planning_pipeline_status'),
  db.from('planning_ingest_runs').select('date_from,date_to,requests_made,records_seen,status').eq('kind','backfill').order('started_at').limit(1000),
  db.from('planning_classification_runs').select('status,started_at,finished_at,cost_usd,error').eq('stage','initial').order('started_at',{ascending:false}).limit(10),
  db.from('planning_applications').select('id',{count:'exact',head:true}).eq('classification_state','deferred_budget'),
 ])
 for(const [i,r] of results.entries()) {
  if(i===1 && r.data) {
   const totals:Record<string,{requests:number;rows:number}>={}
   for(const row of r.data as unknown as Array<{date_from:string;requests_made:number;records_seen:number}>) {
    const group=totals[row.date_from]??={requests:0,rows:0};group.requests+=row.requests_made??0;group.rows+=row.records_seen??0
   }
   console.log(JSON.stringify({kind:'backfillRunTotals',totals,note:'Includes pilot/retries; rows are processed rows, not unique applications.',error:r.error}))
  } else console.log(JSON.stringify({kind:['status','runs','recentClassification','deferredCount'][i],data:r.data,count:r.count,error:r.error}))
 }
 const totals:Record<string,{charged:number;completed:number;actual:number;reserved:number}>={}
 for(let offset=0;offset<20000;offset+=1000) {
  const {data,error}=await db.from('planning_ai_usage').select('stage,status,reserved_usd,actual_usd').gte('occurred_at',month).lt('occurred_at',snapshot).order('id').range(offset,offset+999)
  if(error)throw error
  for(const row of data as UsageRow[]) {
   const t=totals[row.stage]??={charged:0,completed:0,actual:0,reserved:0};t.charged+=chargedUsage(row)
   if(row.status==='complete'){t.completed++;t.actual+=Number(row.actual_usd??row.reserved_usd)}
   if(row.status==='reserved')t.reserved++
  }
  if(data.length<1000){console.log(JSON.stringify({kind:'monthlyAiUsage',snapshot,totals}));return}
 }
 throw new Error('Usage audit cap reached; totals incomplete')
}
main().catch(e=>{console.error(e);process.exitCode=1})
