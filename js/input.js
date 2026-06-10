'use strict';
/* =====================================================================
   ABSTRACTS — input.js
   All player input. One delegated click handler for the battlefield;
   command-bar buttons have their own listeners and are explicitly
   excluded from the delegated handler (this was the cause of the old
   "Attack button does nothing" bug: the button click bubbled up to the
   document handler, which read it as a background click and cancelled
   the targeting it had just started).
   ===================================================================== */

/* Select one of your units: immediately enters attack targeting. */
function selectUnit(ref){
  ui.selCard=null;
  ui.selUnit=ref;
  const u=getUnit(ref);
  const canInvoke = u && !u.isAbstract && u.invoke>0 && !you().summoned;
  ui.targeting={
    mode:'attack',
    hint:`Attack: click an enemy follower${enemy().abstractUnit?', their Abstract':''} or their hero.`+(canInvoke?` Or press Invoke +${u.invoke}.`:''),
    onPick:(t)=>{ const r=ui.selUnit; clearSelection(); attackWith(you(),r,t); }
  };
  renderAll();
}

document.addEventListener('click',ev=>{
  if(!G || G.over || G.turn!==0) return;
  /* command bar & overlays manage their own clicks */
  if(ev.target.closest('#cmdbar') || ev.target.closest('.overlay') || ev.target.closest('#sidebar')) return;
  const p=you();

  /* ---- hand card (spells cast by click; followers are drag-and-drop) ---- */
  const cardEl=ev.target.closest('.card[data-hand]');
  if(cardEl){
    const i=+cardEl.dataset.hand, c=CARDS[p.hand[i]];
    if(c.cost>p.mana){ flashHint(`Not enough mana for ${c.name} (${c.cost}).`); return; }
    if(c.t==='f'){ flashHint(`Drag ${c.name} onto one of your nodes to play it.`); return; }
    ui.selUnit=null; ui.targeting=null;
    if(ui.selCard===i){ ui.selCard=null; renderAll(); return; }   /* click again deselects */
    ui.selCard=i;
    if(!c.target){ const idx=ui.selCard; ui.selCard=null; castSpell(p,idx,null); return; }
    if(c.target==='enemyUnit' && unitRefs(enemy(),false).length===0){ flashHint('No enemy follower to target.'); ui.selCard=null; renderAll(); return; }
    if(c.target==='friendUnit' && unitRefs(p,false).length===0){ flashHint('You have no follower to target.'); ui.selCard=null; renderAll(); return; }
    ui.targeting={mode:c.target,
      hint:c.target==='enemyUnit'?'Choose an enemy follower.':'Choose one of your followers.',
      onPick:(ref)=>{ const idx=ui.selCard; clearSelection(); castSpell(p,idx,ref); }};
    renderAll(); return;
  }

  /* ---- targeting clicks ---- */
  if(ui.targeting){
    const t=ui.targeting;
    const foeUnit=ev.target.closest('#board-foe .unit');
    const foeCentre=ev.target.closest('#board-foe .centre');
    const youUnit=ev.target.closest('#board-you .unit');
    const youCentre=ev.target.closest('#board-you .centre');
    if((t.mode==='enemyUnit'||t.mode==='attack') && foeUnit){ t.onPick({pi:1,zone:'board',idx:+foeUnit.dataset.idx}); return; }
    if((t.mode==='enemyUnit'||t.mode==='attack') && foeCentre && enemy().abstractUnit){ t.onPick({pi:1,zone:'abstract',idx:-1}); return; }
    if(t.mode==='attack' && ev.target.closest('#strip-foe')){ t.onPick({pi:1,zone:'hero'}); return; }
    if(t.mode==='friendUnit' && youUnit){ t.onPick({pi:0,zone:'board',idx:+youUnit.dataset.idx}); return; }
    /* while aiming an attack, clicking another of your ready units switches to it */
    if(t.mode==='attack' && youUnit){
      const idx=+youUnit.dataset.idx, u=p.board[idx];
      if(ui.selUnit && ui.selUnit.zone==='board' && ui.selUnit.idx===idx){ clearSelection(); renderAll(); return; } /* same unit: deselect */
      if(u && u.ready){ selectUnit({pi:0,zone:'board',idx}); return; }
    }
    if(t.mode==='attack' && youCentre && p.abstractUnit && p.abstractUnit.ready){
      if(ui.selUnit && ui.selUnit.zone==='abstract'){ clearSelection(); renderAll(); return; }
      selectUnit({pi:0,zone:'abstract',idx:-1}); return;
    }
    /* click elsewhere cancels */
    clearSelection(); renderAll(); return;
  }

  /* ---- own unit selection ---- */
  const myUnit=ev.target.closest('#board-you .unit');
  if(myUnit){
    const idx=+myUnit.dataset.idx, u=p.board[idx];
    if(!u) return;
    if(u.sick){ flashHint(`${u.name} was just played — it can act next turn.`); return; }
    if(!u.ready){ flashHint(`${u.name} has already acted this turn.`); return; }
    selectUnit({pi:0,zone:'board',idx});
    return;
  }
  const myCentre=ev.target.closest('#board-you .centre');
  if(myCentre && p.abstractUnit){
    const u=p.abstractUnit;
    if(u.sick){ flashHint(`${u.name} has just taken form — it can act next turn.`); return; }
    if(!u.ready){ flashHint(`${u.name} has already acted this turn.`); return; }
    selectUnit({pi:0,zone:'abstract',idx:-1});
    return;
  }

  /* ---- background click clears ---- */
  if(ui.selCard!==null||ui.selUnit){ clearSelection(); renderAll(); }
});

/* ---- drag & drop: followers from hand onto your nodes ----
   NOTE: never re-render the hand during a drag — destroying the dragged
   element mid-drag silently kills the HTML5 drag operation. Node
   highlights are applied directly here instead of via renderAll(). */
document.addEventListener('dragstart',ev=>{
  const cardEl=ev.target.closest && ev.target.closest('.card[data-hand]');
  if(!cardEl || !G || G.over || G.turn!==0){ ev.preventDefault(); return; }
  const i=+cardEl.dataset.hand, c=CARDS[you().hand[i]];
  if(!c || c.t!=='f' || c.cost>you().mana){ ev.preventDefault(); return; }
  ui.dragCard=i; ui.selCard=null; ui.selUnit=null; ui.targeting=null;
  if(ev.dataTransfer){ ev.dataTransfer.setData('text/plain',String(i)); ev.dataTransfer.effectAllowed='move'; }
  cardEl.classList.add('dragging');
  document.querySelectorAll('#board-you .node').forEach(n=>{
    if(!you().board[+n.dataset.idx]) n.classList.add('playable');
  });
  const hint=document.getElementById('action-hint');
  hint.textContent=`Drop ${c.name} on a glowing node — each node grants a different bonus.`;
});
document.addEventListener('dragover',ev=>{
  if(ui.dragCard===null) return;
  const node=ev.target.closest && ev.target.closest('#board-you .node');
  if(node && !you().board[+node.dataset.idx]){
    ev.preventDefault();
    if(ev.dataTransfer) ev.dataTransfer.dropEffect='move';
    node.classList.add('drag-over');
  }
});
document.addEventListener('dragleave',ev=>{
  const node=ev.target.closest && ev.target.closest('#board-you .node');
  if(node) node.classList.remove('drag-over');
});
document.addEventListener('drop',ev=>{
  if(ui.dragCard===null) return;
  ev.preventDefault();
  const node=ev.target.closest && ev.target.closest('#board-you .node');
  const i=ui.dragCard; ui.dragCard=null;
  if(node && !you().board[+node.dataset.idx]) playFollower(you(),i,+node.dataset.idx);
  else renderAll();
});
document.addEventListener('dragend',()=>{
  document.querySelectorAll('.node.playable,.node.drag-over').forEach(n=>n.classList.remove('playable','drag-over'));
  document.querySelectorAll('.card.dragging').forEach(c=>c.classList.remove('dragging'));
  if(ui.dragCard!==null){ ui.dragCard=null; renderAll(); }
});

/* ---- command bar buttons ---- */
document.getElementById('btn-invoke').addEventListener('click',()=>{
  if(!ui.selUnit) return;
  const ref=ui.selUnit; clearSelection(); invokeWith(you(),ref);
});
document.getElementById('btn-cancel').addEventListener('click',()=>{ clearSelection(); renderAll(); });
document.getElementById('btn-end').addEventListener('click',()=>{ if(G && G.turn===0 && !G.over) endTurn(); });
document.getElementById('btn-summon').addEventListener('click',()=>{ if(G && G.turn===0) summonAbstract(you()); });
document.getElementById('btn-help').addEventListener('click',()=>document.getElementById('help-overlay').classList.remove('hidden'));
document.getElementById('btn-help-close').addEventListener('click',()=>document.getElementById('help-overlay').classList.add('hidden'));
document.getElementById('btn-restart').addEventListener('click',()=>location.reload());

/* ---- keyboard ---- */
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
