/* Run with Node and the extracted package path. Uses shipped JSON, not mock frames. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const folder=path.resolve(process.argv[2]||'');
const {Arena,Animation}=require('./combat-core.js');
const pack=JSON.parse(fs.readFileSync(path.join(folder,'Characters/catalog.json'),'utf8'));
for(const group of ['units','variants','effects'])for(const u of pack[group])u.animation=JSON.parse(fs.readFileSync(path.join(folder,u.data),'utf8'));
const results=[];
function test(name,fn){try{fn();results.push({name,passed:true});console.log('PASS '+name)}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL '+name+': '+e.message)}}
function duel(player='retiarius',enemy='murmillo',distance=32){const w=new Arena(pack,{player,enemy,mode:'passive'});w.actors[0].x=200;w.actors[1].x=200+distance;return w}
test('Every fighter and appearance loads every directional action',()=>{
  for(const unit of [...pack.units,...pack.variants])for(const dir of ['front','rear','left','right']){
    const a=new Animation(unit.animation,dir);
    for(const tag of unit.animation.meta.frameTags.filter(t=>t.name.startsWith(dir+'_'))){a.start(tag.name.substring(dir.length+1));a.tick(4000,()=>{},()=>{});assert.ok(a.frame>=tag.from&&a.frame<=tag.to)}
  }
});
test('One attack applies damage only once across its active window',()=>{
  const w=duel();assert.equal(w.command('Attack'),true);w.advance(3000);assert.equal(w.actors[1].hp,80);assert.equal(w.stats.hits,1);assert.equal(w.actors[0].action,'Idle');
});
test('All six distinct attacks reach a nearby opponent',()=>{
  for(const unit of pack.units){const w=duel(unit.id);w.command('Attack');w.advance(1100);assert.equal(w.actors[1].hp,80,unit.id)}
});
test('An attack facing away misses',()=>{const w=duel();w.face(w.actors[0],-1);w.command('Attack');w.advance(1100);assert.equal(w.actors[1].hp,100)});
test('An opponent beyond weapon range is not damaged',()=>{const w=duel('thraex','murmillo',80);w.command('Attack');w.advance(1100);assert.equal(w.actors[1].hp,100)});
test('Frontal guard blocks, reacts and remains raised',()=>{
  const w=duel();w.mode='guard';w.advance(600);w.command('Attack');w.advance(1100);assert.equal(w.actors[1].hp,100);assert.equal(w.stats.blocks,1);assert.equal(w.actors[1].action,'Block');assert.equal(w.actors[1].animation.frame,w.actors[1].animation.tag.to);
});
test('A shield does not block attacks from behind',()=>{
  const w=duel();const target=w.actors[1];w.set(target,'Block',true);w.face(target,1);target.control={block:true};
  // Keep the opponent's guard input without AI turning it to face the player.
  w.enemyInput=()=>({block:true});w.command('Attack');w.advance(1100);assert.equal(target.hp,80);
});
test('Late block is vulnerable during its raising frames',()=>{
  const w=duel();w.command('Attack');w.advance(370);w.mode='guard';w.advance(200);assert.equal(w.actors[1].hp,80);
});
test('Releasing block plays the raising frames backwards to neutral',()=>{
  const w=duel();w.advance(600,{block:true});const a=w.actors[0];const last=a.animation.frame;w.advance(10);assert.equal(a.action,'BlockRelease');assert.equal(a.animation.frame,last);w.advance(600);assert.equal(a.action,'Idle');
});
test('Timed dodge avoids the complete active attack interval',()=>{
  const w=duel();w.command('Attack');w.advance(100);assert.equal(w.act(w.actors[1],'Dodge'),true);w.advance(600);assert.equal(w.actors[1].hp,100);
});
test('Death is one-shot, holds the corpse and rejects new actions',()=>{
  const w=duel();w.actors[0].hp=20;w.act(w.actors[1],'Attack');w.advance(3000);const a=w.actors[0];assert.equal(a.hp,0);assert.equal(a.action,'Death');assert.equal(a.deaths,1);assert.equal(a.animation.frame,a.animation.tag.to);assert.equal(w.command('Attack'),false);const x=a.x;w.advance(500,{axis:1});assert.equal(a.x,x);
});
test('Net release follows JSON timing and persists as unequipped',()=>{
  const w=duel('retiarius','murmillo',100);w.command('NetCast');w.advance(420);assert.equal(w.stats.nets,0);assert.equal(w.actors[0].netReady,true);w.advance(10);assert.equal(w.stats.nets,1);assert.equal(w.actors[0].netReady,false);w.advance(900);assert.equal(w.actors[0].action,'Idle');assert.equal(w.command('NetCast'),false);assert.equal(w.stats.captures,1);
});
test('Net prevents walking and dodging until the entanglement expires',()=>{
  const w=duel('retiarius','murmillo',100);w.command('NetCast');w.advance(900);const a=w.actors[1];assert.ok(a.boundUntil>w.time);const x=a.x;w.enemyInput=()=>({axis:1});assert.equal(w.act(a,'Dodge'),false);w.advance(400);assert.equal(a.x,x);w.advance(1800);assert.ok(a.x>x);
});
test('One net is recovered after its cooldown; non-Retiarius cannot cast',()=>{
  const w=duel('retiarius','murmillo',100);w.command('NetCast');w.advance(4400);assert.equal(w.actors[0].netReady,false);w.advance(30);assert.equal(w.actors[0].netReady,true);assert.equal(w.command('NetCast'),true);assert.equal(w.act(w.actors[1],'NetCast'),false);
});
test('Large elapsed time and fragmented updates produce identical outcomes',()=>{
  const a=duel('retiarius','murmillo',100),b=duel('retiarius','murmillo',100);a.command('NetCast');b.command('NetCast');a.advance(1200);for(let i=0;i<75;i++)b.advance(16);assert.deepEqual(a.stats,b.stats);assert.deepEqual(a.events,b.events);assert.equal(a.actors[1].boundUntil,b.actors[1].boundUntil);
});
test('Profile motion speed matches the native stride metadata',()=>{
  for(const action of ['Walk','Charge']){const w=duel();w.actors[0].x=50;w.actors[1].x=430;const t=w.actors[0].animation.data.meta.frameTags.find(t=>t.name==='right_'+action);w.advance(t.motion.cycleMs,{axis:1,charge:action==='Charge'});assert.ok(Math.abs(w.actors[0].x-50-t.motion.stridePixels)<.001)}
});
test('Changing direction preserves action frame and elapsed timing',()=>{
  const a=new Animation(pack.units[0].animation);a.start('Walk');a.tick(240,()=>{},()=>{});const index=a.frame-a.tag.from,elapsed=a.elapsed;a.face('left');assert.equal(a.frame-a.tag.from,index);assert.equal(a.elapsed,elapsed);
});
test('Native netless exports exist for every appearance and all directions',()=>{
  for(const u of [...pack.units,...pack.variants].filter(u=>u.baseId==='retiarius'))for(const dir of ['front','rear','right','left'])assert.ok(fs.existsSync(path.join(folder,u.netless[dir].image)));
});
test('Movement respects arena bounds and prevents living fighters crossing',()=>{
  const w=duel();w.advance(10000,{axis:1,charge:true});assert.ok(w.actors[0].x<=w.actors[1].x-22);w.advance(10000,{axis:-1,charge:true});assert.equal(w.actors[0].x,36);
});
const result={passed:results.every(t=>t.passed),tests:results.length,results};
fs.mkdirSync(path.join(folder,'Validation'),{recursive:true});fs.writeFileSync(path.join(folder,'Validation/COMBAT_TESTS.json'),JSON.stringify(result,null,2));
console.log(`${results.filter(t=>t.passed).length}/${results.length} passed`);if(!result.passed)process.exitCode=1;
