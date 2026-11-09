import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../server/store.mjs';
import { seedlingOwners } from '../public/donation-map.js';

test('all verified donors survive more than 50 donations and database reopening',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'harithayu-history-'));let store;
  try{
    const path=join(directory,'history.sqlite');store=createStore(path);
    for(let i=0;i<65;i++){store.insert({id:`donor-${i}`,token:`secret-${i}`,name:`Supporter ${i}`,email:'private@example.test',amount:100,reference:`HISTORY-${i}`,publicName:i!==0,createdAt:new Date().toISOString()});if(i<63)store.confirm(`donor-${i}`,'confirmed');}
    store.confirm('donor-63','rejected');store.close();store=createStore(path);
    const summary=store.summary();assert.equal(summary.amount,6300);assert.equal(summary.seedlings,63);assert.equal(summary.contributions,63);assert.equal(summary.donors.length,63);
    assert.equal(summary.donors.find(d=>d.id==='donor-0').name,'Anonymous');assert.ok(summary.donors.some(d=>d.id==='donor-1'));assert.ok(!summary.donors.some(d=>d.id==='donor-63'||d.id==='donor-64'));
    assert.ok(!JSON.stringify(summary).includes('private@example.test'));assert.ok(!JSON.stringify(summary).includes('secret-'));
  }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});

test('map plants preserve existing donor positions and carry partial seedling contributions',()=>{
  const first={id:'a',name:'First',amount:150,confirmed_at:'2026-11-01T00:00:00Z'},second={id:'b',name:'Second',amount:150,confirmed_at:'2026-11-02T00:00:00Z'},third={id:'c',name:'Third',amount:200,confirmed_at:'2026-11-03T00:00:00Z'};
  assert.deepEqual(seedlingOwners([second,first],500).map(d=>d.id),['a','b','b']);
  assert.deepEqual(seedlingOwners([third,second,first],500).map(d=>d.id),['a','b','b','c','c']);
  assert.equal(seedlingOwners([third,second,first],2).length,2);
});
