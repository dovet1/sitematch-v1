/** Exercise the review RPC using isolated, labelled fixtures; remove them in finally.
 * No SQL execution, provider calls, AI calls or real application corrections.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
loadEnvConfig(process.cwd())
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{
 auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(20000)})},
})
const ids={development:randomUUID(),application:randomUUID(),signal:randomUUID(),observation:randomUUID()}
const marker=`CODEX REVIEW VERIFICATION ${ids.development}`
const boundary={type:'Polygon',coordinates:[[[-0.0001,-0.0001],[0.0001,-0.0001],[0.0001,0.0001],[-0.0001,0.0001],[-0.0001,-0.0001]]]}
// The ranked read stored.ts uses; review corrections must reach this function.
const TAB_READ='planning_tab_applications_v3'
const checks:string[]=[]
function check(value:unknown,message:string){if(!value)throw new Error(message);checks.push(message)}
async function ok<T>(request:PromiseLike<{data:T;error:unknown}>){const r=await request;if(r.error)throw r.error;return r.data as NonNullable<T>}
async function main(){
 mkdirSync('reports',{recursive:true})
 writeFileSync('reports/planning-review-verification-fixture.json',JSON.stringify({ids,marker}))
 // Preflight read confirms both the columns and the versioned tab function exist.
 await ok(db.from('planning_review_events').select('id,before_snapshot,after_snapshot').limit(1))
 check(true,'Migration audit columns are available')
 const skipMap=process.argv.includes('--skip-map-read')
 if(!skipMap) {
  await ok(db.rpc(TAB_READ,{p_boundary:boundary,p_limit:1}))
  check(true,'Versioned tab RPC is available')
 }
 try {
  const d=await ok(db.from('developments').insert({id:ids.development,canonical_name:marker,relevance:'high',confidence:0.5,summary:'Synthetic verification record; not a real proposal.',model_dwelling_count:20,model_dwelling_basis:'stated',creates_commercial_space:'yes',research_state:'queued',escalate_for_research:false}).select('updated_at').single())
  await ok(db.from('planning_applications').insert({id:ids.application,provider_id:marker,authority_slug:'codex-verification',authority_name:'Synthetic verification',reference:marker,description:marker,raw:{},input_hash:marker,stated_dwelling_count:40,location:'SRID=4326;POINT(0 0)',location_provenance:'source_exact',intelligence_tier:false,classification_state:'not_eligible'}))
  await ok(db.from('development_applications').insert({development_id:ids.development,planning_application_id:ids.application,relationship_source:'manual'}))
  await ok(db.from('development_brand_signals').insert({id:ids.signal,development_id:ids.development,observed_name:marker,role:'unclear',evidence_source:'manual'}))
  await ok(db.from('development_observations').insert({id:ids.observation,development_id:ids.development,metric:'commercial_floorspace',scope:'net',action:'change',value:10,unit:'sqm'}))
  const request={p_development_id:ids.development,p_reviewer_id:'system:codex-synthetic-verification',p_decision:'corrected',p_expected_updated_at:d.updated_at,p_fields:{dwellingCount:0,createsCommercialSpace:'no',commercialUseClasses:['E']},p_brand_signals:[{id:ids.signal,reviewState:'corrected',role:'applicant_developer'}],p_observations:[{id:ids.observation,reviewState:'corrected',scope:'net',value:-5}]}
  const saved=await ok(db.rpc('apply_planning_review_v2',request))
  check(saved.research_state==='not_eligible' && saved.escalate_for_research===false,'Commercial correction removes unpaid research from queue')
  const audit=await ok(db.from('planning_review_events').select('*').eq('id',saved.review_event_id).single())
  check(audit.before_snapshot.development.model_dwelling_count===20 && audit.after_snapshot.development.model_dwelling_count===0,'Audit retains before and after dwelling counts')
  check(audit.after_snapshot.brandSignals[0].role==='applicant_developer' && audit.after_snapshot.observations[0].value===-5,'Evidence corrections and negative net area are audited')
  if(!skipMap) {
  const tab=await ok(db.rpc(TAB_READ,{p_boundary:boundary,p_limit:10}))
  const fixture=tab.find((r:{id:string})=>r.id===ids.application)
  check(fixture?.model_dwelling_count===0 && fixture.model_dwelling_basis==='human_review' && fixture.stated_dwelling_count===40,'Tab returns reviewed zero with provenance and preserves source figure')
  }
  if(!process.argv.includes('--skip-conflict-check')) {
  const stale=await db.rpc('apply_planning_review_v2',request)
  check(['40001','PT409'].includes(stale.error?.code ?? ''),'Stale review rejected with conflict')
  }
  const current=await ok(db.from('developments').select('updated_at').eq('id',ids.development).single())
  const foreign=await db.rpc('apply_planning_review_v2',{...request,p_expected_updated_at:current.updated_at,p_observations:[{id:randomUUID(),reviewState:'approved'}]})
  check(foreign.error?.code==='22023','Evidence outside the development is rejected')
  const events=await ok(db.from('planning_review_events').select('id').eq('development_id',ids.development))
  check(events.length===1,'Rejected saves create no partial audit events')
  await ok(db.rpc('apply_planning_review_v2',{...request,p_expected_updated_at:current.updated_at,p_fields:{dwellingCount:null},p_brand_signals:[],p_observations:[]}))
  if(!skipMap) {
  const unknown=await ok(db.rpc(TAB_READ,{p_boundary:boundary,p_limit:10}))
  const unknownFixture=unknown.find((r:{id:string})=>r.id===ids.application)
  check(unknownFixture?.model_dwelling_count===null && unknownFixture.model_dwelling_basis==='human_review','Explicit unknown remains human-reviewed rather than falling back to source')
  }
  const persisted=await ok(db.from('developments').select('model_dwelling_count,model_dwelling_basis').eq('id',ids.development).single())
  check(persisted.model_dwelling_count===null && persisted.model_dwelling_basis==='human_review','Explicit unknown persists with human provenance')
  const last=await ok(db.from('developments').select('updated_at').eq('id',ids.development).single())
  await ok(db.rpc('apply_planning_review_v2',{p_development_id:ids.development,p_reviewer_id:'system:codex-synthetic-verification',p_decision:'rejected',p_expected_updated_at:last.updated_at}))
  if(!skipMap) {
  const rejected=await ok(db.rpc(TAB_READ,{p_boundary:boundary,p_limit:10}))
  check(rejected.find((r:{id:string})=>r.id===ids.application)?.relevance===null,'Rejected classification disappears from the tab classification join')
  }
 } finally {
  // Only these generated IDs and matching labels can be removed.
  await ok(db.from('developments').delete().eq('id',ids.development).eq('canonical_name',marker))
  await ok(db.from('planning_applications').delete().eq('id',ids.application).eq('provider_id',marker))
  const remaining=await ok(db.from('developments').select('id').eq('id',ids.development))
  const remainingApps=await ok(db.from('planning_applications').select('id').eq('id',ids.application))
  const remainingEvents=await ok(db.from('planning_review_events').select('id').eq('development_id',ids.development))
  check(remaining.length===0 && remainingApps.length===0 && remainingEvents.length===0,'Synthetic fixtures and their audit events removed')
  writeFileSync('reports/planning-review-verification.json',JSON.stringify({at:new Date().toISOString(),ids,checks},null,2))
 }
 console.log(JSON.stringify({checks,report:'reports/planning-review-verification.json'}))
}
main().catch(e=>{console.error(e);console.error(JSON.stringify({fixtureIds:ids,completedChecks:checks}));process.exitCode=1})
