'use strict';
/* =====================================================================
   ABSTRACTS — config.js
   Global constants and node-effect definitions.
   ===================================================================== */
const INVOKE_GOAL = 10;
const START_HP    = 30;
const MAX_MANA    = 10;
const HAND_MAX    = 8;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- node effects ----------
   Each board node carries one of these bonuses, applied when a follower
   is played onto it. (g = game, p = owning player, u = the unit played) */
const NODE_FX = {
  inv1:      {txt:'+1 Invoke value',          apply:(g,p,u)=>{u.invoke+=1;}},
  atk1:      {txt:'+1 Attack',                apply:(g,p,u)=>{u.atk+=1;}},
  atk2:      {txt:'+2 Attack',                apply:(g,p,u)=>{u.atk+=2;}},
  hp2:       {txt:'+2 Health',                apply:(g,p,u)=>{u.hp+=2;u.maxHp+=2;}},
  hp3:       {txt:'+3 Health',                apply:(g,p,u)=>{u.hp+=3;u.maxHp+=3;}},
  dmgHero1:  {txt:'Deal 1 dmg to enemy hero', apply:(g,p)=>{damageHero(foe(p),1);}},
  healHero2: {txt:'Restore 2 HP to your hero',apply:(g,p)=>{healHero(p,2);}},
  draw1:     {txt:'Draw a card',              apply:(g,p)=>{drawCards(p,1);}},
  mana1:     {txt:'+1 Mana this turn',        apply:(g,p)=>{p.mana+=1;}},
  invHeal:   {txt:'+1 Invoke value & restore 2 HP', apply:(g,p,u)=>{u.invoke+=1;healHero(p,2);}}
};
