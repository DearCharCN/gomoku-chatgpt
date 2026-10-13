import { createHash } from 'node:crypto';
export function normalizeBaseUrl(value){
  let url;try{url=new URL(value);}catch{throw new Error('请输入有效的 API Base URL');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('API 地址必须是 HTTP(S) Base URL，不能包含用户名、密码、查询参数或片段');
  const path=url.pathname.replace(/\/+$/,'');
  if(/\/(chat\/completions|responses|models)$/.test(path))throw new Error('请填写 Base URL（如 https://api.openai.com/v1），不要填写具体接口路径');
  return url.origin+path;
}
export class APIConnection {
  constructor(storage){this.storage=storage;this.record=null;}
  async init(){const saved=await this.storage.credentials(undefined,'api-credentials');this.record=saved?.baseUrl?saved:null;}
  status(){return {configured:!!this.record?.token,baseUrl:this.record?.baseUrl||'',protocol:this.record?.protocol||'chat',id:this.record?.id||null};}
  async access(){if(!this.record?.token)throw new Error('请先在设置中连接 API');return this.record.token;}
  prepare(body){
    const baseUrl=normalizeBaseUrl(body.baseUrl),protocol=body.protocol||'chat';
    if(!['chat','responses'].includes(protocol))throw new Error('请选择有效的 API 协议');
    const same=this.record?.baseUrl===baseUrl&&this.record?.protocol===protocol;
    const token=body.token?.trim()||(same?this.record.token:'');
    if(!token||token.length>8192||/[\r\n]/.test(token))throw new Error('请输入有效 Token；更换 API 地址或协议时需要重新填写');
    const candidate=new APIConnection(this.storage);candidate.record={id:createHash('sha256').update(baseUrl+'|'+protocol).digest('hex'),baseUrl,protocol,token};return candidate;
  }
  async commit(candidate){await this.storage.credentials(candidate.record,'api-credentials');this.record=candidate.record;}
  async disconnect(){await this.storage.credentials({},'api-credentials');this.record=null;}
}
