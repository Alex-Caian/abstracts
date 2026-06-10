'use strict';
/* =====================================================================
   ABSTRACTS — archetypes.js
   The three Abstract archetypes: geometry, node layout, default deck,
   and the Abstract itself.
   ===================================================================== */
const ARCH = {
  fear: {
    name:'FEAR', css:'arch-fear', geoName:'Pentagon of Dread',
    angles:[-90,-18,54,126,198],
    nodes:['inv1','atk1','hp2','dmgHero1','healHero2'],
    deck:['f_shadow','f_shadow','f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_stalker','f_stalker','f_rite','f_rite','f_chill','f_chill','f_chill','f_wave','f_wave','f_wave'],
    abstract:{name:'FEAR ITSELF',atk:9,hp:9,
      summonTxt:'On arrival: all enemy followers get −2 Attack.',
      auraTxt:'Aura: at the start of your turn, the enemy hero suffers 2 damage.'},
    blurb:'Attrition and dread. Whittle the enemy down while terror gathers, then let Fear walk among them.',
    desc:'The pentagon — five versatile nodes around a gathering dark.'
  },
  justice: {
    name:'JUSTICE', css:'arch-justice', geoName:'Triangle of the Pact',
    angles:[-90,30,150],
    nodes:['invHeal','atk2','hp3'],
    deck:['j_squire','j_squire','j_scales','j_scales','j_herald','j_herald','j_vindic','j_vindic','j_paladin','j_paladin','j_arbiter','j_arbiter','j_bless','j_bless','j_plea','j_plea','j_verdict','j_verdict','j_tribunal','j_tribunal'],
    abstract:{name:'JUSTICE INCARNATE',atk:8,hp:12,
      summonTxt:'On arrival: destroy the enemy follower with the highest Attack.',
      auraTxt:'Aura: at the start of your turn, deal 3 damage to the strongest enemy follower.'},
    blurb:'Few but mighty. Three nodes, heavy blessings, and a verdict no one escapes.',
    desc:'The triangle — three nodes only, each one a powerful oath.'
  },
  knowledge: {
    name:'KNOWLEDGE', css:'arch-knowledge', geoName:'Hexagon of the Spiral',
    angles:[-90,-30,30,90,150,210],
    nodes:['inv1','draw1','mana1','atk1','hp2','dmgHero1'],
    deck:['k_inkling','k_inkling','k_scribe','k_scribe','k_owl','k_owl','k_archiv','k_archiv','k_sage','k_sage','k_lore','k_lore','k_spark','k_spark','k_study','k_study','k_revel','k_revel','k_surge','k_surge'],
    abstract:{name:'KNOWLEDGE ABSOLUTE',atk:7,hp:10,
      summonTxt:'On arrival: draw 3 cards.',
      auraTxt:'Aura: at the start of your turn, deal 2 damage to the enemy hero and draw a card.'},
    blurb:'Small, compounding advantages. Out-draw, out-tempo, and let the truth burn them.',
    desc:'The hexagon — six nodes of incremental, compounding insight.'
  }
};
