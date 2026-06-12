'use strict';
/* =====================================================================
   ABSTRACTS — state.js
   Game state container, player factory, and state accessors.
   ===================================================================== */
let G = null;
let ui = { selCard:null, selUnit:null, targeting:null, flash:null, dragCard:null };

function makePlayer(archKey, name, isAI){
  const a = ARCH[archKey];
  return {
    arch:archKey, name, isAI,
    hp:START_HP,            // core HP — the latent Abstract at the centre
    mana:0, maxMana:0,
    deck:shuffle(a.deck.slice()), hand:[], board:Array(a.angles.length).fill(null),
    invoke:0,               // invoke is a currency now: accrues forever
    summonCost:SUMMON_BASE, // rises by SUMMON_STEP after each summon
    summonCount:0,
    abilityUsed:false,      // active ability is once per turn
    abstractUnit:null,      // the manifested form: {name,hp,maxHp} — HP only
    fatigue:0
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
function clearSelection(){ ui.selCard=null; ui.selUnit=null; ui.targeting=null; }
function newGame(humanArch){
  const others = Object.keys(ARCH).filter(k=>k!==humanArch);
  const aiArch = others[Math.floor(Math.random()*others.length)];
  G = { players:[ makePlayer(humanArch,'You',false), makePlayer(aiArch,'The Adversary',true) ],
        turn:0, turnNo:0, over:false };
  drawCards(G.players[0],4,true); drawCards(G.players[1],5,true);
  buildBoards();
  document.getElementById('screen-select').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  log(`A duel of concepts begins: ${ARCH[humanArch].name} against ${ARCH[aiArch].name}.`,'sys');
  startTurn();
}
