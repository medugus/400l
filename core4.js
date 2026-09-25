function renderDashboard(sort='risk'){let v=$('#view'),c=calc(),ps=[...c.per],counts={red:0,amber:0,green:0,grey:0};for(let x of ps){let b=bandForRate(x.rate);if(b.rank===0)counts.red++;else if(b.rank===1)counts.amber++;else if(b.rank===2)counts.green++;else counts.grey++}if(sort==='name')ps.sort((a,b)=>a.name.localeCompare(b.name));else if(sort==='high')ps.sort((a,b)=>(b.rate??-1)-(a.rate??-1)||a.name.localeCompare(b.name));else ps.sort((a,b)=>bandForRate(a.rate).rank-bandForRate(b.rate).rank||(a.rate??101)-(b.rate??101)||a.name.localeCompare(b.name));v.innerHTML=`<div class="dash-summary"><div class="stat stat-total"><b>${ps.length}</b><div>Total in class</div></div><div class="stat stat-green"><b>${counts.green}</b><div>Green ≥85%</div></div><div class="stat stat-amber"><b>${counts.amber}</b><div>Amber 75–84%</div></div><div class="stat stat-red"><b>${counts.red}</b><div>Red &lt;75%</div></div></div><div class="card"><div class="top"><div><b>Attendance Dashboard</b><div class="muted">Cumulative attendance across records you are authorised to see${counts.grey?' · '+counts.grey+' student'+(counts.grey===1?'':'s')+' with no attendance data yet':''}</div></div><div class="dashcontrols"><label>Sort<select onchange="renderDashboard(this.value)"><option value="risk" ${sort==='risk'?'selected':''}>Risk first</option><option value="name" ${sort==='name'?'selected':''}>Name A–Z</option><option value="high" ${sort==='high'?'selected':''}>Highest attendance</option></select></label></div></div></div><div class="dashgrid">${ps.map(x=>{let b=bandForRate(x.rate);return`<div class="stuCard ${b.cls}"><b>${esc(x.name)}</b><div class="small">${esc(x.id)}</div><div class="pct">${x.rate==null?'—':x.rate+'%'}</div><div class="small">${x.n?`${x.a}/${x.n} attended`:b.label}</div></div>`}).join('')}</div>`}
const PATH_COURSES=['Microbiology','Histopathology','Chemical Pathology','Haematology'];
function courseAttendanceStats(courses){let students=S.state.students||[],keys=Object.keys(S.attendance).filter(k=>courses.includes(S.attendance[k]?.__meta?.course));return students.map(st=>{let n=0,a=0;for(let k of keys){let rec=S.attendance[k],v=rec?.[st.id];if(!v)continue;let w=lectureWeight(rec);n+=w;if(v==='present'||v==='late')a+=w}return{...st,n,a,rate:n?Math.round(a/n*100):null}})}
function pathologyFinalRows(){let students=S.state.students||[];let byCourse=Object.fromEntries(PATH_COURSES.map(c=>[c,Object.fromEntries(courseAttendanceStats([c]).map(x=>[x.id,x]))]));let all=Object.fromEntries(courseAttendanceStats(PATH_COURSES).map(x=>[x.id,x]));return students.map(st=>({id:st.id,name:st.name,micro:byCourse['Microbiology'][st.id]?.rate??null,histo:byCourse['Histopathology'][st.id]?.rate??null,chem:byCourse['Chemical Pathology'][st.id]?.rate??null,haem:byCourse['Haematology'][st.id]?.rate??null,final:all[st.id]?.rate??null,a:all[st.id]?.a??0,n:all[st.id]?.n??0}))}
function pctBadge(rate){let b=bandForRate(rate);return`<span class="pctdot ${b.pct}">${rate==null?'—':rate+'%'}</span>`}
function renderPathologyAttendance(){let view=S.pathView||'Microbiology',labels=[['Microbiology','Micro','Microbiology cumulative attendance'],['Histopathology','Histo','Anatomic Pathology / Histopathology cumulative attendance'],['Chemical Pathology','Chem','Chemical Pathology cumulative attendance'],['Haematology','Haem','Haematology & Blood Transfusion cumulative attendance'],['Final','Combined Pathology','Pooled attendance across Microbiology, Histopathology, Chemical Pathology and Haematology'],['Pharmacology','Pharmacology & Therapeutics','Pharmacology & Therapeutics attendance; not included in Combined Pathology']];let tabs=`<div class="subtabs">${labels.map(([k,l,t])=>`<button title="${esc(t)}" class="btn light ${view===k?'active':''}" onclick="S.pathView='${k}';renderSummary()">${l}</button>`).join('')}</div>`;if(view==='Final'){let rows=pathologyFinalRows();return`<div class="card"><b>Department Attendance</b><div class="muted"><b>Combined Pathology</b> pools Microbiology + Histopathology + Chemical Pathology + Haematology. Pharmacology & Therapeutics is reported separately and is not included.</div>${tabs}<div class="report-table-wrap"><table class="table"><tr><th>Matric</th><th>Student</th><th>Micro</th><th>Histo</th><th>Chem</th><th>Haem</th><th>Combined Pathology</th><th>Attended / marked</th></tr>${rows.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${pctBadge(x.micro)}</td><td>${pctBadge(x.histo)}</td><td>${pctBadge(x.chem)}</td><td>${pctBadge(x.haem)}</td><td>${pctBadge(x.final)}</td><td>${x.a}/${x.n}</td></tr>`).join('')}</table></div></div>`}let rows=courseAttendanceStats([view]);let title=view==='Pharmacology'?'Pharmacology & Therapeutics Attendance':view+' Attendance';let note=view==='Pharmacology'?'Pharmacology & Therapeutics is reported separately and is not included in Combined Pathology.':'Department cumulative attendance. Combined Pathology uses Microbiology, Histopathology, Chemical Pathology and Haematology only.';return`<div class="card"><b>${title}</b><div class="muted">${note}</div>${tabs}<div class="report-table-wrap"><table class="table"><tr><th>Matric</th><th>Student</th><th>Attended</th><th>Marked sessions</th><th>Cumulative</th></tr>${rows.map(x=>`<tr><td>${esc(x.id)}</td><td>${esc(x.name)}</td><td>${x.a}</td><td>${x.n}</td><td>${pctBadge(x.rate)}</td></tr>`).join('')}</table></div></div>`}


function footerHtml(){return '<div class="app-footer">Designed by Nubwa Medugu</div>'}

function roleLabel(){
  return S.staff.role==='admin'?'Admin':S.staff.role==='hod'?'HOD':S.staff.role==='lab_scientist'?'Lab Scientist':'Lecturer'
}
function firstName(){
  let n=String(S.staff?.full_name||'').replace(/^(Assoc\. Prof\.|Prof\.|Dr\.|Mrs|Miss|Mr)\s*/i,'').trim();
  return n.split(/\s+/)[0]||'';
}
function navButton(tab,label,icon){
  return `<button class="nav-btn ${S.tab===tab?'active':''}" onclick="S.tab='${tab}';render()"><span class="nav-ico">${icon}</span><span>${label}</span></button>`
}
function renderLogin(msg=''){
  app.innerHTML=`<div class="login-shell">
    <div class="login-photo"><div class="login-photo-overlay"><div class="login-photo-title">FBCS Roll Call</div><div class="login-photo-sub">Simple attendance. Clear records.</div></div></div>
    <div class="login-panel">
      <div class="login-card">
        <div class="eyebrow">Nile University · College of Health Sciences</div>
        <h1>Staff sign in</h1>
        <div class="login-note">Select your name and enter your 6-digit access code.</div>
        <form onsubmit="login(event)">
          <label>Name</label>
          <select id="staff" onchange="staffChanged()" required><option value="">Select your name</option>${staffOptions()}</select>
          <label>Department</label>
          <div id="department" class="readonly-field">Select your name above</div>
          <label>6-digit access code</label>
          <input id="code" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required>
          <div id="err" class="login-error">${esc(msg)}</div>
          <button id="loginbtn" class="btn primary big-action">Sign in</button>
        </form>
        <div class="login-help">Keep your personal code private.</div>
      </div>
      ${footerHtml()}
    </div>
  </div>`
}

function renderHome(){
  let v=$('#view'),{avg,per}=calc(),th=S.state.settings?.threshold||75;
  let risk=per.filter(x=>x.rate!=null&&x.rate<th).length;
  v.innerHTML=`
    <section class="home-hero">
      <div class="hero-copy">
        <div class="eyebrow light">FBCS Roll Call</div>
        <h1>Welcome, ${esc(firstName())}</h1>
        <p>Choose what you want to do.</p>
      </div>
      <div class="hero-building-label">Volta Building</div>
    </section>

    <section class="home-actions">
      <button class="home-action" onclick="S.tab='roll';render()">
        <span class="home-icon">✓</span><span><b>Take Attendance</b><small>Manual or 5-minute QR</small></span><span class="home-arrow">›</span>
      </button>
      <button class="home-action" onclick="S.tab='summary';render()">
        <span class="home-icon">▦</span><span><b>View Reports</b><small>Attendance and Excel reports</small></span><span class="home-arrow">›</span>
      </button>
      <button class="home-action" onclick="S.tab='dashboard';render()">
        <span class="home-icon">↗</span><span><b>Student Dashboard</b><small>See attendance risk quickly</small></span><span class="home-arrow">›</span>
      </button>
      <button class="home-action" onclick="S.tab='help';render()">
        <span class="home-icon">?</span><span><b>Help</b><small>Simple instructions</small></span><span class="home-arrow">›</span>
      </button>
    </section>

    <section class="home-glance">
      <div class="mini-card"><b>${avg==null?'—':avg+'%'}</b><span>Average attendance</span></div>
      <div class="mini-card"><b>${Object.keys(S.attendance).length}</b><span>Registers</span></div>
      <div class="mini-card"><b>${risk}</b><span>Below ${th}%</span></div>
    </section>`
}

function render(){
  let role=roleLabel();
  app.innerHTML=`<div class="app-shell">
    <header class="app-header">
      <div class="brand-block" onclick="S.tab='home';render()">
        <div class="brand-title">FBCS Roll Call</div>
        <div class="brand-sub">Nile University · College of Health Sciences</div>
      </div>
      <div class="user-block">
        <div class="user-text"><b>${esc(S.staff.full_name)}</b><span>${esc(role)}${S.staff.course?' · '+esc(courseLabel(S.staff.course)):''}</span></div>
        <div class="status-wrap">${networkBadge()}</div>
        <button class="btn light small-btn" onclick="logout()">Sign out</button>
      </div>
    </header>

    <nav class="main-nav">
      ${navButton('home','Home','⌂')}
      ${navButton('roll','Take Attendance','✓')}
      ${navButton('summary','Reports','▦')}
      ${navButton('help','Help','?')}
      ${S.staff.role==='admin'?navButton('admin','Admin','⚙'):''}
    </nav>

    <main id="view"></main>
    ${footerHtml()}
  </div>`;
  if(S.tab==='home')renderHome();
  if(S.tab==='dashboard')renderDashboard();
  if(S.tab==='roll')renderRoll();
  if(S.tab==='summary')renderSummary();
  if(S.tab==='help')renderHelp();
  if(S.tab==='admin')renderAdmin();
}

function renderHelp(){
  let v=$('#view');if(!v)return;
  v.innerHTML=`
  <div class="page-heading"><div><h2>Help</h2><p>Short instructions for the main tasks.</p></div></div>

  <div class="help-grid">
    <div class="help-card"><span>1</span><div><b>Take attendance</b><p>Open <b>Take Attendance</b> and select the correct class.</p></div></div>
    <div class="help-card"><span>2</span><div><b>Choose Manual or QR</b><p>Manual goes through students one at a time. QR runs for 5 minutes.</p></div></div>
    <div class="help-card"><span>3</span><div><b>Using QR</b><p>Keep the browser open. Students scan, then enter matric number and surname.</p></div></div>
    <div class="help-card"><span>4</span><div><b>After 5 minutes</b><p>Only students who did not check in appear for manual roll call.</p></div></div>
    <div class="help-card"><span>5</span><div><b>Several lectures in one block</b><p>Use 1, 2 or 4 attendance checks, then tap <b>Finish block / set equivalence</b>.</p></div></div>
    <div class="help-card"><span>6</span><div><b>Correct a mistake</b><p>Use <b>Undo</b> immediately after an incorrect mark.</p></div></div>
    <div class="help-card"><span>7</span><div><b>Reports</b><p>Open <b>Reports</b> for cumulative attendance and Excel downloads.</p></div></div>
    <div class="help-card"><span>8</span><div><b>Historical paper registers</b><p>Authorised users can enter them from <b>Admin</b>.</p></div></div>
  </div>

  <div class="card important-card"><b>Important</b><p>Do not share your staff code. If the app shows Offline, wait for the connection to return before marking attendance.</p></div>`
}
