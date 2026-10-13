import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { createRemoteJWKSet,jwtVerify } from 'jose';
const ISSUER='https://auth.openai.com', RESOURCE='https://api.openai.com/v1';
const TOKEN=ISSUER+'/api/accounts/oauth/token';
const random=()=>randomBytes(32).toString('base64url');
export class Auth {
  constructor(storage,origin){this.storage=storage;this.origin=origin;this.pending=new Map();this.refreshing=null;this.jwks=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks.json'));}
  async init(){this.host=await this.storage.read('host',null);if(!this.host){this.host='urn:uuid:'+randomUUID();await this.storage.write('host',this.host);}this.data=await this.storage.credentials();}
  current(){return this.data.accounts.find(a=>a.id===this.data.active);}
  status(){return {active:this.data.active,accounts:this.data.accounts.map(a=>({id:a.id,email:a.email,label:a.email+' · '+a.client_id.slice(-6),connected:!!a.access_token,planEnabled:a.scopes?.includes('chatgpt.tokens.use.direct')}))};}
  async start(browserId,accountId){
    const account=accountId?this.data.accounts.find(a=>a.id===accountId):null;
    if(accountId&&!account)throw new Error('账户不存在');
    for(const [key,p] of this.pending)if(p.expires<Date.now()||p.browserId===browserId)this.pending.delete(key);
    const state=random(),verifier=random(),nonce=random(),redirect=this.origin+'/auth/callback';
    this.pending.set(state,{browserId,verifier,nonce,redirect,accountId,client:account?.client_id,subject:account?.subject,expires:Date.now()+600000});
    const query=new URLSearchParams({client_id:account?.client_id||'dynamic_agent_client',ext_agent_host_id:this.host,response_type:'code',redirect_uri:redirect,scope:'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct',resource:RESOURCE,state,nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')});
    if(account?.id_token)query.set('id_token_hint',account.id_token);
    if(account?.email)query.set('login_hint',account.email);
    if(!account)query.set('agent_name_hint','Gomoku Studio');
    return ISSUER+'/api/accounts/authorize?'+query;
  }
  async token(form){const res=await fetch(TOKEN,{method:'POST',body:new URLSearchParams({...form,resource:RESOURCE}),signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error('ChatGPT 授权已过期或交换失败，请重新连接账户');return res.json();}
  async callback(url,browserId){
    const state=url.searchParams.get('state'),p=this.pending.get(state);this.pending.delete(state);
    if(!p||p.browserId!==browserId||p.expires<Date.now())throw new Error('登录验证已失效，请重新连接');
    if(url.searchParams.has('error'))throw new Error('未完成 ChatGPT 授权，请在设置中重试');
    const client=url.searchParams.get('client_id')||p.client,code=url.searchParams.get('code');
    if(!client||client==='dynamic_agent_client'||(p.client&&p.client!==client)||!code)throw new Error('登录注册信息不完整或不匹配');
    const t=await this.token({grant_type:'authorization_code',client_id:client,code,code_verifier:p.verifier,redirect_uri:p.redirect});
    const {payload}=await jwtVerify(t.id_token,this.jwks,{issuer:ISSUER,audience:client,requiredClaims:['sub','exp','iat'],clockTolerance:5});
    if(payload.nonce!==p.nonce||typeof payload.sub!=='string'||!payload.sub||(p.subject&&payload.sub!==p.subject))throw new Error('账户身份验证失败');
    const scopes=(t.scope||'').split(' ');
    if(!scopes.includes('chatgpt.tokens.use.direct')||!t.access_token)throw new Error('尚未授权使用 ChatGPT 套餐，请重新连接并允许套餐使用');
    let a=this.data.accounts.find(a=>a.client_id===client&&a.subject===payload.sub);
    if(!a){a={id:randomUUID()};this.data.accounts.push(a);}
    Object.assign(a,{client_id:client,subject:payload.sub,email:payload.email||'ChatGPT 账户',scopes,access_token:t.access_token,refresh_token:t.refresh_token,id_token:t.id_token,expires:Date.now()+Number(t.expires_in||3600)*1000});
    this.data.active=a.id;await this.storage.credentials(this.data);
  }
  async select(id){if(!this.data.accounts.some(a=>a.id===id))throw new Error('账户不存在');this.data.active=id;await this.storage.credentials(this.data);}
  async access(trace){
    const a=this.current();if(!a?.access_token)throw new Error('请先在设置中连接 ChatGPT 账户');
    if(a.expires<Date.now()+60000){
      trace?.mark('token_refresh_start');
      if(!a.refresh_token)throw new Error('登录已过期，请重新连接');
      if(!this.refreshing)this.refreshing=(async()=>{const t=await this.token({grant_type:'refresh_token',client_id:a.client_id,refresh_token:a.refresh_token});if(!t.access_token)throw new Error('刷新登录失败');Object.assign(a,{access_token:t.access_token,refresh_token:t.refresh_token||a.refresh_token,id_token:t.id_token||a.id_token,scopes:t.scope?t.scope.split(' '):a.scopes,expires:Date.now()+Number(t.expires_in||3600)*1000});await this.storage.credentials(this.data);})().finally(()=>this.refreshing=null);
      await this.refreshing;
      trace?.mark('token_refresh_complete',{refreshed:true});
    }
    if(!a.scopes.includes('chatgpt.tokens.use.direct'))throw new Error('套餐权限不可用，请重新连接');return a.access_token;
  }
  async logout(){
    const a=this.current();let revoked=true;
    if(a?.refresh_token){try{const discovery=await fetch(ISSUER+'/.well-known/openid-configuration',{signal:AbortSignal.timeout(10000)}).then(r=>r.json());const endpoint=new URL(discovery.revocation_endpoint);if(endpoint.origin!==ISSUER)throw new Error();const res=await fetch(endpoint,{method:'POST',body:new URLSearchParams({token:a.refresh_token,token_type_hint:'refresh_token',client_id:a.client_id}),signal:AbortSignal.timeout(10000)});revoked=res.ok;}catch{revoked=false;}}
    if(a){delete a.access_token;delete a.refresh_token;delete a.id_token;await this.storage.credentials(this.data);}return {revoked};
  }
}
