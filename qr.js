S.qrActive=S.qrActive||null;
S.qrManual=S.qrManual||null;
let qrTicker=null,qrBusy=false;
const _qrBaseRoster=roster;

roster=function(session){
  let all=_qrBaseRoster(session);
  if(S.qrManual&&S.qrManual.sessionId===session?.id){
    let keep=new Set(S.qrManual.ids||[]);
    return all.filter(st=>keep.has(st.id));
  }
  return all;
};

function qrEligible(ses){
  if(!ses)return false;
  const kind=String(ses.type||'').toLowerCase();
  if(!['lecture','practical'].includes(kind))return false;
  if(S.staff?.role==='lab_scientist')return kind==='practical';
  return ['lecturer','hod','admin'].includes(S.staff?.role);
}
async function qrPost(body){
  let r=await authedFetch(URL+'/functions/v1/qr-attendance-session',{
    method:'POST',
    headers:{apikey:KEY,Authorization:`Bearer ${S.session?.access_token||''}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  let b=await r.json();
  if(!r.ok)throw Error(b.error||'QR attendance request failed');
  return b;
}
async function recoverQrSession(){
  if(!S.session||!S.staff)return;
  let b=await qrPost({action:'recover',session_date:iso()});
  let q=b.session;if(!q)return;
  let prefix=iso()+'__';
  if(!String(q.session_key||'').startsWith(prefix))return;
  let rollSessionId=String(q.session_key).slice(prefix.length);
  let ses=visibleSessions().find(x=>x.id===rollSessionId);
  if(!ses)return;
  S.selected=rollSessionId;S.rollSession=rollSessionId;
  S.qrActive={sessionId:q.id,sessionKey:q.session_key,rollSessionId,token:q.token,windowExpiresAt:q.window_expires_at,tokenExpiresAt:q.token_expires_at,checkedIn:q.checked_in||0,nextRotateAt:Date.now()+50000,nextStatusAt:Date.now()+5000,finishing:false};
  if(q.status==='expired'||Date.now()>=new Date(q.window_expires_at).getTime()){
    S.qrActive.finishing=true;
    await finishQrWindow(true);
  }else startQrTicker();
}

function qrCheckinUrl(q){
  return location.origin+'/checkin.html?sid='+encodeURIComponent(q.sessionId)+'&token='+encodeURIComponent(q.token);
}
function renderQrCode(){
  let el=document.getElementById('qrCodeBox');
  if(!el||!S.qrActive)return;
  el.innerHTML='';
  try{
    new QRCode(el,{text:qrCheckinUrl(S.qrActive),width:250,height:250,correctLevel:QRCode.CorrectLevel.M});
  }catch(e){el.innerHTML='<div class="muted">Could not render QR code. Refresh the page.</div>'}
}
function updateQrStatusUi(){
  if(!S.qrActive)return;
  let rem=Math.max(0,Math.ceil((new Date(S.qrActive.windowExpiresAt).getTime()-Date.now())/1000));
  let m=String(Math.floor(rem/60)).padStart(2,'0'),s=String(rem%60).padStart(2,'0');
  let t=document.getElementById('qrTimer');if(t)t.textContent=m+':'+s;
  let c=document.getElementById('qrCount');if(c)c.textContent=(S.qrActive.checkedIn||0)+' checked in';
}
async function startQrCheckin(){
  let ses=visibleSessions().find(x=>x.id===S.selected);if(!qrEligible(ses))return;
  let all=_qrBaseRoster(ses),rec=S.attendance[key(ses)]||{},marked=all.filter(st=>rec[st.id]).length;
  if(marked){
    alert('This register already has '+marked+' attendance mark'+(marked===1?'':'s')+'. QR check-in should be started before manual marking. Use the existing manual register or restart the session if appropriate.');
    return;
  }
  let lecturer=ses.lecturer||S.staff.full_name;
  let what=String(ses.type||'').toLowerCase()==='practical'?'Practical '+(ses.practicalNumber||1):'Lecture '+(ses.lectureNumber||1);
  if(!confirm('Start a fresh 5-minute rotating QR for '+courseLabel(ses.course)+' · '+what+'?\n\n'+(String(ses.type||'').toLowerCase()==='practical'?'Students will enter matric number + Group A/B + surname.':'Students will enter matric number + surname.')+' After 5 minutes, only students who did not check in will appear for manual roll call.'))return;
  try{
    let b=await qrPost({action:'create',session_key:key(ses),course:ses.course,session_type:ses.type,session_date:iso(),lecturer,venue:ses.venue||''});
    S.qrActive={sessionId:b.session_id,sessionKey:key(ses),rollSessionId:ses.id,token:b.token,windowExpiresAt:b.window_expires_at,tokenExpiresAt:b.token_expires_at,checkedIn:0,nextRotateAt:Date.now()+50000,nextStatusAt:Date.now()+5000,finishing:false};
    S.qrManual=null;S.rollIndex=0;
    startQrTicker();renderRoll();
  }catch(e){alert('Could not start QR attendance: '+e.message)}
}
function startQrTicker(){
  if(qrTicker)clearInterval(qrTicker);
  qrTicker=setInterval(qrTick,1000);
}
async function qrTick(){
  let q=S.qrActive;if(!q)return;
  updateQrStatusUi();
  let end=new Date(q.windowExpiresAt).getTime();
  if(Date.now()>=end){
    if(!q.finishing){q.finishing=true;await finishQrWindow(true)}
    return;
  }
  if(qrBusy)return;
  try{
    if(Date.now()>=q.nextRotateAt){
      qrBusy=true;
      let b=await qrPost({action:'rotate',session_id:q.sessionId});
      q.token=b.token;q.tokenExpiresAt=b.token_expires_at;q.checkedIn=b.checked_in??q.checkedIn;
      q.nextRotateAt=Date.now()+50000;q.nextStatusAt=Date.now()+5000;
      renderQrCode();updateQrStatusUi();
    }else if(Date.now()>=q.nextStatusAt){
      qrBusy=true;
      let b=await qrPost({action:'status',session_id:q.sessionId});
      q.checkedIn=b.checked_in??q.checkedIn;q.nextStatusAt=Date.now()+5000;updateQrStatusUi();
    }
  }catch(e){console.error('QR attendance update failed',e)}
  finally{qrBusy=false}
}
async function finishQrWindow(auto=false){
  let q=S.qrActive;if(!q)return;
  try{await qrPost({action:'close',session_id:q.sessionId})}catch(e){console.error(e)}
  try{await loadAttendance()}catch(e){alert('QR window ended but attendance could not be refreshed. Please refresh the app before continuing.');return}
  let ses=visibleSessions().find(x=>x.id===q.rollSessionId);
  if(!ses){S.qrActive=null;if(qrTicker)clearInterval(qrTicker);render();return}
  let all=_qrBaseRoster(ses),rec=S.attendance[key(ses)]||{},missing=all.filter(st=>!rec[st.id]);
  S.qrManual=missing.length?{sessionId:ses.id,ids:missing.map(x=>x.id),qrCheckedIn:all.length-missing.length}:null;
  S.qrActive=null;if(qrTicker){clearInterval(qrTicker);qrTicker=null}
  S.selected=ses.id;S.rollSession=ses.id;
  S.rollIndex=missing.length?0:all.length;
  renderRoll();
  if(missing.length)alert('QR check-in finished. '+(all.length-missing.length)+' students checked in successfully. Only the remaining '+missing.length+' students are now shown for manual roll call.');
  else alert('QR check-in finished. All '+all.length+' students checked in successfully.');
}
function clearQrResidualView(){
  S.qrManual=null;S.rollIndex=0;renderRoll()
}
function qrCardHtml(ses){
  if(S.qrActive&&S.qrActive.rollSessionId===ses.id){
    return `<div class="card qr-card"><div class="top"><div><b>5-minute rotating QR check-in</b><div class="muted">Students enter matric number + surname. QR refreshes automatically.</div></div><div class="qr-timer" id="qrTimer">05:00</div></div><div class="qr-layout"><div id="qrCodeBox" class="qr-box"></div><div><div class="qr-count" id="qrCount">${S.qrActive.checkedIn||0} checked in</div><div class="muted" style="margin-top:8px">Keep this screen visible to the class. Old QR codes expire quickly.</div><button class="btn light" style="margin-top:12px" onclick="finishQrWindow(false)">End QR phase now</button></div></div></div>`;
  }
  if(S.qrManual&&S.qrManual.sessionId===ses.id){
    return `<div class="card qr-card"><b>QR phase complete</b><div class="muted" style="margin-top:5px">${S.qrManual.qrCheckedIn} students checked in by QR. The roll call below contains only the ${S.qrManual.ids.length} students who did not scan successfully.</div><button class="btn light" style="margin-top:10px" onclick="clearQrResidualView()">Show full register</button></div>`;
  }
  let rec=S.attendance[key(ses)]||{},marked=_qrBaseRoster(ses).filter(st=>rec[st.id]).length;
  let practical=String(ses.type||'').toLowerCase()==='practical';
  return `<div class="card qr-card"><div class="top"><div><b>Attendance method</b><div class="muted">Use manual roll call or a fresh 5-minute QR for this ${practical?'practical':'lecture'}.</div></div><button class="btn primary" ${marked?'disabled title="QR must be started before manual marks are entered"':''} onclick="startQrCheckin()">Start 5-minute QR</button></div><div class="muted" style="margin-top:8px">${practical?'Students enter matric number + Group A/B + surname.':'Students enter matric number + surname.'} After 5 minutes, only students who did not check in are shown for manual marking.</div></div>`;
}

const _qrBaseRenderRoll=renderRoll;
renderRoll=function(){
  _qrBaseRenderRoll();
  let v=$('#view'),ses=visibleSessions().find(x=>x.id===S.selected);
  if(!v||!qrEligible(ses))return;
  let first=v.querySelector('.card');
  if(first)first.insertAdjacentHTML('beforebegin',qrCardHtml(ses));else v.insertAdjacentHTML('afterbegin',qrCardHtml(ses));
  if(S.qrActive&&S.qrActive.rollSessionId===ses.id){
    v.querySelectorAll('.student-card').forEach(x=>x.style.display='none');
    renderQrCode();updateQrStatusUi();startQrTicker();
  }
};
const _qrBaseLoad=load;
load=async function(){
  await _qrBaseLoad();
  if(S.session&&S.staff){
    try{await recoverQrSession();render()}catch(e){console.error('Could not recover QR attendance session',e)}
  }
};
