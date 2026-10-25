/**
 * test-pokerGame.js — Tests for the poker state machine.
 * Run with: node server/engine/test-pokerGame.js
 */

const { startNewHand, handlePlayerAction, sanitizeStateForClient, calculateSidePots } = require('./pokerGame');

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

// ─── Factory: build a minimal room object ────────────────────────────────────
function makeRoom(numPlayers = 3, overrides = {}) {
  const players = Array.from({ length: numPlayers }, (_, i) => ({
    playerId: `p${i + 1}`,
    socketId: `sock${i + 1}`,
    name: `Player${i + 1}`,
    seatIndex: i,
    coins: 1000,
    currentBet: 0,
    totalHandBet: 0,
    holeCards: [],
    status: 'ACTIVE',
    isConnected: true
  }));

  return {
    roomCode: 'TEST01',
    hostId: 'p1',
    status: 'LOBBY',
    config: {
      startingCoins: 1000,
      numDecks: 1,
      smallBlind: 10,
      bigBlind: 20,
      turnTimeLimitSec: 30
    },
    dealerIdx: 0,
    currentTurnIdx: 0,
    pot: 0,
    currentHighestBet: 0,
    minRaise: 20,
    communityCards: [],
    deck: [],
    players,
    ...overrides
  };
}

// ─── startNewHand ─────────────────────────────────────────────────────────────
console.log('\n── startNewHand ──');
{
  const room = makeRoom(3);
  room.dealerIdx = 2; // start at last seat, should rotate to 0
  startNewHand(room);

  assert('Status set to PREFLOP', room.status === 'PREFLOP');
  assert('Each player has 2 hole cards', room.players.every(p => p.holeCards.length === 2));
  assert('Community cards empty', room.communityCards.length === 0);
  assert('Pot equals SB + BB (30)', room.pot === 30, `pot=${room.pot}`);
  assert('Deck shrunk by 6 cards dealt', room.deck.length === 52 - 6, `deck=${room.deck.length}`);
  assert('SB player has 990 coins', room.players.some(p => p.coins === 990));
  assert('BB player has 980 coins', room.players.some(p => p.coins === 980));
  assert('currentHighestBet = bigBlind (20)', room.currentHighestBet === 20, `bet=${room.currentHighestBet}`);
}

// ─── Heads-up (2 player) blind rules ─────────────────────────────────────────
console.log('\n── Heads-up blind rules ──');
{
  const room = makeRoom(2);
  startNewHand(room);

  assert('Heads-up: pot = SB + BB = 30', room.pot === 30, `pot=${room.pot}`);
  assert('Heads-up: status PREFLOP', room.status === 'PREFLOP');
  assert('Heads-up: both players dealt 2 cards',
    room.players.every(p => p.holeCards.length === 2));
}

// ─── handlePlayerAction — FOLD ────────────────────────────────────────────────
console.log('\n── FOLD action ──');
{
  const room = makeRoom(3);
  startNewHand(room);
  const utgIdx = room.currentTurnIdx;
  const utgId = room.players[utgIdx].playerId;

  handlePlayerAction(room, utgId, 'FOLD');
  assert('Folded player status = FOLDED', room.players[utgIdx].status === 'FOLDED');
  assert('Turn advanced past folded player', room.currentTurnIdx !== utgIdx);
}

// ─── handlePlayerAction — CALL ────────────────────────────────────────────────
console.log('\n── CALL action ──');
{
  const room = makeRoom(3);
  startNewHand(room);
  const utgId = room.players[room.currentTurnIdx].playerId;
  const potBefore = room.pot;

  handlePlayerAction(room, utgId, 'CALL');
  assert('Pot increased by call amount (20)', room.pot === potBefore + 20, `pot=${room.pot}`);
}

// ─── handlePlayerAction — RAISE ───────────────────────────────────────────────
console.log('\n── RAISE action ──');
{
  const room = makeRoom(3);
  startNewHand(room);
  const utgId = room.players[room.currentTurnIdx].playerId;

  handlePlayerAction(room, utgId, 'RAISE', 60); // raise to 60
  assert('currentHighestBet updated to 60', room.currentHighestBet === 60, `bet=${room.currentHighestBet}`);
  assert('minRaise updated (60 - 20 = 40)', room.minRaise === 40, `minRaise=${room.minRaise}`);
}

// ─── handlePlayerAction — CHECK ───────────────────────────────────────────────
console.log('\n── CHECK action ──');
{
  const room = makeRoom(3);
  startNewHand(room);
  // BB can check when action gets back to them (after everyone just calls)
  // Simulate: UTG calls, SB calls, BB checks → street advances
  const utg = room.players[room.currentTurnIdx];
  handlePlayerAction(room, utg.playerId, 'CALL');

  const sb = room.players[room.currentTurnIdx];
  handlePlayerAction(room, sb.playerId, 'CALL');

  const bb = room.players[room.currentTurnIdx];
  const result = handlePlayerAction(room, bb.playerId, 'CHECK');

  assert('CHECK allowed when currentBet matches highest', true); // no throw = pass
  assert('After BB check, street advances to FLOP', room.status === 'FLOP', `status=${room.status}`);
  assert('3 community cards dealt on FLOP', room.communityCards.length === 3, `cards=${room.communityCards.length}`);
}

// ─── Full hand — fold to one winner ──────────────────────────────────────────
console.log('\n── Fold-to-winner hand ──');
{
  const room = makeRoom(3);
  startNewHand(room);

  // UTG raises, SB folds, BB folds → UTG wins
  const utg = room.players[room.currentTurnIdx];
  handlePlayerAction(room, utg.playerId, 'RAISE', 100);

  const sb = room.players[room.currentTurnIdx];
  handlePlayerAction(room, sb.playerId, 'FOLD');

  const bb = room.players[room.currentTurnIdx];
  const result = handlePlayerAction(room, bb.playerId, 'FOLD');

  assert('handOver = true when all but one fold', result.handOver === true);
  assert('Winner is UTG player', result.winners[0].playerId === utg.playerId);
  assert('Pot distributed to winner', room.players.find(p => p.playerId === utg.playerId).coins > 900);
  assert('Room pot is 0 after distribution', room.pot === 0);
}

// ─── Out-of-turn action throws ────────────────────────────────────────────────
console.log('\n── Out-of-turn validation ──');
{
  const room = makeRoom(3);
  startNewHand(room);
  const wrongPlayer = room.players[(room.currentTurnIdx + 1) % 3];

  let threw = false;
  try {
    handlePlayerAction(room, wrongPlayer.playerId, 'FOLD');
  } catch {
    threw = true;
  }
  assert('Out-of-turn action throws error', threw);
}

// ─── sanitizeStateForClient ───────────────────────────────────────────────────
console.log('\n── sanitizeStateForClient ──');
{
  const room = makeRoom(3);
  startNewHand(room);
  const viewerId = room.players[0].playerId;

  const sanitized = sanitizeStateForClient(room, viewerId);

  assert('Deck stripped from sanitized state', sanitized.deck === undefined);
  assert('Viewer sees own hole cards',
    sanitized.players[0].holeCards[0] !== 'BACK');
  assert('Other players show BACK cards',
    sanitized.players[1].holeCards[0] === 'BACK' &&
    sanitized.players[2].holeCards[0] === 'BACK');

  // Showdown reveals cards
  room.status = 'SHOWDOWN';
  const sanitizedShowdown = sanitizeStateForClient(room, viewerId);
  assert('Showdown reveals all non-folded cards',
    sanitizedShowdown.players.every(p =>
      p.status === 'FOLDED' || p.holeCards[0] !== 'BACK'
    ));
}

// ─── Side pot calculation ─────────────────────────────────────────────────────
console.log('\n── calculateSidePots ──');
{
  const players = [
    { playerId: 'p1', totalHandBet: 50,  status: 'ALL_IN' },
    { playerId: 'p2', totalHandBet: 200, status: 'ACTIVE' },
    { playerId: 'p3', totalHandBet: 200, status: 'ACTIVE' },
  ];
  const pots = calculateSidePots(players);

  assert('Side pot count >= 2 with one all-in', pots.length >= 2, `pots=${pots.length}`);

  const mainPot = pots[0];
  assert('Main pot = 50 * 3 = 150', mainPot.amount === 150, `main=${mainPot.amount}`);
  assert('Main pot eligible has all 3 players', mainPot.eligiblePlayerIds.length === 3);

  const sidePot = pots[1];
  assert('Side pot = 150 * 2 = 300... wait checking',
    sidePot.amount === (200 - 50) * 2, `side=${sidePot.amount}`);
  assert('Side pot only eligible for p2 and p3', sidePot.eligiblePlayerIds.length === 2);
}

// ─── All-in board runout (the stuck bug) ─────────────────────────────────────
console.log('\n── All-in board runout ──');
{
  const room = makeRoom(2); // heads-up, easier to force all-in
  startNewHand(room);

  // Both players shove all-in preflop
  const p1 = room.players[room.currentTurnIdx];
  handlePlayerAction(room, p1.playerId, 'RAISE', 1000); // all-in

  const p2 = room.players[room.currentTurnIdx];
  const result = handlePlayerAction(room, p2.playerId, 'CALL'); // call all-in

  assert('All-in runout: hand is over (showdown reached)',
    result.handOver === true, `handOver=${result.handOver}`);
  assert('All-in runout: has winners', result.winners?.length >= 1);
  assert('All-in runout: 5 community cards dealt',
    room.communityCards.length === 5, `communityCards=${room.communityCards.length}`);
  assert('All-in runout: pot distributed (both players coins sum = 2000)',
    room.players.reduce((s, p) => s + p.coins, 0) === 2000,
    `total=${room.players.reduce((s, p) => s + p.coins, 0)}`);
}

// ─── All-in mid-street board runout ──────────────────────────────────────────
console.log('\n── All-in mid-street ──');
{
  const room = makeRoom(3);
  startNewHand(room);

  // UTG calls, SB calls, BB checks → FLOP
  handlePlayerAction(room, room.players[room.currentTurnIdx].playerId, 'CALL');
  handlePlayerAction(room, room.players[room.currentTurnIdx].playerId, 'CALL');
  handlePlayerAction(room, room.players[room.currentTurnIdx].playerId, 'CHECK');

  assert('Mid-street setup: reached FLOP', room.status === 'FLOP', `status=${room.status}`);

  // On flop: p1 raises all-in, p2 calls all-in, p3 calls all-in → all ALL_IN
  handlePlayerAction(room, room.players[room.currentTurnIdx].playerId, 'RAISE', 1000);
  handlePlayerAction(room, room.players[room.currentTurnIdx].playerId, 'CALL');
  const result = handlePlayerAction(room, room.players[room.currentTurnIdx].playerId, 'CALL');

  assert('Mid-street all-in: hand is over', result.handOver === true, `handOver=${result.handOver}`);
  assert('Mid-street all-in: 5 community cards', room.communityCards.length === 5,
    `communityCards=${room.communityCards.length}`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
if (failed > 0) process.exit(1);
