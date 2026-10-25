/**
 * pokerGame.js — Authoritative server-side poker state machine.
 *
 * Manages the full hand lifecycle:
 *   LOBBY → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → (next hand)
 *
 * All mutation happens on the in-memory room object passed by reference.
 * MongoDB snapshots are handled by the caller (socketHandlers.js).
 */

const { createAndShuffleDeck } = require('./deck');
const { evaluateShowdown } = require('./evaluator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the next seat index (wrapping) that has an ACTIVE or ALL_IN player
 * with coins > 0 (or is already ALL_IN). Used for dealer rotation.
 */
function nextActiveIndex(players, fromIdx) {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (players[idx].status !== 'OUT' && players[idx].coins > 0) return idx;
  }
  return fromIdx; // fallback (shouldn't happen with >= 2 players)
}

/**
 * Return the next seat index that can still act this round:
 * status ACTIVE and not yet matched the current highest bet (or hasn't acted).
 */
function nextActingIndex(players, fromIdx) {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    if (players[idx].status === 'ACTIVE') return idx;
  }
  return -1; // no active player found
}

/** Deduct coins from a player, clamping to 0 (triggers all-in automatically). */
function deductCoins(player, amount) {
  const actual = Math.min(amount, player.coins);
  player.coins -= actual;
  player.currentBet += actual;
  player.totalHandBet += actual;
  if (player.coins === 0 && player.status === 'ACTIVE') {
    player.status = 'ALL_IN';
  }
  return actual;
}

/**
 * Calculate side pots when one or more players are all-in.
 * Returns an array of { amount, eligiblePlayerIds[] } sorted smallest → largest.
 */
function calculateSidePots(players) {
  // Only consider players who put money in the pot this hand
  const contributors = players
    .filter(p => p.totalHandBet > 0)
    .map(p => ({ playerId: p.playerId, totalHandBet: p.totalHandBet, status: p.status }))
    .sort((a, b) => a.totalHandBet - b.totalHandBet);

  const pots = [];
  let processed = 0;

  for (let i = 0; i < contributors.length; i++) {
    const level = contributors[i].totalHandBet - processed;
    if (level <= 0) continue;

    const eligible = contributors
      .slice(i)
      .filter(p => p.status !== 'FOLDED')
      .map(p => p.playerId);

    const amount = level * (contributors.length - i);
    pots.push({ amount, eligiblePlayerIds: eligible });
    processed = contributors[i].totalHandBet;
  }

  return pots;
}

// ─── Street helpers ───────────────────────────────────────────────────────────

function resetForNewStreet(room) {
  room.currentHighestBet = 0;
  room.minRaise = room.config.bigBlind;
  room.bbHasOption = false; // no BB option on post-flop streets
  room.players.forEach(p => { p.currentBet = 0; p.hasActed = false; });
  // Set currentTurnIdx to first ACTIVE player left of dealer
  room.currentTurnIdx = nextActingIndex(room.players, room.dealerIdx);
}

function dealCommunityCards(room, count) {
  for (let i = 0; i < count; i++) {
    room.communityCards.push(room.deck.shift());
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a new hand. Mutates room in place.
 * - Rotates dealer clockwise (skips OUT players)
 * - Posts blinds
 * - Deals 2 hole cards to each active player
 * - Sets status to PREFLOP and currentTurnIdx to UTG (left of big blind)
 */
function startNewHand(room) {
  const players = room.players;

  // Remove players who are out of coins
  players.forEach(p => {
    if (p.coins <= 0 && p.status !== 'OUT') p.status = 'OUT';
  });

  const activePlayers = players.filter(p => p.status !== 'OUT');
  if (activePlayers.length < 2) {
    throw new Error('Not enough players with coins to start a hand');
  }

  // Reset all non-OUT players for new hand
  players.forEach(p => {
    if (p.status !== 'OUT') {
      p.status = 'ACTIVE';
      p.holeCards = [];
      p.currentBet = 0;
      p.totalHandBet = 0;
    }
  });

  // Rotate dealer to next eligible player
  room.dealerIdx = nextActiveIndex(players, room.dealerIdx);

  // Blind positions
  const numActive = activePlayers.length;
  let sbIdx, bbIdx, utgIdx;

  if (numActive === 2) {
    // Heads-up rule: dealer is small blind, other player is big blind
    sbIdx = room.dealerIdx;
    bbIdx = nextActiveIndex(players, sbIdx);
    utgIdx = sbIdx; // heads-up: dealer/SB acts first post-flop, BB acts first preflop... 
    // preflop UTG = dealer (SB) in heads-up
    utgIdx = sbIdx;
  } else {
    sbIdx = nextActiveIndex(players, room.dealerIdx);
    bbIdx = nextActiveIndex(players, sbIdx);
    utgIdx = nextActiveIndex(players, bbIdx);
  }

  // Post blinds
  room.pot = 0;
  room.currentHighestBet = 0;
  room.communityCards = [];

  const sbAmount = deductCoins(players[sbIdx], room.config.smallBlind);
  room.pot += sbAmount;

  const bbAmount = deductCoins(players[bbIdx], room.config.bigBlind);
  room.pot += bbAmount;

  room.currentHighestBet = Math.max(sbAmount, bbAmount);
  room.minRaise = room.config.bigBlind;

  // Shuffle and deal
  room.deck = createAndShuffleDeck(room.config.numDecks);

  const dealOrder = [];
  let idx = nextActiveIndex(players, room.dealerIdx);
  for (let i = 0; i < activePlayers.length; i++) {
    dealOrder.push(idx);
    idx = nextActiveIndex(players, idx);
  }

  // Deal 2 cards each (one at a time, poker style)
  for (let card = 0; card < 2; card++) {
    for (const seatIdx of dealOrder) {
      players[seatIdx].holeCards.push(room.deck.shift());
    }
  }

  room.status = 'PREFLOP';
  room.currentTurnIdx = utgIdx;
  room.bbIdx = bbIdx;         // track BB seat for the "BB option" check
  room.bbHasOption = true;    // BB hasn't acted yet — they get to raise even if everyone calls

  // BB may have gone all-in on the blind — skip if so
  if (players[room.currentTurnIdx].status === 'ALL_IN') {
    room.currentTurnIdx = nextActingIndex(players, room.currentTurnIdx);
  }

  // Mark blind posters as having acted (so round completion counts them)
  // But BB's "acted" flag is cleared — they still have their option
  players.forEach(p => { p.hasActed = false; });
  players[sbIdx].hasActed = true;
  // BB hasActed stays false so checkRoundCompletion waits for them
}

/**
 * Process a player action. Mutates room in place.
 * Returns { advanced: boolean } — true if the street/hand moved forward.
 *
 * @param {object} room
 * @param {string} playerId
 * @param {'FOLD'|'CHECK'|'CALL'|'RAISE'} action
 * @param {number} [raiseAmount] - Total amount to raise TO (not the raise increment)
 */
function handlePlayerAction(room, playerId, action, raiseAmount = 0) {
  const players = room.players;
  const player = players[room.currentTurnIdx];

  if (!player || player.playerId !== playerId) {
    throw new Error('It is not your turn');
  }
  if (player.status !== 'ACTIVE') {
    throw new Error('Player cannot act in current status: ' + player.status);
  }

  switch (action) {
    case 'FOLD':
      player.status = 'FOLDED';
      break;

    case 'CHECK':
      if (player.currentBet < room.currentHighestBet) {
        throw new Error(`Cannot check — must call ${room.currentHighestBet - player.currentBet} or raise`);
      }
      // No coins change, just passes action
      break;

    case 'CALL': {
      const callAmount = room.currentHighestBet - player.currentBet;
      if (callAmount <= 0) {
        // Nothing to call — treat as check
        break;
      }
      const paid = deductCoins(player, callAmount);
      room.pot += paid;
      break;
    }

    case 'RAISE': {
      // raiseAmount is the total bet the player wants to put in THIS street
      const minTotal = room.currentHighestBet + room.minRaise;
      const maxTotal = player.currentBet + player.coins; // all-in cap

      let raiseTo = Math.max(raiseAmount, minTotal);
      raiseTo = Math.min(raiseTo, maxTotal); // cap at all-in

      const increment = raiseTo - room.currentHighestBet; // the raise size above current
      const toAdd = raiseTo - player.currentBet;          // what this player actually pays

      const paid = deductCoins(player, toAdd);
      room.pot += paid;

      // Only update minRaise if this was a full raise (not a partial all-in)
      if (raiseTo >= minTotal) {
        room.minRaise = increment;
      }
      room.currentHighestBet = Math.max(room.currentHighestBet, player.currentBet);

      // A raise re-opens the action — everyone (including BB) needs to act again
      room.bbHasOption = false;
      room.players.forEach(p => {
        if (p.status === 'ACTIVE' && p.playerId !== player.playerId) {
          p.hasActed = false;
        }
      });
      break;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }

  // Mark this player as having acted this street
  player.hasActed = true;

  // If BB just acted (their option), clear the bbHasOption flag
  if (room.bbHasOption && room.bbIdx === room.currentTurnIdx) {
    room.bbHasOption = false;
  }

  // Advance turn to next ACTIVE player
  room.currentTurnIdx = nextActingIndex(players, room.currentTurnIdx);

  return checkRoundCompletion(room);
}

/**
 * Check if the current betting round is over and advance state accordingly.
 * Returns { handOver: boolean, winners?: Array }
 */
function checkRoundCompletion(room) {
  const players = room.players;
  const activePlayers = players.filter(p => p.status === 'ACTIVE' || p.status === 'ALL_IN');
  const foldedOut = players.filter(p => p.status !== 'FOLDED' && p.status !== 'OUT');

  // ── Case 1: Only one player left unfolded — instant win ──────────────────
  if (foldedOut.length === 1) {
    const winner = foldedOut[0];
    winner.coins += room.pot;
    room.pot = 0;
    room.status = 'SHOWDOWN';
    return {
      handOver: true,
      winners: [{ playerId: winner.playerId, name: winner.name }],
      winningHandDescription: 'All others folded',
      handDescriptions: { [winner.playerId]: 'All others folded' },
      sidePots: []
    };
  }

  // ── Case 2: All remaining ACTIVE players have matched the bet ─────────────
  const activePlayers2 = players.filter(p => p.status === 'ACTIVE');

  const bettingComplete = activePlayers2.every(p =>
    p.currentBet === room.currentHighestBet && p.hasActed
  );

  // BB still has their option (everyone limped preflop and BB hasn't acted yet)
  const bbStillToAct = room.bbHasOption &&
    room.players[room.bbIdx]?.status === 'ACTIVE';

  // Also complete if no ACTIVE players remain (all ALL_IN)
  const noActiveLeft = activePlayers2.length === 0;

  if ((!bettingComplete && !noActiveLeft) || bbStillToAct) {
    return { handOver: false }; // round still in progress
  }

  // ── Advance to next street ────────────────────────────────────────────────
  const streets = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];
  const currentIdx = streets.indexOf(room.status);
  const nextStreet = streets[currentIdx + 1];

  if (nextStreet === 'FLOP') {
    resetForNewStreet(room);
    dealCommunityCards(room, 3);
    room.status = 'FLOP';
    return { handOver: false };
  }

  if (nextStreet === 'TURN') {
    resetForNewStreet(room);
    dealCommunityCards(room, 1);
    room.status = 'TURN';
    return { handOver: false };
  }

  if (nextStreet === 'RIVER') {
    resetForNewStreet(room);
    dealCommunityCards(room, 1);
    room.status = 'RIVER';
    return { handOver: false };
  }

  if (nextStreet === 'SHOWDOWN') {
    // Deal remaining community cards if all-ins ran out the board early
    while (room.communityCards.length < 5) {
      room.communityCards.push(room.deck.shift());
    }
    room.status = 'SHOWDOWN';
    return resolveShowdown(room);
  }

  return { handOver: false };
}

/**
 * Resolve the showdown: evaluate hands, distribute side pots, update coin stacks.
 */
function resolveShowdown(room) {
  const players = room.players;
  const sidePots = calculateSidePots(players);

  // Evaluate the showdown
  const showdownResult = evaluateShowdown(players, room.communityCards);

  // Distribute each pot to eligible winners
  for (const pot of sidePots) {
    const eligibleWinners = showdownResult.winners.filter(w =>
      pot.eligiblePlayerIds.includes(w.playerId)
    );

    // If no declared winner is eligible for this pot, fall back to best hand among eligible
    const potWinners = eligibleWinners.length > 0
      ? eligibleWinners
      : (() => {
          const eligiblePlayers = players.filter(p =>
            pot.eligiblePlayerIds.includes(p.playerId) && p.status !== 'FOLDED'
          );
          try {
            return evaluateShowdown(eligiblePlayers, room.communityCards).winners;
          } catch {
            return [];
          }
        })();

    if (potWinners.length === 0) continue;

    const share = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount % potWinners.length;

    potWinners.forEach((w, i) => {
      const p = players.find(pl => pl.playerId === w.playerId);
      if (p) p.coins += share + (i === 0 ? remainder : 0); // give remainder to first winner
    });
  }

  room.pot = 0;

  return {
    handOver: true,
    winners: showdownResult.winners,
    winningHandDescription: showdownResult.winningHandDescription,
    handDescriptions: showdownResult.handDescriptions,
    sidePots
  };
}

/**
 * Return a deep copy of room safe to send to a specific viewer:
 * - Strips the deck entirely
 * - Replaces other players' holeCards with ['BACK','BACK']
 *   (except during/after SHOWDOWN where non-folded cards are revealed)
 *
 * @param {object} room
 * @param {string} viewerPlayerId
 * @returns {object}
 */
function sanitizeStateForClient(room, viewerPlayerId) {
  const copy = JSON.parse(JSON.stringify(room));
  delete copy.deck;

  copy.players = copy.players.map(p => {
    if (p.playerId === viewerPlayerId) return p; // show own cards always
    if (room.status === 'SHOWDOWN' && p.status !== 'FOLDED') return p; // reveal at showdown
    p.holeCards = p.holeCards.length > 0 ? ['BACK', 'BACK'] : [];
    return p;
  });

  return copy;
}

module.exports = {
  startNewHand,
  handlePlayerAction,
  checkRoundCompletion,
  sanitizeStateForClient,
  calculateSidePots
};
