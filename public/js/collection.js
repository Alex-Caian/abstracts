'use strict';
/* =====================================================================
   ABSTRACTS — collection.js
   The Collection: pick an Abstract, browse just that Abstract's cards,
   click an unlocked card for a zoomed pop-out with plain-language
   explanations. Unlock state comes from the signed-in profile.
   cardTileHtml() is shared with the deck editor (slice 3).
   ===================================================================== */

/* ---- card tile (shared) ---- */
function cardTileHtml(cid, unlocked){
  const c = CARDS[cid]; if(!c) return '';
  const archCss = (ARCH[c.arch] || {}).css || '';
  const stats = c.t === 'f'
    ? `<div class="cstats"><span class="uatk">${c.atk}</span><span class="cinv">✦ ${c.inv}</span><span class="uhp">${c.hp}</span></div>`
    : '';
  return `<div class="card ${archCss} lib-card ${unlocked ? '' : 'locked'} ${c.apparition?'apparition':''}" data-cid="${cid}">
    <div class="cost">${c.cost}</div>
    <div class="cname">${c.name}</div>
    <div class="ctype">${c.t === 'f' ? 'Follower' : 'Spell'}</div>
    <div class="ctext">${c.txt || ''}</div>
    ${stats}
    ${unlocked ? '' : '<div class="lib-lock">Locked</div>'}
  </div>`;
}

/* ---- explanations ----
   Per-card LORE shown (italic) beneath the zoomed card's name. Followers
   only — spells carry no lore. This is the single hook: add a string here
   to populate the panel. */
const CARD_HELP = {
  /* FEAR */
  f_shadow:  'Someone\'s watching...',
  f_whisper: 'Don\'t listen to what it says, it\'s not real!',
  f_acolyte: 'A devoted invoker.',
  f_hound:   'Focusing on your chants will hardly work when you hear the growls.',
  f_wraith:  'My death will not be forgotten.',
  f_stalker: 'Dines alone.',
  f_grow:    'It grows by the minute!',
  f_ap_senths: 'I AM HERE, WITH *ALL* OF MY CHILDREN...',
  /* JUSTICE */
  j_herald:  'A devoted invoker.',
  j_vindic:  'This is God\'s chosen place.',
  j_paladin: 'Worry not, I am here.',
  j_arbiter: 'Feel the rejuvenation flow through.',
  j_oath:    'I promised I\'d be here in your time of need.',
  j_magis:   'You get retribution! And you, and you, ...',
  j_brute:   'Grahhhhhh *cough* *cough*. Sorry.',
  /* KNOWLEDGE */
  k_scribe:  'I\'m almost done translating this scroll.',
  k_owl:     'A devoted invoker.',
  k_archiv:  'I\'m trying to keep track of everything...',
  k_sage:    'Through communion we\'ll achieve Unity.',
  k_lore:    'Once upon a.. wait, wrong line.',
  k_borrower:'Quick, here. Hide in a different realm whilst I think of a good excuse..'
};
function cardExplanations(cid){
  const out = [];
  if (CARD_HELP[cid]) out.push(CARD_HELP[cid].replace(/\*([^*]+)\*/g, '<em>$1</em>'));   // *word* -> emphasis
  const c = CARDS[cid]; if (c && c.explain) out.push(c.explain);   // rules clarification (e.g. Web-spinning's "bonded")
  return out;
}

function isUnlocked(cid){
  const acc = window.Account;
  return (!acc || !acc.isUnlocked) ? true : acc.isUnlocked(cid);
}

/* ---- views: Abstract chooser -> single-Abstract gallery ---- */
function buildCollection(){ renderAbstractChooser(); }

function renderAbstractChooser(){
  const el = document.getElementById('collection-list'); if(!el) return;
  el.innerHTML = `<div class="pick-row">` + Object.keys(ARCH).map(arch => {
    const cards = Object.keys(CARDS).filter(c => CARDS[c].arch === arch && !CARDS[c].hidden);
    const owned = cards.filter(isUnlocked).length;
    return `<div class="pick ${ARCH[arch].css}" data-arch="${arch}">
      ${typeof sigilSvg === 'function' ? sigilSvg(arch) : ''}
      <h2>${ARCH[arch].name}</h2>
      <span class="geo">${owned} / ${cards.length} cards</span>
    </div>`;
  }).join('') + `</div>`;
  el.querySelectorAll('.pick').forEach(t => t.addEventListener('click', () => renderArchGallery(t.dataset.arch)));
}

function renderArchGallery(arch, tfilter, mfilter){
  const el = document.getElementById('collection-list'); if(!el) return;
  tfilter = tfilter || 'all';
  mfilter = Array.isArray(mfilter) ? mfilter : [];   // selected mana costs (multi-select); empty = all
  const all = Object.keys(CARDS).filter(c => CARDS[c].arch === arch && !CARDS[c].hidden);
  const owned = all.filter(isUnlocked).length;
  /* order: followers first, then spells; within each, ascending mana cost */
  const ordered = all.slice().sort((a,b)=>{
    const A = CARDS[a], B = CARDS[b];
    const ta = A.t === 'f' ? 0 : 1, tb = B.t === 'f' ? 0 : 1;
    return ta !== tb ? ta - tb : A.cost - B.cost;
  });
  let shown = ordered;
  if(tfilter !== 'all') shown = shown.filter(c => CARDS[c].t === (tfilter === 'spells' ? 's' : 'f'));
  if(mfilter.length) shown = shown.filter(c => mfilter.includes(CARDS[c].cost));
  const tbtn = (id,label) => `<button class="lib-filt ${tfilter===id?'on':''}" data-tfilt="${id}">${label}</button>`;
  const mbtn = (m,label,on) => `<button class="lib-filt ${on?'on':''}" data-mfilt="${m}">${label}</button>`;
  const manaRow = mbtn('all','All',mfilter.length===0) + [0,1,2,3,4,5,6,7,8,9,10].map(m => mbtn(m,m,mfilter.includes(m))).join('');
  el.innerHTML =
    `<div class="camp-head ${ARCH[arch].css}">${ARCH[arch].name} <span class="lib-count">${owned}/${all.length}</span></div>` +
    `<div class="lib-filter ${ARCH[arch].css}">${tbtn('all','All')}${tbtn('followers','Followers')}${tbtn('spells','Spells')}</div>` +
    `<div class="lib-filter lib-mana ${ARCH[arch].css}"><span class="lib-flabel">Mana</span>${manaRow}</div>` +
    `<div class="lib-grid">` + shown.map(c => cardTileHtml(c, isUnlocked(c))).join('') + `</div>` +
    `<button class="btn" id="lib-arch-back" style="margin-top:4px">← Abstracts</button>`;
  el.querySelectorAll('.lib-filt[data-tfilt]').forEach(b => b.addEventListener('click', () => renderArchGallery(arch, b.dataset.tfilt, mfilter)));
  el.querySelectorAll('.lib-filt[data-mfilt]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.mfilt;
    let next;
    if(v==='all') next = [];
    else { const n=+v; next = mfilter.includes(n) ? mfilter.filter(x=>x!==n) : mfilter.concat(n); }
    renderArchGallery(arch, tfilter, next);
  }));
  document.getElementById('lib-arch-back').addEventListener('click', renderAbstractChooser);
  el.querySelectorAll('.lib-card').forEach(t =>
    t.addEventListener('click', () => openCardZoom(t.dataset.cid)));
}

/* ---- pop-out zoom ---- */
function czEsc(e){ if(e.key === 'Escape') closeCardZoom(); }
function closeCardZoom(){ const ov = document.getElementById('card-zoom'); if(ov) ov.remove(); document.removeEventListener('keydown', czEsc); }
/* unlock condition for a locked card, derived from the campaign rewards */
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>';
function unlockCondition(cid){
  if(CARDS[cid] && CARDS[cid].unlockHint) return CARDS[cid].unlockHint;   // manual hint (e.g. a reward not yet wired to a stage)
  if(typeof CAMPAIGN === 'object' && CAMPAIGN){
    for(const ck in CAMPAIGN){
      const camp = CAMPAIGN[ck], games = camp.games || [];
      for(let i=0;i<games.length;i++){
        if(games[i].reward === cid) return `Complete the "${camp.name}" campaign, Game ${i+1}.`;
      }
    }
  }
  return 'Unlock condition coming soon.';
}
function openCardZoom(cid){
  if(!CARDS[cid]) return;
  closeCardZoom();
  const unlocked = isUnlocked(cid);
  const info = unlocked
    ? cardExplanations(cid).map(e => `<div class="cz-expl">${e}</div>`).join('')
    : `<div class="cz-cond"><b>Locked.</b> ${unlockCondition(cid)}</div>`;
  const ov = document.createElement('div');
  ov.className = 'overlay card-zoom'; ov.id = 'card-zoom';
  ov.innerHTML = `<div class="cz-box">
    <div class="cz-card-wrap${unlocked?'':' locked'}">${cardTileHtml(cid, true)}${unlocked?'':`<div class="cz-lock">${LOCK_SVG}</div>`}</div>
    <div class="cz-info"><h3>${CARDS[cid].name}</h3>${info}</div>
    <button class="btn" id="cz-close">Close</button>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.id === 'cz-close') closeCardZoom(); });
  document.addEventListener('keydown', czEsc);
}

(function wireCollection(){
  const btn = document.getElementById('home-collection');
  if(btn) btn.addEventListener('click', () => { buildCollection(); showScreen('screen-collection'); });
  const back = document.getElementById('collection-back');
  if(back) back.addEventListener('click', () => showScreen('screen-home'));
})();
