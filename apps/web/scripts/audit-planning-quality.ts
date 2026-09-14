/** Read-only, stratified spot check; no provider or model calls. */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
loadEnvConfig(process.cwd())
async function main() {
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})}})
 const samples=[]
 for(const relevance of ['high','medium','low']) {
  const {data,error}=await db.from('developments').select('id,canonical_name,relevance,confidence,summary,model_dwelling_count,creates_commercial_space,unanswered_questions,development_applications(planning_applications(id,raw))').eq('relevance',relevance).order('last_seen_at',{ascending:false}).limit(10)
  if(error)throw error
  samples.push(...data)
 }
 const {data:known,error}=await db.from('planning_applications').select('id,raw,intelligence_tier,classification_state,review_state').in('id',['3261c858-eb17-4d04-ae44-30bd70e6e8d1','326624cc-cecb-4631-ab06-e10298842831'])
 if(error)throw error
 mkdirSync('reports',{recursive:true})
 writeFileSync('reports/planning-quality-sample.json',JSON.stringify({at:new Date().toISOString(),samples,known},null,2))
 console.log(JSON.stringify({sampleSize:samples.length,known,path:'reports/planning-quality-sample.json'}))
}
main().catch(e=>{console.error(e);process.exitCode=1})
