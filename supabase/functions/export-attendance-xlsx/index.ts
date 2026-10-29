import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import ExcelJS from 'npm:exceljs@4.4.0'

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
}
function keyFromEnv(jsonName:string,legacyName:string){const raw=Deno.env.get(jsonName);if(raw){try{const p=JSON.parse(raw);if(p?.default)return p.default as string}catch{}}return Deno.env.get(legacyName)??''}
function markLabel(v:string|undefined){return v==='present'?'Present':v==='late'?'Late':v==='absent'?'Absent':''}
function lectureWeight(rec:any){const w=Number(rec?.__meta?.lectureWeight??1);return Number.isFinite(w)&&w>0?w:1}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='GET')return new Response('Method not allowed',{status:405,headers:cors})
  const requestedSheet=new URL(req.url).searchParams.get('sheet')
  const url=Deno.env.get('SUPABASE_URL')??'',pub=keyFromEnv('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),secret=keyFromEnv('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),auth=req.headers.get('Authorization')??''
  if(!url||!pub||!auth.startsWith('Bearer '))return new Response('Unauthorized',{status:401,headers:cors})
  if(!secret)return new Response('Export storage is not configured',{status:500,headers:cors})
  const sb=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}})
  const token=auth.replace('Bearer ','')
  const {data:userData,error:userErr}=await sb.auth.getUser(token)
  if(userErr||!userData.user)return new Response('Unauthorized',{status:401,headers:cors})

  const [{data:stateRows,error:stateErr},{data:attendanceRows,error:attErr},{data:extraRows,error:extraErr}]=await Promise.all([
    sb.from('rollcall_state').select('key,value'),
    sb.from('attendance_sessions').select('session_key,data').order('session_key'),
    sb.from('extra_sessions').select('id,created_by_name,course,session_date,start_time,end_time,session_type,venue,reason,label,active,created_at').order('session_date').order('start_time'),
  ])
  if(stateErr||attErr||extraErr)return new Response(JSON.stringify({error:stateErr?.message||attErr?.message||extraErr?.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})

  const state=Object.fromEntries((stateRows??[]).map((r:any)=>[r.key,r.value])),students=state.students??[],threshold=state.settings?.threshold??75
  const attendance=Object.fromEntries((attendanceRows??[]).filter((r:any)=>!String(r.session_key||'').startsWith('TEST__')).map((r:any)=>[r.session_key,r.data])),sessionKeys=Object.keys(attendance).sort()
  const completeKeys=sessionKeys.filter(k=>Object.entries(attendance[k]??{}).some(([id,v])=>id!=='__meta'&&['present','late','absent'].includes(String(v))))
  const courseNames=[...new Set(completeKeys.map(k=>attendance[k]?.__meta?.course).filter(Boolean))]
  const perStudent=students.map((st:any)=>{let n=0,a=0;const by:Record<string,{n:number,a:number}>={};for(const k of completeKeys){const rec=attendance[k],v=rec?.[st.id];if(!['present','late','absent'].includes(String(v)))continue;const c=rec?.__meta?.course||'Unknown',w=lectureWeight(rec);by[c]??={n:0,a:0};n+=w;by[c].n+=w;if(v==='present'||v==='late'){a+=w;by[c].a+=w}}const rates=Object.fromEntries(Object.entries(by).map(([c,o])=>[c,Math.round((o.a/o.n)*100)]));return{...st,n,a,rate:n?Math.round((a/n)*100):null,rates,by}})
  const withRates=perStudent.filter((x:any)=>x.rate!=null),avg=withRates.length?Math.round(withRates.reduce((s:number,x:any)=>s+x.rate,0)/withRates.length):null
  const wb=new ExcelJS.Workbook();wb.creator='Nile FBCS Roll Call';wb.created=new Date()
  function addSheet(name:string,rows:any[][],widths?:number[]){const ws=wb.addWorksheet(name);rows.forEach(r=>ws.addRow(r));if(rows.length){const h=ws.getRow(1);h.font={bold:true};h.alignment={vertical:'middle'};h.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE2E8F0'}}})}ws.views=[{state:'frozen',ySplit:1}];if(widths)widths.forEach((w,i)=>ws.getColumn(i+1).width=w);else ws.columns.forEach(c=>c.width=18);return ws}
  function cum(st:any,courses:string[]){let n=0,a=0;for(const c of courses){const x=st.by?.[c];if(!x)continue;n+=x.n;a+=x.a}return{n,a,rate:n?Math.round((a/n)*100):null}}

  addSheet('Overview',[['Nile University FBCS Roll Call'],['Generated',new Date().toLocaleString('en-GB')],['Students',students.length],['Registers',sessionKeys.length],['Average attendance',avg==null?'':`${avg}%`],['Threshold',`${threshold}%`],['Calculation','Saved present/late marks divided by saved present/late/absent marks, using lecture weights. Unmarked students are excluded; partially marked registers contribute recorded marks only.']],[34,24])
  addSheet('Students',[['ID','Name'],...students.map((x:any)=>[x.id,x.name])],[18,36])
  addSheet('Attendance Matrix',[['ID','Name',...sessionKeys.map(k=>{const m=attendance[k]?.__meta??{};return `${m.date||''} ${m.course||''} ${m.type||''}${m.outOfTimetable?' [OUT OF TIMETABLE]':''}`.trim()})],...students.map((st:any)=>[st.id,st.name,...sessionKeys.map(k=>markLabel(attendance[k]?.[st.id]))])],[18,34,...sessionKeys.map(()=>28)])
  addSheet('Student Rates',[['ID','Name','Attended equivalents','Counted equivalents','Rate %',...courseNames],...perStudent.map((x:any)=>[x.id,x.name,x.a,x.n,x.rate??'',...courseNames.map((c:string)=>x.rates[c]??'')])],[18,34,18,18,12,...courseNames.map(()=>20)])
  const csum:any[][]=[['Course','Registers','Average %']];for(const c of courseNames){const vals=perStudent.map((x:any)=>x.rates[c]).filter((x:any)=>x!=null);csum.push([c,completeKeys.filter(k=>attendance[k]?.__meta?.course===c).length,vals.length?Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length):''])}addSheet('Course Summary',csum,[24,14,14])

  const pathCourses=['Microbiology','Histopathology','Chemical Pathology','Haematology']
  addSheet('Pathology Attendance',[['ID','Name','Microbiology %','Histopathology %','Chemical Pathology %','Haematology %','Combined Pathology %','Attended','Marked sessions'],...perStudent.map((x:any)=>{const p=cum(x,pathCourses);return[x.id,x.name,x.rates['Microbiology']??'',x.rates['Histopathology']??'',x.rates['Chemical Pathology']??'',x.rates['Haematology']??'',p.rate??'',p.a,p.n]})],[18,34,16,16,20,16,20,12,16])
  addSheet('Pharmacology & Therapeutics',[['ID','Name','Attended','Marked sessions','Pharmacology & Therapeutics %'],...perStudent.map((x:any)=>{const p=cum(x,['Pharmacology']);return[x.id,x.name,p.a,p.n,p.rate??'']})],[18,34,12,16,28])
  addSheet('At Risk',[['ID','Name','Rate %'],...perStudent.filter((x:any)=>x.rate!=null&&x.rate<threshold).map((x:any)=>[x.id,x.name,x.rate])],[18,34,12])

  const slog:any[][]=[['Session key','Date','Course','Type','Lecture #','Lecture equivalents','Block roll calls','Timetable status','Reason','Venue','Lecturer','Taken by','Marked','Present','Late','Absent']]
  for(const k of sessionKeys){const r=attendance[k]??{},m=r.__meta??{},vals=Object.entries(r).filter(([id])=>id!=='__meta').map(([,v])=>v);slog.push([k,m.date||'',m.course||'',m.type||'',m.lectureNumber||'',lectureWeight(r),m.blockRollCalls||'',m.outOfTimetable?'Out of official timetable':'Official timetable',m.reason||'',m.venue||'',m.lecturer||'',m.takenBy||'',vals.length,vals.filter(x=>x==='present').length,vals.filter(x=>x==='late').length,vals.filter(x=>x==='absent').length])}
  addSheet('Session Log',slog,[28,14,22,14,12,18,16,24,36,20,28,28,12,12,10,12])

  const detailed:any[][]=[['Date','Course','Type','Lecture #','Lecture equivalents','Timetable status','Reason','Venue','Lecturer','Taken by','Student ID','Student name','Status','Attended equivalents']]
  for(const k of sessionKeys){const r=attendance[k]??{},m=r.__meta??{},w=lectureWeight(r);for(const [id,status] of Object.entries(r)){if(id==='__meta')continue;const st=students.find((x:any)=>x.id===id);detailed.push([m.date||'',m.course||'',m.type||'',m.lectureNumber||'',w,m.outOfTimetable?'Out of official timetable':'Official timetable',m.reason||'',m.venue||'',m.lecturer||'',m.takenBy||'',id,st?.name||'',markLabel(status as string),(status==='present'||status==='late')?w:0])}}
  addSheet('Detailed Marks',detailed,[14,22,14,12,18,24,36,20,28,28,18,34,12,18])

  addSheet('Out-of-Timetable Classes',[['Date','Course','Time','Type','Venue','Added by','Reason','Label','Status'],...(extraRows??[]).map((x:any)=>[x.session_date,x.course,`${String(x.start_time).slice(0,5)}-${String(x.end_time).slice(0,5)}`,x.session_type,x.venue||'',x.created_by_name||'',x.reason||'',x.label||'OUT OF OFFICIAL TIMETABLE CLASS',x.active?'Active':'Cancelled'])],[14,22,16,14,20,28,40,32,12])

  if(requestedSheet){const wanted=wb.getWorksheet(requestedSheet);if(!wanted)return new Response('Unknown report',{status:400,headers:cors});for(const ws of [...wb.worksheets])if(ws.name!==requestedSheet)wb.removeWorksheet(ws.id)}
  const out=await wb.xlsx.writeBuffer(),safeName=(requestedSheet||'All_Reports').replace(/[^A-Za-z0-9_-]+/g,'_'),filename=`Nile_FBCS_RollCall_${safeName}_${new Date().toISOString().slice(0,10)}.xlsx`
  const objectPath=`${userData.user.id}/${safeName}.xlsx`
  const bytes=out instanceof Uint8Array?out:new Uint8Array(out as ArrayBuffer)
  const {error:uploadErr}=await admin.storage.from('rollcall-exports').upload(objectPath,bytes,{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',upsert:true,cacheControl:'60'})
  if(uploadErr)return new Response(JSON.stringify({error:uploadErr.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  const {data:signed,error:signedErr}=await admin.storage.from('rollcall-exports').createSignedUrl(objectPath,300,{download:filename})
  if(signedErr||!signed?.signedUrl)return new Response(JSON.stringify({error:signedErr?.message||'Could not create download link'}),{status:500,headers:{...cors,'Content-Type':'application/json'}})
  return new Response(JSON.stringify({url:signed.signedUrl,filename,expiresIn:300}),{status:200,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})
})
