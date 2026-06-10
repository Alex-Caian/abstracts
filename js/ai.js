'use strict';
/* =====================================================================
   ABSTRACTS — ai.js
   The Adversary: greedy card play, simple unit-action heuristics.
   ===================================================================== */
async function aiTurn(){
  const p=enemy(), h=you();
  await sleep(700); if(G.over) return;
  if(p.invoke>=INVOKE_GOAL && !p.summoned){ summonAbstract(p); await sleep(900); }
  /* play cards greedily, most expensive playable first */
  let safety=20;
  while(safety-->0 && !G.over){
    const playable = p.hand.map((cid,i)=>({cid,i,c:CARDS[cid]}))
      .filter(x=>x.c.cost<=p.mana)
      .filter(x=>{
        if(x.c.t==='f') return p.board.some(s=>!s);
        return aiSpellOk(p,h,x.c);
      })
      .sort((a,b)=>b.c.cost-a.c.cost);
    if(!playable.length) break;
    const pick=playable[0];
    if(pick.c.t==='f'){
      playFollower(p,pick.i,aiPickNode(p,pick.c));
    } else {
      castSpell(p,pick.i,aiSpellTarget(p,h,pick.c));
    }
    if(G.over) return;
    await sleep(800);
  }
  /* act with units */
  for(const ref of unitRefs(p,true)){
    if(G.over) return;
    const u=getUnit(ref); if(!u||!u.ready) continue;
    aiActUnit(p,h,ref,u);
    await sleep(700);
  }
  if(G.over) return;
  await sleep(500);
  endTurn();
}

function aiSpellOk(p,h,c){
  const eUnits=unitRefs(h,false);
  switch(c.fx){
    case 'dmg2': case 'dmg3': case 'surge': case 'chill': return eUnits.length>0;
    case 'aoe2': return eUnits.length>=2;
    case 'tribunal': return eUnits.length>=2 || p.hp<=20;
    case 'bless': return unitRefs(p,false).length>0;
    case 'sacrifice': return !p.summoned && unitRefs(p,false).length>=3;
    case 'inv2': return !p.summoned;
    default: return true;
  }
}

function aiSpellTarget(p,h,c){
  if(!c.target) return null;
  if(c.target==='enemyUnit'){
    const refs=unitRefs(h,false);
    const dmg = c.fx==='surge'?4 : c.fx==='dmg3'?3 : 2;
    const kill=refs.filter(r=>getUnit(r).hp<=dmg).sort((a,b)=>getUnit(b).atk-getUnit(a).atk);
    if(kill.length) return kill[0];
    return refs.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0];
  }
  if(c.target==='friendUnit'){
    const refs=unitRefs(p,false);
    if(c.fx==='sacrifice') return refs.sort((a,b)=>(getUnit(b).invoke-getUnit(a).invoke)||(getUnit(a).atk-getUnit(b).atk))[0];
    return refs.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0];
  }
  return null;
}

function aiPickNode(p,c){
  const empty=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
  const fx=i=>ARCH[p.arch].nodes[i];
  const want = key => empty.find(i=>fx(i)===key);
  if(!p.summoned && c.inv>=2){ const n=want('inv1')??want('invHeal'); if(n!==undefined&&n!==null) return n; }
  if(c.atk>=3){ const n=want('atk2')??want('atk1'); if(n!==undefined&&n!==null) return n; }
  const order=['draw1','hp3','hp2','inv1','invHeal','mana1','dmgHero1','healHero2','atk1','atk2'];
  for(const k of order){ const n=want(k); if(n!==undefined&&n!==null) return n; }
  return empty[0];
}

function aiActUnit(p,h,ref,u){
  const eUnits=unitRefs(h,false);
  const totalReadyAtk = unitRefs(p,true)
    .map(getUnit)
    .filter(x=>x.ready||x===u)
    .reduce((s,x)=>s+x.atk,0);
  /* lethal? hit face */
  if(totalReadyAtk>=h.hp){ attackWith(p,ref,{pi:0,zone:'hero'}); return; }
  /* enemy abstract on board? prioritise killing it */
  if(h.abstractUnit){
    attackWith(p,ref,{pi:0,zone:'abstract',idx:-1}); return;
  }
  /* favourable trade: can kill an enemy unit and survive, or kill a bigger threat */
  const kills=eUnits.filter(r=>{const d=getUnit(r);return d.hp<=u.atk;})
                    .sort((a,b)=>getUnit(b).atk-getUnit(a).atk);
  if(kills.length && (getUnit(kills[0]).atk<u.hp || getUnit(kills[0]).atk>=3)){ attackWith(p,ref,kills[0]); return; }
  /* otherwise invoke if it helps */
  if(!p.summoned && u.invoke>0 && !u.isAbstract){ invokeWith(p,ref); return; }
  /* big enemy unit threatening? trade into it if we'd dent it */
  if(eUnits.length && getUnit(eUnits[0]).atk>=4 && u.atk>=3){ attackWith(p,ref,eUnits.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0]); return; }
  attackWith(p,ref,{pi:0,zone:'hero'});
}
