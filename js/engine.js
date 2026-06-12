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
  if(G.turn===0) G.turnNo++;
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
  /* ready units; terror holds the stricken in place for this turn */
  eachUnits(p,u=>{
    u.ready=true; u.sick=false;
    if(u.terrified) u.ready=false;
  });
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
      log(`${ARCH.fear.abstract.name} radiates dread — 3 damage.`,'sys');
      damageFace(e,3);
      const refs=unitRefs(e).filter(r=>!getUnit(r).sick);
      const pool=refs.length?refs:unitRefs(e);
      if(pool.length && !G.over){
        const r=pool[Math.floor(Math.random()*pool.length)];
        const u=getUnit(r); u.terrified=true;
        log(`${u.name} is Terrified — it cannot act next turn.`,'sys');
      }
    }
    if(a==='justice'){
      if(unitRefs(e).length > unitRefs(p).length){
        const refs=unitRefs(e);
        const r=refs[Math.floor(Math.random()*refs.length)];
        log(`The scales tip — 2 damage to ${getUnit(r).name}.`,'sys');
        damageUnit(r,2);
      } else {
        log('The scales rest — JUSTICE restores 1 HP.','sys');
        healFace(p,1);
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
  /* terror releases its grip as the stricken player's turn ends */
  eachUnits(active(),u=>{ u.terrified=false; });
  clearSelection();
  G.turn = 1-G.turn;
  startTurn();
}

function playFollower(p, handIdx, nodeIdx){
  const cid = p.hand[handIdx], c = CARDS[cid];
  if(c.cost>p.mana || p.board[nodeIdx]) return false;
  p.mana -= c.cost; p.hand.splice(handIdx,1); p.used.push(cid);
  const u = {cid, name:c.name, atk:c.atk, hp:c.hp, maxHp:c.hp, invoke:c.inv,
             dr:c.dr||null, ready:false, sick:true, terrified:false};
  p.board[nodeIdx]=u;
  const fxKey = p.nodes[nodeIdx];
  log(`${p.name} play${p.isAI?'s':''} ${c.name} → ${NODE_FX[fxKey].txt}.`, p.isAI?'foe':'you');
  NODE_FX[fxKey].apply(G,p,u);
  if(c.fx) resolveFx(c.fx,p,null,u);
  renderAll(); return true;
}

function castSpell(p, handIdx, targetRef){
  const cid = p.hand[handIdx], c = CARDS[cid];
  if(c.cost>p.mana) return false;
  p.mana -= c.cost; p.hand.splice(handIdx,1); p.used.push(cid);
  const tgtTxt = targetRef && targetRef.zone!=='node' ? ` on ${getUnit(targetRef).name}` : '';
  log(`${p.name} cast${p.isAI?'s':''} ${c.name}${tgtTxt}.`, p.isAI?'foe':'you');
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
    case 'inv1': gainInvoke(p,1); break;
    case 'inv2': gainInvoke(p,2); break;
    case 'buffAlly': { const refs=unitRefs(p).filter(r=>getUnit(r)!==self);
      if(refs.length){ const r=refs[Math.floor(Math.random()*refs.length)]; const u=getUnit(r); u.atk+=1;u.hp+=1;u.maxHp+=1; log(`${u.name} gains +1/+1.`,'sys'); } break; }
    case 'dmg2': damageUnit(ref,2); break;
    case 'dmg3': damageUnit(ref,3); break;
    case 'chill': damageUnit(ref,2); gainInvoke(p,1); break;
    case 'surge': damageUnit(ref,4); drawCards(p,1); break;
    case 'atkDownAll': eachUnits(e,u=>{u.atk=Math.max(0,u.atk-1);}); log('All enemy followers lose 1 Attack.','sys'); break;
    case 'atkUpAll': eachUnits(p,u=>{u.atk+=1;}); log('Hysteria spreads — your followers gain +1 Attack.','sys'); break;
    case 'aoe2': unitRefs(e).reverse().forEach(r=>damageUnit(r,2)); break;
    case 'tribunal': unitRefs(e).reverse().forEach(r=>damageUnit(r,1)); healCore(p,3); break;
    case 'bless': { const u=getUnit(ref); u.atk+=2;u.hp+=2;u.maxHp+=2; break; }
    case 'sacrifice': { const u=getUnit(ref); const gain=u.invoke+2; killUnit(ref); gainInvoke(p,gain); log(`The rite yields ${gain} essence.`,'sys'); break; }
    case 'veil': eachUnits(p,u=>{u.hp+=2;u.maxHp+=2;}); log('A veil of theory settles — your followers gain +0/+2.','sys'); break;
    case 'twinProphets': {
      const n=p.board.length; let spots=null;
      for(let i=0;i<n;i++){ if(!p.board[i] && !p.board[(i+1)%n]){ spots=[i,(i+1)%n]; break; } }
      if(!spots) spots = p.board.map((s,i)=>s?null:i).filter(i=>i!==null).slice(0,2);
      spots.forEach(i=>{ p.board[i]={cid:'tok_prophet',name:'Prophet',atk:1,hp:1,maxHp:1,invoke:1,dr:null,ready:false,sick:true,terrified:false}; });
      log(spots.length?`${spots.length===2?'Two Prophets step':'A Prophet steps'} through, already in chorus.`:'No room — the prophecy fizzles.','sys');
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

/* invoking demands connection: only a linked follower may channel */
function invokeWith(p,ref){
  const u=getUnit(ref); if(!u||!u.ready||!u.invoke) return;
  if(!linkedAt(p,ref.idx)) return;
  u.ready=false;
  gainInvoke(p,u.invoke);
  floatNum(unitEl(ref), u.invoke, true, 'var(--invoke)');
  log(`${u.name} invokes (+${u.invoke}) — ${p.invoke} essence.`, p.isAI?'foe':'you');
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
  p.board[nodeIdx]={cid:'tok_spider',name:'Terror Spider',atk:1,hp:1,maxHp:1,invoke:1,dr:null,ready:false,sick:true,terrified:false};
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
  const cEl=document.querySelector(`#board-${p.isAI?'foe':'you'} .centre`); if(cEl) cEl.classList.add('summoned');
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
  document.getElementById('over-title').textContent = won?'TRIUMPH':'UNDONE';
  document.getElementById('over-text').textContent = won
    ? `${ARCH[you().arch].name} prevails. The Adversary's concept dissolves back into the void it came from.`
    : `${ARCH[enemy().arch].name} overwhelms you. Your geometry lies dark and silent.`;
}
