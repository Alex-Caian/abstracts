'use strict';
/* =====================================================================
   ABSTRACTS — engine.js
   Core rules: turns, drawing, combat, spells, invoking, the Abstract.

   Damage model: each player IS their Abstract. The core (30 HP) sits at
   the centre. While a manifested form is in play it absorbs ALL face
   damage — no spill-through to the core.

   The ritual: a follower can only INVOKE while linked (an adjacent node
   is occupied). At the start of your turn with the diagram complete
   (communion), every follower channels +1 essence passively. All auras
   trigger at the start of your turn.
   ===================================================================== */

function drawCards(p,n,silent){
  for(let i=0;i<n;i++){
    if(p.deck.length===0){
      if(p.used.length===0) return;             /* nothing left anywhere — skip quietly */
      p.deck = shuffle(p.used); p.used = [];
      log(`${p.name===G.players[0].name?'Your':p.name+"'s"} litany begins anew — ${p.deck.length} spent cards return.`,'sys');
    }
    const c = p.deck.pop();
    p.drawnCount = (p.drawnCount||0) + 1;        /* cumulative draws (Loremaster gate) */
    if(p.hand.length>=HAND_MAX){
      /* an overfull mind forgets: the card leaves the cycle for good */
      if(!silent) log(`${p.name}'s hand is full — ${CARDS[c].name} is forgotten.`, p.isAI?'foe':'you');
      continue;
    }
    p.hand.push(c);
  }
}

function healCore(p,n){ p.hp = Math.min(START_HP, p.hp+n); }
function healFace(p,n){
  if(p.abstractUnit){ p.abstractUnit.hp = Math.min(p.abstractUnit.maxHp, p.abstractUnit.hp+n); }
  else healCore(p,n);
}

/* all "face" damage routes here: the form shields the core */
function damageFace(p,n){
  const side = p.isAI?'foe':'you';
  if(p.abstractUnit){
    const u=p.abstractUnit;
    u.hp -= n;
    floatNum(document.querySelector(`#board-${side} .centre`), -n, true);
    if(u.hp<=0){
      p.abstractUnit=null;
      log(`${u.name} is unmade! ${p.name} ${p.isAI?'stands':'stand'} exposed — it may take form again for ${p.summonCost} essence.`,'sys');
    }
    return;
  }
  p.hp -= n;
  floatNum(document.getElementById('strip-'+side), -n);
  if(p.hp<=0 && !G.over) endGame(foe(p));
}

function damageUnit(ref,n){
  const u = getUnit(ref); if(!u) return;
  u.hp -= n;
  floatNum(unitEl(ref), -n, true);
  if(u.hp<=0) killUnit(ref);
}

function killUnit(ref){
  const p = G.players[ref.pi];
  const u = getUnit(ref); if(!u) return;
  p.board[ref.idx]=null;
  log(`${u.name} falls.`, p.isAI?'foe':'you');
  if(u.dr==='dr_dmg2'){ log(`${u.name}'s death curse strikes for 2.`, p.isAI?'foe':'you'); damageFace(foe(p),2); }
  if(u.dr==='dr_dmg1'){ log(`${u.name} bursts — 1 damage.`, p.isAI?'foe':'you'); damageFace(foe(p),1); }
}

function startTurn(){
  const p = active();
  if(G.turn===(G.first||0)) G.turnNo++;   // a new round begins when the first player's turn comes round
  p.maxMana = Math.min(MAX_MANA, p.maxMana+1);
  p.mana = p.maxMana;
  p.abilityUsed = false;
  /* the long duel: from turn 25, reality reasserts itself — the core
     decays at each turn start, harder every turn, bypassing the form */
  if(G.turnNo>=DECAY_START){
    const decay=G.turnNo-DECAY_START+1;
    p.hp -= decay;
    floatNum(document.getElementById('strip-'+(p.isAI?'foe':'you')), -decay);
    log(`Reality reasserts itself — ${p.name===G.players[0].name?'your':p.name+"'s"} core decays by ${decay}.`,'sys');
    if(p.hp<=0 && !G.over){ endGame(foe(p)); return; }
  }
  /* ready units; terror and paralysis hold the stricken in place this turn */
  eachUnits(p,u=>{
    u.ready=true; u.sick=false;
    if(u.terrified || u.paralysed>0) u.ready=false;
  });
  /* paralysis: the stricken take 1 damage at turn start and count down */
  unitRefs(p).forEach(ref=>{
    if(G.over) return;
    const u=getUnit(ref);
    if(u && u.paralysed>0){ u.paralysed--; damageUnit(ref,1); }
  });
  if(G.over) return;
  /* communion: the completed circle channels — +1 essence per follower */
  if(diagramComplete(p)){
    const n=p.board.length;
    gainInvoke(p,n);
    log(`The ${ARCH[p.arch].geoName} stands complete — the circle channels +${n} essence.`,'sys');
    const cEl=document.querySelector(`#board-${p.isAI?'foe':'you'} .centre`);
    if(cEl) floatNum(cEl, n, true, 'var(--invoke)');
  }
  /* aura — only while the form is manifested */
  if(p.abstractUnit && !G.over){
    const a=p.arch, e=foe(p);
    if(a==='fear'){
      log(`${ARCH.fear.abstract.name} radiates dread — 2 damage.`,'sys');
      damageFace(e,2);
      const refs=unitRefs(e).filter(r=>!getUnit(r).sick);
      const pool=refs.length?refs:unitRefs(e);
      if(pool.length && !G.over){
        const r=pool[Math.floor(Math.random()*pool.length)];
        const u=getUnit(r); u.terrified=true;
        log(`${u.name} is Terrified — it cannot act next turn.`,'sys');
      }
    }
    if(a==='justice'){
      const ec=unitRefs(e).length, pc=unitRefs(p).length;
      /* outnumbered: strike. outnumbering: mend. evenly matched: both. */
      if(ec>=pc && ec>0){
        const refs=unitRefs(e);
        const r=refs[Math.floor(Math.random()*refs.length)];
        log(`The scales tip — 2 damage to ${getUnit(r).name}.`,'sys');
        damageUnit(r,2);
      }
      if(ec<=pc && !G.over){
        log('The scales mend — JUSTICE restores 2 HP.','sys');
        healFace(p,2);
      }
    }
    if(a==='knowledge'){
      log(`${ARCH.knowledge.abstract.name} illuminates — draw a card, +1 mana.`,'sys');
      drawCards(p,1);
      p.mana += 1;
    }
  }
  if(G.over) return;
  drawCards(p,1);
  log(`— Turn ${G.turnNo}: ${p.name} (${p.mana} mana) —`, p.isAI?'foe':'you');
  clearSelection(); renderAll();
  if(p.isAI) aiTurn(p);
}

function endTurn(){
  if(G.over) return;
  /* terror and phobia release their grip as the stricken player's turn ends */
  eachUnits(active(),u=>{ u.terrified=false; u.muted=false; });
  clearSelection();
  G.turn = 1-G.turn;
  startTurn();
}

function playFollower(p, handIdx, nodeIdx){
  const cid = p.hand[handIdx], c = CARDS[cid];
  if(c.cost>p.mana || p.board[nodeIdx]) return false;
  p.mana -= c.cost; p.hand.splice(handIdx,1);
  if(!c.apparition) p.used.push(cid);   /* apparitions never recycle: spent forever once played */
  const u = {cid, name:c.name, atk:c.atk, hp:c.hp, maxHp:c.hp, invoke:c.inv,
             soloInv:c.soloInv||0, dr:c.dr||null, ready:false, sick:true, terrified:false, muted:false, paralysed:0};
  p.board[nodeIdx]=u;
  if(c.lockNode && p.lockNode[cid]===undefined){ p.lockNode[cid]=nodeIdx; log(`${c.name} consecrates this seat — its kind may invoke only here.`,'sys'); }
  const fxKey = p.nodes[nodeIdx];
  log(`${p.name} play${p.isAI?'s':''} ${c.name} → ${NODE_FX[fxKey].txt}.`, p.isAI?'foe':'you');
  if(c.apparition) log(`${c.name} fades from the cycle — an apparition is seen but once.`,'sys');
  NODE_FX[fxKey].apply(G,p,u);
  if(c.fx) resolveFx(c.fx,p,null,u);
  renderAll(); return true;
}

function castSpell(p, handIdx, targetRef){
  const cid = p.hand[handIdx], c = CARDS[cid];
  if(c.cost>p.mana) return false;
  p.mana -= c.cost; p.hand.splice(handIdx,1);
  if(!c.apparition) p.used.push(cid);   /* apparitions never recycle: spent forever once played */
  const tgtTxt = targetRef && targetRef.zone!=='node' ? ` on ${getUnit(targetRef).name}` : '';
  log(`${p.name} cast${p.isAI?'s':''} ${c.name}${tgtTxt}.`, p.isAI?'foe':'you');
  if(c.apparition) log(`${c.name} fades from the cycle — an apparition is seen but once.`,'sys');
  resolveFx(c.fx,p,targetRef);
  renderAll(); return true;
}

function resolveFx(fx,p,ref,self){
  const e = foe(p);
  switch(fx){
    case 'whisper': { const refs=unitRefs(e); if(refs.length){ const r=refs[Math.floor(Math.random()*refs.length)]; const u=getUnit(r); u.atk=Math.max(0,u.atk-1); log(`${u.name} loses 1 Attack.`,'sys'); } break; }
    case 'heal2': healCore(p,2); break;
    case 'draw1': drawCards(p,1); break;
    case 'draw2': drawCards(p,2); break;
    case 'archive': {
      if(p.hand.length){ const i=Math.floor(Math.random()*p.hand.length); p.deck.push(p.hand.splice(i,1)[0]); shuffle(p.deck); log('A card is filed back into the deck.','sys'); }
      drawCards(p,1); break; }
    case 'inv1': gainInvoke(p,1); break;
    case 'inv2': gainInvoke(p,2); break;
    case 'buffAlly': { const refs=unitRefs(p).filter(r=>getUnit(r)!==self);
      if(refs.length){ const r=refs[Math.floor(Math.random()*refs.length)]; const u=getUnit(r); u.atk+=1;u.hp+=1;u.maxHp+=1; log(`${u.name} gains +1/+1.`,'sys'); }
      else if(self){ self.atk+=1; self.hp+=1; self.maxHp+=1; log(`${self.name} steels itself — +1/+1.`,'sys'); } break; }
    case 'healAllies': eachUnits(p,u=>{ u.hp=Math.min(u.maxHp,u.hp+1); }); log('The Arbiter mends the faithful — +1 Health to your followers.','sys'); break;
    case 'plea': gainInvoke(p, p.hp>15 ? 3 : 2); break;
    case 'dmg2': damageUnit(ref,2); break;
    case 'dmg3': damageUnit(ref,3); break;
    case 'chill': damageUnit(ref,2); gainInvoke(p,1); break;
    case 'surge': damageUnit(ref,4); drawCards(p,1); break;
    case 'atkDownAll': eachUnits(e,u=>{u.atk=Math.max(0,u.atk-1);}); log('All enemy followers lose 1 Attack.','sys'); break;
    case 'atkUpAll': eachUnits(p,u=>{u.atk+=1;}); log('Occult power surges — your followers gain +1 Attack.','sys'); break;
    case 'massHysteria': {
      unitRefs(e).reverse().forEach(r=>{
        const u=getUnit(r); if(!u) return;
        const roll=Math.floor(Math.random()*3);            /* 0:-1/-0  1:-0/-1  2:-1/-1 */
        if(roll===0||roll===2){ u.atk=Math.max(0,u.atk-1); }
        if(roll===1||roll===2){ u.hp-=1; if(u.maxHp>1) u.maxHp-=1; }
        if(u.hp<=0) killUnit(r);
      });
      log('Mass hysteria sweeps the enemy ranks — they falter at random.','sys'); break; }
    case 'muteInvoke': { const refs=unitRefs(e); if(refs.length){ const r=refs[Math.floor(Math.random()*refs.length)]; const u=getUnit(r); u.muted=true; log(`${u.name} is gripped by phobia — it cannot invoke next turn.`,'sys'); } break; }
    case 'aoe2': unitRefs(e).reverse().forEach(r=>damageUnit(r,2)); break;
    case 'retribution': { for(let n=0;n<3;n++){ const refs=unitRefs(e); if(!refs.length) break; damageUnit(refs[Math.floor(Math.random()*refs.length)],1); } log('Retribution scatters among the enemy ranks.','sys'); break; }
    case 'tribunal': unitRefs(e).reverse().forEach(r=>damageUnit(r,1)); healFace(p,2); break;
    case 'paralyse': { const u=getUnit(ref); if(u){ u.paralysed=2; log(`${u.name} is Terrified for 2 turns — and bleeds 1 each turn.`,'sys'); } break; }
    case 'chessMove': {
      /* 1. steal the follower on the enemy front node (index 0) if you have room */
      const front = e.board[0];
      if(front){
        const free = p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
        if(free.length){
          e.board[0] = null;
          front.sick=true; front.ready=false; front.terrified=false; front.muted=false; front.paralysed=0;
          p.board[free[Math.floor(Math.random()*free.length)]] = front;
          log(`${front.name} is seized and turned to your cause.`,'sys');
        }
      }
      /* 2. scatter the enemy's remaining followers across their diagram */
      const units = e.board.filter(u=>u);
      if(units.length){
        const n = e.board.length; e.board = new Array(n).fill(null);
        const slots = []; for(let i=0;i<n;i++) slots.push(i);
        for(let i=n-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [slots[i],slots[j]]=[slots[j],slots[i]]; }
        units.forEach((u,i)=>{ e.board[slots[i]] = u; });
        log('The opposing ranks are scattered across their diagram.','sys');
      }
      /* 3-5. mend and gather */
      healCore(p,1);
      eachUnits(p,u=>{ u.hp=Math.min(u.maxHp,u.hp+1); });
      gainInvoke(p,1);
      break; }
    case 'bless': { const u=getUnit(ref); u.atk+=2;u.hp+=2;u.maxHp+=2; break; }
    case 'sacrifice': { const u=getUnit(ref); const gain=u.invoke+2; killUnit(ref); gainInvoke(p,gain); log(`The rite yields ${gain} essence.`,'sys'); break; }
    case 'veil': eachUnits(p,u=>{u.hp+=2;u.maxHp+=2;}); log('A veil of theory settles — your followers gain +0/+2.','sys'); break;
    case 'twinProphets': {
      const n=p.board.length; let spots=null;
      for(let i=0;i<n;i++){ if(!p.board[i] && !p.board[(i+1)%n]){ spots=[i,(i+1)%n]; break; } }
      /* no adjacent pair free: a single Prophet manifests — the chorus needs a neighbour */
      if(!spots){ const free=p.board.map((s,i)=>s?null:i).filter(i=>i!==null); spots = free.length?[free[0]]:[]; }
      spots.forEach(i=>{ p.board[i]={cid:'tok_prophet',name:'Prophet',atk:1,hp:1,maxHp:1,invoke:1,dr:null,ready:false,sick:true,terrified:false}; });
      log(spots.length?(spots.length===2?'Two Prophets step through, already in chorus.':'A lone Prophet steps through.'):'No room — the prophecy fizzles.','sys');
      break; }
    case 'refute': { const u=getUnit(ref); if(u){
      G.players[ref.pi].board[ref.idx]={cid:'tok_footnote',name:'Footnote',atk:1,hp:1,maxHp:1,invoke:0,dr:null,ready:false,sick:false,terrified:false};
      log(`${u.name} is reduced to a footnote.`,'sys'); } break; }
    case 'distil': if(ref && ref.zone==='node') removeNode(p, ref.idx); break;
  }
}

/* Distillation: dissolve an empty node — its neighbours join, the
   polygon re-forms one side smaller. Floor: 4 nodes. */
function removeNode(p, idx){
  if(p.board.length<=4 || p.board[idx]) return false;
  const bonus=NODE_FX[p.nodes[idx]].txt;
  p.nodes.splice(idx,1);
  p.board.splice(idx,1);
  const n=p.board.length;
  p.angles = Array.from({length:n},(_,i)=> -90 + i*360/n);
  log(`The diagram is distilled — the "${bonus}" node dissolves and the circle tightens to ${n}.`,'sys');
  clearSelection();
  buildBoards();
  renderAll();
  return true;
}

/* essence accrues forever — spent on summons and abilities */
function gainInvoke(p,n){
  const before=p.invoke;
  p.invoke += n;
  if(!p.abstractUnit && before<p.summonCost && p.invoke>=p.summonCost)
    log(`${p.name} ${p.isAI?'has':'have'} gathered enough essence to summon ${ARCH[p.arch].abstract.name} (${p.summonCost}).`,'sys');
}

/* effective invoke: a solitary channeler (soloInv) inverts the rule — it
   channels only while UNLINKED, for its solo value; otherwise nothing. */
function effInvoke(p,u,idx){
  if(u.soloInv) return linkedAt(p,idx) ? 0 : (u.invoke + u.soloInv);
  return u.invoke;
}
/* may this unit channel right now? muted blocks it; normal units need a
   link, solitary channelers need solitude. */
function canChannel(p,u,idx){
  if(!u || u.muted) return false;
  if(effInvoke(p,u,idx)<=0) return false;
  /* consecrated-seat lock (Vindicator): a lockNode card may only invoke from
     the node its first copy was placed on this game */
  const cdef = CARDS[u.cid];
  if(cdef && cdef.lockNode && p.lockNode && p.lockNode[u.cid]!==undefined && p.lockNode[u.cid]!==idx) return false;
  /* draw-gate (Loremaster): may only invoke once enough cards have been drawn */
  if(cdef && cdef.invDrawn && (p.drawnCount||0) < cdef.invDrawn) return false;
  return u.soloInv ? !linkedAt(p,idx) : linkedAt(p,idx);
}
/* invoking demands connection: only a linked follower may channel
   (the lone hunter is the exception — it channels in solitude). */
function invokeWith(p,ref){
  const u=getUnit(ref); if(!u||!u.ready) return;
  if(!canChannel(p,u,ref.idx)) return;
  const amt=effInvoke(p,u,ref.idx);
  u.ready=false;
  gainInvoke(p,amt);
  floatNum(unitEl(ref), amt, true, 'var(--invoke)');
  log(`${u.name} invokes (+${amt}) — ${p.invoke} essence.`, p.isAI?'foe':'you');
  renderAll();
}

function attackWith(p, attRef, targetRef){
  const a=getUnit(attRef); if(!a||!a.ready) return;
  a.ready=false;
  if(targetRef.zone==='hero'){
    const t=G.players[targetRef.pi];
    const tgt = t.abstractUnit ? t.abstractUnit.name : `${t.name}'s core`;
    log(`${a.name} strikes ${tgt} for ${a.atk}.`, p.isAI?'foe':'you');
    damageFace(t,a.atk);
  } else {
    const d=getUnit(targetRef);
    log(`${a.name} (${a.atk}) clashes with ${d.name} (${d.atk}).`, p.isAI?'foe':'you');
    a.hp -= d.atk;
    floatNum(unitEl(attRef), -d.atk, true);
    damageUnit(targetRef, a.atk);
    if(a.hp<=0) killUnit(attRef);
  }
  renderAll();
}

function spawnSpider(p, nodeIdx){
  p.board[nodeIdx]={cid:'tok_spider',name:'Terror Spider',atk:1,hp:1,maxHp:1,invoke:0,dr:null,ready:false,sick:true,terrified:false};
}

/* ---- scenarios (campaign stages, events, and later the joiner's room) ----
   Build a follower from a card id or a known token id, for pre-placed boards. */
const TOKEN_DEFS = {
  tok_spider:  {name:'Terror Spider', atk:1, hp:1, invoke:0, dr:null},
  tok_gspider: {name:'Giant Spider',  atk:2, hp:2, invoke:1, dr:'dr_dmg1'},
  tok_prophet: {name:'Prophet',       atk:1, hp:1, invoke:1, dr:null},
  tok_footnote:{name:'Footnote',      atk:1, hp:1, invoke:0, dr:null}
};
function scenarioUnit(cid){
  const c = CARDS[cid] || TOKEN_DEFS[cid] || {name:'?',atk:1,hp:1,invoke:0,dr:null};
  const atk=c.atk, hp=c.hp, inv=(c.inv!==undefined?c.inv:c.invoke);
  return {cid, name:c.name, atk, hp, maxHp:hp, invoke:inv||0, soloInv:c.soloInv||0, dr:c.dr||null,
          ready:false, sick:false, terrified:false, muted:false, paralysed:0};
}
/* apply a scenario's setup after standard init: pre-placed boards + stat tweaks.
   No-op for free play (no scenario / no setup). */
function applyScenario(scenario){
  if(!scenario || !scenario.setup) return;
  const sides = { you:G.players[0], foe:G.players[1] };
  for(const side in sides){
    const cfg = scenario.setup[side]; if(!cfg) continue;
    const p = sides[side];
    if(Array.isArray(cfg.board)){
      cfg.board.forEach(spec=>{
        if(spec && spec.node>=0 && spec.node<p.board.length && !p.board[spec.node]){
          p.board[spec.node] = scenarioUnit(spec.cid);
          const cd=CARDS[spec.cid]; if(cd && cd.lockNode && p.lockNode[spec.cid]===undefined) p.lockNode[spec.cid]=spec.node;
        }
      });
    }
    if(typeof cfg.hp==='number')     p.hp = cfg.hp;
    if(typeof cfg.invoke==='number') p.invoke = cfg.invoke;
    if(typeof cfg.mana==='number'){  p.mana = cfg.mana; p.maxMana = Math.max(p.maxMana, cfg.mana); }
    if(typeof cfg.summonLock==='number') p.summonLockTurns = cfg.summonLock; // AI holds its form until this turn passes
    if(Array.isArray(cfg.cast)) cfg.cast.forEach(fx=>resolveFx(fx, p));      // free spell effects resolved for this side at game start
  }
}

function summonAbstract(p){
  if(p.abstractUnit || p.invoke<p.summonCost || G.over) return;
  const a=ARCH[p.arch].abstract;
  p.invoke -= p.summonCost;
  p.summonCount++;
  p.abstractUnit = {name:a.name, hp:a.hp, maxHp:a.hp, isAbstract:true};
  log(`✦ ${a.name} TAKES FORM (${p.summonCost} essence${p.summonCount>1?', resummon '+p.summonCount:''}). ✦`,'sys');
  p.summonCost += SUMMON_STEP;
  const e=foe(p);
  if(p.arch==='fear'){
    let n=0;
    p.board.forEach((s,i)=>{ if(!s){ spawnSpider(p,i); n++; } });
    if(n) log(`${n} Terror Spider${n===1?'':'s'} crawl from the dark — the circle closes itself.`,'sys');
  }
  if(p.arch==='justice'){
    log('Day of Judgement: the aggressive punish themselves.','sys');
    unitRefs(e).reverse().forEach(r=>{ const u=getUnit(r); if(u.atk>0) damageUnit(r,u.atk); });
  }
  if(p.arch==='knowledge'){
    eachUnits(p,u=>{u.invoke+=1;});
    drawCards(p,1);
    log('Awakening: your followers gain +1 invoke value.','sys');
  }
  const cEl=document.querySelector(`#board-${p.isAI?'foe':'you'} .centre`);
  if(cEl){ cEl.classList.remove('summoned'); void cEl.offsetWidth; cEl.classList.add('summoned'); }
  renderAll();
}

/* active ability: once per turn, costs essence, requires the form */
function canUseAbility(p){
  const ab=ARCH[p.arch].abstract.ability;
  if(!p.abstractUnit || p.abilityUsed || p.invoke<ab.cost || G.over) return false;
  if(p.arch==='justice' && unitRefs(foe(p)).length===0) return false;
  if(p.arch==='fear' && !p.board.some(s=>!s)) return false;
  return true;
}
/* can this spell currently find a legal target? followers + targetless spells always 'yes'. */
function spellTargetable(p, c){
  if(!c || c.t!=='s' || !c.target) return true;
  if(c.target==='enemyUnit') return unitRefs(foe(p)).length>0;
  if(c.target==='friendUnit') return unitRefs(p).length>0;
  if(c.target==='emptyNode')  return p.board.length>4 && p.board.some(s=>!s);
  return true;
}
function useAbility(p){
  if(!canUseAbility(p)) return;
  const ab=ARCH[p.arch].abstract.ability;
  p.invoke -= ab.cost; p.abilityUsed = true;
  const e=foe(p);
  log(`${p.abstractUnit.name} channels ${ab.name} (${ab.cost} essence).`,'sys');
  if(p.arch==='fear'){
    const empty=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
    const i=empty[Math.floor(Math.random()*empty.length)];
    p.board[i]={cid:'tok_gspider',name:'Giant Spider',atk:2,hp:2,maxHp:2,invoke:1,dr:'dr_dmg1',ready:false,sick:true,terrified:false};
    log('A Giant Spider drags itself into the circle.','sys');
  }
  if(p.arch==='justice'){
    const refs=unitRefs(e);
    let best=refs[0]; refs.forEach(r=>{ if(getUnit(r).atk>getUnit(best).atk) best=r; });
    log(`${getUnit(best).name} is judged and destroyed.`,'sys');
    killUnit(best);
  }
  if(p.arch==='knowledge'){
    drawCards(p,2);
    if(diagramComplete(p)){
      gainInvoke(p,1); damageFace(e,1);
      log('The completed spiral hums — +1 essence, 1 damage.','sys');
    }
  }
  renderAll();
}

function endGame(winner){
  G.over=true;
  const ov=document.getElementById('over-overlay');
  ov.classList.remove('hidden');
  const won = winner===you();
  ov.classList.add(won?'win':'lose');
  if(won) ov.classList.add(ARCH[you().arch].css);   /* triumph wears your Abstract's colour */
  document.getElementById('over-title').textContent = won?'TRIUMPH':'UNDONE';
  const myArch = you().arch, foeName = ARCH[enemy().arch].name, scen = G.scenario;
  const camp = scen && scen.campaign;
  let text = won
    ? `${ARCH[myArch].name} prevails. The Adversary's concept dissolves back into the void it came from.`
    : `${foeName} overwhelms you. Your geometry lies dark and silent.`;
  /* campaign reward: only on a win, only the first time */
  let reward = null;
  if(won && camp && window.Account && window.Account.completeCampaignGame){
    try{ const res = window.Account.completeCampaignGame(camp.campId, camp.gameId, camp.reward) || {}; reward = res.newlyUnlocked || null; }catch(e){}
  }
  /* winning the LAST game of a campaign: congratulate on finishing it */
  if(won && camp && typeof CAMPAIGN==='object' && CAMPAIGN && CAMPAIGN[camp.campId]){
    const cd = CAMPAIGN[camp.campId], gs = cd.games||[];
    if(gs.length && gs[gs.length-1].id === camp.gameId) text += `  ✦ You have completed the ${cd.name} campaign! ✦`;
  }
  const txtEl = document.getElementById('over-text');
  txtEl.textContent = text;
  /* free-play, not signed in: nudge toward an account (lightly bolded under the outcome) */
  const oldNudge = document.getElementById('over-nudge'); if(oldNudge) oldNudge.remove();
  const signedIn = !!(window.Account && window.Account.user);
  if(!camp && !signedIn){
    const n = document.createElement('p');
    n.id = 'over-nudge'; n.className = 'over-nudge';
    n.textContent = 'Enjoying Abstracts? To get the full experience, Sign-in to unlock account progression, decks, new cards & more!';
    txtEl.insertAdjacentElement('afterend', n);
  }
  /* dynamic end-screen buttons; a reward reveal gates the return menu */
  const actions = document.getElementById('over-actions');
  if(actions){
    const hide=()=>{ ov.classList.add('hidden'); ov.classList.remove('win','lose','arch-fear','arch-justice','arch-knowledge'); };
    const mk=(label,primary,fn)=>{ const b=document.createElement('button'); b.className='btn'+(primary?' primary':''); b.textContent=label; b.addEventListener('click',fn); actions.appendChild(b); };
    const showReturn=()=>{
      actions.innerHTML='';
      if(camp){
        if(!won) mk('Try Again', true, ()=>{ hide(); newGame(myArch, scen); });
        mk('Return to campaign', won, ()=>{ hide(); if(typeof renderCampaignGames==='function') renderCampaignGames(camp.campId); showScreen('screen-campaign'); });
        mk('Return to main menu', false, ()=>{ hide(); showScreen('screen-home'); });
      } else {
        mk('Play again', true, ()=>{ hide(); newGame(myArch, scen); });
        mk('Return to main menu', false, ()=>{ hide(); showScreen('screen-home'); });
      }
    };
    if(reward){
      const cardHtml = (typeof cardTileHtml==='function') ? cardTileHtml(reward, true) : `<b>${(CARDS[reward] && CARDS[reward].name) || reward}</b>`;
      actions.innerHTML = `<div class="reward-reveal"><div class="reward-label">New card unlocked</div><div class="reward-card">${cardHtml}</div><button class="btn primary" id="reward-continue">Continue</button></div>`;
      const rc=document.getElementById('reward-continue'); if(rc) rc.addEventListener('click', showReturn);
    } else {
      showReturn();
    }
  }
}