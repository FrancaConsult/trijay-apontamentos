const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../core.js');
const L=require('../automation/logic.cjs');
test('semana anterior usa São Paulo inclusive perto da meia-noite UTC',()=>{
  const monday=L.previousWeek(new Date('2026-11-23T11:00:00Z'));
  assert.equal(monday.from,'2026-11-16');assert.equal(monday.to,'2026-11-22');
  const sunday=L.previousWeek(new Date('2026-11-23T01:00:00Z'));
  assert.equal(sunday.from,'2026-11-09');assert.equal(sunday.to,'2026-11-15');
});
const entry=(extra={})=>({id:'a',projectId:'project-4',date:'2026-11-16',start:'09:00',end:'10:00',nextDay:false,activity:'Chamado GLPI 6950',status:'ready',updatedAt:null,...extra});
test('GLPI resolve AMS sem alterar a descrição da coluna H',()=>{
  const [item]=L.makePlan({schemaVersion:1,projects:T.seed(),entries:[entry()]},{from:'2026-11-16',to:'2026-11-22'});
  assert.equal(item.project.id,'project-3'); assert.equal(item.notes,'16/11/2026 - [CBC] Chamado GLPI 6950 - 1h');
});
test('exceções GoDeep e CBC interno são respeitadas',()=>{
  assert.equal(L.projectFor(entry({projectId:'project-9',activity:'GLPI 7014'}),T.seed()).id,'project-9');
  assert.equal(L.projectFor(entry({activity:'Interno Teste ZHYP'}),T.seed()).id,'project-1');
});
test('rascunhos e dados antigos ficam fora; duplicados de períodos diferentes permanecem',()=>{
  const plan=L.makePlan({schemaVersion:1,projects:T.seed(),entries:[entry(),entry({id:'b',start:'13:00',end:'14:00'}),entry({id:'old',date:'2026-11-09'}),entry({id:'draft',status:'draft'})]},{from:'2026-11-16',to:'2026-11-22'});
  assert.equal(plan.length,2);assert.equal(plan[0].fingerprint,plan[1].fingerprint);
});
test('conciliação exige data, projeto, duração e descrição e ignora excluídos',()=>{
  const [item]=L.makePlan({schemaVersion:1,projects:T.seed(),entries:[entry()]},{from:'2026-11-16',to:'2026-11-22'});
  const row={project:42,appointDate:'2026-11-16T00:00:00',appointmentTime:'01:00',notes:item.notes,deleted:false};
  assert.equal(L.matching(row,item,42),true);assert.equal(L.matching({...row,project:43},item,42),false);assert.equal(L.matching({...row,appointmentTime:'00:30'},item,42),false);assert.equal(L.matching({...row,deleted:true},item,42),false);
});
