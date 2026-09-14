/** Reconcile the two confirmed eligibility errors, only while unreviewed and unprocessed. */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { decideEligibility } from '../src/lib/planning-intelligence/eligibility'
loadEnvConfig(process.cwd())
async function main(){
 const commit=process.argv.includes('--commit')
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}})
 const ids=['3261c858-eb17-4d04-ae44-30bd70e6e8d1','326624cc-cecb-4631-ab06-e10298842831']
 const {data,error}=await db.from('planning_applications').select('id,raw,input_hash,intelligence_tier,classification_state,review_state').in('id',ids)
 if(error)throw error
 for(const row of data??[]){
  const decision=decideEligibility(row.raw)
  const eligible=!decision.intelligenceTier && row.intelligence_tier && ['queued','deferred_budget','failed'].includes(row.classification_state) && ['unreviewed','pending'].includes(row.review_state)
  if(commit && eligible){
   const result=await db.from('planning_applications').update({intelligence_tier:false,classification_state:'not_eligible',updated_at:new Date().toISOString()}).eq('id',row.id).eq('input_hash',row.input_hash).eq('classification_state',row.classification_state).eq('review_state',row.review_state).select('id')
   if(result.error)throw result.error
   console.log(JSON.stringify({id:row.id,changed:result.data.length}))
  }else console.log(JSON.stringify({id:row.id,commit,wouldChange:eligible,state:row.classification_state}))
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
