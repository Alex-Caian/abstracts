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

/* possessive for log lines: "your" for the human seat, "<Name>'s" otherwise (never "You's") */
function whose(p, cap){ return p===G.players[0] ? (cap?'Your':'your') : p.name+"'s"; }
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
      if(!silent) log(`${whose(p,true)} hand is full — ${CARDS[c].name} is forgotten.`, p.isAI?'foe':'you');
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
    if(formGuarded(p)){ log(`${u.name} is shielded by its followers. No damage.`,'sys'); return; }
    u.hp -= n;
    floatNum(document.querySelector(`#board-${side} .centre`), -n, true);
    if(typeof playCentreFx==='function') playCentreFx(side, 'hit', 1100);   // the form shudders when it is struck, and only then
    if(u.hp<=0){
      p.abstractUnit=null;
      if(p.formTimer){ p.formTimer.left = p.formTimer.every; log(`${u.name} is unmade! It will take form again in ${p.formTimer.every} turns.`,'sys'); }
      else log(`${u.name} is unmade! ${p.name} ${p.isAI?'stands':'stand'} exposed — it may take form again for ${p.summonCost} essence.`,'sys');
    }
    return;
  }
  p.hp -= n;
  floatNum(document.getElementById('strip-'+side), -n);
  checkSenthsWatch(); checkArcanaWatch();
  if(p.hp<=0 && !G.over) endGame(foe(p));
}

function damageUnit(ref,n){
  const u = getUnit(ref); if(!u) return;
  u.preHp = u.hp;   // Health just before this hit (Time Borrower banks it on death)
  u.hp -= n;
  floatNum(unitEl(ref), -n, true);
  if(u.hp<=0) killUnit(ref);
}

/* Senths (her first body only): however she leaves a board (death, transformation or theft), a Hellspawn takes
   her node. It fires once: a Senths that has already left a board carries no cascade with her. The caller must
   have vacated the node first. */
function leavesBoard(p, idx, u){
  if(!u || u.dr!=='dr_senths') return false;
  u.dr = null;
  spawnToken(p, idx, 'tok_hellspawn');
  log(`${u.name} is gone, and a Hellspawn tears free.`, p.isAI?'foe':'you');
  return true;
}
function killUnit(ref){
  const p = G.players[ref.pi];
  const u = getUnit(ref); if(!u) return;
  u.lastHp = u.hp>0 ? u.hp : (u.preHp||0);   // destroyed outright: current HP; killed by damage: HP before the killing blow
  p.board[ref.idx]=null;
  log(`${u.name} falls.`, p.isAI?'foe':'you');
  if(u.dr==='dr_dmg2'){ log(`${u.name}'s death curse strikes for 2.`, p.isAI?'foe':'you'); damageFace(foe(p),2); }
  if(u.dr==='dr_dmg1'){ log(`${u.name} bursts — 1 damage.`, p.isAI?'foe':'you'); damageFace(foe(p),1); }
  if(u.dr==='dr_growdraw'){ const n=u.atk>=3?2:1; log(`${u.name} bursts with growth — draw ${n}.`, p.isAI?'foe':'you'); drawCards(p,n); }
  if(u.curses && u.curses.length) drawCards(foe(p), u.curses.length);   // Tainted Dreams: dying pays out each remaining curse to the caster
  /* Senths' apparition cascade: each corpse births the next horror on its vacated node */
  leavesBoard(p, ref.idx, u);   // Senths: a Hellspawn takes her node however she left
  if(u.dr==='dr_hellspawn'){ spawnToken(p, ref.idx, 'tok_endspawn'); log(`The Hellspawn ruptures — an Endspawn crawls out.`, p.isAI?'foe':'you'); }
  if(u.dr==='dr_endspawn'){
    gainInvoke(p,4);
    let empt=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
    for(let k=0;k<3 && empt.length;k++){ const pick=empt.splice(Math.floor(Math.random()*empt.length),1)[0]; spawnToken(p,pick,'tok_spiderling'); }
    const eu=unitRefs(foe(p)); if(eu.length) damageUnit(eu[Math.floor(Math.random()*eu.length)],2);
    const au=unitRefs(p); if(au.length){ const a=getUnit(au[Math.floor(Math.random()*au.length)]); if(a) a.atk+=1; }
    log(`The Endspawn's death floods the circle — spiders swarm, essence gathers, and one grows hungrier.`, p.isAI?'foe':'you');
  }
  if(u.borrowed) returnBorrowed(p, ref.idx, u);   // Time Borrower: the hidden follower steps back out
}

/* ---- Time Borrower (replace:true followers): played onto a friendly follower,
   which is hidden "in another realm" until the Borrower dies. ---- */
function canPlayFollower(p, c){
  if(!c || c.t!=='f') return false;
  return c.replace ? unitRefs(p).length>0 : (p.board.some(s=>!s) || absorbNodes(p).length>0);
}
/* Absorb (a scenario Boon, e.g. the finale's "For dread"): with no node free, this side may play a follower onto
   one of its own tokens of the named kind. The token is consumed (not a death); the newcomer gains nothing extra. */
function absorbToken(p){ const b=boonsFor(p).find(bn=>bn && bn.absorb); return b ? b.absorb : null; }
function absorbNodes(p){
  const tok=absorbToken(p);
  if(!tok || p.board.some(s=>!s)) return [];   // only once the diagram is full
  return p.board.map((u,i)=>(u && u.cid===tok) ? i : null).filter(i=>i!==null);
}
/* hide a follower: out of play, its timed statuses gone */
function stowUnit(u){
  u.ready=false; u.sick=false; u.terrified=false; u.muted=false; u.paralysed=0; u.curses=[]; u.doomBy=null;
  return u;
}
/* the Borrower died: its hidden follower returns (resting) with +Attack/+Health equal to the Borrower's last stats */
function returnBorrowed(p, idx, carrier){
  const b = carrier.borrowed; carrier.borrowed = null;
  if(!b) return;
  const da = Math.max(0, carrier.atk||0), dh = Math.max(0, carrier.lastHp||0);
  b.atk += da; b.hp += dh; b.maxHp += dh;
  b.ready = false; b.sick = true;
  let at = idx;
  if(p.board[at]){ at = p.board.findIndex(s=>!s); }
  if(at<0){ log(`${b.name} is lost in borrowed time — there is no room to return.`, p.isAI?'foe':'you'); return; }
  p.board[at] = b;
  log(`${b.name} steps back out of borrowed time — +${da}/+${dh}.`, p.isAI?'foe':'you');
}

/* ---- campaign Boons: persistent per-side modifiers, shown on the playmat.
   scenario.boons = { foe:[{title,text,turnStart?:{essence,mana,draw,hp}}], you:[…] }.
   A boon with no turnStart is flavour-only (display only). ---- */
function boonsFor(p){
  const b = G && G.scenario && G.scenario.boons;
  if(!b) return [];
  return (p.isAI ? b.foe : b.you) || [];
}
/* one boon effect (shared by passive turn-start boons and active, paid boons).
   fields: essence, mana, draw, hp (+ hpCap), dmgFoeUnit, buffAll:{atk,hp} */
function applyBoonEffect(p, eff){
  if(!eff) return;
  if(eff.essence) gainInvoke(p, eff.essence);
  if(eff.mana)    p.mana += eff.mana;
  if(eff.draw)    drawCards(p, eff.draw);
  if(eff.hp){ p.hp += eff.hp; if(eff.hpCap) p.hp = Math.min(p.hp, eff.hpCap); }
  if(eff.dmgFoeUnit){ const refs=unitRefs(foe(p)); if(refs.length){ const r=refs[Math.floor(Math.random()*refs.length)]; log(`${p.name} smites ${getUnit(r).name} — ${eff.dmgFoeUnit} damage.`, p.isAI?'foe':'you'); damageUnit(r, eff.dmgFoeUnit); } }
  if(eff.buffAll){ const da=eff.buffAll.atk||0, dh=eff.buffAll.hp||0; eachUnits(p,u=>{ u.atk+=da; u.hp+=dh; u.maxHp+=dh; }); }
  if(eff.spawnBonus){   // Coalesce: every turnSpawn token from now on arrives +N/+N (stacks)
    p.spawnBonus = (p.spawnBonus||0) + eff.spawnBonus;
    log(`The brood coalesces — ${p.name===G.players[0].name?'your':p.name+"'s"} spawns now arrive +${p.spawnBonus}/+${p.spawnBonus}.`, p.isAI?'foe':'you');
  }
  if(eff.execute){   // Execution: sentence the strongest unsentenced enemy follower — it dies when p's next turn begins
    const refs=executionTargets(p);
    if(refs.length){
      refs.sort((a,b)=>(getUnit(b).atk-getUnit(a).atk)||(getUnit(b).hp-getUnit(a).hp));
      const u=getUnit(refs[0]); u.doomBy=G.players.indexOf(p);
      log(`${u.name} is sentenced — it will die when ${p.name===G.players[0].name?'your':p.name+"'s"} next turn begins.`, p.isAI?'foe':'you');
    }
  }
}
/* enemy followers not already under p's sentence */
function executionTargets(p){ const pi=G.players.indexOf(p); return unitRefs(foe(p)).filter(r=>getUnit(r).doomBy!==pi); }
/* at p's turn start: carry out p's sentences on the enemy board */
function carryOutSentences(p){
  const pi=G.players.indexOf(p);
  unitRefs(foe(p)).forEach(ref=>{
    if(G.over) return;
    const u=getUnit(ref);
    if(u && u.doomBy===pi){ log(`The sentence is carried out — ${u.name} is executed.`, p.isAI?'foe':'you'); killUnit(ref); }
  });
}
/* Sentinels: each follower with strike:N deals N to the enemy follower with the highest Attack (ties: random) */
function sentinelStrikes(p){
  unitRefs(p).forEach(ref=>{
    if(G.over) return;
    const s=getUnit(ref); if(!s || !s.strike) return;
    const tgts=unitRefs(foe(p)); if(!tgts.length) return;
    const top=Math.max(...tgts.map(r=>getUnit(r).atk));
    const pool=tgts.filter(r=>getUnit(r).atk===top);
    const r=pool[Math.floor(Math.random()*pool.length)];
    log(`${s.name} strikes ${getUnit(r).name} — ${s.strike} damage.`, p.isAI?'foe':'you');
    damageUnit(r, s.strike);
  });
}
function applyTurnStartBoons(p){
  boonsFor(p).forEach(bn=>{ if(bn && bn.turnStart) applyBoonEffect(p, bn.turnStart); });
}
/* a static per-follower buff Boon (e.g. Justice's "followers are permanently +1/+1") */
function applyFollowerBuff(p, u){
  boonsFor(p).forEach(bn=>{ const fb=bn && bn.followerBuff; if(!fb) return; u.atk+=fb.atk||0; u.hp+=fb.hp||0; u.maxHp+=fb.hp||0; });
}
/* AI-side: fire each affordable active Boon once per turn (banked essence pays for it) */
function activateBoons(p){
  boonsFor(p).forEach(bn=>{
    const a = bn && bn.active; if(!a) return;
    const cost = boonCost(p, bn); if(p.invoke < cost) return;
    const worthHeal = a.hp && (!a.hpCap || p.hp < a.hpCap);
    const worthBuff = a.buffAll && unitRefs(p).length>0;
    const worthExec = a.execute && executionTargets(p).length>0;
    if(!(worthHeal || worthBuff || worthExec || a.spawnBonus || a.essence || a.draw || a.dmgFoeUnit)) return;
    p.invoke -= cost;
    p.boonUses = p.boonUses || {}; p.boonUses[bn.title] = (p.boonUses[bn.title]||0) + 1;
    log(`${p.name} channels ${bn.title} (${cost} essence).`, p.isAI?'foe':'you');
    applyBoonEffect(p, a);
  });
}
/* an active Boon's current price: base cost, +costStep for every previous use (e.g. Coalesce 3 → 5 → 7…) */
function boonCost(p, bn){
  const a = bn && bn.active; if(!a) return 0;
  const n = (p.boonUses && p.boonUses[bn.title]) || 0;
  return a.cost + (a.costStep||0)*n;
}
/* per-turn spawn Boons (The Brood): after the communion check, so a spawn never completes the circle the same turn;
   spawnToken places it resting, and nothing arrives if the diagram is full */
function spawnTurnBoons(p){
  boonsFor(p).forEach(bn=>{
    if(!bn || !bn.turnSpawn || G.over) return;
    const idx = spawnToken(p, null, bn.turnSpawn);
    if(idx==null) return;
    const u = p.board[idx], b = p.spawnBonus||0;
    u.atk += b; u.hp += b; u.maxHp += b;
    log(`A ${u.name} (${u.atk}/${u.hp}) crawls into ${p.name===G.players[0].name?'your':p.name+"'s"} circle.`, p.isAI?'foe':'you');
  });
}
function startTurn(){
  const p = active();
  if(G.turn===(G.first||0)) G.turnNo++;   // a new round begins when the first player's turn comes round
  p.maxMana = Math.min(MAX_MANA, p.maxMana+1);
  p.mana = p.maxMana;
  p.abilityUsed = false;
  p.mirror = false;   // Mirror Display lasts until its caster's next turn begins
  applyTurnStartBoons(p);   // campaign Boons: per-side turn-start modifiers
  /* the long duel: from turn 25, reality reasserts itself — the core
     decays at each turn start, harder every turn, bypassing the form */
  if(G.turnNo>=DECAY_START){
    const decay=G.turnNo-DECAY_START+1;
    p.hp -= decay;
    floatNum(document.getElementById('strip-'+(p.isAI?'foe':'you')), -decay);
    log(`Reality reasserts itself — ${p.name===G.players[0].name?'your':p.name+"'s"} core decays by ${decay}.`,'sys');
    if(p.hp<=0 && !G.over){ endGame(foe(p)); return; }
  }
  carryOutSentences(p);   // Execution: sentences passed last turn fall as this turn begins
  if(G.over) return;
  /* ready units; terror and paralysis hold the stricken in place this turn */
  eachUnits(p,u=>{
    u.ready=true; u.sick=false;
    if(u.grow) u.atk += u.grow;   // self-growing followers (Growth Spider) swell each turn they begin on the board
    if(u.terrified || u.paralysed>0) u.ready=false;
  });
  /* paralysis: the stricken take 1 damage at turn start and count down */
  unitRefs(p).forEach(ref=>{
    if(G.over) return;
    const u=getUnit(ref);
    if(u && u.paralysed>0){ u.paralysed--; damageUnit(ref,1); }
  });
  if(G.over) return;
  /* Tainted Dreams: each stack bleeds 1 at turn start and draws a card for the caster when it wears off (or on death — see killUnit) */
  unitRefs(p).forEach(ref=>{
    if(G.over) return;
    const u=getUnit(ref);
    if(u && u.curses && u.curses.length){
      damageUnit(ref, u.curses.length);                 // 1 per stack; a kill here draws the remaining stacks via killUnit
      const still=getUnit(ref);
      if(still && still.curses){
        still.curses = still.curses.map(c=>c-1);
        const expired = still.curses.filter(c=>c<=0).length;
        still.curses = still.curses.filter(c=>c>0);
        if(expired) drawCards(foe(p), expired);
      }
    }
  });
  if(p.coreCurses && p.coreCurses.length){
    const n=p.coreCurses.length;
    log(`Tainted Dreams gnaws at ${whose(p)} abstract — ${n} damage.`, p.isAI?'foe':'you');
    damageFace(p,n);
    p.coreCurses = p.coreCurses.map(c=>c-1);
    const expired = p.coreCurses.filter(c=>c<=0).length;
    p.coreCurses = p.coreCurses.filter(c=>c>0);
    if(expired) drawCards(foe(p), expired);
    if(p.hp<=0 && !G.over){ endGame(foe(p)); return; }
  }
  if(G.over) return;
  sentinelStrikes(p);   // Sentinels strike the enemy's strongest follower
  if(G.over) return;
  /* communion: the completed circle channels — +1 essence per follower */
  if(diagramComplete(p) && !p.noEssence){
    const n=p.board.length;
    gainInvoke(p,n);
    log(`The ${ARCH[p.arch].geoName} stands complete — the circle channels +${n} essence.`,'sys');
    const cEl=document.querySelector(`#board-${p.isAI?'foe':'you'} .centre`);
    if(cEl) floatNum(cEl, n, true, 'var(--invoke)');
  }
  spawnTurnBoons(p);   // e.g. The Brood — after communion, arriving resting
  /* aura — only while the form is manifested */
  if(p.abstractUnit && !G.over){
    const a=p.arch, e=foe(p);
    if(a==='fear'){
      log(`${ARCH.fear.abstract.name} radiates dread — 2 damage.`,'sys');
      damageFace(e,2);
      const refs=unitRefs(e).filter(r=>!getUnit(r).sick);
      const pool=refs.length?refs:unitRefs(e);
      if(pool.length && !G.over && !p.noTerrify){
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
  tickFormTimer(p);   // scenario countdown: the form arrives by itself (after the aura, so its aura starts next turn)
  if(G.over) return;
  drawCards(p,1);
  log(`— Turn ${G.turnNo}: ${p.name} (${p.mana} mana) —`, p.isAI?'foe':'you');
  checkSenthsWatch(); checkArcanaWatch();
  clearSelection(); renderAll();
  if(p.isAI) aiTurn(p);
}

function endTurn(){
  if(G.over) return;
  /* terror and phobia release their grip as the stricken player's turn ends */
  eachUnits(active(),u=>{ u.terrified=false; u.muted=false; });
  fadeIllusions(active());   // Dimensional Illusions count down at the end of their owner's turn
  clearSelection();
  G.turn = 1-G.turn;
  startTurn();
}

function playFollower(p, handIdx, nodeIdx){
  const cid = p.hand[handIdx], c = CARDS[cid];
  const under = p.board[nodeIdx];
  if(c.cost>p.mana) return false;
  const absorbing = !c.replace && !!under && absorbNodes(p).includes(nodeIdx);   // a full board may absorb one of its own tokens
  if(c.replace ? !under : (!!under && !absorbing)) return false;   // replace-followers (Time Borrower) need a friendly follower; others an empty node
  p.mana -= c.cost; p.hand.splice(handIdx,1);
  if(!c.apparition) p.used.push(cid);   /* apparitions never recycle: spent forever once played */
  const u = {cid, name:c.name, atk:c.atk, hp:c.hp, maxHp:c.hp, invoke:c.inv,
             soloInv:c.soloInv||0, dr:c.dr||null, grow:c.grow||0, strike:c.strike||0, ward:c.ward?1:0, ready:false, sick:true, terrified:false, muted:false, paralysed:0, curses:[]};
  applyFollowerBuff(p, u);   // static Boon buffs (e.g. Justice's permanent +1/+1)
  if(c.replace){ u.borrowed = stowUnit(under); log(`${under.name} slips into borrowed time, hidden beneath ${c.name}.`,'sys'); }
  p.board[nodeIdx]=u;
  if(c.lockNode && p.lockNode[cid]===undefined){ p.lockNode[cid]=nodeIdx; log(`${c.name} consecrates this seat — its kind may invoke only here.`,'sys'); }
  const fxKey = p.nodes[nodeIdx];
  log(`${p.name} play${p.isAI?'s':''} ${c.name} → ${nodeText(p,nodeIdx)}.`, p.isAI?'foe':'you');
  if(c.apparition) log(`${c.name} fades from the cycle — an apparition is seen but once.`,'sys');
  NODE_FX[fxKey].apply(G,p,u);
  if(absorbing) log(`${c.name} absorbs the ${under.name} and takes its node.`, p.isAI?'foe':'you');
  nodeExtras(p,nodeIdx).forEach(k=>NODE_EXTRA[k].apply(u));   // Ancient Arcana's extra node bonuses
  if(c.fx) resolveFx(c.fx,p,null,u);
  renderAll(); return true;
}

function castSpell(p, handIdx, targetRef){
  const cid = p.hand[handIdx], c = CARDS[cid];
  if(c.cost>p.mana) return false;
  p.mana -= c.cost; p.hand.splice(handIdx,1);
  if(!c.apparition) p.used.push(cid);   /* apparitions never recycle: spent forever once played */
  p.spellsSeen = p.spellsSeen || []; if(!p.spellsSeen.includes(cid)) p.spellsSeen.push(cid);   // different spells cast; recorded before resolving, so a spell counts itself
  const tgtTxt = targetRef && targetRef.zone==='board' ? ` on ${getUnit(targetRef).name}` : (targetRef && targetRef.zone==='hero' ? ' on the enemy abstract' : '');
  log(`${p.name} cast${p.isAI?'s':''} ${c.name}${tgtTxt}.`, p.isAI?'foe':'you');
  if(c.apparition) log(`${c.name} fades from the cycle — an apparition is seen but once.`,'sys');
  /* Ward: the first enemy spell that targets a warded follower is undone (the card is still spent) */
  const wt = (targetRef && targetRef.zone==='board') ? getUnit(targetRef) : null;
  if(wt && wt.ward && targetRef.pi!==G.players.indexOf(p)){
    wt.ward = 0;
    log(`${wt.name}'s ward shatters. The spell is undone.`,'sys');
    renderAll(); return true;
  }
  resolveFx(c.fx,p,targetRef);
  renderAll(); return true;
}

/* Redaction / Amnesia: EVERY player shuffles up to n random cards from hand back into their deck */
function shuffleHandBack(n){
  G.players.forEach(pl=>{
    let moved=0;
    for(let k=0;k<n && pl.hand.length;k++){ const i=Math.floor(Math.random()*pl.hand.length); pl.deck.push(pl.hand.splice(i,1)[0]); moved++; }
    if(moved){ shuffle(pl.deck); log(`${pl===G.players[0]?'You':pl.name} shuffle${pl.isAI?'s':''} ${moved} card${moved===1?'':'s'} back into the litany.`, pl.isAI?'foe':'you'); }
  });
}
function resolveFx(fx,p,ref,self){
  const e = foe(p);
  switch(fx){
    case 'mirror': { p.mirror = true; log(`A Mirror Display rises. Until ${p===G.players[0]?'your':p.name+"'s"} next turn, any follower that attacks also strikes itself.`,'sys'); break; }
    case 'arcana': {   // apparition: its gift depends on how many times its caster has summoned their form
      const n = p.summonCount||0;
      if(n===0){                                  // make a wish (the player picks; the AI heals when hurt, else takes essence)
        let w = ref && ref.wish;
        if(!w) w = p.hp<=20 ? 'heal' : 'essence';
        if(w==='damage' && !(ref && ref.zone==='board' && getUnit(ref))) w='essence';
        if(w==='heal'){ healCore(p,5); log('A wish is granted: 5 HP restored to the core.','sys'); }
        else if(w==='damage'){ log(`A wish is granted: ${getUnit(ref).name} takes 5 damage.`,'sys'); damageUnit(ref,5); }
        else { gainInvoke(p,5); log('A wish is granted: 5 essence.','sys'); }
        p.mana += 1;
      } else if(n===1){ arcanaReshape(p); }
      else if(p.abstractUnit){ p.abstractUnit.hp = p.abstractUnit.maxHp; log(`${p.abstractUnit.name} is made whole again.`,'sys'); }
      else summonAbstract(p, 'the apparition answers');
      break; }
    case 'illusion': {
      const n = nodesRemoved(p), x = illusionSize(p);
      if(!ref || ref.zone!=='node' || p.board[ref.idx] || n<=0){ log('The illusion finds no foothold and fades.','sys'); break; }
      const u = p.board[spawnToken(p, ref.idx, 'tok_illusion')];
      u.atk = x; u.hp = 2*x; u.maxHp = 2*x; u.vanish = n; u.vanishFresh = true;   // fixed at cast; arrives resting
      log(`A Dimensional Illusion takes shape: ${x}/${2*x}, for ${n} turn${n===1?'':'s'}.`,'sys');
      break; }
    case 'shuffle2': shuffleHandBack(2); break;
    case 'shuffle3': shuffleHandBack(3); break;
    case 'summon4spiders': { for(let k=0;k<4;k++){ if(spawnToken(p,null,'tok_spider')==null) break; } break; }
    case 'summonGargantuan': spawnToken(p,null,'tok_gargantuan'); break;
    case 'webspin': { if(ref && ref.zone==='bond' && ref.a!==ref.b){ p.bonds=p.bonds||[]; p.bonds.push({a:ref.a,b:ref.b}); log('A web is spun — two nodes are bonded for the rest of the duel.','sys'); } break; }
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
        if(roll===1||roll===2){ u.preHp=u.hp; u.hp-=1; if(u.maxHp>1) u.maxHp-=1; }
        if(u.hp<=0) killUnit(r);
      });
      log('Mass hysteria sweeps the enemy ranks — they falter at random.','sys'); break; }
    case 'muteInvoke': { const refs=unitRefs(e); if(refs.length){ const r=refs[Math.floor(Math.random()*refs.length)]; const u=getUnit(r); u.muted=true; log(`${u.name} is gripped by phobia — it cannot invoke next turn.`,'sys'); } break; }
    case 'aoe2': unitRefs(e).reverse().forEach(r=>damageUnit(r,2)); break;
    case 'retribution': { for(let n=0;n<3;n++){ const refs=unitRefs(e); if(!refs.length) break; damageUnit(refs[Math.floor(Math.random()*refs.length)],1); } log('Retribution scatters among the enemy ranks.','sys'); break; }
    case 'tribunal': unitRefs(e).reverse().forEach(r=>damageUnit(r,1)); healFace(p,2); break;
    case 'paralyse': { const u=getUnit(ref); if(u){ u.paralysed=2; log(`${u.name} is Terrified for 2 turns — and bleeds 1 each turn.`,'sys'); } break; }
    case 'curse': {
      if(ref && ref.zone==='hero'){ const tp=G.players[ref.pi]; (tp.coreCurses=tp.coreCurses||[]).push(3); log(`${whose(tp,true)} abstract sinks into Tainted Dreams — it will bleed for 3 turns.`,'sys'); }
      else if(ref){ const u=getUnit(ref); if(u){ (u.curses=u.curses||[]).push(3); log(`${u.name} sinks into Tainted Dreams — it will bleed for 3 turns.`,'sys'); } }
      break;
    }
    case 'chessMove': {
      /* 1. steal the follower on the enemy front node (index 0) if you have room */
      const front = e.board[0];
      if(front){
        const free = p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
        if(free.length){
          e.board[0] = null;
          leavesBoard(e, 0, front);   // a stolen Senths leaves a Hellspawn behind
          front.sick=true; front.ready=false; front.terrified=false; front.muted=false; front.paralysed=0; front.doomBy=null;
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
      const tp=G.players[ref.pi];
      if(u.dr==='dr_senths'){ tp.board[ref.idx]=null; leavesBoard(tp, ref.idx, u); }   // she cannot be unwritten: the Hellspawn takes her place
      else {
        tp.board[ref.idx]={cid:'tok_footnote',name:'Footnote',atk:1,hp:1,maxHp:1,invoke:0,dr:null,ready:false,sick:false,terrified:false};
        log(`${u.name} is reduced to a footnote.`,'sys');
      }
      if(u.borrowed) log(`${u.borrowed.name}, hidden in borrowed time, is lost with it.`,'sys'); } break; }
    case 'distil': if(ref && ref.zone==='node') removeNode(p, ref.idx); break;
  }
}

/* Distillation: dissolve an empty node — its neighbours join, the
   polygon re-forms one side smaller. Floor: 4 nodes. */
/* ---- extra node bonuses (Ancient Arcana's second gift): stacked on top of a node's own bonus ---- */
const NODE_EXTRA = {
  atk:{txt:'+1 Attack',       apply:u=>{ u.atk+=1; }},
  hp: {txt:'+1 Health',       apply:u=>{ u.hp+=1; u.maxHp+=1; }},
  inv:{txt:'+1 Invoke value', apply:u=>{ u.invoke+=1; }}
};
function nodeExtras(p,i){ return (p.nodeExtras && p.nodeExtras[i]) || []; }
/* what a node grants, extras included (for logs and tooltips) */
function nodeText(p,i){ return [NODE_FX[p.nodes[i]].txt].concat(nodeExtras(p,i).map(k=>NODE_EXTRA[k].txt)).join(' & '); }
/* Ancient Arcana, summoned once before: a random EMPTY node leaves the diagram (never below 4, never an occupied one),
   then every remaining node gains a random extra bonus, applied at once to any follower standing on it */
function arcanaReshape(p){
  const empt=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
  if(p.board.length>4 && empt.length) removeNode(p, empt[Math.floor(Math.random()*empt.length)]);
  else log('No node can be spared, so the diagram keeps its shape.','sys');
  p.nodeExtras = p.nodeExtras || [];
  while(p.nodeExtras.length<p.nodes.length) p.nodeExtras.push([]);
  const keys=Object.keys(NODE_EXTRA);
  p.nodes.forEach((_,i)=>{ const k=keys[Math.floor(Math.random()*keys.length)]; p.nodeExtras[i].push(k); const u=p.board[i]; if(u) NODE_EXTRA[k].apply(u); });
  log(`Every node of ${whose(p)} diagram gains a new bonus.`,'sys');
  buildBoards();
}
function removeNode(p, idx){
  if(p.board.length<=4 || p.board[idx]) return false;
  const bonus=nodeText(p,idx);
  p.nodes.splice(idx,1);
  p.board.splice(idx,1);
  if(p.nodeExtras) p.nodeExtras.splice(idx,1);   // extra node bonuses stay aligned with their nodes
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
  if(p.noEssence) return;   // scenario: this side gathers no essence at all
  const before=p.invoke;
  p.invoke += n;
  if(!p.abstractUnit && before<p.summonCost && p.invoke>=p.summonCost)
    log(`${p.name} ${p.isAI?'has':'have'} gathered enough essence to summon ${ARCH[p.arch].abstract.name} (${p.summonCost}).`,'sys');
}

/* effective invoke: a solitary channeler (soloInv) inverts the rule — it
   channels only while UNLINKED, for its solo value; otherwise nothing. */
/* Web-spinning bonds: nodes bonded to idx that currently hold a follower */
function bondPartners(p, idx){
  const out=[];
  (p.bonds||[]).forEach(b=>{ if(b.a===idx) out.push(b.b); else if(b.b===idx) out.push(b.a); });
  return out;
}
function bondInvokeBonus(p, idx){ let s=0; bondPartners(p,idx).forEach(i=>{ const u=p.board[i]; if(u) s+=u.invoke; }); return s; }
function bondAtkBonus(p, idx){    let s=0; bondPartners(p,idx).forEach(i=>{ const u=p.board[i]; if(u) s+=u.atk;    }); return s; }
function effInvoke(p,u,idx){
  const base = u.soloInv ? (linkedAt(p,idx) ? 0 : (u.invoke + u.soloInv)) : u.invoke;
  return base + bondInvokeBonus(p,idx);   // the web echoes the bonded node's follower
}
/* may this unit channel right now? muted blocks it; normal units need a
   link, solitary channelers need solitude. */
function canChannel(p,u,idx){
  if(!u || u.muted || p.noEssence) return false;
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
  if(targetRef.zone==='hero' && formGuarded(G.players[targetRef.pi])) return;   // a guarded form cannot be attacked
  a.ready=false;
  const dmg = a.atk + bondAtkBonus(p, attRef.idx);   // web echo: the bonded node's follower strikes the same target
  if(targetRef.zone==='hero'){
    const t=G.players[targetRef.pi];
    const tgt = t.abstractUnit ? t.abstractUnit.name : `${whose(t)} core`;
    log(`${a.name} strikes ${tgt} for ${dmg}.`, p.isAI?'foe':'you');
    damageFace(t,dmg);
  } else {
    const d=getUnit(targetRef);
    log(`${a.name} (${dmg}) clashes with ${d.name} (${d.atk}).`, p.isAI?'foe':'you');
    a.preHp = a.hp;
    a.hp -= d.atk;
    floatNum(unitEl(attRef), -d.atk, true);
    damageUnit(targetRef, dmg);
    if(a.hp<=0) killUnit(attRef);
  }
  /* Mirror Display: while the defender's mirror stands, an attacker that survived the exchange also takes its own Attack */
  if(!G.over && foe(p).mirror && getUnit(attRef)===a && a.atk>0){
    log(`${a.name} is struck by its own reflection: ${a.atk} damage.`, p.isAI?'foe':'you');
    damageUnit(attRef, a.atk);
  }
  renderAll();
}

function spawnSpider(p, nodeIdx){
  p.board[nodeIdx]={cid:'tok_spider',name:'Terror Spider',atk:1,hp:1,maxHp:1,invoke:0,dr:null,ready:false,sick:true,terrified:false};
}
/* place a TOKEN_DEFS token, sick, on nodeIdx (or the first empty node if that's taken) */
function spawnToken(p, nodeIdx, tokId){
  if(nodeIdx==null || nodeIdx<0 || nodeIdx>=p.board.length || p.board[nodeIdx]){
    const empt=p.board.map((s,i)=>s?null:i).filter(i=>i!==null);
    if(!empt.length) return null;
    nodeIdx=empt[0];
  }
  const d=TOKEN_DEFS[tokId]||{name:'?',atk:1,hp:1,invoke:0,dr:null};
  p.board[nodeIdx]={cid:tokId,name:d.name,atk:d.atk,hp:d.hp,maxHp:d.hp,invoke:d.invoke||0,soloInv:0,dr:d.dr||null,grow:0,ready:false,sick:true,terrified:false,muted:false,paralysed:0,curses:[]};
  return nodeIdx;
}

/* ---- scenarios (campaign stages, events, and later the joiner's room) ----
   Build a follower from a card id or a known token id, for pre-placed boards. */
const TOKEN_DEFS = {
  tok_spider:  {name:'Terror Spider', atk:1, hp:1, invoke:0, dr:null},
  tok_gspider: {name:'Giant Spider',  atk:2, hp:2, invoke:1, dr:'dr_dmg1'},
  tok_prophet: {name:'Prophet',       atk:1, hp:1, invoke:1, dr:null},
  tok_footnote:{name:'Footnote',      atk:1, hp:1, invoke:0, dr:null},
  tok_hellspawn:{name:'Hellspawn',    atk:4, hp:5, invoke:4, dr:'dr_hellspawn'},
  tok_endspawn: {name:'Endspawn',     atk:2, hp:2, invoke:3, dr:'dr_endspawn'},
  tok_spiderling:{name:'Spiderling',  atk:1, hp:1, invoke:1, dr:null},
  tok_gargantuan:{name:'Gargantuan Spider', atk:5, hp:5, invoke:0, dr:null},
  tok_amalgam:  {name:'Spider Amalgamation', atk:0, hp:1, invoke:0, dr:null},
  tok_illusion: {name:'Dimensional Illusion', atk:0, hp:0, invoke:0, dr:null}   // stats set when cast
};
function scenarioUnit(cid){
  const c = CARDS[cid] || TOKEN_DEFS[cid] || {name:'?',atk:1,hp:1,invoke:0,dr:null};
  const atk=c.atk, hp=c.hp, inv=(c.inv!==undefined?c.inv:c.invoke);
  return {cid, name:c.name, atk, hp, maxHp:hp, invoke:inv||0, soloInv:c.soloInv||0, dr:c.dr||null, grow:c.grow||0, strike:c.strike||0, ward:c.ward?1:0,
          ready:false, sick:false, terrified:false, muted:false, paralysed:0, curses:[]};
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
    if(typeof cfg.idleTurns==='number') p.idleTurns = cfg.idleTurns;         // AI does nothing on its first N turns (quiet lock)
    if(typeof cfg.summonCost==='number') p.summonCost = cfg.summonCost;      // price of the first summon
    if(typeof cfg.summonStep==='number') p.summonStep = cfg.summonStep;      // how much each summon raises the next one's price (default SUMMON_STEP; 0 = flat)
    if(cfg.noEssence) p.noEssence = true;                                    // gathers no essence from any source
    if(typeof cfg.formTimer==='number') p.formTimer = { every:cfg.formTimer, left:cfg.formTimer };   // the form arrives by itself every N of its turns
    if(cfg.guardedForm) p.guardedForm = true;                                // its form takes no damage while it has a follower
    if(cfg.noArrival) p.noArrival = true;                                    // the form arrives with no arrival effect
    if(cfg.noTerrify) p.noTerrify = true;                                    // Fear's aura deals its damage but Terrifies nothing
    if(cfg.summoned && !p.abstractUnit){                                     // start already manifested (free — no essence cost)
      const a=ARCH[p.arch].abstract;
      p.abstractUnit={name:a.name, hp:a.hp, maxHp:a.hp, isAbstract:true};
      p.summonCount++; p.summonCost += summonStepOf(p);
    }
    if(Array.isArray(cfg.revives)) p.revives = cfg.revives.slice();          // "final stand": on death, rise again at each listed HP
    if(typeof cfg.distil==='number'){                                        // pre-distil the diagram (e.g. Knowledge's octagon -> pentagon); assumes an empty board
      for(let k=0;k<cfg.distil && p.board.length>4;k++){ p.nodes.pop(); p.board.pop(); }
      const n=p.board.length; p.angles = Array.from({length:n},(_,i)=> -90 + i*360/n);
    }
    if(Array.isArray(cfg.cast)) cfg.cast.forEach(fx=>resolveFx(fx, p));      // free spell effects resolved for this side at game start
  }
}

/* how much a summon raises the next one's price: SUMMON_STEP unless a scenario overrides it */
function summonStepOf(p){ return (typeof p.summonStep==='number') ? p.summonStep : SUMMON_STEP; }
/* a guarded form (scenario) takes no damage, and cannot be attacked, while its owner has any follower */
function formGuarded(p){ return !!(p && p.guardedForm && p.abstractUnit && unitRefs(p).length); }
/* scenario countdown: with no form, count down at the owner's turn start; at zero the form arrives for free */
function tickFormTimer(p){
  const t=p.formTimer; if(!t || p.abstractUnit || G.over) return;
  t.left--;
  if(t.left<=0){ t.left = t.every; summonAbstract(p, true); }
  else log(`${ARCH[p.arch].abstract.name} will take form in ${t.left} turn${t.left===1?'':'s'}.`,'sys');
}
function summonAbstract(p, free){
  if(p.abstractUnit || G.over) return;
  if(!free && p.invoke<p.summonCost) return;
  const a=ARCH[p.arch].abstract;
  if(!free) p.invoke -= p.summonCost;
  p.summonCount++;
  p.abstractUnit = {name:a.name, hp:a.hp, maxHp:a.hp, isAbstract:true};
  if(free) log(`✦ ${a.name} TAKES FORM (${typeof free==='string' ? free : 'the countdown ends'}). ✦`,'sys');
  else log(`✦ ${a.name} TAKES FORM (${p.summonCost} essence${p.summonCount>1?', resummon '+p.summonCount:''}). ✦`,'sys');
  if(!free) p.summonCost += summonStepOf(p);
  const e=foe(p);
  if(p.arch==='fear' && !p.noArrival){
    let n=0;
    p.board.forEach((s,i)=>{ if(!s){ spawnSpider(p,i); n++; } });
    if(n) log(`${n} Terror Spider${n===1?'':'s'} crawl from the dark — the circle closes itself.`,'sys');
  }
  if(p.arch==='justice' && !p.noArrival){
    log('Day of Judgement: the aggressive punish themselves.','sys');
    unitRefs(e).reverse().forEach(r=>{ const u=getUnit(r); if(u.atk>0) damageUnit(r,u.atk); });
  }
  if(p.arch==='knowledge' && !p.noArrival){
    eachUnits(p,u=>{u.invoke+=1;});
    drawCards(p,1);
    log('Awakening: your followers gain +1 invoke value.','sys');
  }
  if(typeof playCentreFx==='function') playCentreFx(p.isAI?'foe':'you', 'summoned', 1100);   // ignite + shockwave, once
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
  if(c.target==='summonNode') return p.board.some(s=>!s) && (c.fx!=='illusion' || nodesRemoved(p)>0);
  return true;
}
/* ---- Dimensional Illusion ---- */
/* nodes this player has removed from their diagram this game */
function nodesRemoved(p){ return Math.max(0, (p.startNodes || p.board.length) - p.board.length); }
/* how many different spells this player has cast; pass a card id to preview the count as if that card were cast now */
function illusionSize(p, cid){ const seen = p.spellsSeen || []; return seen.length + (cid && !seen.includes(cid) ? 1 : 0); }
/* end of the owner's turn: the turn it was cast doesn't count; after that each turn uses one, and at zero it vanishes (not a death) */
function fadeIllusions(p){
  p.board.forEach((u,i)=>{
    if(!u || !u.vanish) return;
    if(u.vanishFresh){ u.vanishFresh = false; return; }
    u.vanish--;
    if(u.vanish<=0){ p.board[i] = null; log(`${u.name} fades back between dimensions.`, p.isAI?'foe':'you'); }
  });
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

/* move n random cards from a player's hand into their spent litany */
function discardRandom(p, n){
  for(let k=0;k<n && p.hand.length;k++){ p.used.push(p.hand.splice(Math.floor(Math.random()*p.hand.length),1)[0]); }
}
/* resolve one "final stand" revive. rev is {hp, keep?, discard?, discardTo?} (or a bare hp number). */
function reviveLoser(loser){
  const rev = loser.revives.shift();
  const hp = (typeof rev==='number') ? rev : rev.hp;
  loser.hp = hp;
  loser.abstractUnit = null;   // returns as an exposed core — no form
  if(rev && typeof rev==='object'){
    if(typeof rev.keep==='number'){                        // retain `keep` random followers; the rest disperse (no death-rattle)
      const refs = unitRefs(loser);
      if(refs.length > rev.keep){
        const sh = refs.slice();
        for(let i=sh.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [sh[i],sh[j]]=[sh[j],sh[i]]; }
        sh.slice(rev.keep).forEach(r=>{ loser.board[r.idx]=null; });
      }
    }
    if(rev.discard) discardRandom(loser, rev.discard);
    if(typeof rev.discardTo==='number') discardRandom(loser, loser.hand.length - rev.discardTo);
  }
  return { hp, finalOne: loser.revives.length===0 };
}
/* "Senths is watching": when either core falls to 15 or less, the Mother descends onto the player's diagram (once). */
function summonSenthsFor(p){
  let idx = p.board.findIndex(s=>!s);                                   // an empty node, else overwrite a random follower
  if(idx<0) idx = Math.floor(Math.random()*p.board.length);
  const c = CARDS.f_ap_senths;
  p.board[idx] = {cid:'f_ap_senths', ward:c.ward?1:0, name:c.name, atk:c.atk, hp:c.hp, maxHp:c.hp, invoke:c.inv, soloInv:0, dr:c.dr||null, grow:0, ready:false, sick:true, terrified:false, muted:false, paralysed:0, curses:[]};
  log(`✦ ${c.name} answers the call — the Mother descends. ✦`,'sys');
  renderAll();
  if(typeof runRebirth==='function') runRebirth(p.isAI?'foe':'you', 'fear', 'Senths descends..');
  /* the adversary answers: after a beat, it manifests its own form (no arrival effect) */
  const opp = foe(p);
  if(opp && !opp.abstractUnit){
    setTimeout(()=>{
      if(!G || G.over || opp!==foe(you()) || opp.abstractUnit) return;
      const a = ARCH[opp.arch].abstract;
      opp.abstractUnit = {name:a.name, hp:a.hp, maxHp:a.hp, isAbstract:true};
      opp.summonCount++; opp.summonCost += summonStepOf(opp);
      log(`✦ ${a.name} rises to meet her — not so fast. ✦`,'sys');
      renderAll();
      if(typeof runRebirth==='function') runRebirth(opp.isAI?'foe':'you', opp.arch, 'Not so fast..');
    }, 2000);
  }
}
function checkSenthsWatch(){
  if(!G || G.over || G.senthsFired) return;
  if(!boonsFor(you()).some(b=>b && b.senthsWatch)) return;
  const low = pl => pl.hp>0 && pl.hp<=15;
  if(low(you()) || low(enemy())){ G.senthsFired=true; summonSenthsFor(you()); }
}
/* "The Arcana stirs" (S8 finale): when either core falls to 15 or less, a free Ancient Arcana comes to the player's
   hand (once, even if the hand is full). Then, after a beat, the adversary answers by taking form (no arrival effect). */
function checkArcanaWatch(){
  if(!G || G.over || G.arcanaFired) return;
  if(!boonsFor(you()).some(b=>b && b.arcanaWatch)) return;
  const low = pl => pl.hp>0 && pl.hp<=15;
  if(!(low(you()) || low(enemy()))) return;
  G.arcanaFired = true;
  const p = you();
  p.hand.push('k_ap_arcana0');
  log(`✦ ${CARDS.k_ap_arcana0.name} stirs. It comes to your hand, free to cast. ✦`,'sys');
  renderAll();
  if(typeof runRebirth==='function') runRebirth('you', 'knowledge', 'The Arcana stirs..');
  const opp = foe(p);
  if(opp && !opp.abstractUnit){
    setTimeout(()=>{
      if(!G || G.over || opp!==foe(you()) || opp.abstractUnit) return;
      const a = ARCH[opp.arch].abstract;
      opp.abstractUnit = {name:a.name, hp:a.hp, maxHp:a.hp, isAbstract:true};
      opp.summonCount++; opp.summonCost += summonStepOf(opp);
      log(`✦ ${a.name} rises to meet it. Not so fast. ✦`,'sys');
      renderAll();
      if(typeof runRebirth==='function') runRebirth(opp.isAI?'foe':'you', opp.arch, 'Not so fast..');
    }, 2000);
  }
}
function endGame(winner){
  /* "final stand": if the loser has revives banked, it rises again instead of dying */
  const loser = foe(winner);
  if(loser && Array.isArray(loser.revives) && loser.revives.length){
    const { hp, finalOne } = reviveLoser(loser);
    const Name = loser.arch.charAt(0).toUpperCase()+loser.arch.slice(1);
    const msg = finalOne ? `${Name} takes a final stand..` : `${Name} rises again..`;
    log(`${loser.name} refuses to fall — it rises again with ${hp} HP!`,'sys');
    if(typeof runRebirth==='function') runRebirth(loser.isAI?'foe':'you', loser.arch, msg);
    renderAll();
    return;
  }
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