import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
loadEnvConfig(process.cwd())
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}})
 const failures=await db.from('planning_classification_runs').select('planning_application_id,error,started_at,cost_usd').eq('stage','initial').eq('status','failed').order('started_at',{ascending:false}).limit(5)
 console.log(JSON.stringify({failures:failures.data,error:failures.error}))
 for(const ordered of [false,true]){
  const start=Date.now()
  let q=db.from('planning_applications').select('id,classification_state,date_received').eq('intelligence_tier',true).in('classification_state',['queued','failed','deferred_budget','processing']).limit(1)
  if(ordered)q=q.order('date_received',{ascending:false,nullsFirst:false}).order('id')
  const r=await q;console.log(JSON.stringify({ordered,ms:Date.now()-start,data:r.data,error:r.error}))
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
