'use strict';
/* =====================================================================
   ABSTRACTS — campaign.js
   Pre-determined campaign data. Each stage is a static scenario passed
   to newGame(arch, scenario). Stages are pure data — no DB rows; new
   stages and difficulty modifiers ship with the static deploy.

   scenario shape (resolved in engine.js / applyScenario):
     { foeArch, label, coinFlip?, youDeck?,
       setup:{ foe:{board:[{cid,node}],hp,mana,invoke,summonLock,cast:[fx]}, you:{…} },
       boons:{ foe:[{title,text,turnStart?:{essence,mana,draw,hp}}], you:[…] } }
   A boon with no `turnStart` is flavour-only (display only).
   Campaign-level `pickDeck:true` lets the player choose a deck each stage.
   ===================================================================== */
const CAMPAIGN = {
  welcome: {
    id:'welcome', name:'Welcome to Abstracts',
    blurb:'Three duels to learn the ritual. Win each to unlock the next.',
    games:[
      { id:'w1', label:'Game 1 · The First Lesson', arch:'knowledge', foeArch:'justice',
        blurb:'Take up Knowledge against a faltering Justice.',
        tutorial:'basics', reward:'k_surge',
        scenario:{ foeArch:'justice', label:'Tutorial · Knowledge vs Justice', coinFlip:false,
          setup:{ foe:{ hp:10 } },
          boons:{ foe:[ { title:'Faltering', text:'This foe is weaker than your usual.' } ] } } },
      { id:'w2', label:'Game 2 · The Pact Tested', arch:'justice', foeArch:'fear',
        blurb:'Wield Justice against the gathering Fear.', tutorial:'intermediate', reward:'j_chess',
        scenario:{ foeArch:'fear', label:'Campaign · Justice vs Fear', coinFlip:false, setup:{ foe:{ hp:20, invoke:8, summonLock:4 } },
          boons:{ foe:[ { title:'Gathering', text:'This foe will summon its form after 5 turns.' } ] } } },
      { id:'w3', label:'Game 3 · Into the Spiral', arch:'fear', foeArch:'knowledge',
        blurb:'Command Fear against unbound Knowledge.', tutorial:'advanced', reward:'f_fright',
        scenario:{ foeArch:'knowledge', label:'Campaign · Fear vs Knowledge', setup:{ foe:{ cast:['twinProphets'] } },
          boons:{ foe:[ { title:'Unbound', text:'This foe is stronger than your usual.' } ] } } }
    ]
  },
  fear: {
    id:'fear', name:'The Weaving Dark', pickDeck:true, requires:'welcome',
    blurb:'Take up Fear and let the swarm prevail over the other concepts. Spiders await.',
    games:[
      { id:'s1', label:'Stage 1 · A Familiar Foe', arch:'fear', foeArch:'knowledge',
        blurb:'Face Knowledge on even ground — though it has drawn a small boon from its studies.',
        dialogue:[
          { speaker:'KNOWLEDGE', text:'You cannot wield the power you\'re trying to unlock. Turn around now.' },
          { speaker:'FEAR', text:'My spiders will be ecstatic to take over your library and consume your strength, unless you step aside.' },
          { speaker:'KNOWLEDGE', text:'Let us measure your strength. Higher understanding guides me to victory!' }
        ],
        scenario:{ foeArch:'knowledge', label:'The Weaving Dark · Stage 1',
          boons:{ foe:[ { title:'Wellspring', text:'Gains 1 essence at the start of each turn.', turnStart:{ essence:1 } } ] } } },
      { id:'s2', label:'Stage 2 · The Hidden Pages', arch:'fear', foeArch:'knowledge', reward:'f_grow',
        blurb:'Knowledge returns, faster and slyer — and it keeps tearing the cards from your grasp.',
        dialogue:[
          { speaker:'KNOWLEDGE', text:'Hmph.. not bad. You possess some knowledge. No matter.' },
          { speaker:'FEAR', text:'Final warning, get out of the way. The Apparition is mine.' },
          { speaker:'KNOWLEDGE', text:'Forgive me, but after this you will be forgotten. Know unbecoming, little spider.' }
        ],
        scenario:{ foeArch:'knowledge', label:'The Weaving Dark · Stage 2',
          foeDeck:['k_scribe','k_scribe','k_owl','k_owl','k_archiv','k_archiv','k_sage','k_sage','k_spark','k_spark','k_twin','k_twin','k_veil','k_veil','k_redact','k_redact','k_redact','k_amnes','k_amnes','k_amnes'],
          boons:{ foe:[
            { title:'Overclocked', text:'Gains 1 extra mana and draws an extra card at the start of each turn.', turnStart:{ mana:1, draw:1 } },
            { title:'Hidden Pages', text:'This opponent has some extra tricks up its sleeve…' }
          ] } } },
      { id:'s3', label:'Stage 3 · The Caves Below', arch:'fear', foeArch:'justice',
        blurb:'Justice bars the road to the caves — and smites your swarm each turn.',
        dialogue:[
          { speaker:'FEAR', text:'I\'ve now learned where to find the Apparition. I\'ll need to transverse the caves under the hall first.' },
          { speaker:'FEAR', text:'What\'s...' },
          { speaker:'JUSTICE', text:'Abstracts shall not rely on this cheap trickery.' },
          { speaker:'FEAR', text:'Ah, Justice. Ever _afraid_ of finding true power.' },
          { speaker:'JUSTICE', text:'Apparitions hold unjust powers, and you should know this. Stop, before it\'s too late.' }
        ],
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 3',
          boons:{ foe:[ { title:'Smite', text:'Deals 1 damage to a random enemy follower at the start of each turn.', turnStart:{ dmgFoeUnit:1 } } ] } } },
      { id:'s4', label:'Stage 4 · The Unyielding Hall', arch:'fear', foeArch:'justice', reward:'f_taint',
        blurb:'Justice makes its stand — mending and fortifying faster than you can strike it down.',
        dialogue:[
          { speaker:'JUSTICE', text:'Far enough, spider. This hall is where your crawl ends.' },
          { speaker:'FEAR', text:'You bleed like all the rest. I will only bleed you faster than you can mend.' },
          { speaker:'JUSTICE', text:'Mend? I am renewal itself. Strike me, and watch every wound close.' }
        ],
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 4',
          setup:{ foe:{ hp:40, summonLock:999 } },
          boons:{ foe:[
            { title:'Sanctuary', text:'Heals 2 HP at the start of each turn (up to 40).', turnStart:{ hp:2, hpCap:40 } },
            { title:'Ordain', text:'Pay 5 essence: heal 5 HP and give all followers +0/+2.', active:{ cost:5, hp:5, hpCap:40, buffAll:{ atk:0, hp:2 } } }
          ] } } },
      { id:'s5', label:'Stage 5 · The Final Stand', arch:'fear', foeArch:'justice',
        blurb:'Justice bars the last door — empowered, unbroken, and unwilling to stay dead.',
        dialogue:[
          { speaker:'FEAR', text:'I can feel the power emanate through these very walls.' },
          { speaker:'FEAR', text:'It lies behind that door.' },
          { speaker:'KNOWLEDGE', text:'And you shall never cross it.' },
          { speaker:'JUSTICE', text:'...' },
          { speaker:'JUSTICE', text:'Leave this to me, I\'m not done.' }
        ],
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 5',
          setup:{ foe:{ hp:20, invoke:6, summoned:true, summonLock:999, revives:[ { hp:10, keep:1, discard:2 }, { hp:5, keep:0, discardTo:1 } ] } },
          boons:{ foe:[
            { title:'Consecrated Ranks', text:'Justice\'s followers are permanently +1/+1.', followerBuff:{ atk:1, hp:1 } },
            { title:'Final Stand', text:'Justice\'s final stand...' }
          ] } } },
      { id:'s6', label:'Stage 6 · The Mirror', arch:'fear', foeArch:'fear', reward:'f_web',
        blurb:'A reflection of yourself bars the way — a swarm that fights as you would, and worse.',
        dialogue:[
          { speaker:'KNOWLEDGE', text:'It\'s quite clear now that you won\'t stop. Very well then.' },
          { speaker:'KNOWLEDGE', text:'See for yourself the suffering you cause.' },
          { speaker:'FEAR', text:'...' }
        ],
        scenario:{ foeArch:'fear', label:'The Weaving Dark · Stage 6',
          foeDeck:['f_swarm','f_swarm','f_gargant','f_gargant','k_distil','k_distil','f_shadow','f_shadow','f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_rite','f_chill','f_terror','f_wave'],
          boons:{ foe:[ { title:'Illusion', text:'Must remember.. this is not you...' } ] } } },
      { id:'s7', label:'Stage 7 · The Unlocked Mind', arch:'fear', foeArch:'knowledge',
        blurb:'Knowledge throws off its limits — manifested, fortified, and its diagram already refined.',
        dialogue:[
          { speaker:'FEAR', text:'Enough of these tricks.' },
          { speaker:'FEAR', text:'It\'s within reach now. I cannot be stopped.' },
          { speaker:'KNOWLEDGE', text:'You leave me no choice.' }
        ],
        scenario:{ foeArch:'knowledge', label:'The Weaving Dark · Stage 7',
          setup:{ foe:{ hp:40, summoned:true, distil:3, idleTurns:3 } },
          boons:{ foe:[
            { title:'Wellspring', text:'Gains 1 essence at the start of each turn.', turnStart:{ essence:1 } },
            { title:'Enlightened', text:'Knowledge unlocked...' }
          ] } } },
      { id:'s8', label:'Stage 8 · The Weaving Dark', arch:'fear', foeArch:'justice', reward:'f_ap_senths',
        blurb:'Justice and Knowledge set aside their war to end yours. Raise the Mother, and prevail.',
        dialogue:[
          { speaker:'FEAR', text:'Rise, Mother of spiders.' },
          { speaker:'Senths', text:'At your command..', arch:'fear' },
          { speaker:'JUSTICE', text:'For righteousness.' },
          { speaker:'KNOWLEDGE', text:'For wisdom.' },
          { speaker:'JUSTICE', text:'We shall defeat you, Senths.' },
          { speaker:'KNOWLEDGE', text:'We shall defeat you, Senths.' }
        ],
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 8',
          foeDeck:['k_scribe','k_scribe','k_archiv','k_archiv','k_twin','k_twin','k_study','k_study','k_refute','k_surge','j_paladin','j_paladin','j_arbiter','j_arbiter','j_brute','j_brute','j_verdict','j_verdict','j_tribunal','j_chess'],
          boons:{
            foe:[
              { title:'For righteousness', text:'Its followers are +1/+1. Each turn, deals 1 damage to a random enemy follower.', arch:'justice', followerBuff:{ atk:1, hp:1 }, turnStart:{ dmgFoeUnit:1 } },
              { title:'For wisdom', text:'Each turn, gains 1 extra mana and 1 essence.', arch:'knowledge', turnStart:{ mana:1, essence:1 } }
            ],
            you:[
              { title:'Senths is watching', text:'When either core falls to 15 HP or less, the Mother descends to your side.', arch:'fear', senthsWatch:true }
            ]
          } } }
    ]
  }
};
