'use strict';
const crypto = require('node:crypto');
const T = require('../core.js');
function decode(s) {
  let text=String(s??'');
  for(let i=0;i<5;i++) {const next=text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));if(next===text)break;text=next;}
  return text;
}
const normalize = s => decode(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
function previousWeek(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = k => date.find(p=>p.type===k).value;
  const end = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate()-((end.getUTCDay()+6)%7)-1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate()-6);
  return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
}
function projectFor(entry, projects) {
  const selected = projects.find(p=>p.id===entry.projectId);
  if(!selected) throw Error('Projeto não encontrado no aplicativo.');
  const client = normalize(selected.client).replace(/\s+AMS$/,'');
  const glpi = /\b(?:GLPI|GPLI)\b/i.test(entry.activity);
  if(client==='TAURUS HELMETS' && glpi && /\b7014\b/.test(entry.activity)) {
    const found=projects.filter(p=>normalize(p.client)==='TAURUS HELMETS' && /GODEEP/i.test(p.techpro));
    if(found.length!==1) throw Error('Projeto GoDeep não definido.'); return found[0];
  }
  if(glpi) {
    const found=projects.filter(p=>normalize(p.client).replace(/\s+AMS$/,'')===client && p.type==='ams');
    if(found.length!==1) throw Error('Projeto AMS não definido para um chamado GLPI.'); return found[0];
  }
  if(client==='CBC' && /\bINTERNO\b/.test(normalize(entry.activity)) && /ZHYP/.test(normalize(entry.activity))) {
    const found=projects.filter(p=>p.type==='internal');
    if(found.length!==1) throw Error('Projeto Interno não definido.'); return found[0];
  }
  return selected;
}
function makePlan(document, period) {
  const db=T.validateBackup(document);
  return db.entries.filter(e=>e.date>=period.from && e.date<=period.to && ['ready','sent'].includes(e.status)).map(e=>{
    const original=db.projects.find(p=>p.id===e.projectId), project=projectFor(e,db.projects);
    if(!project.techpro.trim()) throw Error('Preencha o projeto Tech Pro antes da execução.');
    const notes=T.description(e,original), minutes=T.duration(e.start,e.end,e.nextDay);
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify([e.date,project.techpro,minutes,notes])).digest('hex');
    return {entry:e,project,notes,minutes,fingerprint};
  }).sort((a,b)=>a.entry.date.localeCompare(b.entry.date)||a.entry.start.localeCompare(b.entry.start)||a.entry.id.localeCompare(b.entry.id));
}
function matching(row,item,projectId) {
  const time=String(row.appointmentTime??'').split(':');
  const minutes=(time.length===2 || (time.length===3&&Number(time[2])===0)) ? Number(time[0])*60+Number(time[1]) : NaN;
  return !row.deleted && String(row.project)===String(projectId) && String(row.appointDate).slice(0,10)===item.entry.date && minutes===item.minutes && decode(row.notes).replace(/\s+/g,' ').trim()===item.notes.replace(/\s+/g,' ').trim();
}
module.exports={previousWeek,projectFor,makePlan,matching,normalize};
