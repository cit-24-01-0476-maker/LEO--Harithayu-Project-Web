// Natural Earth 1:10m country geometry, distributed as public-domain data.
// Source: https://github.com/datasets/geo-countries
// Rebuild the SVG and its matching seedling mask from the same coordinates.
import { readFile, writeFile } from 'node:fs/promises';

const feature=JSON.parse(await readFile('public/assets/sri-lanka.geojson','utf8'));
if(feature.properties['ISO3166-1-Alpha-3']!=='LKA')throw Error('Expected Sri Lanka geometry');
const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
const coordinates=polygons.flat(2);
const lonMin=Math.min(...coordinates.map(p=>p[0])),lonMax=Math.max(...coordinates.map(p=>p[0]));
const latMin=Math.min(...coordinates.map(p=>p[1])),latMax=Math.max(...coordinates.map(p=>p[1]));
const longitudeScale=Math.cos(((latMin+latMax)/2)*Math.PI/180);
const scale=430/(latMax-latMin),center=(lonMin+lonMax)/2;
const project=([lon,lat])=>[Number((246+(lon-center)*longitudeScale*scale).toFixed(2)),Number((42+(latMax-lat)*scale).toFixed(2))];
const rings=polygons.map(p=>p.map(r=>r.map(project)));
const path=rings.flat().map(r=>'M'+r.map(p=>p.join(',')).join('L')+'Z').join('');
const marker=project([79.909,8.981]); // Mannar town; region marker, not a confirmed planting site.
await writeFile('public/sri-lanka-map.js',`// Generated from Natural Earth 1:10m. See scripts/update-map.mjs.\nexport const islandPolygons=${JSON.stringify(rings)};\n`);
let html=await readFile('public/index.html','utf8');
html=html.replace(/<path id="island"[\s\S]*?<g id="map-seedlings">/,`<path id="island" d="${path}" fill="#e0e8d6" stroke="#9fb48f" stroke-width="1.3" stroke-linejoin="round" fill-rule="evenodd" filter="url(#island-shadow)"/><g id="map-seedlings">`);
const [x,y]=marker;
html=html.replace(/<g class="mannar-marker">[\s\S]*?<\/g>/,`<g class="mannar-marker"><circle cx="${x}" cy="${y}" r="16" fill="#8ca96b" opacity=".15"/><circle cx="${x}" cy="${y}" r="5" fill="#315c40" stroke="#fff" stroke-width="2"/><path d="M${x-7},${y}H84V${y-28}" stroke="#60816d" fill="none"/><text x="45" y="${y-44}" fill="#315342" font-size="14" font-family="DM Sans,sans-serif" font-weight="700">MANNAR</text><text x="45" y="${y-27}" fill="#748577" font-size="10" font-family="DM Sans,sans-serif">PROJECT REGION</text></g>`);
await writeFile('public/index.html',html);
console.log(`Sri Lanka map rebuilt: ${polygons.length} land polygons; Mannar marker: ${marker.join(', ')}.`);
