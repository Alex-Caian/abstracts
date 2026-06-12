'use strict';
/* =====================================================================
   ABSTRACTS — archetypes.js
   The three Abstract archetypes: geometry, node layout, default deck,
   and the Abstract itself (a pure-HP form with three powers).
   ===================================================================== */
const ARCH = {
  fear: {
    name:'FEAR', css:'arch-fear', geoName:'Pentagon of Dread',
    angles:[-90,-18,54,126,198],
    nodes:['inv1','atk1','hp2','dmgHero1','healHero2'],
    deck:['f_shadow','f_shadow','f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_stalker','f_stalker','f_rite','f_rite','f_chill','f_chill','f_chill','f_wave','f_wave','f_wave'],
    abstract:{name:'FEAR',hp:9,
      onSummonTxt:'On arrival: every empty node fills with a 1/1 Terror Spider (invoke 1).',
      auraTxt:'Aura: at the start of your turn, the enemy suffers 2 damage.',
      ability:{name:'Creeping Terror',cost:4,txt:'All enemy followers get −1 Attack.'}},
    blurb:'Attrition and dread. Whittle the enemy down while terror gathers, then let Fear walk among them.',
    desc:'The pentagon — five versatile nodes around a gathering dark.'
  },
  justice: {
    name:'JUSTICE', css:'arch-justice', geoName:'Triangle of the Pact',
    angles:[-90,30,150],
    nodes:['invHeal','atk2','hp3'],
    deck:['j_squire','j_squire','j_scales','j_scales','j_herald','j_herald','j_vindic','j_vindic','j_paladin','j_paladin','j_arbiter','j_arbiter','j_bless','j_bless','j_plea','j_plea','j_verdict','j_verdict','j_tribunal','j_tribunal'],
    abstract:{name:'JUSTICE',hp:12,
      onSummonTxt:'On arrival: Day of Judgement — each enemy follower takes damage equal to its own Attack.',
      auraTxt:'Aura: at the start of your turn, deal 3 damage to the strongest enemy follower.',
      ability:{name:'Verdict',cost:5,txt:'Destroy the enemy follower with the highest Attack.'}},
    blurb:'Few but mighty. Three nodes, heavy blessings, and a verdict no one escapes.',
    desc:'The triangle — three nodes only, each one a powerful oath.'
  },
  knowledge: {
    name:'KNOWLEDGE', css:'arch-knowledge', geoName:'Hexagon of the Spiral',
    angles:[-90,-30,30,90,150,210],
    nodes:['inv1','draw1','mana1','atk1','hp2','dmgHero1'],
    deck:['k_inkling','k_inkling','k_scribe','k_scribe','k_owl','k_owl','k_archiv','k_archiv','k_sage','k_sage','k_lore','k_lore','k_spark','k_spark','k_study','k_study','k_revel','k_revel','k_surge','k_surge'],
    abstract:{name:'KNOWLEDGE',hp:10,
      onSummonTxt:'On arrival: Awakening — your followers gain +1 Invoke value; draw a card.',
      auraTxt:'Aura: at the start of your turn, deal 2 damage to the enemy and draw a card.',
      ability:{name:'Insight',cost:3,txt:'Draw 2 cards.'}},
    blurb:'Small, compounding advantages. Out-draw, out-tempo, and let the truth burn them.',
    desc:'The hexagon — six nodes of incremental, compounding insight.'
  }
};
