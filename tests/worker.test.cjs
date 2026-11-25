const test=require('node:test');
const assert=require('node:assert/strict');
const {run,request}=require('../automation/run.cjs');
const T=require('../core.js');
function fixture({existing=0,previous=false,timeout=false,dry=false,count=1,emptyCreateResponse=false}={}) {
 const entry={id:'e1',projectId:'project-2',date:'2026-11-16',start:'09:00',end:'10:00',nextDay:false,activity:'GLPI 1234',status:'ready',updatedAt:null};
 const entries=Array.from({length:count},(_,i)=>({...entry,id:'e'+(i+1)}));
 const document=T.validateBackup({schemaVersion:1,projects:T.seed(),entries});
 const row=id=>({appointment:id,project:42,appointDate:entry.date,appointmentTime:'01:00',notes:T.description(entry,T.seed()[1]),deleted:false});
 const rows=Array.from({length:existing},(_,i)=>row(i+1)),operations=[];
 const call=async(base,route,opts={})=>{
  operations.push({route,opts});
  if(route.includes('get_automation_workspace'))return [{owner_id:'owner',revision:1,document}];
  if(route.includes('/autentication/login'))return {result:{token:'TEST_TOKEN',idUser:7}};
  if(route.includes('get-projects-assigned'))return {result:[{project:42,alias:T.seed()[1].techpro}]};
  if(route.includes('user-appointment-config'))return {result:[{userAppointmentConfig:{dates:[{date:entry.date}],interval:['01:00']}}]};
  if(route.includes('/appointment/all'))return {result:[...rows]};
  if(route.includes('/appointment/create')){rows.push(row(rows.length+1));if(timeout)throw Error('timeout');return emptyCreateResponse?null:{result:null};}
  if(route.includes('timesheet_automation_receipts')&&['POST','PATCH'].includes(opts.method))return null;
  if(route.includes('timesheet_automation_receipts'))return previous?[{entry_id:'e1',fingerprint:require('../automation/logic.cjs').makePlan(document,{from:entry.date,to:entry.date})[0].fingerprint,state:'prepared'}]:[];
  if(route.includes('mark_timesheet_sent'))return true;
  throw Error('Consulta inesperada: '+route);
 };
 return {operations,options:{env:{SUPABASE_SECRET_KEY:'test',TECHPRO_USERNAME:'test',TECHPRO_PASSWORD:'test',DRY_RUN:dry?'true':'false'},now:new Date('2026-11-17T00:05:00Z'),call,log:()=>{}}};
}
test('confirma a leitura do registro persistido antes de marcar enviado',async()=>{
 const f=fixture();await run(f.options);
 const routes=f.operations.map(o=>o.route);const write=routes.indexOf('/appointment/create');
 assert(write>0);assert(routes.findIndex((r,i)=>i>write&&r.includes('/appointment/all'))<routes.findIndex(r=>r.includes('mark_timesheet_sent')));
});
test('resposta incerta não repete criação nem marca enviado',async()=>{
 const f=fixture({timeout:true});await assert.rejects(run(f.options),/timeout/);
 assert.equal(f.operations.filter(o=>o.route.includes('/appointment/create')).length,1);
 assert.equal(f.operations.filter(o=>o.route.includes('mark_timesheet_sent')).length,0);
});
test('tentativa anterior sem registro confirmado bloqueia nova escrita',async()=>{
 const f=fixture({previous:true});await assert.rejects(run(f.options),/tentativa anterior/);
 assert.equal(f.operations.filter(o=>o.route.includes('/appointment/create')).length,0);
});
test('registro encontrado após falha é conciliado sem duplicar',async()=>{
 const f=fixture({previous:true,existing:1});await run(f.options);
 assert.equal(f.operations.filter(o=>o.route.includes('/appointment/create')).length,0);
 assert.equal(f.operations.filter(o=>o.route.includes('mark_timesheet_sent')).length,1);
});
test('dois períodos iguais consomem um registro existente e criam só o segundo',async()=>{
 const f=fixture({existing:1,count:2});await run(f.options);
 assert.equal(f.operations.filter(o=>o.route.includes('/appointment/create')).length,1);
 assert.equal(f.operations.filter(o=>o.route.includes('mark_timesheet_sent')).length,2);
});
test('conferência não grava no Tech Pro nem no Supabase',async()=>{
 const f=fixture({dry:true});await run(f.options);
 assert.equal(f.operations.filter(o=>o.opts.method==='POST'&&!o.route.includes('get_automation_workspace')&&!o.route.includes('/autentication/login')).length,0);
});
test('resposta vazia 201 de recibo é sucesso, não erro de JSON',async()=>{
 const original=global.fetch;global.fetch=async()=>({ok:true,status:201,text:async()=>''});
 try {assert.equal(await request('https://example.test','/receipt',{method:'POST',data:{}}),null);}finally{global.fetch=original;}
});
test('resposta vazia do cadastro exige a mesma confirmação pelo registro persistido',async()=>{
 const f=fixture({emptyCreateResponse:true});await run(f.options);assert.equal(f.operations.filter(o=>o.route.includes('mark_timesheet_sent')).length,1);
});
test('retomada conferida é manual, preserva recibo e marca tentativa antes do envio',async()=>{
 const f=fixture({previous:true});f.options.env.MANUAL_FROM='2026-11-16';f.options.env.RESUME_PREPARED='true';await run(f.options);
 const index=f.operations.findIndex(o=>o.route.includes('/appointment/create'));
 assert(index>0);assert.equal(f.operations[index-1].opts.method,'PATCH');assert.equal(f.operations[index-1].opts.data.state,'uncertain');assert.equal(f.operations.some(o=>o.opts.method==='DELETE'),false);
 const invalid=fixture();invalid.options.env.RESUME_PREPARED='true';await assert.rejects(run(invalid.options),/única data manual/);
});
