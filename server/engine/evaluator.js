/**
 * evaluator.js — Showdown hand evaluation using pokersolver.
 *
 * pokersolver expects cards in the format: 'Ah', 'Td', '2c', 'Ks'
 * (same format our deck.js uses).
 *
 * Multi-deck edge case: if a player's 7-card pool contains duplicate
 * suit+rank cards (only possible with numDecks > 1), we deduplicate them
 * before solving to avoid pokersolver crashing on five-of-a-kind scenarios.
 */

const { Hand } = require('pokersolver');

/**
 * Deduplicate cards in a 7-card pool (hole + community).
 * Keeps only the first occurrence of each unique card string.
 * This is only needed for multi-deck games where the same card
 * can appear twice (e.g. two 'Ah' in play).
 *
 * @param {string[]} cards
 * @returns {string[]}
 */
function deduplicateCards(cards) {
  return [...new Set(cards)];
}

/**
 * Evaluate all active (non-folded) players at showdown and determine winner(s).
 *
 * @param {Array<{ playerId: string, name: string, holeCards: string[], status: string }>} players
 * @param {string[]} communityCards - Exactly 5 community cards at showdown
 * @returns {{
 *   winners: Array<{ playerId: string, name: string }>,
 *   handDescriptions: Record<string, string>,
 *   winningHandDescription: string
 * }}
 */
function evaluateShowdown(players, communityCards) {
  if (communityCards.length !== 5) {
    throw new Error(`evaluateShowdown requires exactly 5 community cards, got ${communityCards.length}`);
  }

  // Only evaluate players still in the hand
  const activePlayers = players.filter(p => p.status !== 'FOLDED' && p.status !== 'OUT');

  if (activePlayers.length === 0) {
    throw new Error('No active players to evaluate at showdown');
  }

  // If only one player is left (everyone else folded), they win trivially
  if (activePlayers.length === 1) {
    return {
      winners: [{ playerId: activePlayers[0].playerId, name: activePlayers[0].name }],
      handDescriptions: { [activePlayers[0].playerId]: 'Last player standing' },
      winningHandDescription: 'Last player standing'
    };
  }

  // Solve each player's best 5-card hand from their 7 available cards
  const solvedHands = activePlayers.map(player => {
    const sevenCards = deduplicateCards([...player.holeCards, ...communityCards]);

    // pokersolver needs at least 5 cards; deduplication could drop us below
    // that only in extreme multi-deck edge cases — handle gracefully
    if (sevenCards.length < 5) {
      return { player, hand: null };
    }

    const hand = Hand.solve(sevenCards);
    hand._playerId = player.playerId; // tag for lookup after Hand.winners()
    return { player, hand };
  }).filter(e => e.hand !== null);

  // Hand.winners() returns the Hand object(s) with the best rank
  const handObjects = solvedHands.map(e => e.hand);
  const winningHands = Hand.winners(handObjects);

  // Map winning hand objects back to player IDs
  const winners = winningHands.map(wh => {
    const entry = solvedHands.find(e => e.hand === wh);
    return { playerId: entry.player.playerId, name: entry.player.name };
  });

  // Build a description map for every active player (for showdown reveal UI)
  const handDescriptions = {};
  solvedHands.forEach(({ player, hand }) => {
    handDescriptions[player.playerId] = hand.descr; // e.g. "Full House, Aces Full of Kings"
  });

  const winningHandDescription = winningHands[0].descr;

  return { winners, handDescriptions, winningHandDescription };
}

module.exports = { evaluateShowdown };
