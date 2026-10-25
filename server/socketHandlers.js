/**
 * socketHandlers.js — Socket.IO event handlers for lobby and game events.
 *
 * In-memory Map<roomCode, roomState> is the source of truth during an active
 * game. MongoDB is written on room creation and at the end of each hand.
 */

const { Room } = require('./db');
const {
  startNewHand,
  handlePlayerAction,
  sanitizeStateForClient
} = require('./engine/pokerGame');

// ─── In-memory room store ─────────────────────────────────────────────────────
const rooms = new Map(); // roomCode → roomState

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random 6-character uppercase alphanumeric room code. */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 ambiguity
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

/** Emit the sanitized room state to every connected player in the room. */
function broadcastRoomState(io, room) {
  for (const player of room.players) {
    if (player.socketId && player.isConnected) {
      const state = sanitizeStateForClient(room, player.playerId);
      io.to(player.socketId).emit('room:state', state);
    }
  }
}

/** Emit hole cards privately to each player after a new hand is dealt. */
function emitHoleCards(io, room) {
  for (const player of room.players) {
    if (player.socketId && player.isConnected && player.holeCards.length > 0) {
      io.to(player.socketId).emit('player:holeCards', { holeCards: player.holeCards });
    }
  }
}

/** Persist a lightweight snapshot of the room to MongoDB. */
async function saveRoomSnapshot(room) {
  try {
    const { deck, ...snapshot } = room; // never store the live deck
    await Room.findOneAndUpdate(
      { roomCode: room.roomCode },
      { $set: snapshot },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error(`[DB] snapshot failed for ${room.roomCode}:`, err.message);
  }
}

/**
 * After a hand ends, notify all clients that the host needs to deal the next hand.
 * The host will click "Deal Next Hand" which emits game:dealNext.
 */
function notifyWaitingForDeal(io, room) {
  const dealer = room.players[room.dealerIdx];
  io.to(room.roomCode).emit('game:waitingForDeal', {
    dealerId:   dealer?.playerId ?? room.hostId,
    dealerName: dealer?.name ?? 'Dealer'
  });
}

// ─── Main handler registration ────────────────────────────────────────────────

module.exports = function registerHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`[Socket] connected: ${socket.id}`);

    // ── room:create ────────────────────────────────────────────────────────
    socket.on('room:create', async ({ name, playerId, config = {} } = {}) => {
      if (!name || !playerId) {
        return socket.emit('error:message', { message: 'name and playerId are required' });
      }

      const roomCode = generateRoomCode();
      const startingCoins = Number(config.startingCoins) || 1000;

      const room = {
        roomCode,
        hostId: playerId,
        status: 'LOBBY',
        config: {
          startingCoins,
          numDecks: Number(config.numDecks) || 1,
          smallBlind: Number(config.smallBlind) || 10,
          bigBlind: Number(config.bigBlind) || 20,
          turnTimeLimitSec: 30
        },
        dealerIdx: 0,
        currentTurnIdx: 0,
        pot: 0,
        currentHighestBet: 0,
        minRaise: Number(config.bigBlind) || 20,
        communityCards: [],
        deck: [],
        players: [{
          playerId,
          socketId: socket.id,
          name: name.trim().slice(0, 20),
          seatIndex: 0,
          coins: startingCoins,
          currentBet: 0,
          totalHandBet: 0,
          holeCards: [],
          status: 'ACTIVE',
          isConnected: true
        }]
      };

      rooms.set(roomCode, room);
      socket.join(roomCode);
      await saveRoomSnapshot(room);

      socket.emit('room:created', { roomCode });
      broadcastRoomState(io, room);
      console.log(`[Room] created: ${roomCode} by ${name}`);
    });

    // ── room:join ──────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomCode, name, playerId } = {}) => {
      if (!roomCode || !name || !playerId) {
        return socket.emit('error:message', { message: 'roomCode, name, and playerId are required' });
      }

      const code = roomCode.toUpperCase().trim();
      const room = rooms.get(code);

      if (!room) {
        return socket.emit('error:message', { message: `Room "${code}" not found` });
      }

      socket.join(code);

      // Reconnection: player already has a seat
      const existing = room.players.find(p => p.playerId === playerId);
      if (existing) {
        existing.socketId = socket.id;
        existing.isConnected = true;
        broadcastRoomState(io, room);

        // Re-send hole cards if a hand is in progress
        if (room.status !== 'LOBBY' && existing.holeCards.length > 0) {
          socket.emit('player:holeCards', { holeCards: existing.holeCards });
        }
        console.log(`[Room] ${playerId} reconnected to ${code}`);
        return;
      }

      // New player joining
      if (room.status !== 'LOBBY') {
        return socket.emit('error:message', { message: 'Game already in progress — cannot join mid-hand' });
      }

      if (room.players.length >= 9) {
        return socket.emit('error:message', { message: 'Room is full (max 9 players)' });
      }

      room.players.push({
        playerId,
        socketId: socket.id,
        name: name.trim().slice(0, 20),
        seatIndex: room.players.length,
        coins: room.config.startingCoins,
        currentBet: 0,
        totalHandBet: 0,
        holeCards: [],
        status: 'ACTIVE',
        isConnected: true
      });

      broadcastRoomState(io, room);
      console.log(`[Room] ${name} joined ${code} (${room.players.length} players)`);
    });

    // ── room:updateConfig ──────────────────────────────────────────────────
    socket.on('room:updateConfig', ({ roomCode, playerId, config = {} } = {}) => {
      const room = rooms.get(roomCode?.toUpperCase());
      if (!room) return socket.emit('error:message', { message: 'Room not found' });
      if (room.hostId !== playerId) return socket.emit('error:message', { message: 'Only the host can change settings' });
      if (room.status !== 'LOBBY') return socket.emit('error:message', { message: 'Cannot change settings after game starts' });

      if (config.startingCoins) room.config.startingCoins = Number(config.startingCoins);
      if (config.numDecks)      room.config.numDecks      = Math.min(8, Math.max(1, Number(config.numDecks)));
      if (config.smallBlind)    room.config.smallBlind    = Number(config.smallBlind);
      if (config.bigBlind)      room.config.bigBlind      = Number(config.bigBlind);

      // Sync all seated players' coin stacks to new startingCoins
      room.players.forEach(p => { p.coins = room.config.startingCoins; });

      broadcastRoomState(io, room);
    });

    // ── game:start ─────────────────────────────────────────────────────────
    socket.on('game:start', async ({ roomCode, playerId } = {}) => {
      const room = rooms.get(roomCode?.toUpperCase());
      if (!room) return socket.emit('error:message', { message: 'Room not found' });
      if (room.hostId !== playerId) return socket.emit('error:message', { message: 'Only the host can start the game' });
      if (room.status !== 'LOBBY') return socket.emit('error:message', { message: 'Game already started' });
      if (room.players.length < 2) return socket.emit('error:message', { message: 'Need at least 2 players to start' });

      try {
        startNewHand(room);
        broadcastRoomState(io, room);
        emitHoleCards(io, room);
        await saveRoomSnapshot(room);
        console.log(`[Game] started in ${roomCode}`);
      } catch (err) {
        socket.emit('error:message', { message: err.message });
      }
    });

    // ── game:action ────────────────────────────────────────────────────────
    socket.on('game:action', async ({ roomCode, playerId, action, amount = 0 } = {}) => {
      const room = rooms.get(roomCode?.toUpperCase());
      if (!room) return socket.emit('error:message', { message: 'Room not found' });
      if (room.status === 'LOBBY' || room.status === 'SHOWDOWN') {
        return socket.emit('error:message', { message: 'No active betting round' });
      }

      try {
        const result = handlePlayerAction(room, playerId, action.toUpperCase(), Number(amount));
        broadcastRoomState(io, room);

        if (result.handOver) {
          // Emit showdown result to the whole room
          io.to(room.roomCode).emit('game:showdown', {
            winners: result.winners,
            winningHandDescription: result.winningHandDescription,
            handDescriptions: result.handDescriptions,
            sidePots: result.sidePots,
            players: room.players.map(p => ({
              playerId: p.playerId,
              name: p.name,
              coins: p.coins,
              holeCards: p.status !== 'FOLDED' ? p.holeCards : [],
              status: p.status
            }))
          });

          await saveRoomSnapshot(room);
          notifyWaitingForDeal(io, room);
        }
      } catch (err) {
        socket.emit('error:message', { message: err.message });
      }
    });

    // ── game:dealNext ──────────────────────────────────────────────────────
    socket.on('game:dealNext', async ({ roomCode, playerId: pid } = {}) => {
      const room = rooms.get(roomCode?.toUpperCase());
      if (!room) return socket.emit('error:message', { message: 'Room not found' });
      const dealer = room.players[room.dealerIdx];
      if (dealer?.playerId !== pid) return socket.emit('error:message', { message: 'Only the dealer can deal the next hand' });
      if (room.status !== 'SHOWDOWN') return socket.emit('error:message', { message: 'Hand is still in progress' });

      const eligible = room.players.filter(p => p.status !== 'OUT' && p.coins > 0);
      if (eligible.length < 2) {
        io.to(room.roomCode).emit('game:over', {
          message: 'Not enough players with coins to continue.',
          players: room.players.map(p => ({ name: p.name, coins: p.coins }))
        });
        return;
      }

      try {
        startNewHand(room);
        broadcastRoomState(io, room);
        emitHoleCards(io, room);
        await saveRoomSnapshot(room);
      } catch (err) {
        socket.emit('error:message', { message: err.message });
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] disconnected: ${socket.id}`);

      // Mark the player as disconnected but keep their seat
      for (const room of rooms.values()) {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) {
          player.isConnected = false;
          broadcastRoomState(io, room);

          // If it was their turn, auto-fold after a short grace period
          if (
            room.status !== 'LOBBY' &&
            room.status !== 'SHOWDOWN' &&
            room.players[room.currentTurnIdx]?.playerId === player.playerId
          ) {
            setTimeout(() => {
              const current = rooms.get(room.roomCode);
              if (!current) return;
              const p = current.players.find(pl => pl.socketId === socket.id);
              if (!p || p.isConnected) return; // reconnected in time

              try {
                const result = handlePlayerAction(current, player.playerId, 'FOLD');
                broadcastRoomState(io, current);

                if (result.handOver) {
                  io.to(current.roomCode).emit('game:showdown', {
                    winners: result.winners,
                    winningHandDescription: result.winningHandDescription,
                    handDescriptions: result.handDescriptions,
                    sidePots: result.sidePots,
                    players: current.players.map(pl => ({
                      playerId: pl.playerId,
                      name: pl.name,
                      coins: pl.coins,
                      holeCards: pl.status !== 'FOLDED' ? pl.holeCards : [],
                      status: pl.status
                    }))
                  });
                  saveRoomSnapshot(current);
                  notifyWaitingForDeal(io, current);
                }
              } catch { /* player may have reconnected or hand ended */ }
            }, 15000); // 15s grace period before auto-fold
          }
          break;
        }
      }
    });
  });
};
