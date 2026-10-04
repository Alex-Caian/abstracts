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
        intro:'You\'re facing a studious Knowledge.',
        scenario:{ foeArch:'knowledge', label:'The Weaving Dark · Stage 1',
          boons:{ foe:[ { title:'Wellspring', text:'Gains 1 essence at the start of each turn.', turnStart:{ essence:1 } } ] } } },
      { id:'s2', label:'Stage 2 · The Hidden Pages', arch:'fear', foeArch:'knowledge', reward:'f_grow',
        blurb:'Knowledge returns, faster and slyer — and it keeps tearing the cards from your grasp.',
        intro:'You\'re facing a cunning Knowledge.',
        scenario:{ foeArch:'knowledge', label:'The Weaving Dark · Stage 2',
          foeDeck:['k_scribe','k_scribe','k_owl','k_owl','k_archiv','k_archiv','k_sage','k_sage','k_spark','k_spark','k_twin','k_twin','k_veil','k_veil','k_redact','k_redact','k_redact','k_amnes','k_amnes','k_amnes'],
          boons:{ foe:[
            { title:'Overclocked', text:'Gains 1 extra mana and draws an extra card at the start of each turn.', turnStart:{ mana:1, draw:1 } },
            { title:'Hidden Pages', text:'This opponent has some extra tricks up its sleeve…' }
          ] } } },
      { id:'s3', label:'Stage 3 · The Caves Below', arch:'fear', foeArch:'justice',
        blurb:'Justice bars the road to the caves — and smites your swarm each turn.',
        intro:'You\'re facing a righteous Justice.',
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 3',
          boons:{ foe:[ { title:'Smite', text:'Deals 1 damage to a random enemy follower at the start of each turn.', turnStart:{ dmgFoeUnit:1 } } ] } } },
      { id:'s4', label:'Stage 4 · The Unyielding Hall', arch:'fear', foeArch:'justice', reward:'f_taint',
        blurb:'Justice makes its stand — mending and fortifying faster than you can strike it down.',
        intro:'You\'re facing an unyielding Justice.',
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 4',
          setup:{ foe:{ hp:40, summonLock:999 } },
          boons:{ foe:[
            { title:'Sanctuary', text:'Heals 2 HP at the start of each turn (up to 40).', turnStart:{ hp:2, hpCap:40 } },
            { title:'Ordain', text:'Pay 5 essence: heal 5 HP and give all followers +0/+2.', active:{ cost:5, hp:5, hpCap:40, buffAll:{ atk:0, hp:2 } } }
          ] } } },
      { id:'s5', label:'Stage 5 · The Final Stand', arch:'fear', foeArch:'justice',
        blurb:'Justice bars the last door — empowered, unbroken, and unwilling to stay dead.',
        intro:'You\'re facing an unbroken Justice.',
        scenario:{ foeArch:'justice', label:'The Weaving Dark · Stage 5',
          setup:{ foe:{ hp:20, invoke:6, summoned:true, summonLock:999, revives:[ { hp:10, keep:1, discard:2 }, { hp:5, keep:0, discardTo:1 } ] } },
          boons:{ foe:[
            { title:'Consecrated Ranks', text:'Justice\'s followers are permanently +1/+1.', followerBuff:{ atk:1, hp:1 } },
            { title:'Final Stand', text:'Justice\'s final stand...' }
          ] } } },
      { id:'s6', label:'Stage 6 · The Mirror', arch:'fear', foeArch:'fear', reward:'f_web',
        blurb:'A reflection of yourself bars the way — a swarm that fights as you would, and worse.',
        intro:'You\'re facing a familiar reflection.',
        scenario:{ foeArch:'fear', label:'The Weaving Dark · Stage 6',
          foeDeck:['f_swarm','f_swarm','f_gargant','f_gargant','k_distil','k_distil','f_shadow','f_shadow','f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_rite','f_chill','f_terror','f_wave'],
          boons:{ foe:[ { title:'Illusion', text:'Must remember.. this is not you...' } ] } } },
      { id:'s7', label:'Stage 7 · The Unlocked Mind', arch:'fear', foeArch:'knowledge',
        blurb:'Knowledge throws off its limits — manifested, fortified, and its diagram already refined.',
        intro:'You\'re facing an enlightened Knowledge.',
        scenario:{ foeArch:'knowledge', label:'The Weaving Dark · Stage 7',
          setup:{ foe:{ hp:40, summoned:true, distil:3, idleTurns:3 } },
          boons:{ foe:[
            { title:'Wellspring', text:'Gains 1 essence at the start of each turn.', turnStart:{ essence:1 } },
            { title:'Enlightened', text:'Knowledge unlocked...' }
          ] } } },
      { id:'s8', label:'Stage 8 · The Weaving Dark', arch:'fear', foeArch:'justice', reward:'f_ap_senths',
        blurb:'Justice and Knowledge set aside their war to end yours. Raise the Mother, and prevail.',
        intro:'You\'re facing Justice and Knowledge, united.',
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
  },
  knowledge: {
    id:'knowledge', name:'The Ancient Discovery', pickDeck:true, requires:'welcome',
    blurb:'Take up Knowledge and seek what the spiral has long kept buried. The others would rather it stayed that way.',
    games:[
      { id:'s1', label:'Stage 1 · A Test of Strength', arch:'knowledge', foeArch:'justice',
        blurb:'Justice meets you with a Champion of Light already standing guard.',
        intro:'You\'re facing Justice and its champion.',
        scenario:{ foeArch:'justice', label:'The Ancient Discovery · Stage 1',
          setup:{ foe:{ board:[ { cid:'j_champion', node:0 } ] } } } },
      { id:'s2', label:'Stage 2 · The Sentence', arch:'knowledge', foeArch:'justice', reward:'k_borrower',
        blurb:'Justice returns more watchful than before, and it has begun passing sentences.',
        intro:'You\'re facing a watchful Justice.',
        scenario:{ foeArch:'justice', label:'The Ancient Discovery · Stage 2',
          foeDeck:['j_herald','j_herald','j_oath','j_paladin','j_paladin','j_magis','j_magis','j_arbiter','j_brute','j_plea','j_plea','j_verdict','j_verdict','j_tribunal','j_tribunal','j_bless','j_bless','j_sentinel','j_sentinel','j_sentinel'],
          boons:{ foe:[
            { title:'Vigilance', text:'Justice keeps a few tricks up its sleeve…' },
            { title:'Execution', text:'Pay 4 essence: sentence an enemy follower. It dies when Justice\'s next turn begins.', active:{ cost:4, execute:true } }
          ] } } },
      { id:'s3', label:'Stage 3 · The Nest', arch:'knowledge', foeArch:'fear',
        blurb:'Beyond the hall, Fear\'s brood has nested, and it keeps on coming.',
        intro:'You\'re facing a brooding Fear.',
        scenario:{ foeArch:'fear', label:'The Ancient Discovery · Stage 3',
          boons:{ foe:[
            { title:'The Brood', text:'At the start of each turn, Fear summons a 0/1 Spider Amalgamation.', turnSpawn:'tok_amalgam' },
            { title:'Coalesce', text:'Pay essence: every Amalgamation from now on gains +1/+1. Costs 2 more each time.', active:{ cost:3, costStep:2, spawnBonus:1 } }
          ] } } },
      { id:'s4', label:'Stage 4 · The Rising Swarm', arch:'knowledge', foeArch:'fear', reward:'k_mirror',
        blurb:'Down here Fear takes form almost at will, and its swarm fills every gap you leave.',
        intro:'You\'re facing a restless Fear.',
        scenario:{ foeArch:'fear', label:'The Ancient Discovery · Stage 4',
          setup:{ foe:{ summonCost:3, board:[ { cid:'tok_amalgam', node:1 }, { cid:'tok_amalgam', node:4 } ] } },
          boons:{ foe:[ { title:'Restless Form', text:'Fear takes form for just 3 essence. Each resummon costs 5 more.' } ] } } },
      { id:'s5', label:'Stage 5 · The Refined Mind', arch:'knowledge', foeArch:'knowledge',
        blurb:'A mirror of your own mind, already distilled to its purest form.',
        intro:'You\'re facing a refined Knowledge.',
        scenario:{ foeArch:'knowledge', label:'The Ancient Discovery · Stage 5',
          foeDeck:['k_spark','k_spark','k_spark','k_spark','k_spark','k_surge','k_surge','k_surge','k_surge','k_surge','k_refute','k_refute','k_refute','k_refute','k_lore','k_lore','k_archiv','k_archiv','k_scribe','k_scribe'],
          setup:{ foe:{ distil:4, hp:40 } } } },
      { id:'s6', label:'Stage 6 · The Shell', arch:'knowledge', foeArch:'fear', reward:'k_illusion',
        blurb:'A brittle core hides behind a form that returns every time you break it.',
        intro:'You\'re facing a shielded Fear.',
        scenario:{ foeArch:'fear', label:'The Ancient Discovery · Stage 6',
          foeDeck:['f_shadow','f_shadow','f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_stalker','f_stalker','f_terror','f_wave','f_wave','f_hysteria','f_hysteria','f_web0','f_web0','f_web0'],
          setup:{ foe:{ hp:15, summonCost:1, summonStep:0, noArrival:true, noTerrify:true } },
          boons:{ foe:[
            { title:'The Shell', text:'Fear\'s form returns for 1 essence, every time. It arrives alone, and its aura no longer Terrifies.' },
            { title:'Hidden Depths', text:'Gains 1 essence at the start of each turn. It keeps other secrets, too…', turnStart:{ essence:1 } }
          ] } } },
      { id:'s7', label:'Stage 7 · The Honour Guard', arch:'knowledge', foeArch:'justice',
        blurb:'Justice gathers no essence here. Its form arrives on a countdown, behind a wall of guards.',
        intro:'You\'re facing a guarded Justice.',
        scenario:{ foeArch:'justice', label:'The Ancient Discovery · Stage 7',
          foeDeck:['j_herald','j_herald','j_vindic','j_vindic','j_oath','j_oath','j_paladin','j_paladin','j_magis','j_magis','j_arbiter','j_brute','j_bless','j_bless','j_guard','j_guard','j_verdict','j_verdict','j_tribunal','j_tribunal'],
          setup:{ foe:{ noEssence:true, formTimer:4, guardedForm:true, idleTurns:3, board:[ { cid:'j_guard', node:0 }, { cid:'j_guard', node:1 }, { cid:'j_guard', node:2 } ] } },
          boons:{ foe:[
            { title:'The Appointed Hour', text:'Justice gathers no essence. Its form arrives by itself every 4 turns, and the count restarts each time you break it.', formTimer:true },
            { title:'Honour Guard', text:'While Justice has a follower, its form takes no damage.' }
          ] } } },
      { id:'s8', label:'Stage 8 · The Ancient Discovery', arch:'knowledge', foeArch:'fear', reward:'k_ap_arcana',
        blurb:'Fear and Justice set aside their quarrel to bury what you have found. Let the Arcana answer.',
        intro:'You\'re facing Fear and Justice, united.',
        scenario:{ foeArch:'fear', label:'The Ancient Discovery · Stage 8',
          foeDeck:['f_whisper','f_whisper','f_acolyte','f_acolyte','f_hound','f_hound','f_wraith','f_wraith','f_stalker','f_wave','j_paladin','j_paladin','j_arbiter','j_arbiter','j_brute','j_magis','j_verdict','j_verdict','j_tribunal','j_chess'],
          setup:{ you:{ summonStep:0 } },
          boons:{
            foe:[
              { title:'For dread', text:'Each turn, a Spider Amalgamation crawls into its circle. With no node free, its followers absorb one to take its place.', arch:'fear', turnSpawn:'tok_amalgam', absorb:'tok_amalgam' },
              { title:'For order', text:'Pay 4 essence: sentence an enemy follower. It dies when this foe\'s next turn begins.', arch:'justice', active:{ cost:4, execute:true } }
            ],
            you:[
              { title:'The Arcana stirs', text:'When either core falls to 15 HP or less, Ancient Arcana comes to your hand, free to cast.', arch:'knowledge', arcanaWatch:true },
              { title:'Unbound Form', text:'Your form\'s price does not rise in this battle.', arch:'knowledge' }
            ]
          } } }
    ]
  }
};
