S.extraSessions=S.extraSessions||[];

function mapExtraSession(x){
  return {
    id:'EXTRA_'+x.id,
    extraId:x.id,
    day:new Date(x.session_date+'T12:00:00').getDay(),
    date:x.session_date,
    start:String(x.start_time||'').slice(0,5),
    end:String(x.end_time||'').slice(0,5),
    type:x.session_type,
    venue:x.venue||'',
    course:x.course,
    outOfTimetable:true,
    reason:x.reason||'',
    label:x.label||'OUT OF OFFICIAL TIMETABLE CLASS',
    createdBy:x.created_by_name||'',
    active:x.active!==false,
    createdAt:x.created_at||''
  };
}

async function loadExtraSessions(){
  let rows=await req('/rest/v1/extra_sessions?active=eq.true&select=id,created_by,created_by_name,course,session_date,start_time,end_time,session_type,venue,reason,label,active,created_at&order=session_date.asc,start_time.asc');
  S.extraSessions=(rows||[]).map(mapExtraSession);
}

const _baseLoad=load;
load=async function(){
  await _baseLoad();
  if(S.session&&S.staff){
    try{await loadExtraSessions();render()}catch(e){console.error('Could not load out-of-timetable sessions',e)}
  }
};

const _baseVisibleSessions=visibleSessions;
visibleSessions=function(){
  let official=_baseVisibleSessions();
  let today=iso();
  let extra=(S.extraSessions||[]).filter(x=>x.active!==false&&x.date===today);
  if(S.staff?.course)extra=extra.filter(x=>x.course===S.staff.course);
  if(S.staff?.role==='lab_scientist')extra=extra.filter(x=>String(x.type||'').toLowerCase()==='practical');
  return [...official,...extra].sort((a,b)=>String(a.start||'').localeCompare(String(b.start||''))||String(a.course||'').localeCompare(String(b.course||'')));
};

const _baseSessionRecord=sessionRecord;
sessionRecord=function(ses){
  let [k,rec]=_baseSessionRecord(ses);
  if(ses?.outOfTimetable){
    rec.__meta={...(rec.__meta||{}),outOfTimetable:true,officialTimetable:false,label:ses.label||'OUT OF OFFICIAL TIMETABLE CLASS',reason:ses.reason||'',createdBy:ses.createdBy||'',extraSessionId:ses.extraId||''};
  }else{
    rec.__meta={...(rec.__meta||{}),outOfTimetable:false,officialTimetable:true};
  }
  return [k,rec];
};

function canCreateExtraSession(){
  return !!(S.staff?.course&&['lecturer','hod','admin'].includes(S.staff?.role));
}

function defaultExtraTimes(){
  let d=new Date(),start=new Date(d.getTime());
  start.setMinutes(Math.ceil(start.getMinutes()/15)*15,0,0);
  let end=new Date(start.getTime()+60*60*1000);
  const f=x=>String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0');
  return [f(start),f(end)];
}

function openExtraSessionDialog(){
  if(!canCreateExtraSession())return;
  let old=document.getElementById('extraClassDialog');if(old)old.remove();
  let [start,end]=defaultExtraTimes();
  document.body.insertAdjacentHTML('beforeend',`<dialog id="extraClassDialog" class="extra-dialog"><form onsubmit="saveExtraSession(event)"><div class="extra-title">Add out-of-timetable class</div><div class="muted">${esc(courseLabel(S.staff.course))} · ${iso()}</div><div class="out-badge" style="margin-top:10px">OUT OF OFFICIAL TIMETABLE CLASS</div><label>Class type</label><select id="extraType" required><option>Lecture</option><option>Practical</option></select><div class="two-col"><div><label>Start</label><input id="extraStart" type="time" value="${start}" required></div><div><label>End</label><input id="extraEnd" type="time" value="${end}" required></div></div><label>Venue</label><input id="extraVenue" placeholder="Lecture theatre / laboratory"><label>Why is this class outside the official timetable?</label><textarea id="extraReason" minlength="5" required placeholder="e.g. replacement class, make-up lecture, rescheduled class"></textarea><div id="extraErr" class="errorline"></div><div class="dialog-actions"><button type="button" class="btn light" onclick="document.getElementById('extraClassDialog').close()">Cancel</button><button id="extraSave" class="btn primary">Create class</button></div></form></dialog>`);
  document.getElementById('extraClassDialog').showModal();
}

async function saveExtraSession(e){
  e.preventDefault();
  if(!navigator.onLine){document.getElementById('extraErr').textContent='You must be online to create an out-of-timetable class.';return}
  let start=$('#extraStart').value,end=$('#extraEnd').value,reason=$('#extraReason').value.trim(),venue=$('#extraVenue').value.trim(),type=$('#extraType').value;
  if(end<=start){$('#extraErr').textContent='End time must be after the start time.';return}
  let btn=$('#extraSave');btn.disabled=true;btn.textContent='Creating…';
  try{
    let rows=await req('/rest/v1/extra_sessions',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({created_by:S.session.user.id,created_by_name:S.staff.full_name,course:S.staff.course,session_date:iso(),start_time:start,end_time:end,session_type:type,venue:venue||null,reason,label:'OUT OF OFFICIAL TIMETABLE CLASS'})});
    let row=Array.isArray(rows)?rows[0]:rows;if(!row)throw Error('Class was created but could not be loaded. Refresh and try again.');
    let ses=mapExtraSession(row);S.extraSessions.push(ses);S.selected=ses.id;S.rollSession=ses.id;S.rollIndex=0;
    document.getElementById('extraClassDialog').close();
    audit('extra_session_created',ses,null,null,null,{reason,start_time:start,end_time:end,venue,type,label:ses.label});
    renderRoll();
  }catch(err){$('#extraErr').textContent=err.message;btn.disabled=false;btn.textContent='Create class'}
}

function enhanceRoll(){
  let v=$('#view');if(!v)return;
  if(canCreateExtraSession())v.insertAdjacentHTML('afterbegin',`<div class="card extra-create"><div><b>Need to teach outside the official timetable?</b><div class="muted">Create a clearly labelled replacement, make-up or rescheduled class. A reason is required and the action is audited.</div></div><button class="btn extra-btn" onclick="openExtraSessionDialog()">+ Add out-of-timetable class</button></div>`);
  let ss=visibleSessions();
  [...v.querySelectorAll('.session')].forEach((el,i)=>{let s=ss[i];if(s?.outOfTimetable)el.insertAdjacentHTML('afterbegin','<div class="out-badge">OUT OF OFFICIAL TIMETABLE</div>')});
  let selected=ss.find(x=>x.id===S.selected);
  if(selected?.outOfTimetable){
    let first=v.querySelector('.extra-create');
    let html=`<div class="card out-note"><b>${esc(selected.label)}</b><div>${esc(courseLabel(selected.course))} · ${esc(selected.start)}–${esc(selected.end)} · ${esc(selected.type)}</div><div class="muted" style="margin-top:5px"><b>Reason:</b> ${esc(selected.reason)}${selected.createdBy?' · Added by '+esc(selected.createdBy):''}</div></div>`;
    if(first)first.insertAdjacentHTML('afterend',html);else v.insertAdjacentHTML('afterbegin',html);
  }
}

const _baseRenderRoll=renderRoll;
renderRoll=function(){_baseRenderRoll();enhanceRoll()};

function addTabHints(){
  const tips={
    'Attendance Dashboard':'Colour-coded overview of student attendance. Green ≥85%, amber 75–84%, red <75%.',
    'Roll call':'Take today’s attendance, continue a register, or add an out-of-official-timetable class with a reason.',
    'Reports':'View departmental and cumulative attendance and download Excel reports.',
    'Admin':'Manage staff access and codes, review the audit trail, timetable blocks and special classes.'
  };
  document.querySelectorAll('.tabs button').forEach(b=>{let t=(b.textContent||'').trim();if(tips[t]){b.title=tips[t];b.setAttribute('aria-label',t+'. '+tips[t])}});
}

const _baseRender=render;
render=function(){_baseRender();addTabHints()};

async function cancelExtraSession(id){
  if(S.staff?.role!=='admin')return;
  if(!confirm('Cancel this out-of-timetable class? Existing attendance records, if any, will remain in reports and the audit trail.'))return;
  try{
    await req('/rest/v1/extra_sessions?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({active:false})});
    let ses=(S.extraSessions||[]).find(x=>x.extraId===id);if(ses)audit('extra_session_cancelled',ses,null,null,null,{reason:ses.reason});
    S.extraSessions=(S.extraSessions||[]).filter(x=>x.extraId!==id);renderAdmin();
  }catch(e){alert('Could not cancel class: '+e.message)}
}

function extraAdminCard(){
  let rows=[...(S.extraSessions||[])].sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
  return `<div class="card" id="extraSessionsAdmin"><b>Out-of-official-timetable classes</b><div class="muted" style="margin:4px 0 10px">Classes created by lecturers/HODs outside the submitted timetable. Reasons are retained for audit and reporting.</div>${rows.length?`<div class="scroll"><table class="table"><tr><th>Date</th><th>Course</th><th>Time</th><th>Type</th><th>Added by</th><th>Reason</th><th></th></tr>${rows.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(courseLabel(x.course))}</td><td>${esc(x.start)}–${esc(x.end)}</td><td>${esc(x.type)}</td><td>${esc(x.createdBy)}</td><td>${esc(x.reason)}</td><td><button class="btn light" onclick="cancelExtraSession('${esc(x.extraId)}')">Cancel</button></td></tr>`).join('')}</table></div>`:'<div class="muted">None created.</div>'}</div>`;
}

const _baseRenderAdmin=renderAdmin;
renderAdmin=function(){
  _baseRenderAdmin();
  if(S.staff?.role!=='admin')return;
  let v=$('#view'),staff=document.getElementById('staffAdmin');
  if(v&&!document.getElementById('extraSessionsAdmin')){
    if(staff)staff.insertAdjacentHTML('beforebegin',extraAdminCard());else v.insertAdjacentHTML('beforeend',extraAdminCard());
  }
};
