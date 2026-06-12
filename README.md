# ABSTRACTS

*A summoning card game where concepts take form.*

**[▶ Play it now](https://alex-caian.github.io/abstracts/)** — single-player vs. the Adversary, in your browser. Nothing to install.

<img src="screenshots/abstracts1.png" height=600px width=400px/>

---

## The concept

Abstracts is a duelling card game built around anthropomorphised concepts — **Fear**, **Justice**, and **Knowledge**. You do not play a hero who summons creatures; you *are* the concept, and the game is the struggle to give yourself form.

Each Abstract fights on its own **geometry**: Fear commands a pentagon, Justice a triangle, Knowledge a sprawling octagon it can refine. Followers are played onto the nodes of your geometry, and every node grants a different bonus — the same card becomes a different threat depending on where you place it. But position matters far beyond bonuses: the ritual itself flows through the diagram's edges.

## How to play

### The goal

Your **core** — 30 HP of latent essence — rests at the centre of your geometry. Reduce the enemy core to 0 and their concept dissolves. Protect your own at all costs.

### Turns

Each turn you gain a mana crystal (up to 10), refill your mana, and draw a card. Then:

- **Drag followers** from your hand onto the empty nodes (dots) of your geometry. Hover a dot to see the bonus it grants.
- **Click spells** to cast them — they resolve immediately; some ask for a target.
- **Click a glowing follower** to act with it. Followers act once per turn, but never on the turn they are played (they rest, marked **zZ**).

A follower can do one of two things with its action:

- **Attack** — strike an enemy follower, or the enemy face at the centre of their geometry.
- **Invoke** — channel its invoke value (the violet badge) into your essence instead of fighting.

Every turn poses the same dilemma: press the attack, hold the line, or feed the circle.

### The ritual: links and communion

Followers on **adjacent** nodes form a **link** — the edge between them ignites. Links are the conduit of the ritual:

- A follower can only **invoke while linked**. An isolated follower cannot channel (its badge dims), and not every follower can invoke at all.
- Start your turn with **every node filled** and the completed circle enters **communion**, channelling **+1 essence per follower** passively — the bigger your geometry, the louder it sings. Your opponent will be looking to break the circle before your turn comes around.

### Essence is a currency

Essence accrues without limit and is never wasted. You spend it on two things:

| Purchase | Cost |
|---|---|
| Summon your form | **Fear 8 · Knowledge 12 · Justice 15**, +5 each time it is unmade |
| Your form's active ability | varies by Abstract, once per turn |

### The manifested form

When you summon, your Abstract takes physical form at the centre. While it stands, it **shields your core completely** — all face damage strikes the form, and nothing spills through. The form cannot attack or invoke; its power is presence. All auras trigger at the start of your turn.

| | **FEAR** | **JUSTICE** | **KNOWLEDGE** |
|---|---|---|---|
| Geometry | Pentagon (5 nodes) | Triangle (3 nodes) | Octagon (8 nodes, distillable to 4) |
| Form HP / summon cost | 6 HP · 8 essence | 10 HP · 15 essence | 10 HP · 12 essence |
| On arrival | Every empty node fills with a 1/1 Terror Spider | Day of Judgement: each enemy follower takes damage equal to its own Attack | Awakening: your followers gain +1 invoke value; draw a card |
| Aura | 3 damage, and a random enemy follower is Terrified (cannot act next turn) | If outnumbered, 2 damage to a random enemy follower; otherwise restore 1 HP | Draw a card and gain 1 mana |
| Ability (essence) | Brood (3): summon a 2/2 Giant Spider that deals 1 damage on death | Verdict (6): destroy the strongest enemy follower | Insight (4): draw 2 cards; in communion, also +1 essence and 1 damage |

Three relationships with the god: Fear is cheap to conjure, quick to fall, and always returning — an aggro deck whose summon is a weapon. Justice is the expensive fortress, arriving late and judging hard. Knowledge sits between, and it alone can **distil** its diagram: spells dissolve empty nodes forever, neighbours join (sometimes forging new links), the polygon redraws itself, and communion comes within reach.

### The litany

Your deck never runs dry: when it empties, your spent cards shuffle back in — *the litany begins anew*. But a card drawn to a full hand is **forgotten**, gone from the cycle for good. And no duel lasts forever: from turn 25, both cores decay at the start of each turn — 1, then 2, then 3… Reality reasserts itself.

### Controls

| Input | Action |
|---|---|
| Drag a card to a node | Play a follower |
| Click a card | Cast a spell |
| Click a glowing follower | Choose its action (attack targets light up) |
| **Esc** / Cancel / click empty ground | Deselect |
| **Enter** | End turn |

## Running locally

No build step, no dependencies, no server. The game is plain HTML, CSS, and JavaScript:

```bash
git clone https://github.com/Alex-Caian/abstracts.git
cd abstracts
# open index.html in any modern browser — that's it
```

## Project structure

```
abstracts/
├── index.html          # markup shell; loads styles and scripts in order
├── css/
│   └── style.css       # all styling, theming via CSS custom properties
└── js/
    ├── config.js       # game constants and node-effect definitions
    ├── cards.js        # the card database (followers and spells)
    ├── archetypes.js   # the three Abstracts: geometry, decks, powers
    ├── state.js        # game state container and accessors
    ├── engine.js       # core rules: turns, combat, essence, summoning
    ├── ai.js           # the Adversary: plays either seat, links-aware
    ├── render.js       # all DOM rendering (no game rules here)
    ├── input.js        # click, drag-and-drop, and keyboard handling
    └── main.js         # bootstrap and deck-select screen
```

### Architecture notes

- **Zero dependencies.** Vanilla JavaScript with plain `<script>` tags sharing global scope — load order in `index.html` matters and is documented there.
- **Data-driven design.** Cards, archetypes, and node effects are declarative objects in `cards.js`, `archetypes.js`, and `config.js`. Adding a card is one line; adding an Abstract is one object (geometry, deck, and powers included). Geometry is per-player and mutable at runtime — Knowledge's Distillation reshapes the board mid-game.
- **Strict layering.** `engine.js` contains rules and never touches the DOM beyond delegated helpers; `render.js` draws state and contains no rules; `input.js` translates user intent into engine calls.
- **Touch-first dragging.** Drag-and-drop is built on Pointer Events rather than the HTML5 drag API, so the same code path serves mouse and touch — the game is playable on mobile. A ghost card follows the pointer and the drop target is resolved with `elementFromPoint`. One quirk worth knowing: the hand is never re-rendered during a drag; node highlights are applied directly rather than through the normal render pass (see `input.js`).
- **Simulation-tuned.** Balance is tuned with a headless jsdom harness: 50+ automated rule checks plus AI-vs-AI batch simulations across every matchup and seating, measuring win rates, game length, and summon timing.

## Releases

The project follows a staging → release flow: changes are developed and playtested in a local staging copy, then copied here, committed, and tagged (`v0.x.y`, loosely semantic — middle number for mechanics and features, last for fixes). Each push to `main` deploys automatically to GitHub Pages.

| Version | Highlights |
|---|---|
| v0.2.2 | The ritual update: link-gated invoking, communion, per-Abstract summon costs, Knowledge's distillable octagon (Twin Prophets, Veil of Theory, Distillation, Refutation), aggro Fear (cheap recurring form, Mass Hysteria, Giant Spiders), the litany (decks recycle, overdraw forgets), turn-25 decay clock, Terrified status, AI-vs-AI balance simulator |
| v0.2.1 | Mobile support: drag-and-drop rebuilt on Pointer Events (touch and mouse), ghost-card drag preview, ghost-click suppression |
| v0.2.0 | Invoke economy rework: the Abstract *is* the player — 30 HP core, pure-HP shield forms, resummoning at escalating cost, arrival powers, once-per-turn abilities, hover tooltips |
| v0.1.x | Initial release: three decks, node geometries, drag-and-drop, click-to-attack, NPC opponent |

## Roadmap

- **Progression (v0.3.x)** — accounts, card collections, deck-building, and campaigns that unlock cards through missions. No pack openings, ever: rewards come from play.
- **Multiplayer (v0.4.x)** — private 1v1 rooms via shareable code.
- **Visual overhaul (v0.5.x)** — effects, card art, and flavour treatment for the Abstracts.
- **The balance break** — deck-aware AI opponents and serious meta tuning, building on the simulator.
- **New Abstracts (v0.6.x)** — one or two new concepts, each bending a different rule, introduced through the campaign.
- Commit the headless test harness and simulator used during development.

## Credits

Designed by Alex, built with Claude Fable 5.
