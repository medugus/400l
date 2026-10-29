const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fixture=process.argv[2];
const state=fixture?Object.fromEntries(JSON.parse(fs.readFileSync(fixture)).state.map(x=>[x.key,x.value])):{students:[{id:'1',name:'Existing'},{id:'2',name:'New'}]};
const attendance=fixture?Object.fromEntries(JSON.parse(fs.readFileSync(fixture)).sessions.map(x=>[x.session_key,x.data])):{old:{'1':'present',__meta:{course:'Microbiology',lectureWeight:2}},partial:{'1':'absent',__meta:{course:'Microbiology'}},empty:{__meta:{course:'Microbiology'}},TEST__fake:{'1':'absent',__meta:{course:'Microbiology'}}};
const before=JSON.stringify({state,attendance});
const ctx=vm.createContext({S:{state,attendance}});
for(const f of ['core2.js','core3.js','core4.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const front=vm.runInContext('calc().per',ctx);
const src=fs.readFileSync(path.join(root,'supabase/functions/export-attendance-xlsx/index.ts'),'utf8');
const start=src.indexOf('  const completeKeys=');const end=src.indexOf('  const withRates=',start);
assert(start>0&&end>start);
const server=vm.runInNewContext(stripTypeScriptTypes(src.slice(start,end))+';perStudent',{students:state.students,attendance:Object.fromEntries(Object.entries(attendance).filter(([k])=>!k.startsWith('TEST__'))),sessionKeys:Object.keys(attendance).filter(k=>!k.startsWith('TEST__')),lectureWeight:r=>{const w=Number(r?.__meta?.lectureWeight??1);return Number.isFinite(w)&&w>0?w:1;}});
assert.equal(JSON.stringify(front.map(x=>[x.id,x.a,x.n,x.rate,x.rates])),JSON.stringify(server.map(x=>[x.id,x.a,x.n,x.rate,x.rates])));
assert.equal(before,JSON.stringify({state,attendance}));
if(!fixture){assert.equal(front[0].a,2);assert.equal(front[0].n,3);assert.equal(front[0].rate,67);assert.equal(front[1].rate,null);assert.equal(front[1].n,0);}
else{assert.equal(front.filter(x=>x.n>0).length,166);assert.equal(front.filter(x=>x.n===0).length,11);assert(front.some(x=>x.a>0));}
console.log('PASS: browser/server parity, weighted saved marks, roster growth, blanks/test exclusion, source unchanged ('+front.length+' students).');
