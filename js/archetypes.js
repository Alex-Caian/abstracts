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
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v3.4"/><ellipse cx="12" cy="13.6" rx="5.5" ry="6.4"/><path d="M9.3 8.3Q12 13.2 9.7 19M14.7 8.3Q12 13.2 14.3 19M6.7 13.4h10.6"/></svg>',
    iconSummoned:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="13.2" rx="2.7" ry="3.6"/><circle cx="12" cy="8.3" r="1.8"/><path d="M9.5 9.3L5 6.7 3.3 4.4"/><path d="M9.2 11.5L3.7 10.8 1.7 9.4"/><path d="M9.2 13.8L3.7 15.4 1.8 17"/><path d="M9.8 15.6L6.1 18.5 4.7 20.8"/><path d="M14.5 9.3L19 6.7 20.7 4.4"/><path d="M14.8 11.5L20.3 10.8 22.3 9.4"/><path d="M14.8 13.8L20.3 15.4 22.2 17"/><path d="M14.2 15.6L17.9 18.5 19.3 20.8"/></svg>',
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
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5L13.5 5.5V14H10.5V5.5Z"/><path d="M7.3 15h9.4"/><path d="M12 15v4"/><circle cx="12" cy="20.3" r="1.2"/></svg>',
    iconSummoned:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="1"/><path d="M12 5v15"/><path d="M8.5 20h7"/><path d="M5 8h14"/><path d="M5 8l-2.6 1.6M5 8l2.6 1.6M2.4 9.6q2.6 5 5.2 0M19 8l-2.6 1.6M19 8l2.6 1.6M16.4 9.6q2.6 5 5.2 0"/></svg>',
    angles:[-90,30,150],
    nodes:['invHeal','atk2','hp3'],
    deck:['j_herald','j_herald','j_herald','j_vindic','j_vindic','j_vindic','j_paladin','j_paladin','j_arbiter','j_arbiter','j_bless','j_bless','j_plea','j_plea','j_plea','j_verdict','j_verdict','j_verdict','j_tribunal','j_tribunal'],
    abstract:{name:'JUSTICE',hp:10,
      onSummonTxt:'On arrival: Day of Judgement — each enemy follower takes damage equal to its own Attack.',
      auraTxt:'Aura: if outnumbered, 2 damage to a random enemy follower; if outnumbering, restore 2 HP; at equal numbers, both.',
      ability:{name:'Verdict',cost:6,txt:'Destroy the enemy follower with the highest Attack.'}},
    blurb:'Defensive playstyle. Field few but mighty champions & punish aggression with judgement.',
    desc:'The triangle — three nodes only, each one a powerful oath.'
  },
  knowledge: {
    name:'KNOWLEDGE', css:'arch-knowledge', geoName:'Octagon of the Spiral',
    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3.5" width="12" height="17" rx="1.5"/><path d="M9 3.5v17"/><path d="M11.5 8h4M11.5 11h4"/></svg>',
    iconSummoned:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v14"/><path d="M12 6C9.5 4 6.5 3.5 3 4v13c3.5-.5 6.5 0 9 2"/><path d="M12 6c2.5-2 5.5-2.5 9-2v13c-3.5-.5-6.5 0-9 2"/><path d="M5.5 8.3q2-.5 4 .1M5.5 11.3q2-.5 4 .1"/></svg>',
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
