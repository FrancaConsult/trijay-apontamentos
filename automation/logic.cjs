'use strict';
const crypto = require('node:crypto');
const T = require('../core.js');
function decode(s) {
  let text=String(s??'');
  for(let i=0;i<5;i++) {const next=text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));if(next===text)break;text=next;}
  return text;
}
const normalize = s => decode(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
function dailyPeriod(now = new Date(),scheduled=false) {
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const part = k => date.find(p=>p.type===k).value;
  const day = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
  // A queued nightly run before the next 21:05 still belongs to the prior day.
  if(scheduled&&Number(part('hour'))*60+Number(part('minute'))<21*60+5)day.setUTCDate(day.getUTCDate()-1);
  const iso=day.toISOString().slice(0,10);
  return {from:iso,to:iso};
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
  const minutes=techproMinutes(row.appointmentTime);
  return !row.deleted && String(row.project)===String(projectId) && String(row.appointDate).slice(0,10)===item.entry.date && minutes===item.minutes && decode(row.notes).replace(/\s+/g,' ').trim()===item.notes.replace(/\s+/g,' ').trim();
}
function techproMinutes(value) {
  const match=/^(\d{1,2})[h:]([0-5]\d)(?::00)?$/i.exec(String(value??''));
  return match?Number(match[1])*60+Number(match[2]):NaN;
}
function resolvePeriod(env,now=new Date()) {
  const from=String(env.MANUAL_FROM||'').trim(), to=String(env.MANUAL_TO||'').trim();
  if(!from&&!to)return dailyPeriod(now,env.TRIGGER_KIND==='schedule');
  const end=to||from;
  if(!T.validDate(from)||!T.validDate(end)||end<from)throw Error('Informe um período válido no formato AAAA-MM-DD.');
  if((Date.parse(end+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000>30)throw Error('O período manual deve ter no máximo 31 dias.');
  return {from,to:end};
}
function allowedDuration(configs,date,minutes) {
  for(const config of configs) {
    const rule=config.userAppointmentConfig;
    if(!Array.isArray(rule?.dates)||!rule.dates.some(d=>String(d.date).slice(0,10)===date)||!Array.isArray(rule.interval))continue;
    const option=rule.interval.find(value=>{
      return techproMinutes(value)===minutes;
    });
    if(option!==undefined)return option;
  }
  return null;
}
module.exports={dailyPeriod,resolvePeriod,allowedDuration,projectFor,makePlan,matching,normalize};
