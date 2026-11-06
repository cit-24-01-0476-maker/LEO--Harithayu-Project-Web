import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for(const f of ['public/app.js','public/sri-lanka-map.js','public/admin.js','api/index.mjs','server/index.mjs','server/service.mjs','server/store.mjs','server/turso-store.mjs']){const r=spawnSync(process.execPath,['--check',f],{stdio:'inherit'});if(r.status)process.exit(r.status);}
const html=await readFile('public/index.html','utf8');
for(const asset of [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(x=>x[1]))await access(`public${asset}`);
const photo=await readFile('public/assets/mangroves.jpg');if(photo.length<10000)throw Error('Hero image is missing or incomplete.');
console.log('JavaScript syntax and referenced local assets verified.');
