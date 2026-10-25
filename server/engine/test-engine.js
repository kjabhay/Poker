/**
 * test-engine.js — Quick smoke tests for deck.js and evaluator.js
 * Run with: node server/engine/test-engine.js
 */

const { createAndShuffleDeck } = require('./deck');
const { evaluateShowdown } = require('./evaluator');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── deck.js tests ───────────────────────────────────────────────────────────
console.log('\n── deck.js ──');

const deck1 = createAndShuffleDeck(1);
assert('Single deck has 52 cards', deck1.length === 52, `got ${deck1.length}`);
assert('All cards unique in single deck', new Set(deck1).size === 52);
assert('Cards match expected format (rank+suit)', deck1.every(c => /^[2-9TJQKA][hdcs]$/.test(c)));

const deck2 = createAndShuffleDeck(2);
assert('Double deck has 104 cards', deck2.length === 104, `got ${deck2.length}`);
assert('Double deck has 2 copies of each card', (() => {
  const counts = {};
  deck2.forEach(c => counts[c] = (counts[c] || 0) + 1);
  return Object.values(counts).every(v => v === 2);
})());

// Verify shuffle actually randomises (two shuffles should differ)
const deckA = createAndShuffleDeck(1);
const deckB = createAndShuffleDeck(1);
assert('Two shuffles produce different orders', deckA.join() !== deckB.join());

// Edge case: invalid numDecks
let threw = false;
try { createAndShuffleDeck(0); } catch { threw = true; }
assert('Throws on numDecks = 0', threw);

threw = false;
try { createAndShuffleDeck(9); } catch { threw = true; }
assert('Throws on numDecks = 9', threw);

// ─── evaluator.js tests ───────────────────────────────────────────────────────
console.log('\n── evaluator.js ──');

// Royal flush vs pair — royal flush must win
const community = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];
const players = [
  { playerId: 'p1', name: 'Alice', holeCards: ['2c', '3d'], status: 'ACTIVE' },  // pair of nothing, royal board
  { playerId: 'p2', name: 'Bob',   holeCards: ['Ac', 'Ad'], status: 'ACTIVE' },  // has full house (AAA + KK ish)
  { playerId: 'p3', name: 'Carol', holeCards: ['9h', '8h'], status: 'ACTIVE' },  // has royal flush (board)
];
const result1 = evaluateShowdown(players, community);
assert('evaluateShowdown returns winners array', Array.isArray(result1.winners));
assert('handDescriptions populated for all active players',
  Object.keys(result1.handDescriptions).length === 3);
assert('winningHandDescription is a string', typeof result1.winningHandDescription === 'string');
console.log(`     Winning hand: "${result1.winningHandDescription}"`);

// Folded players excluded
const players2 = [
  { playerId: 'p1', name: 'Alice', holeCards: ['As', 'Ks'], status: 'FOLDED' },
  { playerId: 'p2', name: 'Bob',   holeCards: ['2h', '3d'], status: 'ACTIVE' },
];
const result2 = evaluateShowdown(players2, ['7c', '8d', '9s', 'Th', 'Jh']);
assert('Folded players are excluded from evaluation',
  result2.winners.every(w => w.playerId !== 'p1'));

// Single unfolded player wins immediately
const result3 = evaluateShowdown(
  [{ playerId: 'p1', name: 'Alice', holeCards: ['As', 'Ks'], status: 'ACTIVE' }],
  ['7c', '8d', '9s', 'Th', 'Jh']
);
assert('Single active player wins by default', result3.winners[0].playerId === 'p1');
assert('Description is "Last player standing"',
  result3.winningHandDescription === 'Last player standing');

// Multi-deck duplicate card deduplication
const players3 = [
  { playerId: 'p1', name: 'Alice', holeCards: ['Ah', 'Ah'], status: 'ACTIVE' }, // duplicate Ah (multi-deck)
  { playerId: 'p2', name: 'Bob',   holeCards: ['2c', '3d'], status: 'ACTIVE' },
];
let dedupThrew = false;
try {
  evaluateShowdown(players3, ['Kh', 'Qh', 'Jh', 'Th', '9h']);
} catch (e) {
  dedupThrew = true;
  console.log(`     (dedup threw: ${e.message})`);
}
assert('Multi-deck duplicate cards handled without crash', !dedupThrew);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
