'use strict';
/* =====================================================================
   ABSTRACTS — ai.js
   The Adversary: greedy card play, simple unit-action heuristics,
   summon / resummon / ability usage.
   ===================================================================== */
async function aiTurn(){
  const p=enemy(), h=you();
  await sleep(700); if(G.over) return;
  /* summon or resummon whenever affordable */
  if(!p.abstractUnit && p.invoke>=p.summonCost){ summonAbstract(p); await sleep(900); }
  /* use the active ability when it earns its cost */
  if(canUseAbility(p) && aiAbilityWorthIt(p,h)){ useAbility(p); await sleep(700); }
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
  /* late summon if card play pushed invoke over the line */
  if(!G.over && !p.abstractUnit && p.invoke>=p.summonCost){ summonAbstract(p); await sleep(900); }
  /* act with units */
  for(const ref of unitRefs(p)){
    if(G.over) return;
    const u=getUnit(ref); if(!u||!u.ready) continue;
    aiActUnit(p,h,ref,u);
    await sleep(700);
  }
  if(G.over) return;
  if(canUseAbility(p) && aiAbilityWorthIt(p,h)){ useAbility(p); await sleep(700); }
  await sleep(500);
  endTurn();
}

function aiAbilityWorthIt(p,h){
  const eUnits=unitRefs(h);
  if(p.arch==='fear')      return eUnits.length>=2;
  if(p.arch==='justice')   return eUnits.length>0 && Math.max(...eUnits.map(r=>getUnit(r).atk))>=3;
  if(p.arch==='knowledge') return p.hand.length<=HAND_MAX-2;
  return false;
}

function aiSpellOk(p,h,c){
  const eUnits=unitRefs(h);
  switch(c.fx){
    case 'dmg2': case 'dmg3': case 'surge': case 'chill': return eUnits.length>0;
    case 'aoe2': return eUnits.length>=2;
    case 'tribunal': return eUnits.length>=2 || p.hp<=20;
    case 'bless': return unitRefs(p).length>0;
    case 'sacrifice': return unitRefs(p).length>=3;
    case 'inv2': return true;
    default: return true;
  }
}

function aiSpellTarget(p,h,c){
  if(!c.target) return null;
  if(c.target==='enemyUnit'){
    const refs=unitRefs(h);
    const dmg = c.fx==='surge'?4 : c.fx==='dmg3'?3 : 2;
    const kill=refs.filter(r=>getUnit(r).hp<=dmg).sort((a,b)=>getUnit(b).atk-getUnit(a).atk);
    if(kill.length) return kill[0];
    return refs.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0];
  }
  if(c.target==='friendUnit'){
    const refs=unitRefs(p);
    if(c.fx==='sacrifice') return refs.sort((a,b)=>(getUnit(b).invoke-getUnit(a).invoke)||(getUnit(a).atk-getUnit(b).atk))[0];
    return refs.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0];
  }
  return null;
}

function aiPickNode(p,c){
  const empty=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
  const fx=i=>ARCH[p.arch].nodes[i];
  const want = key => empty.find(i=>fx(i)===key);
  if(c.inv>=2){ const n=want('inv1')??want('invHeal'); if(n!==undefined&&n!==null) return n; }
  if(c.atk>=3){ const n=want('atk2')??want('atk1'); if(n!==undefined&&n!==null) return n; }
  const order=['draw1','hp3','hp2','inv1','invHeal','mana1','dmgHero1','healHero2','atk1','atk2'];
  for(const k of order){ const n=want(k); if(n!==undefined&&n!==null) return n; }
  return empty[0];
}

function aiActUnit(p,h,ref,u){
  const eUnits=unitRefs(h);
  const totalReadyAtk = unitRefs(p)
    .map(getUnit)
    .filter(x=>x.ready||x===u)
    .reduce((s,x)=>s+x.atk,0);
  /* lethal? the face pool is form HP + core HP (no spill, so approximate) */
  const facePool = (h.abstractUnit?h.abstractUnit.hp:0) + h.hp;
  if(totalReadyAtk>=facePool){ attackWith(p,ref,{pi:0,zone:'hero'}); return; }
  /* enemy form up? batter it down — the core is unreachable anyway */
  if(h.abstractUnit && u.atk>=2){ attackWith(p,ref,{pi:0,zone:'hero'}); return; }
  /* favourable trade: can kill an enemy unit and survive, or kill a bigger threat */
  const kills=eUnits.filter(r=>{const d=getUnit(r);return d.hp<=u.atk;})
                    .sort((a,b)=>getUnit(b).atk-getUnit(a).atk);
  if(kills.length && (getUnit(kills[0]).atk<u.hp || getUnit(kills[0]).atk>=3)){ attackWith(p,ref,kills[0]); return; }
  /* invoke if building toward a summon */
  if(!p.abstractUnit && u.invoke>0){ invokeWith(p,ref); return; }
  /* form up but invoke bank low? feed the ability with high-invoke units */
  if(p.abstractUnit && u.invoke>=2 && p.invoke<ARCH[p.arch].abstract.ability.cost){ invokeWith(p,ref); return; }
  /* big enemy unit threatening? trade into it if we'd dent it */
  if(eUnits.length && getUnit(eUnits[0]).atk>=4 && u.atk>=3){ attackWith(p,ref,eUnits.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0]); return; }
  attackWith(p,ref,{pi:0,zone:'hero'});
}
