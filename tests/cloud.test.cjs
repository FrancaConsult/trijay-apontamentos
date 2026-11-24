const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function setup({hash='',email='valdemir.franca@trijay.tech'}={}){
 const calls=[];let listener;
 const auth={getUser:async()=>({data:{user:{id:'owner',email}},error:null}),resetPasswordForEmail:async(...args)=>{calls.push(['reset',...args]);return {error:null};},updateUser:async data=>{calls.push(['update',data]);return {error:null};},signOut:async()=>{calls.push(['signout']);return {error:null};},onAuthStateChange:fn=>{listener=fn;return {};}};
 const window={location:{hash},TRIJAY_CONFIG:{supabaseUrl:'https://example.supabase.co',publishableKey:'public-test',ownerEmail:'valdemir.franca@trijay.tech',redirectUrl:'https://francaconsult.github.io/trijay-apontamentos/'},supabase:{createClient:()=>({auth})}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../cloud.js'),'utf8'),{window,URLSearchParams,setTimeout:fn=>fn()});
 return {cloud:window.TrijayCloud,calls,emit:(...args)=>listener(...args)};
}
test('recuperação é enviada apenas ao e-mail autorizado com retorno ao aplicativo',async()=>{
 const f=setup();await f.cloud.requestPasswordReset();assert.equal(f.calls[0][1],'valdemir.franca@trijay.tech');assert.equal(f.calls[0][2].redirectTo,'https://francaconsult.github.io/trijay-apontamentos/');
});
test('nova senha exige sessão de recuperação e usuário autorizado',async()=>{
 const normal=setup();await assert.rejects(normal.cloud.updatePassword('test-passphrase-only'),/link de recuperação/);assert.equal(normal.calls.length,0);
 const other=setup({hash:'#type=recovery',email:'other@example.com'});await assert.rejects(other.cloud.updatePassword('test-passphrase-only'),/expirou/);assert.equal(other.calls.length,0);
});
test('senha curta é recusada antes de atualizar e sucesso encerra a recuperação',async()=>{
 const f=setup({hash:'#type=recovery'});await assert.rejects(f.cloud.updatePassword('short'),/12 a 128/);await f.cloud.updatePassword('test-passphrase-only');assert.equal(f.calls[0][0],'update');assert.equal(f.calls[1][0],'signout');assert.equal(f.cloud.recovering,false);
});
test('evento de recuperação sinaliza a tela de nova senha',()=>{
 const f=setup();let event;f.cloud.onSession((user,type)=>{event={user,type,recovering:f.cloud.recovering};});f.emit('PASSWORD_RECOVERY',{user:{id:'owner',email:'valdemir.franca@trijay.tech'}});assert.equal(event.type,'PASSWORD_RECOVERY');assert.equal(event.recovering,true);assert.equal(event.user.id,'owner');
});
