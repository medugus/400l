
S.testMode = localStorage.getItem('nile_rollcall_testmode')==='1';
S.testCourse = localStorage.getItem('nile_rollcall_testcourse') || (S.staff?.course||'Microbiology');

function testPrefix(){
  return 'TEST__'+(S.session?.user?.id||'unknown')+'__';
}
function testSessionKeyPrefix(){
  return testPrefix()+iso()+'__';
}
function enterTestMode(){
  S.testMode=true;
  localStorage.setItem('nile_rollcall_testmode','1');
  if(S.staff?.course)S.testCourse=S.staff.course;
  S.selected=null;S.rollSession=null;S.rollIndex=0;S.undo=null;S.qrActive=null;S.qrManual=null;S.tab='roll';
  render();
}
function exitTestMode(){
  S.testMode=false;
  localStorage.removeItem('nile_rollcall_testmode');
  S.selected=null;S.rollSession=null;S.rollIndex=0;S.undo=null;S.qrActive=null;S.qrManual=null;S.tab='home';
  render();
}
function setTestCourse(c){
  if(S.staff?.course)return;
  S.testCourse=c||'Microbiology';
  localStorage.setItem('nile_rollcall_testcourse',S.testCourse);
  S.selected=null;S.rollSession=null;S.rollIndex=0;render();
}
async function resetTestMode(){
  if(!confirm('Clear all of your TEST MODE attendance, QR sessions and test-device bindings?\n\nReal attendance will not be touched.'))return;
  try{
    let r=await authedFetch(URL+'/functions/v1/test-mode-reset',{method:'POST',headers:{apikey:KEY,Authorization:`Bearer ${S.session?.access_token||''}`,'Content-Type':'application/json'},body:'{}'});
    let b=await r.json();if(!r.ok)throw Error(b.error||'Could not reset Test Mode');
    for(const k of Object.keys(S.attendance))if(k.startsWith(testPrefix()))delete S.attendance[k];
    S.qrActive=null;S.qrManual=null;S.selected=null;S.rollSession=null;S.rollIndex=0;S.undo=null;
    alert('Your Test Mode data has been cleared. Real attendance was not changed.');
    render();
  }catch(e){alert(e.message)}
}

const _tmVisibleSessions=visibleSessions;
visibleSessions=function(){
  if(!S.testMode)return _tmVisibleSessions();
  const course=S.staff?.course||S.testCourse||'Microbiology',d=lagosDay();
  let out=[];
  if(S.staff?.role!=='lab_scientist'){
    for(let n=1;n<=4;n++)out.push({
      id:n===1?'SANDBOX-AM':'SANDBOX-AM__L'+n,day:d,start:'08:00',end:'13:00',type:'Lecture',
      venue:'TEST ROOM',course,lectureNumber:n,baseSessionId:'SANDBOX-AM',lecturer:S.staff?.full_name||'',testMode:true
    });
  }
  for(let n=1;n<=2;n++)out.push({
    id:n===1?'SANDBOX-PM':'SANDBOX-PM__P2',day:d,start:'14:00',end:'17:00',type:'Practical',
    venue:'TEST LAB',course,practicalNumber:n,baseSessionId:'SANDBOX-PM',lecturer:S.staff?.full_name||'',testMode:true
  });
  return out;
};

const _tmRoster=roster;
roster=function(session){
  if(S.testMode)return S.state.test_students||[];
  return _tmRoster(session);
};

const _tmKey=key;
key=function(s){
  if(S.testMode)return testSessionKeyPrefix()+s.id;
  return _tmKey(s);
};

const _tmSessionRecord=sessionRecord;
sessionRecord=function(ses){
  let [k,rec]=_tmSessionRecord(ses);
  if(S.testMode){
    rec.__meta={...(rec.__meta||{}),testMode:true,course:ses.course,type:ses.type,lectureNumber:ses.lectureNumber||null,practicalNumber:ses.practicalNumber||null};
    k=key(ses);
  }
  return [k,rec];
};

const _tmRegisterIsComplete=registerIsComplete;
registerIsComplete=function(rec){
  if(rec?.__meta?.testMode){
    const target=(S.state.test_students||[]).length;
    return registerMarkCount(rec)===target;
  }
  return _tmRegisterIsComplete(rec);
};

const _tmAudit=audit;
audit=async function(action,ses,studentId=null,oldStatus=null,newStatus=null,details={}){
  if(S.testMode)return;
  return _tmAudit(action,ses,studentId,oldStatus,newStatus,details);
};

const _tmCalc=calc;
calc=function(){
  if(!S.testMode)return _tmCalc();
  const students=S.state.test_students||[],prefix=testPrefix(),keys=Object.keys(S.attendance).filter(k=>k.startsWith(prefix)&&registerIsComplete(S.attendance[k]));
  const per=students.map(st=>{
    let n=0,a=0,by={};
    for(const k of keys){
      let rec=S.attendance[k],v=rec?.[st.id];if(!v)continue;
      let c=rec.__meta?.course||'TEST',w=lectureWeight(rec);by[c]??={n:0,a:0};n+=w;by[c].n+=w;
      if(v==='present'||v==='late'){a+=w;by[c].a+=w}
    }
    let rates=Object.fromEntries(Object.entries(by).map(([c,o])=>[c,Math.round(o.a/o.n*100)]));
    return {...st,n,a,rate:n?Math.round(a/n*100):null,rates};
  });
  let vals=per.filter(x=>x.rate!=null),avg=vals.length?Math.round(vals.reduce((s,x)=>s+x.rate,0)/vals.length):null;
  return {per,avg};
};

const _tmRenderHome=renderHome;
renderHome=function(){
  _tmRenderHome();
  let v=$('#view');if(!v)return;
  if(!S.testMode){
    v.insertAdjacentHTML('beforeend',`
      <section class="card" style="border:2px dashed #2563eb">
        <b>Practice / Test Mode</b>
        <div class="muted" style="margin:5px 0 10px">Try attendance, QR, device locking, restarts and practicals using six fake students. Nothing counts toward real attendance.</div>
        <button class="btn primary" onclick="enterTestMode()">Open Test Mode</button>
      </section>`);
  }
};

const _tmRenderSummary=renderSummary;
renderSummary=function(){
  if(!S.testMode)return _tmRenderSummary();
  let v=$('#view'),{per,avg}=calc(),prefix=testPrefix(),keys=Object.keys(S.attendance).filter(k=>k.startsWith(prefix)).sort();
  v.innerHTML=`
    <div class="card" style="border:2px solid #f59e0b;background:#fffbeb">
      <b>TEST MODE REPORT</b>
      <div class="muted">Sandbox only. These records are excluded from real dashboards and Excel exports.</div>
      <div style="margin-top:10px"><button class="btn danger" onclick="resetTestMode()">Clear my test data</button></div>
    </div>
    <div class="card"><b>Test summary</b><div class="muted">${keys.length} test register(s) · average ${avg==null?'—':avg+'%'}</div>
      <div class="scroll" style="margin-top:10px"><table class="table"><tr><th>ID</th><th>Sample student</th><th>Attended</th><th>Counted</th><th>Rate</th></tr>
      ${per.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${x.a}</td><td>${x.n}</td><td>${x.rate==null?'—':x.rate+'%'}</td></tr>`).join('')}
      </table></div>
    </div>`;
};

const _tmRender=render;
render=function(){
  _tmRender();
  if(!S.testMode)return;
  let shell=document.querySelector('.app-shell'),main=document.querySelector('#view');
  if(shell&&!document.querySelector('.test-mode-banner')){
    let div=document.createElement('div');div.className='test-mode-banner';
    let courseSelect=S.staff?.course?'':`<select onchange="setTestCourse(this.value)" style="margin-left:8px"><option value="Microbiology" ${S.testCourse==='Microbiology'?'selected':''}>Microbiology</option><option value="Haematology" ${S.testCourse==='Haematology'?'selected':''}>Haematology</option><option value="Histopathology" ${S.testCourse==='Histopathology'?'selected':''}>Histopathology</option><option value="Chemical Pathology" ${S.testCourse==='Chemical Pathology'?'selected':''}>Chemical Pathology</option><option value="Pharmacology" ${S.testCourse==='Pharmacology'?'selected':''}>Pharmacology</option></select>`;
    div.innerHTML=`<b>TEST MODE — NO REAL ATTENDANCE</b>${courseSelect}<span style="margin-left:auto"><button class="btn light" onclick="resetTestMode()">Reset test</button> <button class="btn danger" onclick="exitTestMode()">Exit Test Mode</button></span>`;
    if(main)main.parentNode.insertBefore(div,main);
  }
};

(function(){
  const style=document.createElement('style');
  style.textContent='.test-mode-banner{display:flex;align-items:center;gap:8px;padding:12px 16px;background:#fef3c7;border-bottom:2px solid #f59e0b;color:#7c2d12;position:sticky;top:0;z-index:20;flex-wrap:wrap}.test-mode-banner select{padding:7px 9px;border-radius:8px;border:1px solid #d97706;background:white}@media(max-width:700px){.test-mode-banner{font-size:13px}.test-mode-banner span{width:100%;margin-left:0!important}}';
  document.head.appendChild(style);
})();
