function visibleSessions(){
  let t=S.state.timetable||[],today=iso(),d=new Date().getDay(),ex=S.state.schedule_exclusions||[];
  if(ex.includes(today))return[];
  t=t.filter(x=>{
    if(x.date&&x.date!==today)return false;
    if(x.validFrom&&today<x.validFrom)return false;
    if(x.validTo&&today>x.validTo)return false;
    return x.day===d;
  });
  if(S.staff?.course)t=t.filter(x=>x.course===S.staff.course);
  if(S.staff?.role==='lab_scientist')t=t.filter(x=>String(x.type||'').toLowerCase()==='practical');
  return t;
}
function roster(session){let cohorts=S.state.cohorts||[],map=S.state.courseCohort||{},students=S.state.students||[],by=Object.fromEntries(students.map(x=>[x.id,x]));let c=cohorts.find(x=>x.id===(map[session.course]||cohorts[0]?.id))||cohorts[0];return (c?.members||[]).map(id=>by[id]).filter(Boolean)}
function key(s){return iso()+'__'+s.id} function markLabel(v){return v==='present'?'Present':v==='late'?'Late':v==='absent'?'Absent':''}
function queueSave(k,rec){let snapshot=JSON.parse(JSON.stringify(rec));saveChain=saveChain.then(()=>req('/rest/v1/attendance_sessions?on_conflict=session_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({session_key:k,data:snapshot,updated_at:new Date().toISOString()})})).catch(e=>{console.error(e);alert('Attendance could not be saved. Check your connection and try again.');});return saveChain}
function sessionRecord(ses){let k=key(ses),rec={...(S.attendance[k]||{})};rec.__meta={course:ses.course,type:ses.type,venue:ses.venue||'',date:iso(),takenBy:S.staff.full_name,takenByRole:S.staff.role,lecturer:S.staff.full_name,cohort:'',savedAt:new Date().toISOString()};return [k,rec]}
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