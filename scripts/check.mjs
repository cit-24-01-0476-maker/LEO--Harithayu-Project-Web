import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for(const f of ['public/sri-lanka-provinces.js','public/app.js','public/soundscape.js','public/lagoon-audio.js','public/mangrove-intro.js','public/mangrove-video.js','public/sri-lanka-map.js','public/admin.js','api/index.mjs','server/index.mjs','server/service.mjs','server/store.mjs','server/turso-store.mjs']){const r=spawnSync(process.execPath,['--check',f],{stdio:'inherit'});if(r.status)process.exit(r.status);}
const html=await readFile('public/index.html','utf8');
for(const asset of [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(x=>x[1]))await access(`public${asset}`);
const photo=await readFile('public/assets/mangroves.jpg');if(photo.length<10000)throw Error('Hero image is missing or incomplete.');
const intro=await readFile('public/assets/mangrove-intro.webp');if(intro.subarray(8,12).toString()!=='WEBP')throw Error('Mangrove intro image must be a valid WebP.');
console.log('JavaScript syntax and referenced local assets verified.');
