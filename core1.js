const URL='https://ktlynfdhhfwqnhtkgauy.supabase.co',KEY='sb_publishable_5rmnEy05iKgq7bcCHYfQzw_Anumymr5',SK='nile_rollcall_session';
const STAFF=[
 {key:'nubwa',name:'Assoc. Prof. Medugu Nubwa',department:'Microbiology'},
 {key:'boaz',name:'Prof. Boaz',department:'Microbiology'},
 {key:'imran',name:'Dr. Imran',department:'Microbiology'},
 {key:'princewill',name:'Dr. Princewill',department:'Microbiology'},
 {key:'olaitan',name:'Mrs Olaitan',department:'Microbiology'},
 {key:'sanni',name:'Assoc. Prof. Sanni Emmanuel Oladipo',department:'Haematology & Blood Transfusion'},
 {key:'chizoba',name:'Dr. Chizoba Nwankwo',department:'Haematology & Blood Transfusion'},
 {key:'udo',name:'Dr. Udo Christiana',department:'Haematology & Blood Transfusion'},
 {key:'bukar',name:'Prof. Bukar Audu',department:'Haematology & Blood Transfusion'},
 {key:'omotayo',name:'Mr. Omotayo Joseph',department:'Haematology & Blood Transfusion'},
 {key:'mba',name:'Dr. Izuchukwu Nnachi Mba',department:'Chemical Pathology'},
 {key:'maxwell',name:'Prof. Maxwell Nwegbu',department:'Chemical Pathology'},
 {key:'jamila',name:'Dr. Jamila Mohammed',department:'Chemical Pathology'},
 {key:'nabilah',name:'Dr. Nabilah Abubakar',department:'Chemical Pathology'},
 {key:'anetor',name:'Prof. John Anetor',department:'Chemical Pathology'},
 {key:'nneka',name:'Mrs Nneka',department:'Chemical Pathology'},
 {key:'ezike',name:'Prof. Ezike Kevin Nwabueze',department:'Anatomic Pathology & Forensic Medicine'},
 {key:'ofuntebi',name:'Dr. Oguntebi',department:'Anatomic Pathology & Forensic Medicine'},
 {key:'ike',name:'Dr. Ike',department:'Anatomic Pathology & Forensic Medicine'},
 {key:'shehu',name:'Prof. M.S. Shehu',department:'Anatomic Pathology & Forensic Medicine'},
 {key:'charity',name:'Mrs Charity',department:'Anatomic Pathology & Forensic Medicine'},
 {key:'asalu',name:'Prof. Asalu Folorunsho Adedayo',department:'Pharmacology'},
 {key:'bassi',name:'Prof. Bassi',department:'Pharmacology'},
 {key:'egua',name:'Prof. Egua',department:'Pharmacology'},
 {key:'isaac',name:'Mr. Isaac',department:'Pharmacology'},
 {key:'zainab',name:'Mrs Zainab',department:'College Administration'},
 {key:'glory',name:'Mrs Glory',department:'College Administration'},
 {key:'anita',name:'Miss Anita',department:'College Administration'}
];
let S={session:null,staff:null,state:{},attendance:{},tab:'home',selected:null,rollIndex:0,rollSession:null,undo:null,pathView:'Microbiology',adminStaff:[],adminAudit:[]};
let saveChain=Promise.resolve();
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
window.addEventListener('appinstalled',()=>{installPrompt=null});

let audioCtx=null;
function playMarkSound(status){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    if(!audioCtx)audioCtx=new AC();
    if(audioCtx.state==='suspended')audioCtx.resume();
    const now=audioCtx.currentTime;
    if(status==='present'){
      [659.25,783.99,987.77].forEach((f,i)=>{
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.type='sine';o.frequency.value=f;
        const start=now+i*0.055,end=start+0.085;
        g.gain.setValueAtTime(0.0001,start);g.gain.exponentialRampToValueAtTime(0.075,start+0.012);g.gain.exponentialRampToValueAtTime(0.0001,end);
        o.connect(g);g.connect(audioCtx.destination);o.start(start);o.stop(end+0.01);
      });
    }else if(status==='absent'){
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type='triangle';o.frequency.setValueAtTime(210,now);o.frequency.exponentialRampToValueAtTime(105,now+0.28);
      g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(0.09,now+0.02);g.gain.exponentialRampToValueAtTime(0.0001,now+0.30);
      o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+0.31);
    }
  }catch(e){console.debug('Sound unavailable',e)}
}
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function courseLabel(c){return c==='Pharmacology'?'Pharmacology & Therapeutics':c==='Histopathology'?'Anatomic Pathology / Histopathology':c}
async function installApp(){if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return}if(/iphone|ipad|ipod/i.test(navigator.userAgent)){alert('On iPhone/iPad: tap Share, then Add to Home Screen.')}else{alert('Use your browser menu and choose Install app or Add to Home screen.')}}
function networkBadge(){return navigator.onLine?'<span class="online">Online · syncing</span>':'<span class="offline">Offline · changes cannot sync</span>'}
function hdr(token,extra={}){return{apikey:KEY,Authorization:`Bearer ${token||KEY}`,'Content-Type':'application/json',...extra}}
async function req(path,opt={}){let r=await fetch(URL+path,{...opt,headers:hdr(S.session?.access_token,opt.headers||{})});let t=await r.text(),b;try{b=t?JSON.parse(t):null}catch{b=t}if(!r.ok)throw Error(b?.msg||b?.message||b?.error_description||b?.error||`Request failed ${r.status}`);return b}
function saveSession(x){S.session=x; x?localStorage.setItem(SK,JSON.stringify(x)):localStorage.removeItem(SK)}
async function refresh(){if(!S.session?.refresh_token)return false;let r=await fetch(URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:hdr(),body:JSON.stringify({refresh_token:S.session.refresh_token})});if(!r.ok){saveSession(null);return false}let b=await r.json();b.expires_at=Math.floor(Date.now()/1000)+(b.expires_in||3600);saveSession(b);return true}
async function restore(){try{let x=JSON.parse(localStorage.getItem(SK)||'null');if(!x)return false;saveSession(x);if((x.expires_at||0)<Date.now()/1000+60)await refresh();return !!S.session}catch{return false}}
async function login(e){e.preventDefault();let login_key=$('#staff').value,code=$('#code').value.trim();let btn=$('#loginbtn');btn.disabled=true;btn.textContent='Signing in…';try{let r=await fetch(URL+'/functions/v1/staff-login',{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({login_key,code})});let b=await r.json();if(!r.ok||!b.session)throw Error(b.error||'Sign-in failed');saveSession(b.session);S.staff=b.staff||null;await load();}catch(e){$('#err').textContent=e.message;btn.disabled=false;btn.textContent='Sign in'}}
function staffChanged(){let st=STAFF.find(x=>x.key===$('#staff')?.value);let el=$('#department');if(el)el.textContent=st?st.department:'Select your name above'}
function staffOptions(){return [...new Set(STAFF.map(x=>x.department))].map(g=>`<optgroup label="${esc(g)}">${STAFF.filter(x=>x.department===g).map(x=>`<option value="${esc(x.key)}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}
async function logout(){try{await req('/auth/v1/logout',{method:'POST'})}catch{}saveSession(null);S.staff=null;renderLogin()}
async function load(){try{let uid=S.session.user.id;let p=await req('/rest/v1/staff_profiles?user_id=eq.'+encodeURIComponent(uid)+'&select=user_id,email,full_name,role,course&limit=1');if(!p?.[0])throw Error('This account has no staff profile. Ask the faculty administrator to add it.');S.staff=p[0];let rows=await req('/rest/v1/rollcall_state?select=key,value');S.state=Object.fromEntries(rows.map(x=>[x.key,x.value]));await loadAttendance();render()}catch(e){saveSession(null);renderLogin(e.message)}}
async function loadAttendance(){let rows=await req('/rest/v1/attendance_sessions?select=session_key,data&order=session_key.asc');S.attendance=Object.fromEntries(rows.map(x=>[x.session_key,x.data]))}
const iso=()=>new Date().toISOString().slice(0,10),days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];