/** Read-only checks of the review queue and versioned map read; no external data providers. */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
loadEnvConfig(process.cwd())
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(45000)})}})
 let start=Date.now()
 const queue=await db.from('developments').select('id').eq('review_state','pending').not('relevance','is',null).order('confidence',{ascending:true,nullsFirst:true}).order('last_seen_at',{ascending:false}).order('id').range(0,25)
 if(queue.error)throw queue.error
 console.log(JSON.stringify({check:'reviewQueue',rows:queue.data.length,ms:Date.now()-start}))
 const bands:Record<string,number>={high:0,medium:1,low:2}
 for(const [name,w,s,e,n] of [['Balham',-0.17,51.43,-0.12,51.47],['Birmingham',-1.94,52.46,-1.86,52.51],['Canterbury',1.04,51.25,1.13,51.31]] as const){
  start=Date.now()
  const boundary={type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
  const result=await db.rpc('planning_tab_applications_v3',{p_boundary:boundary,p_limit:2001}).order('sort_rank').range(0,999)
  if(result.error)throw result.error
  const rows=result.data as Array<{sort_rank:number;relevance:string|null;inside_boundary:boolean}>
  const ordered=rows.every((r,i)=>Number(r.sort_rank)===i+1 && (!i || (bands[rows[i-1].relevance??'']??3)<=(bands[r.relevance??'']??3)))
  if(!ordered)throw new Error(`Unexpected relevance order for ${name}`)
  console.log(JSON.stringify({check:name,rows:rows.length,firstPageOnly:true,ordered,overlapOnly:rows.filter(r=>!r.inside_boundary).length,ms:Date.now()-start}))
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
