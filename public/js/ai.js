'use strict';
/* =====================================================================
   ABSTRACTS — ai.js
   AI decision-making for either seat (enables AI-vs-AI simulation).
   Aware of links, communion, and the essence economy.
   ===================================================================== */
async function aiTurn(p){
  const h=foe(p);
  if(p.idleTurns && G.turnNo <= p.idleTurns){   // quiet lock: the AI stays passive for its first N turns
    log(`${p.name} watches, unmoving.`, 'foe');
    await sleep(900);
    if(!G.over) endTurn();
    return;
  }
  const maySummon = G.turnNo > (p.summonLockTurns||0);   // scenario summon-lock (e.g. tutorial Fear holds 4 turns)
  await sleep(700); if(G.over) return;
  if(maySummon && !p.abstractUnit && p.invoke>=p.summonCost){ summonAbstract(p); await sleep(900); }
  if(canUseAbility(p) && aiAbilityWorthIt(p,h)){ useAbility(p); await sleep(700); }
  /* play cards greedily, most expensive playable first */
  let safety=20;
  while(safety-->0 && !G.over){
    const playable = p.hand.map((cid,i)=>({cid,i,c:CARDS[cid]}))
      .filter(x=>x.c.cost<=p.mana)
      .filter(x=>{
        if(x.c.t==='f') return canPlayFollower(p,x.c);
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
  if(maySummon && !G.over && !p.abstractUnit && p.invoke>=p.summonCost){ summonAbstract(p); await sleep(900); }
  /* act with units */
  for(const ref of unitRefs(p)){
    if(G.over) return;
    const u=getUnit(ref); if(!u||!u.ready) continue;
    aiActUnit(p,h,ref,u);
    await sleep(700);
  }
  if(G.over) return;
  activateBoons(p); renderAll(); await sleep(600);   // spend banked essence on active Boons (e.g. Justice's Ordain)
  if(G.over) return;
  if(canUseAbility(p) && aiAbilityWorthIt(p,h)){ useAbility(p); await sleep(700); }
  await sleep(500);
  endTurn();
}

function aiAbilityWorthIt(p,h){
  if(p.arch==='fear'){
    const empty=p.board.filter(s=>!s).length;
    /* repair the circle: always when one node from communion, otherwise
       only with essence to spare beyond a pending resummon */
    if(empty===0) return false;
    if(empty===1) return true;
    return p.invoke >= ARCH.fear.abstract.ability.cost + 4;
  }
  if(p.arch==='justice'){
    const eUnits=unitRefs(h);
    return eUnits.length>0 && Math.max(...eUnits.map(r=>getUnit(r).atk))>=4;
  }
  if(p.arch==='knowledge') return p.hand.length<=HAND_MAX-2;
  return false;
}

function aiSpellOk(p,h,c){
  const eUnits=unitRefs(h);
  switch(c.fx){
    case 'dmg2': case 'dmg3': case 'surge': case 'chill': return eUnits.length>0;
    case 'atkDownAll': return eUnits.length>=2;
    case 'massHysteria': return eUnits.length>=2;
    case 'paralyse': return eUnits.length>0;
    case 'chessMove': return eUnits.length>0;
    case 'webspin': return (p.bonds||[]).length<3 && !!aiBondPair(p);   // needs two followers not already bonded together; stops at three bonds
    case 'arcana': return !((p.summonCount||0)>=2 && p.abstractUnit && p.abstractUnit.hp>=p.abstractUnit.maxHp);   // pointless only when its form is already whole
    case 'illusion': return nodesRemoved(p)>0 && p.board.some(s=>!s) && illusionSize(p,'k_illusion')>=4;   // only once it would be a real body
    case 'mirror': return eUnits.some(r=>getUnit(r).atk>0);   // only worth raising against followers that can attack
    case 'aoe2': return eUnits.length>=2;
    case 'tribunal': return eUnits.length>=2 || p.hp<=20;
    case 'bless': return unitRefs(p).length>0;
    case 'sacrifice': return unitRefs(p).length>=4 && !diagramComplete(p);
    case 'inv2': return true;
    case 'plea': return true;
    case 'veil': return unitRefs(p).length>=2;
    case 'atkUpAll': return unitRefs(p).length>=3;
    case 'twinProphets': return p.board.some(s=>!s);
    case 'summon4spiders': case 'summonGargantuan': return p.board.some(s=>!s);
    case 'refute': return eUnits.some(r=>getUnit(r).atk>=3);
    case 'distil': {
      if(p.board.length<=4) return false;
      const empty=p.board.filter(s=>!s).length;
      return empty>=1 && (p.board.length-empty)>=2;
    }
    default: return true;
  }
}

/* Web-spinning: bond the nodes of its two strongest followers that are not already bonded to each other */
function aiBondPair(p){
  const own=unitRefs(p).sort((a,b)=>getUnit(b).atk-getUnit(a).atk);
  const bonded=(a,b)=>(p.bonds||[]).some(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));
  for(let i=0;i<own.length;i++) for(let j=i+1;j<own.length;j++) if(!bonded(own[i].idx,own[j].idx)) return {pi:G.players.indexOf(p),zone:'bond',a:own[i].idx,b:own[j].idx};
  return null;
}
function aiSpellTarget(p,h,c){
  if(!c.target) return null;
  if(c.target==='bondNodes') return aiBondPair(p);
  if(c.target==='emptyNode' || c.target==='summonNode'){
    /* the empty node that best joins occupied neighbours (to dissolve, or to summon onto) */
    const n=p.board.length; let best=null,bs=-1;
    for(let i=0;i<n;i++){
      if(p.board[i]) continue;
      const sc=(p.board[(i+1)%n]?1:0)+(p.board[(i-1+n)%n]?1:0);
      if(sc>bs){bs=sc;best=i;}
    }
    return {pi:G.players.indexOf(p),zone:'node',idx:best};
  }
  if(c.target==='enemyUnit'){
    const refs=unitRefs(h);
    const dmg = c.fx==='surge'?4 : c.fx==='dmg3'?3 : c.fx==='refute'?0 : 2;
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

/* node choice: balance the node bonus against forging links */
function aiPickNode(p,c){
  /* Time Borrower: hide the most damaged follower (ties: the lower-Health one) */
  if(c.replace){
    const own=unitRefs(p).map(r=>({i:r.idx,u:getUnit(r)}));
    own.sort((a,b)=>((b.u.maxHp-b.u.hp)-(a.u.maxHp-a.u.hp)) || (a.u.hp-b.u.hp));
    return own.length?own[0].i:0;
  }
  let empty=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
  if(!empty.length) empty=absorbNodes(p);   // no node free: absorb one of its own tokens instead (scenario Boon)
  const order=['draw1','hp3','hp2','inv1','invHeal','mana1','dmgHero1','healHero2','atk1','atk2'];
  const fx=i=>ARCH[p.arch].nodes[i];
  let best=empty[0], bestScore=-99;
  for(const i of empty){
    let score = 0;
    if(linkedAt(p,i)) score += (c.inv>0 ? 3 : 1);     /* links matter most for invokers */
    if(c.inv>=2 && (fx(i)==='inv1'||fx(i)==='invHeal')) score += 2;
    if(c.atk>=3 && (fx(i)==='atk2'||fx(i)==='atk1')) score += 2;
    score += (order.length - order.indexOf(fx(i)))/10;
    if(score>bestScore){ bestScore=score; best=i; }
  }
  return best;
}

function aiActUnit(p,h,ref,u){
  const hi=G.players.indexOf(h);
  const eUnits=unitRefs(h);
  const totalReadyAtk = unitRefs(p)
    .map(getUnit)
    .filter(x=>x.ready||x===u)
    .reduce((s,x)=>s+x.atk,0);
  /* lethal? the face pool is form HP + core HP (approximate) */
  const facePool = (h.abstractUnit?h.abstractUnit.hp:0) + h.hp;
  const faceOpen = !formGuarded(h);   // a guarded form cannot be attacked while its owner has followers
  if(faceOpen && totalReadyAtk>=facePool && u.atk>0){ attackWith(p,ref,{pi:hi,zone:'hero'}); return; }
  /* enemy form up? batter it down */
  if(faceOpen && h.abstractUnit && u.atk>=2){ attackWith(p,ref,{pi:hi,zone:'hero'}); return; }
  /* favourable trade */
  const kills=eUnits.filter(r=>{const d=getUnit(r);return d.hp<=u.atk;})
                    .sort((a,b)=>getUnit(b).atk-getUnit(a).atk);
  if(kills.length && (getUnit(kills[0]).atk<u.hp || getUnit(kills[0]).atk>=3)){ attackWith(p,ref,kills[0]); return; }
  /* invoke when able and building toward a summon (or banking for the ability) */
  const wantsEssence = !p.abstractUnit || p.invoke < ARCH[p.arch].abstract.ability.cost;
  if(wantsEssence && canChannel(p,u,ref.idx)){ invokeWith(p,ref); return; }
  /* big enemy threatening? trade into it */
  if(eUnits.length && getUnit(eUnits[0]).atk>=4 && u.atk>=3){ attackWith(p,ref,eUnits.sort((a,b)=>getUnit(b).atk-getUnit(a).atk)[0]); return; }
  if(u.atk>0 && faceOpen){ attackWith(p,ref,{pi:hi,zone:'hero'}); return; }
  if(u.atk>0 && eUnits.length){ attackWith(p,ref,eUnits.sort((a,b)=>getUnit(a).hp-getUnit(b).hp)[0]); return; }   // form guarded: clear its weakest guard
  /* zero-attack unit with nothing to channel: hold the node */
  u.ready=false;
}
