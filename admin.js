async function fetchAdminStaff(){
  let r=await fetch(URL+'/functions/v1/admin-staff',{headers:{apikey:KEY,Authorization:`Bearer ${S.session?.access_token||''}`}});
  let b=await r.json();if(!r.ok)throw Error(b.error||'Could not load staff');S.adminStaff=b.staff||[];return S.adminStaff
}
async function loadAdminPanel(){
  try{
    let [staff,auditRows]=await Promise.all([
      fetchAdminStaff(),
      req('/rest/v1/attendance_audit?select=actor_name,action,session_key,course,student_id,old_status,new_status,details,created_at&order=created_at.desc&limit=100')
    ]);
    S.adminAudit=auditRows||[];renderStaffAdmin();renderAuditAdmin();
  }catch(e){
    let a=$('#staffAdmin');if(a)a.innerHTML='<div class="muted">Could not load staff access: '+esc(e.message)+'</div>';
  }
}
function copyStaffCode(code,name){
  if(!code)return;
  let text=String(code);
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text).then(()=>alert((name?name+' · ':'')+'code copied')).catch(()=>prompt('Copy code',text));
  }else prompt('Copy code',text)
}
function renderStaffAdmin(){
  let el=$('#staffAdmin');if(!el)return;
  let me=S.adminStaff.find(x=>x.full_name===S.staff.full_name),myCode=me?.code_display||'—';
  el.innerHTML=`<div class="top"><div><b>Staff access codes</b><div class="muted">Admin only. The table fills automatically when you open Admin.</div></div><button class="btn light" onclick="downloadCodeTable()">Download code table</button></div>
  <div style="margin-top:10px;padding:12px;border:1px solid #c7d2fe;background:#eef2ff;border-radius:12px"><b>Your code: <span class="codebox">${esc(myCode)}</span></b> ${myCode!=='—'?`<button class="btn light" style="margin-left:8px" onclick="copyStaffCode('${esc(myCode)}','Your')">Copy</button>`:''}</div>
  <div class="scroll" style="margin-top:10px"><table class="table"><tr><th>Name</th><th>Department</th><th>Role</th><th>Code</th><th>Status</th><th>Actions</th></tr>${S.adminStaff.map(x=>{let mine=x.full_name===S.staff.full_name;return `<tr class="${x.active?'':'staff-inactive'}" style="${mine?'background:#eef2ff':''}"><td>${esc(x.full_name)}${mine?' <span class="pill">YOU</span>':''}</td><td>${esc(x.department)}</td><td>${esc(x.role)}</td><td class="codebox"><b>${esc(x.code_display||'—')}</b></td><td>${x.active?'Active':'Inactive'}</td><td><div class="admin-actions">${x.code_display?`<button class="btn light" onclick="copyStaffCode('${esc(x.code_display)}','${esc(x.full_name)}')">Copy code</button>`:''}<button class="btn light" onclick="resetStaffCode('${esc(x.login_key)}')">New code</button><button class="btn ${x.active?'danger':'green'}" onclick="toggleStaff('${esc(x.login_key)}',${!x.active})">${x.active?'Deactivate':'Activate'}</button></div></td></tr>`}).join('')}</table></div>`
}
async function resetStaffCode(loginKey){
  if(!confirm('Generate a new 6-digit code for this staff member? Their old code will stop working immediately.'))return;
  try{
    let r=await fetch(URL+'/functions/v1/admin-staff',{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${S.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({action:'reset_code',login_key:loginKey})});
    let b=await r.json();if(!r.ok)throw Error(b.error||'Could not reset code');
    alert('New code: '+b.code+'\nSend this code only to that staff member.');
    await fetchAdminStaff();renderStaffAdmin();loadAdminPanel();
  }catch(e){alert(e.message)}
}
async function toggleStaff(loginKey,active){
  if(!confirm((active?'Activate':'Deactivate')+' this staff account?'))return;
  try{
    let r=await fetch(URL+'/functions/v1/admin-staff',{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${S.session?.access_token||''}`,'Content-Type':'application/json'},body:JSON.stringify({action:'set_active',login_key:loginKey,active})});
    let b=await r.json();if(!r.ok)throw Error(b.error||'Could not update staff');
    await fetchAdminStaff();renderStaffAdmin();loadAdminPanel();
  }catch(e){alert(e.message)}
}
function downloadCodeTable(){
  if(!S.adminStaff.length)return;
  let rows=[['Name','Department','Role','Code','Status'],...S.adminStaff.map(x=>[x.full_name,x.department,x.role,x.code_display||'',x.active?'Active':'Inactive'])];
  let csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  let blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='Nile_FBCS_RollCall_Staff_Codes_'+iso()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)
}
function auditText(x){
  let when=new Date(x.created_at).toLocaleString(),who=x.actor_name||'',act=x.action.replace('_',' '),target=x.student_id?' · '+x.student_id:'';
  return `<div class="audititem"><b>${esc(who)}</b> · ${esc(act)}${esc(target)}<div class="muted">${esc(x.course||'')} ${esc(x.session_key||'')} · ${esc(when)}</div></div>`
}
function renderAuditAdmin(){let el=$('#auditAdmin');if(el)el.innerHTML=S.adminAudit.length?S.adminAudit.map(auditText).join(''):'<div class="muted">No audit events yet.</div>'}
function renderAdmin(){
  let v=$('#view');if(S.staff.role!=='admin'){v.innerHTML='';return}
  let t=S.state.timetable||[],st=S.state.students||[],ex=S.state.schedule_exclusions||[];
  v.innerHTML=`<div class="card"><b>Admin overview</b><div class="muted" style="margin-top:5px">${st.length} students · ${t.length} recurring teaching blocks · ${ex.length} excluded self-study/break/exam dates.</div></div>
  <div class="card"><b>Academic timetable used for roll call</b><div class="muted" style="margin:5px 0 10px">Department/date/time blocks are based on the submitted 400-level schedule. Specific lecture topics are not required.</div><div class="scroll"><table class="table"><tr><th>Course</th><th>Day</th><th>Time</th><th>Type</th><th>Period</th></tr>${t.map(x=>`<tr><td>${esc(courseLabel(x.course))}</td><td>${days[x.day]}</td><td>${esc(x.start)}–${esc(x.end)}</td><td>${esc(x.type)}</td><td>${esc(x.validFrom||'')} – ${esc(x.validTo||'')}</td></tr>`).join('')}</table></div></div>
  <div class="card" id="staffAdmin"><div class="muted">Loading staff access codes…</div></div>
  <div class="card"><b>Audit trail</b><div class="muted">Marks, undo actions, restarts, code resets and account status changes.</div><div id="auditAdmin" class="scroll" style="margin-top:10px"><div class="muted">Loading audit trail…</div></div></div>
  <div class="card"><b>Student list</b><div class="scroll"><table class="table"><tr><th>Matric</th><th>Name</th></tr>${st.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td></tr>`).join('')}</table></div></div>`;
  loadAdminPanel();
}