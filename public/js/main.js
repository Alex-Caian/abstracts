'use strict';
/* =====================================================================
   ABSTRACTS — main.js
   Bootstrap: deck-select screen and debug handle.
   ===================================================================== */

function sigilSvg(archKey){
  const a=ARCH[archKey];
  const pts=a.angles.map(ang=>{
    const r=40,rad=ang*Math.PI/180;
    return (50+r*Math.cos(rad)).toFixed(1)+','+(50+r*Math.sin(rad)).toFixed(1);
  });
  let s=`<svg viewBox="0 0 100 100"><polygon points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  a.angles.forEach(ang=>{
    const r=40,rad=ang*Math.PI/180;
    s+=`<line x1="50" y1="50" x2="${(50+r*Math.cos(rad)).toFixed(1)}" y2="${(50+r*Math.sin(rad)).toFixed(1)}" stroke="var(--accent)" stroke-opacity=".4" stroke-width="1"/>`;
    s+=`<circle cx="${(50+r*Math.cos(rad)).toFixed(1)}" cy="${(50+r*Math.sin(rad)).toFixed(1)}" r="3.5" fill="var(--accent)"/>`;
  });
  s+=`<circle cx="50" cy="50" r="6" fill="var(--accent)"/></svg>`;
  return s;
}

function showScreen(id){
  ['screen-home','screen-select','screen-deckpick','screen-campaign','screen-collection','screen-decks','screen-deckedit','screen-game'].forEach(s=>{
    const el=document.getElementById(s); if(el) el.classList.toggle('hidden', s!==id);
  });
}
/* escape user-provided strings before injecting into innerHTML (defence-in-depth vs XSS) */
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* picking an Abstract: signed-in players choose a deck first; otherwise default */
function pickArch(arch){
  const acc = window.Account;
  if(acc && acc.user && acc.profile){ showDeckPick(arch); }
  else { newGame(arch); }
}
let deckPickBack = null;   // where the deck-pick Back button returns (set per context)
function showDeckPick(arch, onPick, onBack){
  deckPickBack = onBack || null;
  const acc = window.Account;
  const decks = (acc && acc.decksFor) ? acc.decksFor(arch) : [];
  document.getElementById('deckpick-arch').textContent = ARCH[arch].name;
  const list = document.getElementById('deckpick-list');
  list.innerHTML = decks.map(d=>
    `<div class="camp-stage ${ARCH[arch].css}" data-deck="${d.id}"><h3>${escapeHtml(d.name)}</h3><p>${(d.cards||[]).length} cards</p></div>`
  ).join('');
  list.querySelectorAll('.camp-stage').forEach(el=>el.addEventListener('click',()=>{
    const deck = decks.find(d=>d.id===el.dataset.deck);
    const cards = deck && deck.cards;
    if(onPick) onPick(cards);
    else newGame(arch, { youDeck: cards });
  }));
  showScreen('screen-deckpick');
}

(function buildSelect(){
  const row=document.getElementById('pick-row');
  row.innerHTML=Object.keys(ARCH).map(k=>{
    const a=ARCH[k];
    return `<div class="pick ${a.css}" data-arch="${k}">
      ${sigilSvg(k)}
      <h2>${a.name}</h2>
      <p>${a.blurb}</p>
      <span class="geo">${a.desc}</span>
    </div>`;
  }).join('');
  row.querySelectorAll('.pick').forEach(el=>el.addEventListener('click',()=>pickArch(el.dataset.arch)));
})();

/* ---- campaign: chooser -> games (sequential unlock) -> tutorial -> play (v0.3.0) ---- */
const TUTORIALS = {
  basics: [
    { title:'You are the Abstract', text:'You don\'t command a hero. You ARE the concept, and here you take up Knowledge. Your core, 30 HP at the centre of your diagram, is your life. Reduce the enemy core to 0 to win.' },
    { title:'Summon followers', text:'Drag a follower from your hand onto an empty node (a dot) of your diagram to summon it. Each node grants a different bonus, so placement matters. Hover a node to see what it gives.' },
    { title:'Act with followers', text:'A follower can act once per turn, but never the turn it is played. Click a glowing follower, then choose its action: strike an enemy follower, or hit the enemy core directly.' },
    { title:'Essence and your form', text:'Instead of attacking, a follower can Invoke, channelling essence (the violet currency). Spend essence to summon your Abstract\'s manifested form, which shields your core completely while it stands.' },
    { title:'Links and communion', text:'Followers on adjacent nodes form a link, and only a linked follower may invoke. Begin a turn with every node filled to reach communion, channelling bonus essence each turn.' },
    { title:'Your first duel', text:'Justice stands before you, weakened. Defeat it to claim your first reward. Good luck.' }
  ],
  intermediate: [
    { title:'Communion', text:'Begin a turn with every node of your diagram filled, and the complete circle enters communion: it channels bonus essence each turn, one for every follower. A whole circle is a powerful engine, and a wise opponent will try to break it before your turn comes.' },
    { title:'The three concepts', text:'Each concept fights differently. Justice, which you wield, fields fewer followers across its three nodes, but those nodes grant stronger bonuses and its bodies are sturdier. Fear overwhelms through aggression and weight of numbers. Knowledge reshapes its own diagram, drawing quickly and casting powerful spells.' },
    { title:'Ready to break through', text:'The Fear you face is already swollen with essence, poised to take form. It holds back for now, but in four turns it will break through and manifest. Build your circle and brace for the assault.' }
  ],
  advanced: [
    { title:'The litany', text:'Your deck never runs dry: when it empties, your spent cards shuffle back in and the litany begins anew. But your hand caps at eight cards. Draw with a full hand and the new card is forgotten, lost from the cycle for good, so play your cards before you overdraw.' },
    { title:'Resummoning', text:'Your manifested form shields your core, and when it is unmade it can take form again. But each resummon costs more essence than the last, five more every time, so losing your form is a real setback. Guard it well, or be ready to pay the rising price.' }
  ]
};

/* the brand colour for a dialogue speaker, matched by Abstract name (or explicit arch) */
function speakerColor(speaker, arch){
  const key = arch || (speaker && Object.keys(ARCH).find(k=>ARCH[k].name===String(speaker).toUpperCase()));
  return ({fear:'var(--fear)',justice:'var(--justice)',knowledge:'var(--knowledge)'})[key] || 'var(--invoke)';
}
/* dialogue text: escape, then render _word_ as emphasis (rendered upright inside the italic line) */
function fmtDialogue(s){ return escapeHtml(s).replace(/_([^_]+)_/g,'<em>$1</em>'); }

function runTutorial(steps, onDone){
  const ov=document.getElementById('tutorial-overlay'); if(!ov || !steps || !steps.length){ onDone(); return; }
  const titleEl=document.getElementById('tut-title'), textEl=document.getElementById('tut-text'),
        stepEl=document.getElementById('tut-step'), nextBtn=document.getElementById('tut-next'),
        backBtn=document.getElementById('tut-back');
  let i=0;
  function show(){ const s=steps[i]; if(stepEl) stepEl.textContent=`${i+1} / ${steps.length}`;
    titleEl.style.color=''; titleEl.textContent=s.title; textEl.textContent=s.text;
    nextBtn.textContent = i===steps.length-1?'Begin':'Next';
    if(backBtn) backBtn.style.visibility = i===0?'hidden':'visible'; }
  function cleanup(){ ov.classList.add('hidden'); nextBtn.removeEventListener('click',next); if(backBtn) backBtn.removeEventListener('click',back); }
  function next(){ i++; if(i>=steps.length){ cleanup(); onDone(); } else show(); }
  function back(){ if(i>0){ i--; show(); } }
  nextBtn.addEventListener('click', next);
  if(backBtn) backBtn.addEventListener('click', back);
  show(); ov.classList.remove('hidden');
}

/* story dialogue before a match — reuses the tutorial overlay in a distinct
   'dialogue' style. lines: [{speaker, text, arch?}]. Speaker is coloured by
   its Abstract's brand hue. Falls through if none. */
function runDialogue(lines, onDone){
  const ov=document.getElementById('tutorial-overlay');
  if(!ov || !lines || !lines.length){ if(onDone) onDone(); return; }
  const titleEl=document.getElementById('tut-title'), textEl=document.getElementById('tut-text'),
        stepEl=document.getElementById('tut-step'), nextBtn=document.getElementById('tut-next'),
        backBtn=document.getElementById('tut-back');
  ov.classList.add('dialogue-mode');
  let i=0;
  function show(){ const l=lines[i];
    if(stepEl) stepEl.textContent='';
    titleEl.textContent=l.speaker||''; titleEl.style.color=speakerColor(l.speaker, l.arch);
    textEl.innerHTML=fmtDialogue(l.text||'');
    nextBtn.textContent = i===lines.length-1?'Begin':'Next';
    if(backBtn){ backBtn.style.display = lines.length===1 ? 'none' : '';   // a one-line card has nothing to go back to: drop the button so Begin sits centred
      backBtn.style.visibility = i===0?'hidden':'visible'; } }
  function cleanup(){ ov.classList.add('hidden'); ov.classList.remove('dialogue-mode'); titleEl.style.color=''; nextBtn.removeEventListener('click',next); if(backBtn){ backBtn.removeEventListener('click',back); backBtn.style.display=''; } }
  function next(){ i++; if(i>=lines.length){ cleanup(); if(onDone) onDone(); } else show(); }
  function back(){ if(i>0){ i--; show(); } }
  nextBtn.addEventListener('click', next);
  if(backBtn) backBtn.addEventListener('click', back);
  show(); ov.classList.remove('hidden');
}

/* a campaign is locked until its prerequisite campaign's final game is won */
function campaignUnlocked(camp){
  if(!camp || !camp.requires) return true;
  const req = CAMPAIGN[camp.requires]; if(!req || !req.games || !req.games.length) return true;
  const acc = window.Account;
  const done = (acc && acc.campaignCompleted) ? acc.campaignCompleted(camp.requires) : [];
  return done.includes(req.games[req.games.length-1].id);
}

function renderCampaign(){
  const list=document.getElementById('campaign-list'); if(!list) return;
  list.innerHTML = Object.values(CAMPAIGN).map(camp=>{
    const unlocked = campaignUnlocked(camp);
    const req = camp.requires && CAMPAIGN[camp.requires];
    const note = unlocked ? '' : `<p class="note">Complete ${req?escapeHtml(req.name):'the previous campaign'} first.</p>`;
    return `<div class="camp-stage ${unlocked?'':'locked'}" ${unlocked?`data-camp="${camp.id}"`:''}><h3>${escapeHtml(camp.name)}${unlocked?'':' · Locked'}</h3><p>${escapeHtml(camp.blurb||'')}</p>${note}</div>`;
  }).join('');
  list.querySelectorAll('.camp-stage[data-camp]').forEach(el=>el.addEventListener('click',()=>renderCampaignGames(el.dataset.camp)));
}

function renderCampaignGames(campId){
  const camp=CAMPAIGN[campId]; if(!camp) return;
  const list=document.getElementById('campaign-list'); if(!list) return;
  const acc=window.Account;
  const done = (acc && acc.campaignCompleted) ? acc.campaignCompleted(campId) : [];
  let html = `<div class="camp-head">${escapeHtml(camp.name)}</div>`;
  camp.games.forEach((g,idx)=>{
    const completed = done.includes(g.id);
    const unlocked = idx===0 || done.includes(camp.games[idx-1].id);
    const cls = (ARCH[g.arch]||{}).css || '';
    const tag = completed ? ' · Completed' : (unlocked ? '' : ' · Locked');
    html += `<div class="camp-stage ${cls} ${unlocked?'':'locked'}" ${unlocked?`data-camp="${campId}" data-game="${g.id}"`:''}>
      <h3>${escapeHtml(g.label)}${completed?' ✓':''}</h3>
      <p>${escapeHtml(g.blurb||'')}</p>
      <p class="geo">You: ${ARCH[g.arch].name} vs ${ARCH[g.foeArch].name}${tag}</p>
      ${unlocked?'':'<p class="note">Win the previous duel to unlock.</p>'}
    </div>`;
  });
  html += `<button class="btn" id="camp-games-back" style="margin-top:6px">← Campaigns</button>`;
  list.innerHTML = html;
  list.querySelectorAll('.camp-stage[data-game]').forEach(el=>el.addEventListener('click',()=>{
    const g=camp.games.find(x=>x.id===el.dataset.game); if(g) startCampaignGame(campId, g);
  }));
  document.getElementById('camp-games-back').addEventListener('click', renderCampaign);
}

function startCampaignGame(campId, game){
  const camp = (typeof CAMPAIGN==='object' && CAMPAIGN && CAMPAIGN[campId]) || {};
  const baseScen = Object.assign({}, game.scenario, { campaign:{ campId, gameId:game.id, reward:game.reward||null } });
  const acc = window.Account;
  const canPick = !!(camp.pickDeck && acc && acc.user && acc.profile);   // let the player choose a deck each stage
  const launch = (youDeck)=>{ const scen = youDeck ? Object.assign({}, baseScen, { youDeck }) : baseScen; newGame(game.arch, scen); };
  const afterIntro = canPick
    ? ()=> showDeckPick(game.arch, launch, ()=>{ renderCampaignGames(campId); showScreen('screen-campaign'); })
    : ()=> launch();
  if(game.intro) runDialogue([{ speaker:game.label, text:game.intro, arch:game.foeArch }], afterIntro);   // one-line matchup card, headed by the stage name in the foe's colour
  else if(game.dialogue) runDialogue(game.dialogue, afterIntro);
  else if(game.tutorial){ const steps = TUTORIALS[game.tutorial] || TUTORIALS.basics; runTutorial(steps, afterIntro); }
  else afterIntro();
}

/* ---- menu navigation ---- */
document.getElementById('home-free').addEventListener('click',()=>showScreen('screen-select'));
document.getElementById('home-campaign').addEventListener('click',()=>{ renderCampaign(); showScreen('screen-campaign'); });
/* #home-signin is owned by the Firebase module (src/account.js) */

/* ---- home button hover descriptions (shown in #home-note) ---- */
(function homeHoverDesc(){
  const note = document.getElementById('home-note');
  if(!note) return;
  const DESC = {
    'home-free':'Play against AI using one of your abstract decks.',
    'home-campaign':'Embark on designed quests to unlock new cards & progress your story.'
  };
  let saved = null;
  Object.keys(DESC).forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('mouseenter',()=>{ if(saved===null) saved = note.textContent; note.textContent = DESC[id]; });
    el.addEventListener('mouseleave',()=>{ if(saved!==null){ note.textContent = saved; saved = null; } });
  });
})();
document.getElementById('select-back').addEventListener('click',()=>showScreen('screen-home'));
document.getElementById('deckpick-back').addEventListener('click',()=>{ if(deckPickBack){ const f=deckPickBack; deckPickBack=null; f(); } else showScreen('screen-select'); });
document.getElementById('campaign-back').addEventListener('click',()=>showScreen('screen-home'));

/* Debug / test handle — inspect game state from the console as `Abstracts` */
window.Abstracts = {
  get G(){ return G; },
  get ui(){ return ui; },
  CARDS, ARCH, NODE_FX, CAMPAIGN, getUnit, unitRefs, newGame, showScreen
};
