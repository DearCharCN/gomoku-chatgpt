import { mkdir,readFile,writeFile,rename } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
export async function readJSON(path,fallback) {try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT') return fallback;throw e;}}
export async function atomic(path,data) { const temp=path+'.tmp';await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await rename(temp,path); }
function dpapi(value,decrypt=false) {
  const action=decrypt?'Unprotect':'Protect';
  const code=`Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); $bytes=[Convert]::FromBase64String($v); $out=[Security.Cryptography.ProtectedData]::${action}($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($out))`;
  return new Promise((resolve,reject)=>{const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='';p.stdout.on('data',d=>out+=d);p.stderr.resume();p.on('error',()=>reject(new Error('本地凭据保护不可用')));p.on('exit',c=>c?reject(new Error('本地凭据保护失败')):resolve(out.trim()));p.stdin.end(value);});
}
export async function openStorage(root) {
  await mkdir(root,{recursive:true,mode:0o700});
  return {
    read:(name,fallback)=>readJSON(join(root,name+'.json'),fallback),
    write:(name,data)=>atomic(join(root,name+'.json'),data),
    async credentials(data,name='credentials') {
      if(!['credentials','api-credentials'].includes(name))throw new Error('凭据存储名称无效');
      const path=join(root,name+'.json');
      if(data!==undefined) {const raw=Buffer.from(JSON.stringify(data)).toString('base64');await atomic(path,process.platform==='win32'?{dpapi:await dpapi(raw)}:{plain:data});return;}
      const saved=await readJSON(path,null);if(!saved)return {accounts:[],active:null};
      return saved.dpapi?JSON.parse(Buffer.from(await dpapi(saved.dpapi,true),'base64').toString()):saved.plain;
    }
  };
}
