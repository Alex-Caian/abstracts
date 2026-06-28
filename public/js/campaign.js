'use strict';
/* =====================================================================
   ABSTRACTS — campaign.js
   Pre-determined campaign data. Each stage is a static scenario passed
   to newGame(arch, scenario). Stages are pure data — no DB rows; new
   stages and difficulty modifiers ship with the static deploy.

   scenario shape (resolved in engine.js / applyScenario):
     { foeArch, label, setup:{ foe:{board:[{cid,node}],hp,mana,invoke}, you:{…} } }
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
          setup:{ foe:{ hp:10 } } } },
      { id:'w2', label:'Game 2 · The Pact Tested', arch:'justice', foeArch:'fear',
        blurb:'Wield Justice against the gathering Fear.', tutorial:'intermediate', reward:'j_chess',
        scenario:{ foeArch:'fear', label:'Campaign · Justice vs Fear', coinFlip:false, setup:{ foe:{ hp:20, invoke:8, summonLock:4 } } } },
      { id:'w3', label:'Game 3 · Into the Spiral', arch:'fear', foeArch:'knowledge',
        blurb:'Command Fear against unbound Knowledge.', tutorial:'advanced', reward:'f_fright',
        scenario:{ foeArch:'knowledge', label:'Campaign · Fear vs Knowledge', setup:{ foe:{ cast:['twinProphets'] } } } }
    ]
  }
};
