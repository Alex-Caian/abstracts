'use strict';
/* =====================================================================
   ABSTRACTS — decks.js
   Deck manager + editor (signed-in). Reads/writes the per-user profile
   through window.Account (createDeck/updateDeck/deleteDeck/legality).
   Reuses cardTileHtml() + isUnlocked() from collection.js.
   Flow: Decks -> Abstract chooser -> deck list -> editor.
   ===================================================================== */
let deckEditor = null;

function deckTotal(counts){ return Object.values(counts).reduce((s,n)=>s+n,0); }
function expandCounts(counts){ const a=[]; Object.keys(counts).forEach(c=>{ for(let i=0;i<counts[c];i++) a.push(c); }); return a; }

/* ---- Abstract chooser ---- */
function renderDecksChooser(){
  const el = document.getElementById('decks-body'); if(!el) return;
  const acc = window.Account;
  el.innerHTML = `<div class="pick-row">` + Object.keys(ARCH).map(arch=>{
    const n = (acc && acc.decksFor ? acc.decksFor(arch) : []).length;
    return `<div class="pick ${ARCH[arch].css}" data-arch="${arch}">${typeof sigilSvg==='function'?sigilSvg(arch):''}<h2>${ARCH[arch].name}</h2><span class="geo">${n} deck${n===1?'':'s'}</span></div>`;
  }).join('') + `</div>`;
  el.querySelectorAll('.pick').forEach(t=>t.addEventListener('click',()=>renderDeckList(t.dataset.arch)));
}

/* ---- deck list for one Abstract ---- */
function renderDeckList(arch){
  const el = document.getElementById('decks-body'); if(!el) return;
  const acc = window.Account;
  const decks = acc.decksFor(arch);
  const canCreate = decks.length < acc.rules.MAX_DECKS_PER_ARCH;
  el.innerHTML = `<div class="camp-head ${ARCH[arch].css}">${ARCH[arch].name} — your decks</div>` +
    decks.map(d=>{
      const def = d.id === 'default';
      return `<div class="deck-row ${ARCH[arch].css}">
        <div class="deck-row-main"><h3>${escapeHtml(d.name)}</h3><p>${(d.cards||[]).length} cards${def?' · <em>view only</em>':''}</p></div>
        <div class="deck-row-actions">${def?`<button class="btn de-view" data-id="${d.id}">View</button>`:`<button class="btn de-edit" data-id="${d.id}">Edit</button><button class="btn de-del" data-id="${d.id}">Delete</button>`}</div>
      </div>`;
    }).join('') +
    (canCreate ? `<button class="btn primary" id="deck-new">+ New deck</button>`
               : `<div class="note">Up to ${acc.rules.MAX_DECKS_PER_ARCH} decks per Abstract.</div>`) +
    `<button class="btn" id="decks-arch-back" style="margin-top:6px">← Abstracts</button>`;
  el.querySelectorAll('.de-edit').forEach(b=>b.addEventListener('click',()=>openDeckEditor(arch, b.dataset.id)));
  el.querySelectorAll('.de-del').forEach(b=>b.addEventListener('click',async()=>{
    if(window.confirm('Delete this deck?')){ try{ await acc.deleteDeck(arch, b.dataset.id); }catch(e){} renderDeckList(arch); }
  }));
  el.querySelectorAll('.de-view').forEach(b=>b.addEventListener('click',()=>openDeckView(arch, b.dataset.id)));
  const nb = document.getElementById('deck-new'); if(nb) nb.addEventListener('click',()=>openDeckEditor(arch, null));
  document.getElementById('decks-arch-back').addEventListener('click', renderDecksChooser);
}

/* ---- read-only deck view (e.g. the un-editable Default) ---- */
function openDeckView(arch, deckId){
  const acc = window.Account;
  const d = acc.decksFor(arch).find(x=>x.id===deckId); if(!d) return;
  const counts = {}; (d.cards||[]).forEach(c=>counts[c]=(counts[c]||0)+1);
  const cids = Object.keys(counts).sort((a,b)=>{ const A=CARDS[a],B=CARDS[b]; if(!A||!B) return 0; const ta=A.t==='f'?0:1, tb=B.t==='f'?0:1; return ta!==tb?ta-tb:A.cost-B.cost; });
  const total = (d.cards||[]).length;
  const h1 = document.querySelector('#screen-deckedit h1'); if(h1) h1.textContent = 'DECK';
  const sub = document.querySelector('#screen-deckedit .sub'); if(sub) sub.textContent = `${escapeHtml(d.name)} · ${total} cards · view only`;
  const el = document.getElementById('deckedit-body');
  el.innerHTML = `<div class="lib-grid de-grid ${ARCH[arch].css}">` + cids.map(cid=>
    `<div class="edit-card view-card" data-cid="${cid}">${cardTileHtml(cid, true)}<div class="de-badge has">${counts[cid]}</div></div>`
  ).join('') + `</div><button class="btn" id="dv-back" style="margin-top:6px">← Back</button>`;
  el.querySelectorAll('.view-card').forEach(card=>card.addEventListener('click',()=>{ if(typeof openCardZoom==='function') openCardZoom(card.dataset.cid); }));
  document.getElementById('dv-back').addEventListener('click',()=>{ renderDeckList(arch); showScreen('screen-decks'); });
  showScreen('screen-deckedit');
}

/* ---- editor ---- */
function openDeckEditor(arch, deckId){
  const acc = window.Account;
  let name = 'New deck', counts = {};
  if(deckId){
    const d = acc.decksFor(arch).find(x=>x.id===deckId);
    if(d){ name = d.name; (d.cards||[]).forEach(c=>counts[c]=(counts[c]||0)+1); }
  }
  /* a new deck starts empty — built from scratch */
  deckEditor = { arch, deckId, name, counts, msg:'' };
  renderDeckEditor();
  showScreen('screen-deckedit');
}

function renderDeckEditor(){
  const ed = deckEditor; if(!ed) return;
  const acc = window.Account; const arch = ed.arch;
  const h1 = document.querySelector('#screen-deckedit h1'); if(h1) h1.textContent = 'DECK EDITOR';
  const sub = document.querySelector('#screen-deckedit .sub'); if(sub) sub.textContent = `${acc.rules.DECK_SIZE} cards · up to ${acc.rules.MAX_COPIES} per card (Apparitions: 1) · tap to add, − to remove`;
  const size = acc.rules.DECK_SIZE, max = acc.rules.MAX_COPIES;
  const total = deckTotal(ed.counts);
  const legal = acc.legality(expandCounts(ed.counts)).ok;
  const pool = Object.keys(CARDS).filter(c=>CARDS[c].arch===arch && !CARDS[c].hidden && isUnlocked(c))
    .sort((a,b)=>{ const A=CARDS[a],B=CARDS[b]; const ta=A.t==='f'?0:1, tb=B.t==='f'?0:1; return ta!==tb?ta-tb:A.cost-B.cost; });
  const el = document.getElementById('deckedit-body');
  el.innerHTML = `
    <div class="de-bar ${ARCH[arch].css}">
      <input id="de-name" class="de-name" maxlength="24" value="${(ed.name||'').replace(/"/g,'&quot;')}">
      <span class="de-count ${total===size?'ok':'bad'}">${total} / ${size}</span>
      <button class="btn primary" id="de-save" ${legal?'':'disabled'}>Save</button>
      <button class="btn" id="de-cancel">Cancel</button>
      <span class="de-msg">${ed.msg||''}</span>
    </div>
    <div class="lib-grid de-grid ${ARCH[arch].css}">` + pool.map(cid=>{
      const cmax = acc.maxCopies ? acc.maxCopies(cid) : (CARDS[cid].apparition?1:max);
      const n = ed.counts[cid]||0;
      return `<div class="edit-card ${n>=cmax?'maxed':''} ${(total>=size && n<cmax)?'full':''}" data-cid="${cid}">
        ${cardTileHtml(cid, true)}
        <div class="de-badge ${n>0?'has':''}">${n}</div>
        <div class="de-pm">
          <button class="de-minus" data-cid="${cid}" ${n<=0?'disabled':''}>−</button>
          <button class="de-plus" data-cid="${cid}" ${(n>=cmax || total>=size)?'disabled':''}>+</button>
        </div>
      </div>`;
    }).join('') + `</div>`;
  el.querySelector('#de-name').addEventListener('input', e=>{ e.target.value = e.target.value.replace(/[^A-Za-z0-9_-]/g, ''); ed.name = e.target.value; });
  el.querySelector('#de-save').addEventListener('click', saveEditor);
  el.querySelector('#de-cancel').addEventListener('click', ()=>{ renderDeckList(arch); showScreen('screen-decks'); });
  el.querySelectorAll('.edit-card').forEach(card=>card.addEventListener('click', ()=>{ if(typeof openCardZoom==='function') openCardZoom(card.dataset.cid); }));
  el.querySelectorAll('.de-plus').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); addCard(b.dataset.cid); }));
  el.querySelectorAll('.de-minus').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); removeCard(b.dataset.cid); }));
}

function addCard(cid){
  const ed = deckEditor; const acc = window.Account;
  const total = deckTotal(ed.counts), n = ed.counts[cid]||0;
  const cmax = acc.maxCopies ? acc.maxCopies(cid) : (CARDS[cid].apparition?1:acc.rules.MAX_COPIES);
  if(n < cmax && total < acc.rules.DECK_SIZE){ ed.counts[cid] = n+1; ed.msg=''; renderDeckEditor(); }
}
function removeCard(cid){
  const ed = deckEditor;
  if(ed.counts[cid] > 0){ ed.counts[cid]--; if(!ed.counts[cid]) delete ed.counts[cid]; ed.msg=''; renderDeckEditor(); }
}
async function saveEditor(){
  const ed = deckEditor; const acc = window.Account;
  const cards = expandCounts(ed.counts);
  try{
    if(ed.deckId) await acc.updateDeck(ed.arch, ed.deckId, { name:ed.name, cards });
    else          await acc.createDeck(ed.arch, ed.name, cards);
    renderDeckList(ed.arch); showScreen('screen-decks');
  }catch(e){ ed.msg = (e && e.message) || 'Save failed.'; renderDeckEditor(); }
}

(function wireDecks(){
  const btn = document.getElementById('home-decks');
  if(btn) btn.addEventListener('click', ()=>{ renderDecksChooser(); showScreen('screen-decks'); });
  const back = document.getElementById('decks-back');
  if(back) back.addEventListener('click', ()=>showScreen('screen-home'));
})();
