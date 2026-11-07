// Provincial source: geoBoundaries LKA ADM1 (2017), ODbL 1.0.
// https://www.geoboundaries.org/api/current/gbOpen/LKA/ADM1/
import {readFile,writeFile} from 'node:fs/promises';
const country=JSON.parse(await readFile('public/assets/sri-lanka.geojson','utf8'));
const polygons=country.geometry.type==='MultiPolygon'?country.geometry.coordinates:[country.geometry.coordinates];
const coords=polygons.flat(2), latMax=Math.max(...coords.map(p=>p[1])),latMin=Math.min(...coords.map(p=>p[1])),center=(Math.min(...coords.map(p=>p[0]))+Math.max(...coords.map(p=>p[0])))/2;
const k=430/(latMax-latMin),cos=Math.cos((latMin+latMax)/2*Math.PI/180);
const project=([lon,lat])=>[+(246+(lon-center)*cos*k).toFixed(2),+(42+(latMax-lat)*k).toFixed(2)];
const geo=JSON.parse(await readFile('public/assets/sri-lanka-provinces.geojson','utf8'));
if(geo.features.length!==9)throw Error('Expected nine provinces');
const namesSi={'Northern Province':'උතුරු පළාත','Eastern Province':'නැගෙනහිර පළාත','Central Province':'මධ්‍යම පළාත','North Central Province':'උතුරු මැද පළාත','North Western Province':'වයඹ පළාත','Sabaragamuwa Province':'සබරගමුව පළාත','Southern Province':'දකුණු පළාත','Uva Province':'ඌව පළාත','Western Province':'බස්නාහිර පළාත'};
const centers={'Northern Province':[80.25,9.05],'Eastern Province':[81.4,7.7],'Central Province':[80.75,7.3],'North Central Province':[80.6,8.3],'North Western Province':[80.05,7.7],'Sabaragamuwa Province':[80.4,6.65],'Southern Province':[80.6,6.12],'Uva Province':[81.12,6.82],'Western Province':[80.05,6.95]};
const provinces=geo.features.map(f=>{const ps=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];return{name:f.properties.shapeName,si:namesSi[f.properties.shapeName],center:project(centers[f.properties.shapeName]),path:ps.flat().map(r=>'M'+r.map(project).map(p=>p.join(',')).join('L')+'Z').join('')}});
await writeFile('public/sri-lanka-provinces.js','// Source: geoBoundaries LKA ADM1, ODbL 1.0. See scripts/update-provinces.mjs.\nexport const provinces='+JSON.stringify(provinces)+';\n');
console.log('Built nine provincial paths using the existing island projection.');
