'use strict';
/* =====================================================================
   ABSTRACTS — input.js
   All player input. One delegated click handler for the battlefield;
   command-bar buttons have their own listeners and are excluded from
   the delegated handler (clicks would otherwise bubble up and be read
   as background clicks, cancelling targeting).

   Followers are played by dragging. This uses POINTER EVENTS, not the
   HTML5 drag-and-drop API: pointer events fire identically for mouse
   and touch, so the same code path works on desktop and mobile. A
   ghost card follows the pointer; drop target is resolved with
   document.elementFromPoint.
   ===================================================================== */
function selectUnit(ref){
  ui.selCard=null;
  ui.selUnit=ref;
  const u=getUnit(ref);
  const e=enemy();
  const faceTxt = e.abstractUnit ? `${e.abstractUnit.name}'s form (it shields their core)` : "their exposed core";
  const linked = linkedAt(you(), ref.idx);
  ui.targeting={
    mode:'attack',
    hint:`Attack: click an enemy follower or ${faceTxt}.`
      +(u.invoke>0 ? (linked?` Or press Invoke +${u.invoke}.`:` (Isolated — it needs a linked neighbour to invoke.)`) : ''),
    onPick:(t)=>{ const r=ui.selUnit; clearSelection(); attackWith(you(),r,t); }
  };
  renderAll();
}
document.addEventListener('click',ev=>{
  if(dragPtr.suppressClick){ dragPtr.suppressClick=false; return; }
  if(!G || G.over || G.turn!==0) return;
  if(ev.target.closest('#cmdbar') || ev.target.closest('.overlay') || ev.target.closest('#sidebar')) return;
  const p=you();
  const cardEl=ev.target.closest('.card[data-hand]');
  if(cardEl){
    const i=+cardEl.dataset.hand, c=CARDS[p.hand[i]];
    if(c.cost>p.mana){ flashHint(`Not enough mana for ${c.name} (${c.cost}).`); return; }
    if(c.t==='f'){ flashHint(`Drag ${c.name} onto one of your nodes to play it.`); return; }
    ui.selUnit=null; ui.targeting=null;
    if(ui.selCard===i){ ui.selCard=null; renderAll(); return; }
    ui.selCard=i;
    if(!c.target){ const idx=ui.selCard; ui.selCard=null; castSpell(p,idx,null); return; }
    if(c.target==='enemyUnit' && unitRefs(enemy()).length===0){ flashHint('No enemy follower to target.'); ui.selCard=null; renderAll(); return; }
    if(c.target==='friendUnit' && unitRefs(p).length===0){ flashHint('You have no follower to target.'); ui.selCard=null; renderAll(); return; }
    if(c.target==='emptyNode'){
      if(p.board.length<=4){ flashHint('The diagram can tighten no further.'); ui.selCard=null; renderAll(); return; }
      if(!p.board.some(s=>!s)){ flashHint('No empty node to dissolve.'); ui.selCard=null; renderAll(); return; }
    }
    ui.targeting={mode:c.target,
      hint:c.target==='enemyUnit'?'Choose an enemy follower.':(c.target==='emptyNode'?'Choose an empty node to dissolve.':'Choose one of your followers.'),
      onPick:(ref)=>{ const idx=ui.selCard; clearSelection(); castSpell(p,idx,ref); }};
    renderAll(); return;
  }
  if(ui.targeting){
    const t=ui.targeting;
    const foeUnit=ev.target.closest('#board-foe .unit');
    const foeCentre=ev.target.closest('#board-foe .centre');
    const youUnit=ev.target.closest('#board-you .unit');
    if((t.mode==='enemyUnit'||t.mode==='attack') && foeUnit){ t.onPick({pi:1,zone:'board',idx:+foeUnit.dataset.idx}); return; }
    /* the centre IS the face (form or exposed core); the strip works too */
    if(t.mode==='attack' && (foeCentre || ev.target.closest('#strip-foe'))){ t.onPick({pi:1,zone:'hero'}); return; }
    if(t.mode==='friendUnit' && youUnit){ t.onPick({pi:0,zone:'board',idx:+youUnit.dataset.idx}); return; }
    if(t.mode==='emptyNode'){
      const nodeEl=ev.target.closest('.node[data-side="you"]');
      if(nodeEl && !p.board[+nodeEl.dataset.idx]){ t.onPick({pi:0,zone:'node',idx:+nodeEl.dataset.idx}); return; }
      clearSelection(); renderAll(); return;
    }
    if(t.mode==='attack' && youUnit){
      const idx=+youUnit.dataset.idx, u=p.board[idx];
      if(ui.selUnit && ui.selUnit.idx===idx){ clearSelection(); renderAll(); return; }
      if(u && u.ready){ selectUnit({pi:0,zone:'board',idx}); return; }
    }
    clearSelection(); renderAll(); return;
  }
  const myUnit=ev.target.closest('#board-you .unit');
  if(myUnit){
    const idx=+myUnit.dataset.idx, u=p.board[idx];
    if(!u) return;
    if(u.sick){ flashHint(`${u.name} was just played — it can act next turn.`); return; }
    if(!u.ready){ flashHint(`${u.name} has already acted this turn.`); return; }
    selectUnit({pi:0,zone:'board',idx});
    return;
  }
  if(ui.selCard!==null||ui.selUnit){ clearSelection(); renderAll(); }
});

/* ---- pointer-based drag & drop (works on touch AND mouse) ----
   NOTE: never re-render the hand during a drag — destroying the source
   element mid-drag would break pointer capture. Node highlights are
   applied directly, not via renderAll(). */
let dragPtr = {idx:null, cardEl:null, ghost:null, started:false, sx:0, sy:0, overNode:null, suppressClick:false};

function dragNodeAtPoint(x,y){
  let el=null;
  if(dragPtr.ghost) dragPtr.ghost.style.display='none';
  try{ el=document.elementFromPoint(x,y); }catch(e){ el=null; }
  if(dragPtr.ghost) dragPtr.ghost.style.display='';
  const node = el && el.closest && el.closest('.node[data-side="you"]');
  return (node && !you().board[+node.dataset.idx]) ? node : null;
}
function dragStartGhost(x,y){
  dragPtr.started=true;
  ui.dragCard=dragPtr.idx; ui.selCard=null; ui.selUnit=null; ui.targeting=null;
  const c=CARDS[you().hand[dragPtr.idx]];
  const g=dragPtr.cardEl.cloneNode(true);
  g.classList.add('drag-ghost'); g.classList.remove('selected');
  g.style.width=(dragPtr.cardEl.offsetWidth||122)+'px';
  document.body.appendChild(g); dragPtr.ghost=g;
  dragPtr.cardEl.classList.add('dragging');
  document.querySelectorAll('#board-you .node').forEach(n=>{
    if(!you().board[+n.dataset.idx]) n.classList.add('playable');
  });
  document.getElementById('action-hint').textContent=`Drop ${c.name} on a glowing node — each node grants a different bonus.`;
  dragMoveGhost(x,y);
}
function dragMoveGhost(x,y){
  if(dragPtr.ghost){ dragPtr.ghost.style.left=x+'px'; dragPtr.ghost.style.top=y+'px'; }
}
function dragCleanup(){
  if(dragPtr.ghost) dragPtr.ghost.remove();
  if(dragPtr.cardEl) dragPtr.cardEl.classList.remove('dragging');
  document.querySelectorAll('.node.playable,.node.drag-over').forEach(n=>n.classList.remove('playable','drag-over'));
  ui.dragCard=null;
  dragPtr.idx=null; dragPtr.cardEl=null; dragPtr.ghost=null; dragPtr.started=false; dragPtr.overNode=null;
}
document.addEventListener('pointerdown',ev=>{
  if(!G || G.over || G.turn!==0) return;
  if(ev.button!==undefined && ev.button!==0) return;
  const cardEl=ev.target.closest && ev.target.closest('.card.can-drag');
  if(!cardEl) return;
  const i=+cardEl.dataset.hand, c=CARDS[you().hand[i]];
  if(!c || c.t!=='f' || c.cost>you().mana) return;
  dragPtr.idx=i; dragPtr.cardEl=cardEl; dragPtr.started=false;
  dragPtr.sx=ev.clientX; dragPtr.sy=ev.clientY;
  if(cardEl.setPointerCapture){ try{ cardEl.setPointerCapture(ev.pointerId); }catch(e){} }
});
document.addEventListener('pointermove',ev=>{
  if(dragPtr.idx===null) return;
  if(!dragPtr.started){
    if(Math.hypot(ev.clientX-dragPtr.sx, ev.clientY-dragPtr.sy) < 8) return;
    dragStartGhost(ev.clientX, ev.clientY);
  }
  dragMoveGhost(ev.clientX, ev.clientY);
  const node=dragNodeAtPoint(ev.clientX, ev.clientY);
  if(dragPtr.overNode && dragPtr.overNode!==node) dragPtr.overNode.classList.remove('drag-over');
  dragPtr.overNode=node;
  if(node) node.classList.add('drag-over');
  if(ev.cancelable) ev.preventDefault();
});
document.addEventListener('pointerup',ev=>{
  if(dragPtr.idx===null) return;
  const i=dragPtr.idx, started=dragPtr.started;
  const node = started ? dragNodeAtPoint(ev.clientX, ev.clientY) : null;
  dragCleanup();
  if(started){
    dragPtr.suppressClick=true;                       /* swallow the click that follows pointerup */
    setTimeout(()=>{ dragPtr.suppressClick=false; },50);
    if(node) playFollower(you(), i, +node.dataset.idx);
    else renderAll();
  }
});
document.addEventListener('pointercancel',()=>{
  if(dragPtr.idx!==null){ const started=dragPtr.started; dragCleanup(); if(started) renderAll(); }
});
/* native HTML5 drag would fight the pointer implementation — disable it */
document.addEventListener('dragstart',ev=>ev.preventDefault());

/* ---- command bar buttons ---- */
document.getElementById('btn-invoke').addEventListener('click',()=>{
  if(!ui.selUnit) return;
  const ref=ui.selUnit; clearSelection(); invokeWith(you(),ref);
});
document.getElementById('btn-cancel').addEventListener('click',()=>{ clearSelection(); renderAll(); });
document.getElementById('btn-end').addEventListener('click',()=>{ if(G && G.turn===0 && !G.over) endTurn(); });
document.getElementById('btn-summon').addEventListener('click',()=>{ if(G && G.turn===0) summonAbstract(you()); });
document.getElementById('btn-ability').addEventListener('click',()=>{ if(G && G.turn===0) useAbility(you()); });
document.getElementById('btn-help').addEventListener('click',()=>document.getElementById('help-overlay').classList.remove('hidden'));
document.getElementById('btn-help-close').addEventListener('click',()=>document.getElementById('help-overlay').classList.add('hidden'));
document.getElementById('btn-restart').addEventListener('click',()=>location.reload());
document.addEventListener('keydown',ev=>{
  if(!G || G.over) return;
  if(ev.key==='Escape'){
    if(!document.getElementById('help-overlay').classList.contains('hidden')){
      document.getElementById('help-overlay').classList.add('hidden'); return;
    }
    if(ui.selCard!==null||ui.selUnit||ui.targeting){ clearSelection(); renderAll(); }
  }
  if(ev.key==='Enter' && G.turn===0 && !ui.selCard && !ui.selUnit) endTurn();
});
