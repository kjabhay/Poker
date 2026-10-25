const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  socketId: { type: String, default: null },
  name: { type: String, required: true },
  seatIndex: { type: Number, required: true },
  coins: { type: Number, default: 1000 },
  currentBet: { type: Number, default: 0 },
  totalHandBet: { type: Number, default: 0 },
  holeCards: { type: [String], default: [] },
  status: {
    type: String,
    enum: ['ACTIVE', 'FOLDED', 'ALL_IN', 'OUT'],
    default: 'ACTIVE'
  },
  isConnected: { type: Boolean, default: true }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  hostId: { type: String, required: true },
  status: {
    type: String,
    enum: ['LOBBY', 'PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'],
    default: 'LOBBY'
  },
  config: {
    startingCoins: { type: Number, default: 1000 },
    numDecks: { type: Number, default: 1 },
    smallBlind: { type: Number, default: 10 },
    bigBlind: { type: Number, default: 20 },
    turnTimeLimitSec: { type: Number, default: 30 }
  },
  dealerIdx: { type: Number, default: 0 },
  currentTurnIdx: { type: Number, default: 0 },
  pot: { type: Number, default: 0 },
  currentHighestBet: { type: Number, default: 0 },
  minRaise: { type: Number, default: 20 },
  communityCards: { type: [String], default: [] },
  players: { type: [playerSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

// 24-hour TTL index so the free MongoDB M0 tier never fills up
roomSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const Room = mongoose.model('Room', roomSchema);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Atlas connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB, Room };
