'use strict';
/* =====================================================================
   ABSTRACTS — render.js
   Board construction and all DOM rendering. No game rules live here.
   ===================================================================== */
function nodePos(angleDeg){
  const r=42, a=angleDeg*Math.PI/180;
  return { x:50 + r*Math.cos(a), y:50 + (r-2)*Math.sin(a) };
}
function unitEl(ref){
  const side = ref.pi===0 ? 'you' : 'foe';
  return document.querySelector(`#board-${side} .unit[data-idx="${ref.idx}"]`);
}
function buildBoards(){
  ['you','foe'].forEach(side=>{
    const p = side==='you'?you():enemy();
    const arch=ARCH[p.arch];
    const el=document.getElementById('board-'+side);
    el.className='board '+arch.css;
    if(el.parentElement) el.parentElement.className='board-wrap mat '+arch.css;  // playmat backdrop per Abstract
    const pts=p.angles.map(nodePos);
    let svg=`<svg class="geo-lines" viewBox="0 0 100 100" preserveAspectRatio="none">`;
    pts.forEach((pt,i)=>{
      const q=pts[(i+1)%pts.length];
      svg+=`<line class="edge" data-e="${i}" x1="${pt.x}" y1="${pt.y}" x2="${q.x}" y2="${q.y}"></line>`;
    });
    pts.forEach((pt,i)=>{ svg+=`<line class="spoke" data-s="${i}" x1="50" y1="50" x2="${pt.x}" y2="${pt.y}"></line>`; });
    svg+='</svg>';
    let html=svg;
    p.angles.forEach((ang,i)=>{
      const pt=nodePos(ang);
      html+=`<div class="node" data-side="${side}" data-idx="${i}" style="left:${pt.x}%;top:${pt.y}%"></div>`;
    });
    html+=`<div class="centre" data-side="${side}">
      <div class="sig-hp"></div>
      <div class="sig-icon"><span class="ic ic-pre">${arch.icon}</span><span class="ic ic-on">${arch.iconSummoned}</span></div>
      <div class="sig-sub"></div>
      <div class="hover-tip centre-tip"></div>
    </div>`;
    el.innerHTML=html;
    document.getElementById('strip-'+side).className='hero-strip '+arch.css;
  });
  const a=ARCH[you().arch];
  const ab=a.abstract.ability;
  document.getElementById('nodes-help').innerHTML =
    `<b>${a.abstract.name}</b> (${a.abstract.hp} HP form)<br>`+
    `${a.abstract.onSummonTxt}<br>${a.abstract.auraTxt}<br>`+
    `<b>${ab.name}</b> (${ab.cost} invoke, once per turn) — ${ab.txt}`;
}
function renderAll(){
  if(!G) return;
  renderStrip('you',you()); renderStrip('foe',enemy());
  renderBoard('you',you()); renderBoard('foe',enemy());
  renderHand(); renderFoeHand(); renderCmd();
  applyHighlights();
}
/* the opponent's concealed hand — face-down backs, one per held card */
function renderFoeHand(){
  const el=document.getElementById('foe-hand'); if(!el) return;
  const e=enemy();
  el.className='foe-hand '+ARCH[e.arch].css;
  el.innerHTML=Array.from({length:e.hand.length},()=>`<div class="card-back"></div>`).join('');
}
/* HP now lives at the centre — the strip carries resources only */
function renderStrip(side,p){
  const el=document.getElementById('strip-'+side);
  el.innerHTML=`<span class="who">${ARCH[p.arch].name}</span><span class="tag">${p.name}</span>
    <span class="stat mana"><b>${p.mana}/${p.maxMana}</b><span class="lbl">Mana</span></span>
    <span class="stat inv"><b>${p.invoke}</b><span class="lbl">Essence</span></span>
    <span class="handcount">${p.isAI? p.hand.length+' cards in hand · ':''}${p.deck.length} in deck</span>`;
  el.dataset.side=side;
}
/* tooltip content for a follower */
function unitTipHtml(u, owner, nodeIdx){
  const c = CARDS[u.cid];
  const lines=[];
  if(c && c.txt) lines.push(`<b>${c.txt}</b>`);
  if(u.cid==='tok_spider') lines.push(`<b>Born of FEAR — the circle sustains itself.</b>`);
  if(u.cid==='tok_gspider') lines.push(`<b>Brood-spawn. On death: deal 1 damage.</b>`);
  if(u.cid==='tok_prophet') lines.push(`<b>Conjured — a voice in the chorus.</b>`);
  if(u.cid==='tok_footnote') lines.push(`<b>All that remains of something greater.</b>`);
  const eInv = effInvoke(owner,u,nodeIdx);
  if(u.soloInv){
    if(eInv>0) lines.push(`Invokes for <b>${eInv}</b> essence while <b>alone</b>.`);
    else lines.push(`<b>Linked</b> — the lone hunter channels nothing.`);
  } else if(u.invoke>0){
    lines.push(`Invokes for <b>${u.invoke}</b> essence.`);
    if(!linkedAt(owner,nodeIdx)) lines.push(`<b>Isolated</b> — needs a linked neighbour to invoke.`);
  }
  if(u.muted) lines.push(`<b>Muted</b> — cannot invoke this turn.`);
  if(u.paralysed>0) lines.push(`<b>Terrified</b> — cannot act (${u.paralysed} turn${u.paralysed===1?'':'s'} left). It also takes 1 damage at the start of each of those turns.`);
  const cdef=CARDS[u.cid];
  if(cdef && cdef.lockNode && owner.lockNode && owner.lockNode[u.cid]!==undefined && owner.lockNode[u.cid]!==nodeIdx)
    lines.push(`<b>Unconsecrated seat</b> — invokes only from your first Vindicator's node.`);
  if(cdef && cdef.invDrawn && (owner.drawnCount||0) < cdef.invDrawn)
    lines.push(`<b>Unschooled</b> — invokes once you have drawn ${cdef.invDrawn} cards (drawn ${owner.drawnCount||0}).`);
  if(u.terrified) lines.push(`<b>Terrified</b> — cannot act this turn.`);
  if(u.sick) lines.push(`Resting — can act next turn.`);
  lines.push(`<span class="tip-dim">Played on: ${NODE_FX[owner.nodes[nodeIdx]].txt}</span>`);
  return lines.map(l=>`<div>${l}</div>`).join('');
}
/* tooltip content for an Abstract centre (yours or theirs) */
function centreTipHtml(p){
  const a=ARCH[p.arch].abstract, ab=a.ability;
  const lines=[];
  if(p.abstractUnit)
    lines.push(`<b>Manifested</b> — ${p.abstractUnit.hp}/${p.abstractUnit.maxHp} HP, shielding the core (${p.hp} HP) beneath.`);
  else
    lines.push(`<b>Exposed core</b> — ${p.hp}/${START_HP} HP. ${p.summonCount>0?'Re-summon':'Summon'} at ${p.summonCost} essence (has ${p.invoke}).`);
  if(diagramComplete(p)) lines.push(`<b>In communion</b> — the complete circle channels +${p.board.length} essence at the start of ${p.isAI?'its':'your'} turn.`);
  lines.push(`<b>Arrival:</b> ${a.onSummonTxt.replace('On arrival: ','')}`);
  lines.push(`<b>Aura:</b> ${a.auraTxt.replace('Aura: ','')}`);
  lines.push(`<b>${ab.name}</b> (${ab.cost} invoke, once per turn): ${ab.txt}`);
  return lines.map(l=>`<div>${l}</div>`).join('');
}
function renderBoard(side,p){
  const board=document.getElementById('board-'+side);
  const arch=ARCH[p.arch];
  board.querySelectorAll('.node').forEach(node=>{
    const i=+node.dataset.idx, u=p.board[i];
    node.classList.remove('playable','drag-over','empty');
    if(u){
      const eInv = effInvoke(p,u,i);
      const canCh = canChannel(p,u,i);
      const appar = (CARDS[u.cid] && CARDS[u.cid].apparition) ? 'apparition' : '';
      node.innerHTML=`<div class="unit ${appar}" data-side="${side}" data-idx="${i}">
        ${eInv>0?`<div class="uinv ${canCh?'':'dim'}">${eInv}</div>`:''}
        ${u.paralysed>0?`<div class="upar">↯</div>`:(u.terrified?`<div class="uterr">✕</div>`:(u.sick?`<div class="usick">zZ</div>`:''))}
        <div class="uname">${u.name}</div>
        <div class="ustats"><span class="uatk">${u.atk}</span><span class="uhp">${u.hp}</span></div>
        <div class="hover-tip">${unitTipHtml(u,p,i)}</div>
      </div>`;
      const uEl=node.firstElementChild;
      const mine = side==='you';
      if(mine && G.turn===0 && u.ready && !G.over) uEl.classList.add('ready');
      if(mine && G.turn===0 && !u.ready && !u.sick) uEl.classList.add('acted');
      if(mine && u.sick) uEl.classList.add('sick');
      if(u.terrified) uEl.classList.add('terrified');
    } else {
      node.classList.add('empty');
      node.innerHTML=`<div class="dot"></div><div class="node-tip">${NODE_FX[p.nodes[i]].txt}</div>`;
    }
  });
  /* ring edges: lit between adjacent occupied nodes; full circle = communion */
  const nN=p.board.length;
  board.querySelectorAll('svg .edge').forEach(edge=>{
    const i=+edge.dataset.e;
    edge.classList.toggle('lit', !!(p.board[i] && p.board[(i+1)%nN]));
  });
  /* spokes to the core: lit (subtly) wherever a follower stands on that node */
  board.querySelectorAll('svg .spoke').forEach(sp=>{
    sp.classList.toggle('lit', !!p.board[+sp.dataset.s]);
  });
  board.classList.toggle('communion', diagramComplete(p));
  /* centre: the emblem IS the heart now — HP on top, summon cost (chain) below, no ring */
  const c=board.querySelector('.centre');
  const hpEl=c.querySelector('.sig-hp');
  const subEl=c.querySelector('.sig-sub');
  /* manifested = the awakened emblem (open book / scales / spider); latent otherwise */
  c.classList.toggle('manifested', !!p.abstractUnit);
  if(p.abstractUnit){
    const u=p.abstractUnit;
    hpEl.innerHTML=`${u.hp}<span class="sig-max">/ ${u.maxHp}</span>`;
    subEl.innerHTML=`shielding core · ${p.hp}`;
  } else {
    hpEl.innerHTML=`${p.hp}<span class="sig-max">/ ${START_HP}</span>`;
    subEl.innerHTML=`<svg class="chain" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M11 7l1-1a3.4 3.4 0 0 1 4.8 4.8l-1 1"/><path d="M13 17l-1 1a3.4 3.4 0 0 1-4.8-4.8l1-1"/></svg> ${p.summonCost}`;
  }
  /* the LATENT emblem fades toward black as the core bleeds; the manifested emblem never fades */
  const preSvg=c.querySelector('.ic-pre svg');
  if(preSvg) preSvg.style.filter=`brightness(${Math.pow(Math.max(0,p.hp)/START_HP,0.7).toFixed(2)})`;
  /* the core stirs when enough essence has gathered to take form */
  c.classList.toggle('summon-ready', !p.abstractUnit && p.invoke>=p.summonCost && !G.over);
  const tip=c.querySelector('.hover-tip');
  if(tip) tip.innerHTML=centreTipHtml(p);
}
function renderHand(){
  const p=you(), el=document.getElementById('hand');
  const myTurn = G.turn===0 && !G.over;
  el.innerHTML=p.hand.map((cid,i)=>{
    const c=CARDS[cid];
    const hasMana = c.cost<=p.mana;
    const hasTgt  = (typeof spellTargetable==='function') ? spellTargetable(p,c) : true;
    const aff = hasMana && hasTgt && myTurn;
    const drag = aff && c.t==='f';
    const noTgt = myTurn && hasMana && !hasTgt;   // otherwise castable, blocked only by a lack of targets
    return `<div class="card ${ARCH[c.arch].css} ${aff?'affordable':'unaffordable'} ${drag?'can-drag':''} ${c.apparition?'apparition':''} ${ui.selCard===i?'selected':''}" data-hand="${i}" draggable="false">
      <div class="cost">${c.cost}</div>
      <div class="cname">${c.name}</div>
      <div class="ctype">${c.t==='f'?'Follower':'Spell'}</div>
      <div class="ctext">${c.txt||''}</div>
      ${c.t==='f'?`<div class="cstats"><span class="uatk">${c.atk}</span><span class="cinv">✦ invoke ${c.inv}</span><span class="uhp">${c.hp}</span></div>`:''}
      ${noTgt?`<div class="hover-tip card-tip"><b>No valid targets.</b></div>`:''}
    </div>`;
  }).join('');
}
function renderCmd(){
  const p=you();
  const myTurn = G.turn===0 && !G.over;
  document.getElementById('turn-ind').textContent = G.over?'GAME OVER': myTurn?`TURN ${G.turnNo} — YOURS`:`TURN ${G.turnNo} — ADVERSARY`;
  const endBtn=document.getElementById('btn-end');
  endBtn.disabled = !myTurn;
  const anythingLeft = myTurn && (
    p.hand.some(cid=>CARDS[cid].cost<=p.mana && (CARDS[cid].t==='s' || p.board.some(s=>!s))) ||
    unitRefs(p).some(r=>getUnit(r).ready) ||
    (!p.abstractUnit && p.invoke>=p.summonCost) ||
    canUseAbility(p)
  );
  endBtn.classList.toggle('attention', myTurn && !anythingLeft);
  const bs=document.getElementById('btn-summon');
  const canSummon = myTurn && !p.abstractUnit && p.invoke>=p.summonCost;
  bs.style.display = canSummon?'inline-block':'none';
  if(canSummon) bs.textContent=`${p.summonCount>0?'Resummon':'Summon'} (${p.summonCost})`;
  const ba=document.getElementById('btn-ability');
  const ab=ARCH[p.arch].abstract.ability;
  ba.style.display = (myTurn && canUseAbility(p))?'inline-block':'none';
  ba.textContent=`${ab.name} (${ab.cost})`;
  ba.title=ab.txt+' Once per turn.';
  const hint=document.getElementById('action-hint');
  hint.classList.remove('flash');
  if(ui.flash && Date.now()<ui.flash.until){
    hint.textContent=ui.flash.msg; hint.classList.add('flash');
  }
  else if(!myTurn){ hint.textContent = G.over?'':'The Adversary considers…'; }
  else if(ui.targeting){ hint.textContent = ui.targeting.hint; }
  else { hint.textContent='Drag a follower onto a node, click a spell, or click a glowing follower to act.'; }
  const showActions = myTurn && ui.selUnit;
  document.getElementById('unit-actions').classList.toggle('hidden', !showActions);
  if(showActions){
    const ref=ui.selUnit;
    const u=getUnit(ref);
    const bi=document.getElementById('btn-invoke');
    const canInvoke = u && canChannel(p, u, ref.idx);
    bi.style.display = canInvoke?'inline-block':'none';
    if(canInvoke) bi.textContent=`Invoke +${effInvoke(p,u,ref.idx)}`;
  }
}
function applyHighlights(){
  document.querySelectorAll('.node.playable,.unit.targetable,.unit.friend-target,.unit.selected,.hero-strip.targetable,.centre.targetable,.centre.selected')
    .forEach(e=>e.classList.remove('playable','targetable','friend-target','selected'));
  const myTurn=G.turn===0 && !G.over;
  if(!myTurn) return;
  if(ui.targeting){
    const t=ui.targeting;
    if(t.mode==='enemyUnit'||t.mode==='attack'){
      document.querySelectorAll('#board-foe .unit').forEach(e=>e.classList.add('targetable'));
    }
    if(t.mode==='attack'){
      /* the form shields the core: the centre is always the face target */
      document.querySelector('#board-foe .centre').classList.add('targetable');
    }
    if(t.mode==='friendUnit'){
      document.querySelectorAll('#board-you .unit').forEach(e=>e.classList.add('friend-target'));
    }
    if(t.mode==='emptyNode'){
      document.querySelectorAll('#board-you .node.empty').forEach(e=>e.classList.add('playable'));
    }
  }
  if(ui.selUnit){
    const el=document.querySelector(`#board-you .unit[data-idx="${ui.selUnit.idx}"]`);
    if(el) el.classList.add('selected');
  }
}
function flashHint(msg, ms=1800){
  ui.flash={msg, until:Date.now()+ms};
  renderCmd();
  setTimeout(()=>{ if(ui.flash && Date.now()>=ui.flash.until){ ui.flash=null; if(G&&!G.over) renderCmd(); } }, ms+50);
}
function floatNum(host,n,small=false,color=null){
  if(!host) return;
  const r=host.getBoundingClientRect();
  const f=document.createElement('div');
  f.className='floater'+(small?' small':'');
  f.style.left=(r.left+r.width/2)+'px'; f.style.top=(r.top)+'px';
  f.style.color = color || (n<0?'var(--hp)':'#7CE8A9');
  f.textContent=(n>0?'+':'')+n;
  document.body.appendChild(f); setTimeout(()=>f.remove(),1000);
}
function log(msg,cls){
  const el=document.getElementById('log');
  const d=document.createElement('div'); d.className='l-'+(cls||'sys'); d.textContent=msg;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}
/* a cast spell crumbles to dust — a clear cue it was spent (esp. for no-target spells) */
function dissolveCard(idx){
  const el=document.querySelector(`.card[data-hand="${idx}"]`);
  if(!el) return;
  const r=el.getBoundingClientRect();
  const g=el.cloneNode(true);
  g.classList.add('cast-dissolve'); g.classList.remove('selected');
  g.style.position='fixed'; g.style.left=r.left+'px'; g.style.top=r.top+'px';
  g.style.width=r.width+'px'; g.style.height=r.height+'px'; g.style.margin='0';
  document.body.appendChild(g);
  setTimeout(()=>g.remove(),760);
}
/* coin flip at game start: a spinning disc, then who-goes-first, then onDone (startTurn) */
function runCoinFlip(first, onDone){
  const ov=document.createElement('div'); ov.className='coinflip-overlay';
  ov.innerHTML=`<div class="coin"></div><div class="coin-result" id="coin-result"></div>`;
  document.body.appendChild(ov);
  setTimeout(()=>{ const r=document.getElementById('coin-result');
    if(r){ r.textContent = first===0 ? 'You go first.' : 'The Adversary goes first.'; r.classList.add('show'); } }, 1150);
  setTimeout(()=>{ ov.remove(); if(typeof onDone==='function') onDone(); }, 2250);
}