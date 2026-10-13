import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,exportJWK,createLocalJWKSet} from 'jose';
import {Auth} from '../lib/auth.mjs';
async function setup(){const writes=[];const storage={read:async()=>null,write:async()=>{},credentials:async data=>data?writes.push(data):{accounts:[],active:null}};const auth=new Auth(storage,'http://127.0.0.1:3210');await auth.init();return auth;}
test('PKCE、动态注册和稳定 host ID；无效 state 不触发 token 交换',async()=>{const a=await setup();const u=new URL(await a.start('browser'));assert.equal(u.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),'http://127.0.0.1:3210/auth/callback');assert.match(u.searchParams.get('ext_agent_host_id'),/^urn:uuid:/);let called=false;a.token=async()=>{called=true;};await assert.rejects(a.callback(new URL('http://127.0.0.1:3210/auth/callback?state=wrong'),'browser'));assert.equal(called,false);});
test('登录校验签名、nonce、audience、scope，拒绝重放',async()=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';
  for(const kind of ['valid','nonce','audience','scope']){
    const a=await setup();a.jwks=createLocalJWKSet({keys:[jwk]});const u=new URL(await a.start('browser')),state=u.searchParams.get('state'),nonce=u.searchParams.get('nonce');
    const token=await new SignJWT({nonce:kind==='nonce'?'wrong':nonce,email:'test@example.invalid'}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://auth.openai.com').setAudience(kind==='audience'?'wrong':'oaiapp_test').setSubject('subject').setIssuedAt().setExpirationTime('1h').sign(privateKey);
    a.token=async()=>({id_token:token,access_token:'test',scope:kind==='scope'?'openid':'openid chatgpt.tokens.use.direct',expires_in:3600});
    const callback=new URL(`http://127.0.0.1:3210/auth/callback?state=${state}&code=code&client_id=oaiapp_test`);
    if(kind==='valid'){await a.callback(callback,'browser');assert.equal(a.current().subject,'subject');await assert.rejects(a.callback(callback,'browser'));}else await assert.rejects(a.callback(callback,'browser'));
  }
});
test('不同浏览器或已过期的回调被拒绝',async()=>{for(const expired of [false,true]){const a=await setup();const u=new URL(await a.start('a'));const state=u.searchParams.get('state');if(expired)a.pending.get(state).expires=0;await assert.rejects(a.callback(new URL(`http://127.0.0.1:3210/auth/callback?state=${state}`),expired?'a':'b'));}});
