'use strict';
window.TrijayCloud = (()=>{
  const cfg=window.TRIJAY_CONFIG;
  if(!window.supabase)throw Error('Não foi possível carregar a conexão com o Supabase. Recarregue a página.');
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
  async function signOut(){const {error}=await client.auth.signOut();if(error)throw error;connected=false;user=null;revision=0;}
  function onSession(callback){return client.auth.onAuthStateChange((event,session)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))setTimeout(()=>callback(allowed(session?.user)?session.user:null),0);});}
  return {load,save,signIn,signOut,onSession,get revision(){return revision;}};
})();
