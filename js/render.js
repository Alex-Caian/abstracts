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
    const pts=arch.angles.map(nodePos);
    let svg=`<svg class="geo-lines" viewBox="0 0 100 100" preserveAspectRatio="none">`;
    svg+=`<polygon points="${pts.map(pt=>pt.x+','+pt.y).join(' ')}"></polygon>`;
    pts.forEach(pt=>{ svg+=`<line x1="50" y1="50" x2="${pt.x}" y2="${pt.y}"></line>`; });
    svg+='</svg>';
    let html=svg+`<div class="board-label">${p.name} · ${arch.geoName}</div>`;
    arch.angles.forEach((ang,i)=>{
      const pt=nodePos(ang);
      html+=`<div class="node" data-side="${side}" data-idx="${i}" style="left:${pt.x}%;top:${pt.y}%"></div>`;
    });
    html+=`<div class="centre" data-side="${side}">
      <svg class="sigil-ring" viewBox="0 0 118 118">
        <circle class="track" cx="59" cy="59" r="55"></circle>
        <circle class="fill" cx="59" cy="59" r="55" stroke-dasharray="345.6" stroke-dashoffset="345.6"></circle>
      </svg>
      <div class="sig-inner"></div>
      <div class="hover-tip centre-tip"></div>
    </div>`;
    el.innerHTML=html;
    document.getElementById('strip-'+side).className='hero-strip '+arch.css;
  });
  const a=ARCH[you().arch];
  const ab=a.abstract.ability;
  document.getElementById('nodes-help').innerHTML =
    `<b>${a.geoName}</b><br>`+
    a.nodes.map((k,i)=>`<b>Node ${i+1}</b> — ${NODE_FX[k].txt}`).join('<br>')+
    `<br><br><b>${a.abstract.name}</b> (${a.abstract.hp} HP form)<br>`+
    `${a.abstract.onSummonTxt}<br>${a.abstract.auraTxt}<br>`+
    `<b>${ab.name}</b> (${ab.cost} invoke, once per turn) — ${ab.txt}`;
}
function renderAll(){
  if(!G) return;
  renderStrip('you',you()); renderStrip('foe',enemy());
  renderBoard('you',you()); renderBoard('foe',enemy());
  renderHand(); renderCmd();
  applyHighlights();
}
/* HP now lives at the centre — the strip carries resources only */
function renderStrip(side,p){
  const el=document.getElementById('strip-'+side);
  el.innerHTML=`<span class="who">${ARCH[p.arch].name}</span><span class="tag">${p.name}</span>
    <span class="stat mana"><b>${p.mana}/${p.maxMana}</b><span class="lbl">Mana</span></span>
    <span class="stat inv"><b>${p.invoke}</b><span class="lbl">Invoke</span></span>
    <span class="handcount">${p.isAI? p.hand.length+' cards in hand · ':''}${p.deck.length} in deck</span>`;
  el.dataset.side=side;
}
/* tooltip content for a follower */
function unitTipHtml(u, archKey, nodeIdx){
  const c = CARDS[u.cid];
  const lines=[];
  if(c && c.txt) lines.push(`<b>${c.txt}</b>`);
  if(u.cid==='tok_spider') lines.push(`<b>Skittered in when FEAR took form.</b>`);
  if(u.invoke>0) lines.push(`Invokes for <b>${u.invoke}</b> essence.`);
  if(u.sick) lines.push(`Resting — can act next turn.`);
  lines.push(`<span class="tip-dim">Played on: ${NODE_FX[ARCH[archKey].nodes[nodeIdx]].txt}</span>`);
  return lines.map(l=>`<div>${l}</div>`).join('');
}
/* tooltip content for an Abstract centre (yours or theirs) */
function centreTipHtml(p){
  const a=ARCH[p.arch].abstract, ab=a.ability;
  const lines=[];
  if(p.abstractUnit)
    lines.push(`<b>Manifested</b> — ${p.abstractUnit.hp}/${p.abstractUnit.maxHp} HP, shielding the core (${p.hp} HP) beneath.`);
  else
    lines.push(`<b>Exposed core</b> — ${p.hp}/${START_HP} HP. ${p.summonCount>0?'Re-summon':'Summon'} at ${p.summonCost} invoke (has ${p.invoke}).`);
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
      node.innerHTML=`<div class="unit" data-side="${side}" data-idx="${i}">
        ${u.invoke>0?`<div class="uinv">${u.invoke}</div>`:''}
        ${u.sick?`<div class="usick">zZ</div>`:''}
        <div class="uname">${u.name}</div>
        <div class="ustats"><span class="uatk">${u.atk}</span><span class="uhp">${u.hp}</span></div>
        <div class="hover-tip">${unitTipHtml(u,p.arch,i)}</div>
      </div>`;
      const uEl=node.firstElementChild;
      const mine = side==='you';
      if(mine && G.turn===0 && u.ready && !G.over) uEl.classList.add('ready');
      if(mine && G.turn===0 && !u.ready && !u.sick) uEl.classList.add('acted');
      if(mine && u.sick) uEl.classList.add('sick');
    } else {
      node.classList.add('empty');
      node.innerHTML=`<div class="dot"></div><div class="node-tip">${NODE_FX[arch.nodes[i]].txt}</div>`;
    }
  });
  /* centre: the HP lives here now, manifested or exposed */
  const c=board.querySelector('.centre');
  const inner=c.querySelector('.sig-inner');
  const ring=c.querySelector('circle.fill');
  const circ=345.6;
  if(p.abstractUnit){
    const u=p.abstractUnit;
    ring.style.strokeDashoffset = circ*(1-Math.max(0,u.hp)/u.maxHp);
    inner.innerHTML=`<div class="sig-name">${u.name}</div>
      <div class="sig-stats"><span class="uhp">${u.hp}</span><span class="sig-max">/ ${u.maxHp}</span></div>
      <div class="sig-meter">shielding core · ${p.hp}</div>`;
  } else {
    ring.style.strokeDashoffset = circ*(1-Math.max(0,p.hp)/START_HP);
    inner.innerHTML=`<div class="sig-name">${ARCH[p.arch].abstract.name}</div>
      <div class="sig-stats"><span class="uhp">${p.hp}</span><span class="sig-max">/ ${START_HP}</span></div>
      <div class="sig-meter">${p.invoke} / ${p.summonCost} to ${p.summonCount>0?'re-':''}summon</div>`;
  }
  const tip=c.querySelector('.hover-tip');
  if(tip) tip.innerHTML=centreTipHtml(p);
}
function renderHand(){
  const p=you(), el=document.getElementById('hand');
  el.innerHTML=p.hand.map((cid,i)=>{
    const c=CARDS[cid];
    const aff = c.cost<=p.mana && G.turn===0 && !G.over;
    const drag = aff && c.t==='f';
    return `<div class="card ${ARCH[c.arch].css} ${aff?'affordable':'unaffordable'} ${drag?'can-drag':''} ${ui.selCard===i?'selected':''}" data-hand="${i}" draggable="false">
      <div class="cost">${c.cost}</div>
      <div class="cname">${c.name}</div>
      <div class="ctype">${c.t==='f'?'Follower':'Spell'}</div>
      <div class="ctext">${c.txt||''}</div>
      ${c.t==='f'?`<div class="cstats"><span class="uatk">${c.atk}</span><span class="cinv">✦ invoke ${c.inv}</span><span class="uhp">${c.hp}</span></div>`:''}
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
    const u=getUnit(ui.selUnit);
    const bi=document.getElementById('btn-invoke');
    const canInvoke = u && u.invoke>0;
    bi.style.display = canInvoke?'inline-block':'none';
    if(canInvoke) bi.textContent=`Invoke +${u.invoke}`;
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
