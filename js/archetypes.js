'use strict';
/* =====================================================================
   ABSTRACTS — archetypes.js
   The three Abstracts: geometry, node layout, default deck, and the
   Abstract itself. All auras trigger at the start of your turn (global
   rule — not repeated in the texts).
   ===================================================================== */
const ARCH = {
  fear: {
    name:'FEAR', css:'arch-fear', geoName:'Pentagon of Dread',
    angles:[-90,-18,54,126,198],
    nodes:['inv1','atk1','hp2','dmgHero1','dmgUnit1'],
    deck:['f_shadow','f_shadow','f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_stalker','f_stalker','f_rite','f_rite','f_chill','f_terror','f_wave','f_wave','f_hysteria','f_hysteria'],
    abstract:{name:'FEAR',hp:6,summonBase:8,
      onSummonTxt:'On arrival: every empty node fills with a 1/1 Terror Spider (invoke 1).',
      auraTxt:'Aura: the enemy suffers 3 damage and a random enemy follower is Terrified (cannot act next turn).',
      ability:{name:'Brood',cost:3,txt:'Summon a 2/2 Giant Spider on an empty node. On death it deals 1 damage.'}},
    blurb:'Aggressive playstyle. Conjure spiders & leverage strength in numbers.',
    desc:'The pentagon — five versatile nodes around a gathering dark.'
  },
  justice: {
    name:'JUSTICE', css:'arch-justice', geoName:'Triangle of the Pact',
    angles:[-90,30,150],
    nodes:['invHeal','atk2','hp3'],
    deck:['j_herald','j_herald','j_herald','j_vindic','j_vindic','j_vindic','j_paladin','j_paladin','j_arbiter','j_arbiter','j_bless','j_bless','j_plea','j_plea','j_plea','j_verdict','j_verdict','j_verdict','j_tribunal','j_tribunal'],
    abstract:{name:'JUSTICE',hp:10,
      onSummonTxt:'On arrival: Day of Judgement — each enemy follower takes damage equal to its own Attack.',
      auraTxt:'Aura: if the enemy has more followers than you, deal 2 damage to a random enemy follower; otherwise restore 1 HP to your form or core.',
      ability:{name:'Verdict',cost:6,txt:'Destroy the enemy follower with the highest Attack.'}},
    blurb:'Defensive playstyle. Field few but mighty champions & punish aggression with judgement.',
    desc:'The triangle — three nodes only, each one a powerful oath.'
  },
  knowledge: {
    name:'KNOWLEDGE', css:'arch-knowledge', geoName:'Octagon of the Spiral',
    angles:[-90,-45,0,45,90,135,180,225],
    nodes:['inv1','draw1','mana1','atk1','hp2','dmgHero1','healHero2','atk1'],
    deck:['k_scribe','k_scribe','k_owl','k_owl','k_archiv','k_archiv','k_sage','k_sage','k_lore','k_lore','k_spark','k_spark','k_study','k_twin','k_twin','k_veil','k_veil','k_distil','k_distil','k_refute'],
    abstract:{name:'KNOWLEDGE',hp:10,summonBase:12,
      onSummonTxt:'On arrival: Awakening — your followers gain +1 invoke value; draw a card.',
      auraTxt:'Aura: draw a card and gain 1 mana.',
      ability:{name:'Insight',cost:4,txt:'Draw 2 cards. In communion: also gain 1 essence and deal 1 damage to the enemy.'}},
    blurb:'Control playstyle. Out-draw everyone, distil your diagram & rule the late game.',
    desc:'The octagon — eight nodes, made elegant by deletion.'
  }
};
