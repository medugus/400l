function extraSessionsToday(){
  const today=iso(),seen=new Set(),out=[];
  for(const [k,rec] of Object.entries(S.attendance||{})){
    const m=rec?.__meta||{};
    if(!m.outOfTimetable||m.date!==today)continue;
    if(S.staff?.role!=='admin'&&S.staff?.course&&m.course!==S.staff.course)continue;
    if(S.staff?.role==='lab_scientist')continue;
    const id=m.sessionId||String(k).split('__').slice(1).join('__');
    if(!id||seen.has(id))continue;seen.add(id);
    out.push({id,day:new Date().getDay(),date:today,start:m.start||'',end:m.end||'',type:m.type||'Out-of-official-timetable class',course:m.course,venue:m.venue||'',reason:m.reason||'',outOfTimetable:true,classType:m.classType||'Lecture'});
  }
  return out;
}
function visibleSessions(){
  let t=S.state.timetable||[],today=iso(),d=new Date().getDay(),ex=S.state.schedule_exclusions||[];
  if(!ex.includes(today)){
    t=t.filter(x=>{
      if(x.date&&x.date!==today)return false;
      if(x.validFrom&&today<x.validFrom)return false;
      if(x.validTo&&today>x.validTo)return false;
      return x.day===d;
    });
    if(S.staff?.course)t=t.filter(x=>x.course===S.staff.course);
    if(S.staff?.role==='lab_scientist')t=t.filter(x=>String(x.type||'').toLowerCase()==='practical');
  }else t=[];
  return [...t,...extraSessionsToday()];
}
function roster(session){let cohorts=S.state.cohorts||[],map=S.state.courseCohort||{},students=S.state.students||[],by=Object.fromEntries(students.map(x=>[x.id,x]));let c=cohorts.find(x=>x.id===(map[session.course]||cohorts[0]?.id))||cohorts[0];return (c?.members||[]).map(id=>by[id]).filter(Boolean)}
function key(s){return (s.date||iso())+'__'+s.id} function markLabel(v){return v==='present'?'Present':v==='late'?'Late':v==='absent'?'Absent':''}
function queueSave(k,rec){let snapshot=JSON.parse(JSON.stringify(rec));saveChain=saveChain.then(()=>req('/rest/v1/attendance_sessions?on_conflict=session_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({session_key:k,data:snapshot,updated_at:new Date().toISOString()})})).catch(e=>{console.error(e);alert('Attendance could not be saved. Check your connection and try again.');});return saveChain}
function sessionRecord(ses){let k=key(ses),rec={...(S.attendance[k]||{})};rec.__meta={...(rec.__meta||{}),course:ses.course,type:ses.type,venue:ses.venue||'',date:ses.date||iso(),start:ses.start||'',end:ses.end||'',takenBy:S.staff.full_name,takenByRole:S.staff.role,lecturer:S.staff.full_name,cohort:'',savedAt:new Date().toISOString(),sessionId:ses.id,outOfTimetable:!!ses.outOfTimetable,reason:ses.reason||'',classType:ses.classType||''};return [k,rec]}
async function audit(action,ses,studentId=null,oldStatus=null,newStatus=null,details={}){
  try{
    await req('/rest/v1/attendance_audit',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
      actor_user_id:S.session?.user?.id,actor_name:S.staff?.full_name||'',
      action,session_key:ses?key(ses):null,course:ses?.course||null,session_type:ses?.type||null,
      student_id:studentId,old_status:oldStatus||null,new_status:newStatus||null,details
    })});
  }catch(e){console.error('Audit log failed',e)}
}
function setRollSession(id){S.selected=id;S.rollSession=id;let ses=visibleSessions().find(x=>x.id===id);if(!ses){S.rollIndex=0;renderRoll();return}let r=roster(ses),rec=S.attendance[key(ses)]||{},first=r.findIndex(st=>!rec[st.id]);S.rollIndex=first>=0?first:0;renderRoll()}
function gotoStudent(delta){let ses=visibleSessions().find(x=>x.id===S.selected);if(!ses)return;let r=roster(ses);S.rollIndex=Math.max(0,Math.min(r.length,S.rollIndex+delta));renderRoll()}
function reviewUnmarked(){let ses=visibleSessions().find(x=>x.id===S.selected);if(!ses)return;let r=roster(ses),rec=S.attendance[key(ses)]||{},i=r.findIndex(st=>!rec[st.id]);S.rollIndex=i>=0?i:0;renderRoll()}
async function createExtraClassFromForm(e){
  e.preventDefault();
  if(S.staff?.role==='lab_scientist')return;
  const course=S.staff?.role==='admin'?($('#extraCourse')?.value||S.staff?.course):S.staff?.course;
  const start=$('#extraStart')?.value||'',end=$('#extraEnd')?.value||'',classType=$('#extraType')?.value||'Lecture',venue=$('#extraVenue')?.value.trim()||'',reason=$('#extraReason')?.value.trim()||'';
  if(!course||!start||!end||!reason){alert('Please complete course, start time, end time and reason.');return}
  const id='EXT-'+Date.now().toString(36).toUpperCase();
  const ses={id,day:new Date().getDay(),date:iso(),start,end,course,venue,reason,classType,type:`Out-of-official-timetable class – ${classType}`,outOfTimetable:true};
  const [k,rec]=sessionRecord(ses);S.attendance[k]=rec;S.selected=id;S.rollSession=id;S.rollIndex=0;S.showExtraForm=false;
  renderRoll();
  await queueSave(k,rec);
  audit('extra_class_created',ses,null,null,null,{reason,start,end,classType,venue,label:'Out-of-official-timetable class'});
}
