'use strict';
/* =====================================================================
   ABSTRACTS — cards.js
   The card database. fx keys are resolved in engine.js / resolveFx().
   t = 'f' follower, 's' spell. dr = death rattle.
   inv = invoke value; followers with inv 0 cannot invoke at all.
   ===================================================================== */
const CARDS = {
  /* FEAR */
  f_shadow:  {t:'f',arch:'fear',name:'Creeping Shadow',cost:1,atk:1,hp:2,inv:1,txt:''},
  f_whisper: {t:'f',arch:'fear',name:'Night Whisper',cost:2,atk:2,hp:2,inv:1,txt:'On play: a random enemy follower gets −1 Attack.',fx:'whisper'},
  f_acolyte: {t:'f',arch:'fear',name:'Dread Acolyte',cost:2,atk:1,hp:3,inv:2,txt:'A devoted invoker.'},
  f_hound:   {t:'f',arch:'fear',name:'Phobia Hound',cost:3,atk:3,hp:3,inv:1,txt:''},
  f_wraith:  {t:'f',arch:'fear',name:'Terror Wraith',cost:4,atk:4,hp:3,inv:1,txt:'On death: deal 2 damage to the enemy.',dr:'dr_dmg2'},
  f_stalker: {t:'f',arch:'fear',name:'Nightmare Stalker',cost:5,atk:5,hp:5,inv:0,txt:'A silent hunter. Cannot invoke.'},
  f_rite:    {t:'s',arch:'fear',name:'Sacrificial Rite',cost:1,txt:'Destroy a friendly follower. Gain essence equal to its invoke value +2.',fx:'sacrifice',target:'friendUnit'},
  f_chill:   {t:'s',arch:'fear',name:'Chill of Dread',cost:2,txt:'Deal 2 damage to an enemy follower. Gain 1 essence.',fx:'chill',target:'enemyUnit'},
  f_terror:  {t:'s',arch:'fear',name:'Creeping Terror',cost:3,txt:'All enemy followers get −1 Attack.',fx:'atkDownAll'},
  f_wave:    {t:'s',arch:'fear',name:'Wave of Terror',cost:4,txt:'Deal 2 damage to all enemy followers.',fx:'aoe2'},
  f_hysteria:{t:'s',arch:'fear',name:'Mass Hysteria',cost:2,txt:'Your followers gain +1 Attack.',fx:'atkUpAll'},
  /* JUSTICE — heavy curve: champions arrive slowly, few can invoke */
  j_squire:  {t:'f',arch:'justice',name:'Oath Squire',cost:1,atk:1,hp:2,inv:1,txt:''},
  j_scales:  {t:'f',arch:'justice',name:'Scales Bearer',cost:2,atk:2,hp:3,inv:1,txt:'On play: restore 2 HP to your hero.',fx:'heal2'},
  j_herald:  {t:'f',arch:'justice',name:'Court Herald',cost:3,atk:2,hp:4,inv:2,txt:'A devoted invoker.'},
  j_vindic:  {t:'f',arch:'justice',name:'Vindicator',cost:3,atk:3,hp:4,inv:0,txt:'Cannot invoke.'},
  j_paladin: {t:'f',arch:'justice',name:'Paladin of the Pact',cost:4,atk:3,hp:4,inv:0,txt:'On play: another random friendly follower gains +1/+1. Cannot invoke.',fx:'buffAlly'},
  j_arbiter: {t:'f',arch:'justice',name:'Arbiter of Oaths',cost:5,atk:5,hp:5,inv:0,txt:'Cannot invoke.'},
  j_bless:   {t:'s',arch:'justice',name:'Blessing of the Scales',cost:1,txt:'Give a friendly follower +2/+2.',fx:'bless',target:'friendUnit'},
  j_plea:    {t:'s',arch:'justice',name:'Righteous Plea',cost:2,txt:'Gain 2 essence.',fx:'inv2'},
  j_verdict: {t:'s',arch:'justice',name:'Verdict',cost:3,txt:'Deal 3 damage to an enemy follower.',fx:'dmg3',target:'enemyUnit'},
  j_tribunal:{t:'s',arch:'justice',name:'Tribunal',cost:5,txt:'Deal 1 damage to all enemy followers and restore 3 HP to your hero.',fx:'tribunal'},
  /* KNOWLEDGE */
  k_inkling: {t:'f',arch:'knowledge',name:'Inkling',cost:1,atk:1,hp:2,inv:1,txt:''},
  k_scribe:  {t:'f',arch:'knowledge',name:'Apprentice Scribe',cost:2,atk:2,hp:3,inv:1,txt:'On play: draw a card.',fx:'draw1'},
  k_owl:     {t:'f',arch:'knowledge',name:'Owl of Insight',cost:2,atk:1,hp:4,inv:2,txt:'A devoted invoker.'},
  k_archiv:  {t:'f',arch:'knowledge',name:'Archivist',cost:3,atk:3,hp:4,inv:1,txt:''},
  k_sage:    {t:'f',arch:'knowledge',name:'Sage of the Spiral',cost:4,atk:3,hp:5,inv:1,txt:'On play: gain 1 essence.',fx:'inv1'},
  k_lore:    {t:'f',arch:'knowledge',name:'Loremaster',cost:5,atk:4,hp:6,inv:0,txt:'Cannot invoke.'},
  k_spark:   {t:'s',arch:'knowledge',name:'Spark of Thought',cost:1,txt:'Deal 2 damage to an enemy follower.',fx:'dmg2',target:'enemyUnit'},
  k_study:   {t:'s',arch:'knowledge',name:'Deep Study',cost:2,txt:'Draw 2 cards.',fx:'draw2'},
  k_revel:   {t:'s',arch:'knowledge',name:'Revelation',cost:3,txt:'Gain 2 essence.',fx:'inv2'},
  k_surge:   {t:'s',arch:'knowledge',name:'Mind Surge',cost:5,txt:'Deal 4 damage to an enemy follower. Draw a card.',fx:'surge',target:'enemyUnit'},
  k_twin:    {t:'s',arch:'knowledge',name:'Twin Prophets',cost:2,txt:'Summon two 1/1 Prophets (invoke 1) on adjacent empty nodes.',fx:'twinProphets'},
  k_veil:    {t:'s',arch:'knowledge',name:'Veil of Theory',cost:3,txt:'Your followers gain +0/+2.',fx:'veil'},
  k_distil:  {t:'s',arch:'knowledge',name:'Distillation',cost:3,txt:'Remove an empty node from your diagram forever — its neighbours join.',fx:'distil',target:'emptyNode'},
  k_refute:  {t:'s',arch:'knowledge',name:'Refutation',cost:4,txt:'Transform an enemy follower into a 1/1 Footnote.',fx:'refute',target:'enemyUnit'}
};
