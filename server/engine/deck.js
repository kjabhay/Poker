/**
 * deck.js — Multi-deck card generator with cryptographically secure shuffle.
 *
 * Card format: rank + suit, e.g. 'Ah' (Ace of Hearts), 'Td' (Ten of Diamonds),
 * '2c' (Two of Clubs), 'Ks' (King of Spades).
 */

const { randomInt } = require('crypto');

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades

/**
 * Build and shuffle one or more standard 52-card decks.
 * Uses Fisher-Yates with Node's crypto.randomInt() for a cryptographically
 * fair shuffle — card order cannot be predicted or reproduced.
 *
 * @param {number} numDecks - Number of 52-card decks to combine (default: 1)
 * @returns {string[]} Shuffled array of card strings, length = 52 * numDecks
 */
function createAndShuffleDeck(numDecks = 1) {
  if (!Number.isInteger(numDecks) || numDecks < 1 || numDecks > 8) {
    throw new RangeError('numDecks must be an integer between 1 and 8');
  }

  // Build the combined deck
  const deck = [];
  for (let d = 0; d < numDecks; d++) {
    for (const rank of RANKS) {
      for (const suit of SUITS) {
        deck.push(`${rank}${suit}`);
      }
    }
  }

  // Fisher-Yates shuffle using crypto.randomInt for uniform distribution
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1); // 0 ≤ j ≤ i (inclusive on both ends)
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

module.exports = { createAndShuffleDeck, RANKS, SUITS };
