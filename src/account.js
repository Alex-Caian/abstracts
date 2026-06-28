/* =====================================================================
   ABSTRACTS — account.js  (the only Vite-bundled module)
   Firebase Auth (Google) + per-user profile in Firestore.

   The game itself stays as classic global scripts (public/js/*). This
   module bridges to them via window.Abstracts (exposed by main.js).
   The backend only ever stores a small per-user document: which cards
   are unlocked, deck lists, and campaign progress. Card/stage/rule
   DEFINITIONS stay in the client code, never the database.
   ===================================================================== */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDolqxdXTy_FvvCMoz0gQ8VaaiFiq3EnsQ",
  authDomain: "abstracts-500108.firebaseapp.com",
  projectId: "abstracts-500108",
  storageBucket: "abstracts-500108.firebasestorage.app",
  messagingSenderId: "501919882562",
  appId: "1:501919882562:web:82f0e4c101b707d8dcfcdb"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app, 'abstracts');   // the named (non-default) database
const provider = new GoogleAuthProvider();

const A = () => window.Abstracts || {};

/* ---- deck model & rules ---- */
const DECK_SIZE = 20, MAX_COPIES = 3, MAX_DECKS_PER_ARCH = 4; // 1 read-only Default + 3 custom
const changeCbs = [];
function fireChange(){ changeCbs.forEach(cb => { try { cb(currentProfile); } catch(e){ console.error(e); } }); }
function newDeckId(){ return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* ---- safe names: letters, digits, _ and - only (blocks spaces + injection/XSS chars) ---- */
function cleanHandle(s, maxLen){ return (s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, maxLen || 24); }
function validUsername(s){ return typeof s === 'string' && /^[A-Za-z0-9_-]{3,20}$/.test(s); }
function cleanDeckName(s){ return cleanHandle(s, 24); }

function defaultDeckFor(arch){
  const ARCH = A().ARCH || {};
  return { id:'default', name:'Default', cards:(((ARCH[arch]||{}).deck) || []).slice() };
}

/* the starter collection = every current card. Future unlockable cards will
   carry `locked:true` in cards.js and are NOT auto-granted here. */
function starterCards(){
  const C = A().CARDS || {};
  return Object.keys(C).filter(cid => !C[cid].locked);
}

/* a fresh account: one read-only Default deck per Abstract, all current cards unlocked */
function defaultProfile(){
  const ARCH = A().ARCH || {};
  const decks = {};
  Object.keys(ARCH).forEach(k => { decks[k] = [ defaultDeckFor(k) ]; });
  return { decks, unlocked: starterCards(), campaign: {}, icon: 'default', createdAt: serverTimestamp() };
}

/* tolerate old/odd shapes: wrap a flat card-id array as Default, ensure a Default exists */
function normalizeProfile(prof){
  const ARCH = A().ARCH || {};
  let changed = false;
  prof.decks = prof.decks || {};
  Object.keys(ARCH).forEach(k => {
    let list = prof.decks[k];
    if (Array.isArray(list) && (list.length === 0 || typeof list[0] === 'string')){
      list = [{ id:'default', name:'Default', cards:(list || []).slice() }]; changed = true;   // migrate old flat shape
    }
    if (!Array.isArray(list)){ list = []; changed = true; }
    if (!list.some(d => d && d.id === 'default')){ list.unshift(defaultDeckFor(k)); changed = true; }
    const def = list.find(d => d && d.id === 'default');     // keep the read-only Default synced to current code
    if (def){ const canon = defaultDeckFor(k).cards;
      if (def.name !== 'Default' || (def.cards || []).join(',') !== canon.join(',')){ def.name = 'Default'; def.cards = canon; changed = true; } }
    prof.decks[k] = list;
  });
  if (!Array.isArray(prof.unlocked)) prof.unlocked = [];
  { const set = new Set(prof.unlocked); let added = false;          // ensure every starter card is unlocked (heals older profiles)
    starterCards().forEach(c => { if (!set.has(c)){ set.add(c); added = true; } });
    if (added){ prof.unlocked = [...set]; changed = true; } }
  if (!prof.campaign){ prof.campaign = {}; changed = true; }
  if (!prof.icon){ prof.icon = 'default'; changed = true; }
  return { prof, changed };
}

async function loadOrCreateProfile(user){
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    const prof = defaultProfile();
    prof.email = user.email || null;          // admin-facing lookup key (search Firestore by email)
    await setDoc(ref, prof);
    return prof;
  }
  const { prof, changed } = normalizeProfile(snap.data());
  let emailChanged = false;
  if (prof.email !== (user.email || null)){ prof.email = user.email || null; emailChanged = true; }   // backfill / keep current
  if (changed || emailChanged) await setDoc(ref, { decks:prof.decks, unlocked:prof.unlocked, campaign:prof.campaign, icon:prof.icon, email:prof.email }, { merge:true });
  return prof;
}

/* copies allowed per card: Apparitions are unique (1), everything else MAX_COPIES */
function maxCopiesOf(cid){ const C = A().CARDS || {}; return (C[cid] && C[cid].apparition) ? 1 : MAX_COPIES; }

/* deck legality: exactly DECK_SIZE cards, per-card copy cap, all unlocked */
function deckLegality(cards){
  if (!Array.isArray(cards)) return { ok:false, reason:'No cards.' };
  if (cards.length !== DECK_SIZE) return { ok:false, reason:`Need exactly ${DECK_SIZE} cards (have ${cards.length}).` };
  const cnt = {};
  for (const c of cards){
    cnt[c] = (cnt[c] || 0) + 1;
    const cmax = maxCopiesOf(c);
    if (cnt[c] > cmax) return { ok:false, reason: cmax===1 ? 'Apparitions are limited to 1 copy per deck.' : `Max ${cmax} copies of any card.` };
    if (currentProfile && Array.isArray(currentProfile.unlocked) && !currentProfile.unlocked.includes(c))
      return { ok:false, reason:'Deck contains a locked card.' };
  }
  return { ok:true };
}
async function persistDecks(){
  const u = auth.currentUser;
  if (!u || !currentProfile) return;
  await setDoc(doc(db, 'users', u.uid), { decks: currentProfile.decks }, { merge:true });
}

let currentProfile = null;

/* public handle for the rest of the app (deckbuilding/campaign will use this) */
window.Account = {
  get user(){ return auth.currentUser; },
  get profile(){ return currentProfile; },
  rules: { DECK_SIZE, MAX_COPIES, MAX_DECKS_PER_ARCH },
  maxCopies(cid){ return maxCopiesOf(cid); },
  signIn(){ return signInWithPopup(auth, provider); },
  signOut(){ return signOut(auth); },
  decksFor(arch){ return (currentProfile && currentProfile.decks && currentProfile.decks[arch]) || []; },
  isUnlocked(cid){ return !!(currentProfile && Array.isArray(currentProfile.unlocked) && currentProfile.unlocked.includes(cid)); },
  /* ---- campaign progress ---- */
  campaignCompleted(campId){ const c = currentProfile && currentProfile.campaign; return (c && Array.isArray(c[campId])) ? c[campId] : []; },
  /* mark a game won; unlock its reward the FIRST time only. Returns { newlyUnlocked }. */
  completeCampaignGame(campId, gameId, rewardCid){
    if (!currentProfile) return { newlyUnlocked:null };
    currentProfile.campaign = currentProfile.campaign || {};
    const done = Array.isArray(currentProfile.campaign[campId]) ? currentProfile.campaign[campId] : (currentProfile.campaign[campId] = []);
    if (!done.includes(gameId)) done.push(gameId);
    let newlyUnlocked = null;
    if (rewardCid && Array.isArray(currentProfile.unlocked) && !currentProfile.unlocked.includes(rewardCid)){
      currentProfile.unlocked.push(rewardCid); newlyUnlocked = rewardCid;
    }
    const u = auth.currentUser;
    if (u) setDoc(doc(db, 'users', u.uid), { campaign: currentProfile.campaign, unlocked: currentProfile.unlocked }, { merge:true })
            .catch(e => console.error('[account] campaign save failed', e));
    fireChange();
    return { newlyUnlocked };
  },
  legality: deckLegality,
  async createDeck(arch, name, cards){
    if (!currentProfile) throw new Error('Not signed in.');
    const list = currentProfile.decks[arch] || (currentProfile.decks[arch] = []);
    if (list.length >= MAX_DECKS_PER_ARCH) throw new Error(`Up to ${MAX_DECKS_PER_ARCH} decks per Abstract.`);
    const leg = deckLegality(cards); if (!leg.ok) throw new Error(leg.reason);
    const cleanName = cleanDeckName(name); if (!cleanName) throw new Error('Deck name: letters, digits, _ and - only.');
    const deck = { id:newDeckId(), name:cleanName, cards:cards.slice() };
    list.push(deck); await persistDecks(); fireChange(); return deck;
  },
  async updateDeck(arch, id, patch){
    if (id === 'default') throw new Error('The Default deck is read-only.');
    const list = (currentProfile && currentProfile.decks[arch]) || [];
    const deck = list.find(d => d.id === id); if (!deck) throw new Error('Deck not found.');
    if (patch.cards){ const leg = deckLegality(patch.cards); if (!leg.ok) throw new Error(leg.reason); deck.cards = patch.cards.slice(); }
    if (patch.name){ const cn = cleanDeckName(patch.name); if (!cn) throw new Error('Deck name: letters, digits, _ and - only.'); deck.name = cn; }
    await persistDecks(); fireChange(); return deck;
  },
  async deleteDeck(arch, id){
    if (id === 'default') throw new Error('The Default deck cannot be deleted.');
    const list = (currentProfile && currentProfile.decks[arch]) || [];
    const i = list.findIndex(d => d.id === id); if (i < 0) return;
    list.splice(i, 1); await persistDecks(); fireChange();
  },
  async setIcon(key){
    if (!currentProfile) return;
    currentProfile.icon = key;
    const u = auth.currentUser; if (u) await setDoc(doc(db, 'users', u.uid), { icon:key }, { merge:true });
    fireChange();
  },
  async setUsername(name){
    const clean = cleanHandle(name, 20);
    if (!validUsername(clean)) throw new Error('Username: 3–20 chars, letters/digits/_/- only.');
    if (!currentProfile) return;
    currentProfile.username = clean;
    const u = auth.currentUser; if (u) await setDoc(doc(db, 'users', u.uid), { username:clean }, { merge:true });
    fireChange();
  },
  onChange(cb){ if (typeof cb === 'function'){ changeCbs.push(cb); if (currentProfile) cb(currentProfile); } }
};

function setNote(msg){ const n = document.getElementById('home-note'); if (n) n.textContent = msg; }

/* ---- profile widget (top-right on the home screen) ---- */
const DEFAULT_PROFILE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 4.4 19.1 16.4 4.9 16.4Z"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/></svg>';
function profileIconSvg(key){
  const ARCH = A().ARCH || {};
  if (key && key !== 'default' && ARCH[key] && ARCH[key].iconSummoned) return ARCH[key].iconSummoned;
  return DEFAULT_PROFILE_ICON;
}
function renderProfileIconPicker(){
  const el = document.getElementById('profile-icons'); if(!el) return;
  const ARCH = A().ARCH || {};
  const cur = (currentProfile && currentProfile.icon) || 'default';
  const opts = ['default','fear','justice','knowledge'];
  el.innerHTML = opts.map(k => {
    const archCss = (k !== 'default' && ARCH[k]) ? ARCH[k].css : '';
    return `<button class="profile-ico ${archCss} ${k===cur?'on':''}" data-icon="${k}" aria-label="${k} icon">${profileIconSvg(k)}</button>`;
  }).join('');
  el.querySelectorAll('.profile-ico').forEach(b => b.addEventListener('click', async () => {
    try { await window.Account.setIcon(b.dataset.icon); } catch(e){ console.error(e); }
  }));
}
function renderProfile(user){
  const wrap = document.getElementById('profile'); if(!wrap) return;
  wrap.classList.toggle('hidden', !user);
  if(!user){ const m = document.getElementById('profile-menu'); if(m) m.classList.add('hidden'); return; }
  const key = (currentProfile && currentProfile.icon) || 'default';
  const btn = document.getElementById('profile-btn'); if(btn) btn.innerHTML = profileIconSvg(key);
  const nm = document.getElementById('profile-name');
  if(nm) nm.textContent = (currentProfile && currentProfile.username) || user.displayName || 'Player';
  renderProfileIconPicker();
}

/* ---- username modal (mandatory on first sign-in; editable thereafter) ---- */
function validateUsernameInput(){
  const input = document.getElementById('username-input'); if(!input) return;
  input.value = input.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);   // live-filter to safe charset
  const ok = validUsername(input.value);
  const btn = document.getElementById('username-confirm'); if(btn) btn.disabled = !ok;
  const msg = document.getElementById('username-msg');
  if(msg) msg.textContent = (input.value.length && input.value.length < 3) ? 'At least 3 characters.' : '';
}
function openUsernameModal(mandatory){
  const modal = document.getElementById('username-modal'); if(!modal) return;
  const input = document.getElementById('username-input');
  const cancel = document.getElementById('username-cancel');
  const suggestion = (currentProfile && currentProfile.username) || cleanHandle((auth.currentUser && auth.currentUser.displayName) || '', 20);
  if(input) input.value = suggestion;
  if(cancel) cancel.classList.toggle('hidden', !!mandatory);
  modal.classList.remove('hidden');
  validateUsernameInput();
  if(input) input.focus();
}
function closeUsernameModal(){ const m = document.getElementById('username-modal'); if(m) m.classList.add('hidden'); }

function renderAuthUI(user){
  /* Sign-in button only when signed out; Sign-out lives in the profile menu */
  const signin = document.getElementById('home-signin');
  if (signin){ signin.textContent = 'Sign in'; signin.classList.toggle('hidden', !!user); }
  ['home-campaign','home-decks','home-collection'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !user);
  });
  setNote(user ? '' : 'Play needs no account. Sign in with Google to unlock the campaign and save your progress.');
  renderProfile(user);
}

const signinBtn = document.getElementById('home-signin');
if (signinBtn){
  signinBtn.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e){ setNote('Sign-in failed: ' + (e && (e.code || e.message) || 'unknown error')); console.error('[account] auth error', e); }
  });
}
/* profile menu: toggle + sign out (the icon picker buttons are bound per render) */
const profileBtn = document.getElementById('profile-btn');
if (profileBtn) profileBtn.addEventListener('click', () => { const m = document.getElementById('profile-menu'); if(m) m.classList.toggle('hidden'); });
const profileSignout = document.getElementById('profile-signout');
if (profileSignout) profileSignout.addEventListener('click', () => signOut(auth));
const profileEditName = document.getElementById('profile-editname');
if (profileEditName) profileEditName.addEventListener('click', () => openUsernameModal(false));
/* username modal wiring */
const unameInput = document.getElementById('username-input');
if (unameInput) unameInput.addEventListener('input', validateUsernameInput);
const unameConfirm = document.getElementById('username-confirm');
if (unameConfirm) unameConfirm.addEventListener('click', async () => {
  const v = (document.getElementById('username-input') || {}).value || '';
  try { await window.Account.setUsername(v); closeUsernameModal(); }
  catch (e){ const m = document.getElementById('username-msg'); if(m) m.textContent = (e && e.message) || 'Invalid.'; }
});
const unameCancel = document.getElementById('username-cancel');
if (unameCancel) unameCancel.addEventListener('click', closeUsernameModal);
/* keep the profile widget in sync when the profile changes (e.g. icon pick) */
changeCbs.push(() => renderProfile(auth.currentUser));

onAuthStateChanged(auth, async (user) => {
  renderAuthUI(user);
  if (!user){ currentProfile = null; return; }
  try {
    currentProfile = await loadOrCreateProfile(user);
    console.info('[account] profile ready', currentProfile);
    fireChange();
    if (!currentProfile.username) openUsernameModal(true);   // first sign-in: must choose a username
  } catch (e){
    console.error('[account] profile load/create failed', e);
    setNote('Signed in, but saving your profile failed — check Firestore rules. ' + (e.code || ''));
  }
});
