'use strict';
/* =====================================================================
   ABSTRACTS — state.js
   Game state container, player factory, and state accessors.
   ===================================================================== */
let G = null;
let ui = { selCard:null, selUnit:null, targeting:null, flash:null, dragCard:null };

function makePlayer(archKey, name, isAI, deckOverride){
  const a = ARCH[archKey];
  /* deckOverride: a chosen deck's card-id list (signed-in players). Falls back
     to the Abstract's default deck for free play / the AI. */
  const cards = (Array.isArray(deckOverride) && deckOverride.length) ? deckOverride : a.deck;
  return {
    arch:archKey, name, isAI,
    hp:START_HP,            // core HP — the latent Abstract at the centre
    mana:0, maxMana:0,
    angles:a.angles.slice(),  // per-player geometry: Distillation mutates it
    nodes:a.nodes.slice(),
    deck:shuffle(cards.slice()), hand:[], used:[],   // used = the spent litany; reshuffled when the deck empties
    board:Array(a.angles.length).fill(null),
    invoke:0,               // invoke is a currency now: accrues forever
    summonCost:(a.abstract.summonBase ?? SUMMON_BASE), // rises by SUMMON_STEP after each summon
    summonCount:0,
    abilityUsed:false,      // active ability is once per turn
    lockNode:{},            // per-cid consecrated node index (Vindicator's chosen seat)
    drawnCount:0,           // cards drawn this game (Loremaster's invoke gate)
    abstractUnit:null       // the manifested form: {name,hp,maxHp} — HP only
  };
}
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function foe(p){ return G.players[p===G.players[0]?1:0]; }
function you(){ return G.players[0]; }
function enemy(){ return G.players[1]; }
function active(){ return G.players[G.turn]; }
function getUnit(ref){ const p = G.players[ref.pi]; return ref.zone==='abstract' ? p.abstractUnit : p.board[ref.idx]; }
function eachUnits(p,fn){ p.board.forEach((u,i)=>{ if(u) fn(u,{pi:G.players.indexOf(p),zone:'board',idx:i}); }); }
function unitRefs(p){
  const pi = G.players.indexOf(p); const out=[];
  p.board.forEach((u,i)=>{ if(u) out.push({pi,zone:'board',idx:i}); });
  return out;
}
/* a node is linked if an adjacent node on the ring is occupied */
function linkedAt(p, idx){
  const n=p.board.length;
  return !!(p.board[(idx+1)%n] || p.board[(idx-1+n)%n]);
}
function diagramComplete(p){ return p.board.every(u=>u); }
function clearSelection(){ ui.selCard=null; ui.selUnit=null; ui.targeting=null; }
function newGame(humanArch, scenario){
  scenario = scenario || {};
  const others = Object.keys(ARCH).filter(k=>k!==humanArch);
  const aiArch = scenario.foeArch || others[Math.floor(Math.random()*others.length)];
  G = { players:[ makePlayer(humanArch,'You',false, scenario.youDeck), makePlayer(aiArch,'The Adversary',true, scenario.foeDeck) ],
        turn:0, turnNo:0, over:false, scenario, first:0 };
  /* coin flip for turn order: ON by default; disabled by scenario.coinFlip===false (Welcome games 1-2) */
  const doFlip = scenario.coinFlip !== false;
  const first = doFlip ? (Math.random()<0.5 ? 0 : 1) : 0;
  const second = 1 - first;
  G.first = first; G.turn = first;
  drawCards(G.players[first],4,true); drawCards(G.players[second],5,true);   // the player going second draws one extra card
  G.players.forEach(p=>{ p.drawnCount = 0; });   // opening hand is not counted: draw-gates start at 0 for both seats
  applyScenario(scenario);          // campaign/event setup — no-op for free play
  buildBoards();                    // going-second is compensated by the extra opening card (drawn above)
  ['screen-home','screen-select','screen-deckpick','screen-campaign'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.add('hidden');
  });
  document.getElementById('screen-game').classList.remove('hidden');
  const _logEl=document.getElementById('log'); if(_logEl) _logEl.innerHTML='';   // Chronicle tracks only the current game
  log(`A duel of concepts begins: ${ARCH[humanArch].name} against ${ARCH[aiArch].name}.`,'sys');
  if(doFlip && typeof runCoinFlip==='function') runCoinFlip(first, startTurn);
  else startTurn();
}
