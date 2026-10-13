import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStorage} from '../lib/storage.mjs';
test('凭据存储往返且 Windows 文件中不存在明文令牌',async()=>{const dir=await mkdtemp(join(tmpdir(),'gomoku-storage-'));try{const store=await openStorage(dir),data={accounts:[{access_token:'unit-test-token-not-real'}],active:'test'};await store.credentials(data);assert.deepEqual(await store.credentials(),data);if(process.platform==='win32')assert.ok(!(await readFile(join(dir,'credentials.json'),'utf8')).includes('unit-test-token-not-real'));}finally{await rm(dir,{recursive:true,force:true});}});
