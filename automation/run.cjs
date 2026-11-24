'use strict';
// No browser, password, token, activity text or response body is written to logs.
const {previousWeek,makePlan,matching,normalize}=require('./logic.cjs');
const {isDeepStrictEqual}=require('node:util');
const SB='https://ibakqnucwpdmzbwuaczz.supabase.co';
const TP='https://trijayconsultoria.com.br/api';
const OWNER='valdemir.franca@trijay.tech';
async function request(base,route,{method='GET',data,headers={}}={}) {
  let response;
  try {response=await fetch(base+route,{method,headers:{Accept:'application/json','Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(45000),redirect:'error'});}
  catch {throw Error('Falha de conexão; confira a execução antes de tentar novamente.');}
  if(!response.ok) {
    const service=base===SB?'Supabase':'Tech Pro';
    let reason='';
    try {const problem=await response.json();if(problem.code==='42501')reason=' Permissão insuficiente para a chave configurada.';else if(/invalid api key/i.test(String(problem.message)))reason=' Chave de API inválida.';} catch {}
    throw Error(`${service} recusou a operação (HTTP ${response.status}).${reason}`);
  }
  let result; try {result=await response.json();} catch {throw Error('Resposta inesperada do serviço.');}
  return result;
}
async function run({env=process.env,now=new Date(),call=request,log=console.log}={}) {
  const secret=env.SUPABASE_SECRET_KEY?.trim();
  if(!secret||!env.TECHPRO_USERNAME||!env.TECHPRO_PASSWORD) throw Error('Cadastre os três segredos exigidos no repositório.');
  const dry=env.DRY_RUN!=='false';
  if(secret.startsWith('sb_publishable_')) throw Error('SUPABASE_SECRET_KEY contém uma chave publicável. Use a chave Secret keys do projeto.');
  // New opaque keys go only in apikey; legacy service-role JWTs also need Bearer.
  const serviceHeaders={apikey:secret,...(secret.startsWith('eyJ')?{Authorization:`Bearer ${secret}`}:{})};
  const sb=(route,opts={})=>call(SB,'/rest/v1/'+route,{...opts,headers:{...serviceHeaders,...opts.headers}});
  const rpc=(name,data)=>sb('rpc/'+name,{method:'POST',data});
  const workspaces=await rpc('get_automation_workspace',{p_email:OWNER});
  if(!Array.isArray(workspaces)||workspaces.length!==1) throw Error('Entre no aplicativo e importe os dados para o banco antes da automação.');
  const workspace=workspaces[0], period=previousWeek(now), plan=makePlan(workspace.document,period);
  const pending=plan.filter(i=>i.entry.status==='ready');
  log(`Período: ${period.from} a ${period.to}. Prontos: ${pending.length}. Modo: ${dry?'conferência':'cadastro'}.`);
  if(!pending.length&&!dry) return;
  const login=await call(TP,'/autentication/login',{method:'POST',data:{user:env.TECHPRO_USERNAME,password:env.TECHPRO_PASSWORD,log:'',platform:'WEB',language:'PTBR'}});
  const auth=login.result;
  if(!auth?.token||!Number.isInteger(auth.idUser)) throw Error('Não foi possível autenticar no Tech Pro.');
  // Mask the server-issued token in GitHub Actions before further work.
  log('::add-mask::'+auth.token);
  const tp=(route,opts={})=>call(TP,route,{...opts,headers:{Authorization:`Bearer ${auth.token}`}}).then(r=>{
    if(r.erroInterno && r.erroInterno!==0) throw Error('Tech Pro recusou a operação. Verifique permissões, datas e limites.');
    if(!Object.hasOwn(r,'result')) throw Error('Resposta do Tech Pro incompatível.'); return r.result;
  });
  const projects=await tp(`/project/get-projects-assigned-to-user?user=${auth.idUser}&is_appoint=true`);
  const configs=await tp(`/user-appointment-config/all?user=${auth.idUser}`);
  if(!Array.isArray(projects)||!Array.isArray(configs)) throw Error('Configuração do Tech Pro incompatível.');
  const list=async()=>{const rows=await tp(`/appointment/all?user=${auth.idUser}&isDeleted=false`);if(!Array.isArray(rows))throw Error('Lista de apontamentos inválida.');return rows;};
  let rows=await list(); const used=new Set();
  const receipts=await sb(`timesheet_automation_receipts?owner_id=eq.${workspace.owner_id}&select=entry_id,fingerprint,state`);
  const receiptMap=new Map(receipts.map(r=>[r.entry_id,r]));
  // Reserve matches for sent entries first, preserving the multiplicity of identical periods.
  const items=[...plan.filter(i=>i.entry.status==='sent'),...pending];
  let reconciled=0,created=0;
  for(const item of items) {
    const candidates=projects.filter(p=>normalize(p.alias)===normalize(item.project.techpro));
    if(candidates.length!==1) throw Error('Projeto do aplicativo não corresponde a um único projeto disponível no Tech Pro.');
    const projectId=candidates[0].project;
    const matches=rows.filter(r=>!used.has(String(r.appointment))&&matching(r,item,projectId));
    let match=matches[0];
    if(item.entry.status==='sent') {if(match)used.add(String(match.appointment));continue;}
    const previous=receiptMap.get(item.entry.id);
    if(previous && previous.fingerprint!==item.fingerprint) throw Error('Um apontamento já processado foi alterado. Revise manualmente.');
    if(!match && previous) throw Error('Há uma tentativa anterior sem confirmação. Confira o Tech Pro antes de liberar uma nova tentativa.');
    if(!match) {
      const duration=`${String(Math.floor(item.minutes/60)).padStart(2,'0')}:${String(item.minutes%60).padStart(2,'0')}`;
      const allowed=configs.some(c=>c.userAppointmentConfig?.dates?.some(d=>String(d.date).slice(0,10)===item.entry.date) && c.userAppointmentConfig?.interval?.includes(duration));
      if(!allowed) throw Error('Data ou duração não está liberada pelo Tech Pro. Nenhum limite será contornado.');
      if(dry) continue;
      const fresh=await rpc('get_automation_workspace',{p_email:OWNER});
      const current=fresh[0]?.document?.entries?.find(e=>e.id===item.entry.id);
      if(!isDeepStrictEqual(current,item.entry)||!isDeepStrictEqual(fresh[0]?.document?.projects,workspace.document.projects)) throw Error('Os dados mudaram durante a execução. Confira e execute novamente.');
      await sb('timesheet_automation_receipts',{method:'POST',data:{owner_id:workspace.owner_id,entry_id:item.entry.id,fingerprint:item.fingerprint,state:'prepared'}});
      const before=new Set(rows.map(r=>String(r.appointment)));
      // Exactly one write. A failed or ambiguous response never triggers an automatic retry.
      await tp('/appointment/create',{method:'POST',data:{user:auth.idUser,project:projectId,appointDate:item.entry.date,appointmentTime:duration,notes:item.notes}});
      rows=await list();
      const added=rows.filter(r=>!before.has(String(r.appointment))&&matching(r,item,projectId));
      if(added.length!==1) throw Error('Gravação sem confirmação única. Confira o Tech Pro; o aplicativo permanece pendente.');
      match=added[0]; created++;
    } else reconciled++;
    used.add(String(match.appointment));
    if(!dry) {
      await sb('timesheet_automation_receipts?on_conflict=owner_id,entry_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},data:{owner_id:workspace.owner_id,entry_id:item.entry.id,fingerprint:item.fingerprint,state:'confirmed'}});
      const marked=await rpc('mark_timesheet_sent',{p_owner:workspace.owner_id,p_entry_id:item.entry.id,p_expected:item.entry,p_projects:workspace.document.projects});
      if(marked!==true) throw Error('O registro foi localizado no Tech Pro, mas mudou no aplicativo. Revise o status.');
    }
  }
  log(dry?`Conferência concluída. Já encontrados: ${reconciled}. Nenhuma gravação realizada.`:`Concluído. Criados: ${created}. Conciliados: ${reconciled}.`);
}
module.exports={run};
if(require.main===module) run().catch(e=>{console.error('Falha: '+e.message);process.exitCode=1;});
