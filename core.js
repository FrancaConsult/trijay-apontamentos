(function(root){
  'use strict';
  const id=()=>globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const validDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;};
  const timeMinutes=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
  function duration(start,end,nextDay){const a=timeMinutes(start),b=timeMinutes(end);const m=b-a+(nextDay?1440:0);return Number.isFinite(m)&&m>0&&m<=1440?m:0;}
  const hours=m=>`${Math.floor(m/60)}h${m%60?String(m%60).padStart(2,'0'):''}`;
  const dateBR=d=>validDate(d)?d.split('-').reverse().join('/'):'';
  const description=(e,p)=>`${dateBR(e.date)} - [${p.client}] ${e.activity.trim()} - ${hours(duration(e.start,e.end,e.nextDay))}`;
  const sum=entries=>entries.reduce((n,e)=>n+duration(e.start,e.end,e.nextDay),0);
  function seed(){return [
    ['INTERNO','Treinamento / Estudos','HIB-IDL-000012-TRIJAY-Treinamento / Estudos','internal'],
    ['TECFIL','AMS 2026','HIB-HDK-000451-TECFIL-TECFIL - AMS 2026','ams'],
    ['CBC','AMS 2026 - GLPI','HIB-TMA-000002-CBC-RP-CBC RIBEIRÃO - AMS 2026 - GLPI','ams'],
    ['CBC','Melhorias CRM Light Fiori','HIB-PJF-000466-CBC-RP-Melhorias do CRM Light Fiori CBC – 2026 – Pacote 1','project'],
    ['CBC','Armeria CBC','HIB-PJF-000472-CBC-RP-Melhorias Armeria CBC','project'],
    ['MERCÚRIO','S&OP Integrado, Fase 1','SAP-PJF-000460-MERCÚRIO-S&OP Integrado, Fase 1','project'],
    ['MERCÚRIO','AMS 2026 - GLPI','HIB-TMA-000060-MERCÚRIO-MERCÚRIO AMS 2026 - GLPI','ams'],
    ['TAURUS','AMS 2026 - GLPI','HIB-HDK-000009-TAURUS ARMAS-Taurus AMS 2026 - GLPI','ams'],
    ['TAURUS HELMETS','Integração GoDeep Hub','HIB-PJF-000525-TAURUS HELMETS-Integração GoDeep Hub','project']
  ].map(([client,name,techpro,type],i)=>({id:'project-'+(i+1),client,name,techpro,type,active:true}));}
  function validateEntry(e,projects){const p=projects.find(p=>p.id===e.projectId);if(!p)throw Error('Selecione um projeto válido.');if(!validDate(e.date))throw Error('Informe uma data válida.');if(!duration(e.start,e.end,e.nextDay))throw Error('O fim deve ser posterior ao início. Para atravessar a meia-noite, marque “Termina no dia seguinte”.');if(typeof e.activity!=='string'||!e.activity.trim()||e.activity.length>300)throw Error('Informe uma atividade com até 300 caracteres.');if(!['draft','ready','sent'].includes(e.status))throw Error('Status inválido.');if(typeof e.nextDay!=='boolean')throw Error('Indicador de dia seguinte inválido.');if(description(e,p).length>400)throw Error('A descrição para o Tech Pro ultrapassa 400 caracteres.');return true;}
  function validateBackup(data){if(data?.schemaVersion!==1||!Array.isArray(data.projects)||!Array.isArray(data.entries))throw Error('Arquivo de backup inválido.');if(data.projects.length>10000||data.entries.length>100000)throw Error('Backup excede o tamanho suportado.');const ids=new Set();const projects=data.projects.map(p=>{if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id))throw Error('Identificador de projeto inválido ou repetido.');ids.add(p.id);if(typeof p.client!=='string'||!p.client.trim()||p.client.length>80||typeof p.name!=='string'||!p.name.trim()||p.name.length>160||typeof p.techpro!=='string'||p.techpro.length>220||typeof p.active!=='boolean'||!['project','ams','internal'].includes(p.type))throw Error('Projeto inválido no backup.');return {id:p.id,client:p.client,name:p.name,techpro:p.techpro,type:p.type,active:p.active};});ids.clear();const entries=data.entries.map(e=>{if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id))throw Error('Identificador de apontamento inválido ou repetido.');ids.add(e.id);validateEntry(e,projects);return {id:e.id,projectId:e.projectId,date:e.date,start:e.start,end:e.end,nextDay:e.nextDay,activity:e.activity,status:e.status,updatedAt:typeof e.updatedAt==='string'?e.updatedAt:null};});return {schemaVersion:1,projects,entries};}
  function csvCell(v){let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
  function csv(entries,projects){const header=['Data','Cliente','Projeto / Atividade','Hora Início','Hora Fim','Horas','Total Dia','Linha para Sistema','Projeto Tech Pro','Status','ID'];const totals={};for(const e of entries)totals[e.date]=(totals[e.date]||0)+duration(e.start,e.end,e.nextDay);return '\uFEFF'+[header,...entries.map(e=>{const p=projects.find(p=>p.id===e.projectId);return [dateBR(e.date),p.client,e.activity,e.start,e.end,hours(duration(e.start,e.end,e.nextDay)),(totals[e.date]/60).toLocaleString('pt-BR'),description(e,p),p.techpro,e.status,e.id];})].map(row=>row.map(csvCell).join(';')).join('\r\n');}
  const api={id,validDate,duration,hours,dateBR,description,sum,seed,validateEntry,validateBackup,csv};if(typeof module!=='undefined')module.exports=api;root.Timesheet=api;
})(typeof window!=='undefined'?window:globalThis);
