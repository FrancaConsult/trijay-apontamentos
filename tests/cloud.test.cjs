const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function setup({hash='',sendError=null}={}){
 const calls=[];let listener;
 const auth={signInWithOtp:async args=>{calls.push(args);return {error:sendError};},onAuthStateChange:fn=>{listener=fn;return {};}};
 const window={location:{hash},TRIJAY_CONFIG:{supabaseUrl:'https://example.supabase.co',publishableKey:'public-test',ownerEmail:'valdemir.franca@trijay.tech',redirectUrl:'https://francaconsult.github.io/trijay-apontamentos/'},supabase:{createClient:()=>({auth})}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cloud.js'),'utf8'),{window,URLSearchParams,setTimeout:fn=>fn()});
 return {cloud:window.TrijayCloud,calls,emit:(...args)=>listener(...args)};
}
test('link enviado somente ao e-mail autorizado, sem senha ou criação de conta',async()=>{
 const f=setup();await f.cloud.signIn();assert.equal(f.calls[0].email,'valdemir.franca@trijay.tech');assert.equal(f.calls[0].options.emailRedirectTo,'https://francaconsult.github.io/trijay-apontamentos/');assert.equal(f.calls[0].options.shouldCreateUser,false);assert.equal(Object.hasOwn(f.calls[0],'password'),false);
});
test('falha de envio não apresenta sucesso nem revela detalhes internos',async()=>{
 const f=setup({sendError:{message:'PRIVATE SMTP DETAIL'}});await assert.rejects(f.cloud.signIn(),e=>e.message.includes('Não foi possível enviar')&&!e.message.includes('PRIVATE'));
});
test('sessão de outro e-mail é recusada',()=>{
 const f=setup();let user;f.cloud.onSession(u=>user=u);f.emit('SIGNED_IN',{user:{email:'other@example.com'}});assert.equal(user,null);f.emit('SIGNED_IN',{user:{id:'owner',email:'valdemir.franca@trijay.tech'}});assert.equal(user.id,'owner');
});
test('link expirado é reconhecido e não há cadastro ou troca de senha',()=>{
 const f=setup({hash:'#error=access_denied&error_code=otp_expired'});assert.equal(f.cloud.linkError,true);assert.equal(f.cloud.updatePassword,undefined);assert.equal(f.cloud.requestPasswordReset,undefined);
});
