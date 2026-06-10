'use strict';
/* =====================================================================
   ABSTRACTS — render.js
   Board construction and all DOM rendering. No game rules live here.
   ===================================================================== */

function nodePos(angleDeg){
  const r=42, a=angleDeg*Math.PI/180;
  return { x:50 + r*Math.cos(a), y:50 + (r-2)*Math.sin(a) };
}

/* DOM element for a unit ref (board unit or abstract centre) */
function unitEl(ref){
  const side = ref.pi===0 ? 'you' : 'foe';
  if(ref.zone==='abstract') return document.querySelector(`#board-${side} .centre`);
  return document.querySelector(`#board-${side} .unit[data-idx="${ref.idx}"]`);
}

function buildBoards(){
  ['you','foe'].forEach(side=>{
    const p = side==='you'?you():enemy();
    const arch=ARCH[p.arch];
    const el=document.getElementById('board-'+side);
    el.className='board '+arch.css;
    const pts=arch.angles.map(nodePos);
    /* svg constellation */
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
    </div>`;
    el.innerHTML=html;
    document.getElementById('strip-'+side).className='hero-strip '+arch.css;
  });
  /* node help panel */
  const a=ARCH[you().arch];
  document.getElementById('nodes-help').innerHTML =
    `<b>${a.geoName}</b><br>`+
    a.nodes.map((k,i)=>`<b>Node ${i+1}</b> — ${NODE_FX[k].txt}`).join('<br>')+
    `<br><br><b>${a.abstract.name}</b> (${a.abstract.atk}/${a.abstract.hp})<br>${a.abstract.summonTxt}<br>${a.abstract.auraTxt}`;
}

function renderAll(){
  if(!G) return;
  renderStrip('you',you()); renderStrip('foe',enemy());
  renderBoard('you',you()); renderBoard('foe',enemy());
  renderHand(); renderCmd();
  applyHighlights();
}

function renderStrip(side,p){
  const el=document.getElementById('strip-'+side);
  el.innerHTML=`<span class="who">${ARCH[p.arch].name}</span><span class="tag">${p.name}</span>
    <span class="stat hp"><b>${p.hp}</b><span class="lbl">HP</span></span>
    <span class="stat mana"><b>${p.mana}/${p.maxMana}</b><span class="lbl">Mana</span></span>
    <span class="stat inv"><b>${p.summoned?'✦':p.invoke+'/'+INVOKE_GOAL}</b><span class="lbl">Invoke</span></span>
    <span class="handcount">${p.isAI? p.hand.length+' cards in hand · ':''}${p.deck.length} in deck</span>`;
  el.dataset.side=side;
}

function renderBoard(side,p){
  const board=document.getElementById('board-'+side);
  const arch=ARCH[p.arch];
  board.querySelectorAll('.node').forEach(node=>{
    const i=+node.dataset.idx, u=p.board[i];
    node.classList.remove('playable','drag-over','empty');
    if(u){
      node.innerHTML=`<div class="unit" data-side="${side}" data-idx="${i}" title="Node bonus: ${NODE_FX[arch.nodes[i]].txt}">
        ${u.invoke>0?`<div class="uinv" title="Invoke value">${u.invoke}</div>`:''}
        ${u.sick?`<div class="usick" title="Just played — can act next turn">zZ</div>`:''}
        <div class="uname">${u.name}</div>
        <div class="ustats"><span class="uatk">${u.atk}</span><span class="uhp">${u.hp}</span></div>
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
  /* centre */
  const c=board.querySelector('.centre');
  const inner=c.querySelector('.sig-inner');
  const ring=c.querySelector('circle.fill');
  const circ=345.6;
  c.classList.remove('ready-abs');
  if(p.abstractUnit){
    const u=p.abstractUnit;
    ring.style.strokeDashoffset=0;
    inner.innerHTML=`<div class="sig-name">${u.name}</div>
      <div class="sig-stats"><span class="uatk">${u.atk}</span><span class="uhp">${u.hp}</span></div>
      ${u.sick?'<div class="sig-meter">resting…</div>':''}`;
    const mine=side==='you';
    if(mine && G.turn===0 && u.ready && !G.over) c.classList.add('ready-abs');
  } else if(p.summoned){
    ring.style.strokeDashoffset=circ;
    inner.innerHTML=`<div class="sig-name" style="opacity:.4">${arch.abstract.name}</div><div class="sig-meter">unmade</div>`;
  } else {
    ring.style.strokeDashoffset = circ*(1-p.invoke/INVOKE_GOAL);
    inner.innerHTML=`<div class="sig-name">${arch.abstract.name}</div>
      <div class="sig-meter">${p.invoke} / ${INVOKE_GOAL} invoked</div>
      <div class="sig-meter" style="font-size:10px">${arch.abstract.atk}/${arch.abstract.hp} when summoned</div>`;
  }
}

function renderHand(){
  const p=you(), el=document.getElementById('hand');
  el.innerHTML=p.hand.map((cid,i)=>{
    const c=CARDS[cid];
    const aff = c.cost<=p.mana && G.turn===0 && !G.over;
    const drag = aff && c.t==='f';
    return `<div class="card ${ARCH[c.arch].css} ${aff?'affordable':'unaffordable'} ${ui.selCard===i?'selected':''}" data-hand="${i}" draggable="${drag}">
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
  /* nudge: glow End Turn when nothing useful remains */
  const anythingLeft = myTurn && (
    p.hand.some(cid=>CARDS[cid].cost<=p.mana && (CARDS[cid].t==='s' || p.board.some(s=>!s))) ||
    unitRefs(p,true).some(r=>getUnit(r).ready) ||
    (!p.summoned && p.invoke>=INVOKE_GOAL)
  );
  endBtn.classList.toggle('attention', myTurn && !anythingLeft);

  const bs=document.getElementById('btn-summon');
  bs.style.display = (myTurn && !p.summoned && p.invoke>=INVOKE_GOAL)?'inline-block':'none';

  /* hint line */
  const hint=document.getElementById('action-hint');
  hint.classList.remove('flash');
  if(ui.flash && Date.now()<ui.flash.until){
    hint.textContent=ui.flash.msg; hint.classList.add('flash');
  }
  else if(!myTurn){ hint.textContent = G.over?'':'The Adversary considers…'; }
  else if(ui.targeting){ hint.textContent = ui.targeting.hint; }
  else { hint.textContent='Drag a follower onto a node, click a spell, or click a glowing follower to act.'; }

  /* unit action buttons: Invoke (when meaningful) + Cancel while a unit is selected */
  const showActions = myTurn && ui.selUnit;
  document.getElementById('unit-actions').classList.toggle('hidden', !showActions);
  if(showActions){
    const u=getUnit(ui.selUnit);
    const bi=document.getElementById('btn-invoke');
    const canInvoke = u && !u.isAbstract && u.invoke>0 && !p.summoned;
    bi.style.display = canInvoke?'inline-block':'none';
    if(canInvoke) bi.textContent=`Invoke +${u.invoke}`;
  }
}

function applyHighlights(){
  /* clear */
  document.querySelectorAll('.node.playable,.unit.targetable,.unit.friend-target,.unit.selected,.hero-strip.targetable,.centre.targetable,.centre.selected')
    .forEach(e=>e.classList.remove('playable','targetable','friend-target','selected'));
  const myTurn=G.turn===0 && !G.over;
  if(!myTurn) return;
  /* targeting */
  if(ui.targeting){
    const t=ui.targeting;
    if(t.mode==='enemyUnit'||t.mode==='attack'){
      document.querySelectorAll('#board-foe .unit').forEach(e=>e.classList.add('targetable'));
      const cFoe=document.querySelector('#board-foe .centre');
      if(enemy().abstractUnit) cFoe.classList.add('targetable');
      if(t.mode==='attack') document.getElementById('strip-foe').classList.add('targetable');
    }
    if(t.mode==='friendUnit'){
      document.querySelectorAll('#board-you .unit').forEach(e=>e.classList.add('friend-target'));
    }
  }
  /* selected unit */
  if(ui.selUnit){
    if(ui.selUnit.zone==='abstract') document.querySelector('#board-you .centre').classList.add('selected');
    else { const el=document.querySelector(`#board-you .unit[data-idx="${ui.selUnit.idx}"]`); if(el) el.classList.add('selected'); }
  }
}

/* transient hint message in the command bar */
function flashHint(msg, ms=1800){
  ui.flash={msg, until:Date.now()+ms};
  renderCmd();
  setTimeout(()=>{ if(ui.flash && Date.now()>=ui.flash.until){ ui.flash=null; if(G&&!G.over) renderCmd(); } }, ms+50);
}

/* floating combat number over an element */
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
