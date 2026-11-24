'use strict';
window.TrijayCloud = (()=>{
  const cfg=window.TRIJAY_CONFIG;
  if(!window.supabase)throw Error('Não foi possível carregar a conexão com o Supabase. Recarregue a página.');
  let recovering=new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery';
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey);
  let user=null,revision=0,connected=false;
  const allowed=u=>u&&u.email?.toLowerCase()===cfg.ownerEmail;
  async function load(){
    const {data:{user:verified},error}=await client.auth.getUser();
    if(error||!allowed(verified))throw Error('Entre com o e-mail autorizado para acessar os apontamentos.');
    user=verified;
    const result=await client.from('timesheet_workspaces').select('document,revision').eq('owner_id',user.id).maybeSingle();
    if(result.error)throw Error('Não foi possível consultar os dados online. Tente novamente.');
    revision=result.data?.revision||0;connected=true;
    return result.data?.document||null;
  }
  async function save(document){
    if(!connected||!user)throw Error('Entre na sua conta antes de salvar.');
    const result=await client.rpc('save_timesheet',{p_document:document,p_revision:revision});
    if(result.error){if(result.error.message.includes('CONFLICT'))throw Error('Os dados foram atualizados em outra sessão ou pela automação. Clique em Atualizar dados antes de salvar novamente.');throw Error('Não foi possível salvar online. Seus campos continuam abertos para tentar novamente.');}
    revision=Number(result.data);return revision;
  }
  async function signIn(password){
    const {error}=await client.auth.signInWithPassword({email:cfg.ownerEmail,password});
    if(error)throw Error('Não foi possível entrar. Confira a senha do aplicativo e se o usuário foi criado no Supabase.');
  }
  async function requestPasswordReset(){
    const {error}=await client.auth.resetPasswordForEmail(cfg.ownerEmail,{redirectTo:cfg.redirectUrl});
    if(error)throw Error('Não foi possível enviar a recuperação. Confira a configuração de envio no Supabase e tente novamente.');
  }
  async function updatePassword(password){
    if(!recovering)throw Error('Abra o link de recuperação recebido por e-mail antes de definir a senha.');
    if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Use uma senha com 12 a 128 caracteres.');
    const {data:{user:verified},error:verifyError}=await client.auth.getUser();
    if(verifyError||!allowed(verified))throw Error('O link de recuperação expirou. Solicite um novo link.');
    const {error}=await client.auth.updateUser({password});
    if(error)throw Error('Não foi possível alterar a senha. Use uma senha diferente da anterior ou solicite um novo link.');
    await signOut();
  }
  async function signOut(){const {error}=await client.auth.signOut();if(error)throw error;connected=false;user=null;revision=0;recovering=false;}
  function onSession(callback){return client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')recovering=true;if(event==='SIGNED_OUT')recovering=false;if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT','PASSWORD_RECOVERY'].includes(event))setTimeout(()=>callback(allowed(session?.user)?session.user:null,event),0);});}
  return {load,save,signIn,signOut,requestPasswordReset,updatePassword,onSession,get recovering(){return recovering;},get revision(){return revision;}};
})();
