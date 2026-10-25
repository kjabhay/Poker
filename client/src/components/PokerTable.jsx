import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';
import ActionBar from './ActionBar';

// ─── Card rendering ───────────────────────────────────────────────────────────
const SUIT_SYMBOLS = { h: '♥', d: '♦', c: '♣', s: '♠' };
const RED_SUITS    = new Set(['h', 'd']);

function Card({ card, small = false }) {
  if (!card || card === 'BACK') {
    return (
      <div className={`${small ? 'w-7 h-10' : 'w-10 h-14'} rounded bg-blue-800 border border-blue-600
                       flex items-center justify-center text-blue-400 font-bold select-none`}>
        🂠
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const isRed = RED_SUITS.has(suit);

  return (
    <div className={`${small ? 'w-7 h-10 text-xs' : 'w-10 h-14 text-sm'} rounded bg-white border border-gray-300
                     flex flex-col items-center justify-center font-bold select-none
                     ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
      <span>{rank}</span>
      <span>{SUIT_SYMBOLS[suit]}</span>
    </div>
  );
}

// ─── Seat positions around oval table (percentage-based) ─────────────────────
// 9 positions: bottom-center = index 0 (local player), going clockwise
const SEAT_POSITIONS = [
  { bottom: '2%',  left: '50%',  transform: 'translateX(-50%)' },  // 0 — bottom center (you)
  { bottom: '10%', left: '80%',  transform: 'none' },               // 1 — bottom right
  { top: '30%',    left: '92%',  transform: 'none' },               // 2 — right
  { top: '5%',     left: '80%',  transform: 'none' },               // 3 — top right
  { top: '2%',     left: '50%',  transform: 'translateX(-50%)' },   // 4 — top center
  { top: '5%',     right: '80%', transform: 'none', left: undefined }, // 5 — top left
  { top: '30%',    right: '92%', transform: 'none', left: undefined }, // 6 — left
  { bottom: '10%', right: '80%', transform: 'none', left: undefined }, // 7 — bottom left
  { bottom: '20%', left: '50%',  transform: 'translateX(-50%)' },   // 8 — fallback (rarely used)
];

function PlayerSeat({ player, isDealer, isActive, isMe, seatPos }) {
  const statusColor = {
    ACTIVE:  '',
    FOLDED:  'opacity-40',
    ALL_IN:  'ring-2 ring-yellow-400',
    OUT:     'opacity-20',
  }[player.status] ?? '';

  return (
    <div
      className={`absolute flex flex-col items-center gap-1 ${statusColor}`}
      style={{
        bottom:    seatPos.bottom,
        top:       seatPos.top,
        left:      seatPos.left,
        right:     seatPos.right,
        transform: seatPos.transform,
      }}
    >
      {/* Cards */}
      <div className="flex gap-1">
        {player.holeCards && player.holeCards.length > 0
          ? player.holeCards.map((c, i) => <Card key={i} card={c} small />)
          : <div className="w-16 h-10" /> /* spacer */
        }
      </div>

      {/* Player chip */}
      <div className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold
                       bg-gray-800 border transition-all
                       ${isActive ? 'border-yellow-400 shadow-glow-yellow' : 'border-gray-600'}
                       ${isMe ? 'ring-1 ring-blue-400' : ''}`}>
        {/* Dealer button */}
        {isDealer && (
          <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gold text-gray-950
                           text-[10px] font-black flex items-center justify-center shadow">D</span>
        )}
        {/* Connection dot */}
        <span className={`absolute top-1 left-1 w-1.5 h-1.5 rounded-full
                          ${player.isConnected ? 'bg-green-400' : 'bg-gray-500'}`} />

        <div className="text-white pl-2 max-w-[80px] truncate">{player.name}{isMe ? ' ★' : ''}</div>
        <div className="text-gray-400 pl-2">{player.coins.toLocaleString()} 🪙</div>

        {/* Status badge */}
        {player.status === 'FOLDED' && (
          <div className="text-red-400 text-[10px] pl-2">FOLDED</div>
        )}
        {player.status === 'ALL_IN' && (
          <div className="text-yellow-400 text-[10px] pl-2">ALL-IN</div>
        )}

        {/* Current round bet */}
        {player.currentBet > 0 && (
          <div className="text-blue-300 text-[10px] pl-2">{player.currentBet.toLocaleString()} bet</div>
        )}
      </div>
    </div>
  );
}

// ─── Showdown banner ──────────────────────────────────────────────────────────
function ShowdownBanner({ showdown, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4800);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!showdown) return null;

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-[50%]">
      <div className="bg-gray-900 border border-gold rounded-2xl px-8 py-6 text-center max-w-xs shadow-2xl">
        <p className="text-gold text-lg font-extrabold mb-1">
          🏆 {showdown.winners.map(w => w.name).join(' & ')}
        </p>
        <p className="text-white text-sm">{showdown.winningHandDescription}</p>
        {showdown.winners.length === 1 && (
          <p className="text-gray-400 text-xs mt-2">wins the pot!</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PokerTable({ roomState: initialState }) {
  const [roomState, setRoomState] = useState(initialState);
  const [showdown, setShowdown]   = useState(null);
  const [gameOver, setGameOver]   = useState(null);

  useEffect(() => {
    function onState(state)       { setRoomState(state); }
    function onShowdown(data)     { setShowdown(data); }
    function onGameOver(data)     { setGameOver(data); }
    function onHoleCards({ holeCards }) {
      // Merge privately received hole cards into our player entry
      setRoomState(prev => {
        if (!prev) return prev;
        const players = prev.players.map(p =>
          p.playerId === playerId ? { ...p, holeCards } : p
        );
        return { ...prev, players };
      });
    }

    socket.on('room:state',      onState);
    socket.on('game:showdown',   onShowdown);
    socket.on('game:over',       onGameOver);
    socket.on('player:holeCards', onHoleCards);
    return () => {
      socket.off('room:state',      onState);
      socket.off('game:showdown',   onShowdown);
      socket.off('game:over',       onGameOver);
      socket.off('player:holeCards', onHoleCards);
    };
  }, []);

  // Re-sync when parent passes new state (e.g. first render)
  useEffect(() => { setRoomState(initialState); }, [initialState]);

  if (!roomState) return null;

  // Rotate players array so local player is always seat 0 (bottom)
  const myIndex = roomState.players.findIndex(p => p.playerId === playerId);
  const rotated = myIndex >= 0
    ? [...roomState.players.slice(myIndex), ...roomState.players.slice(0, myIndex)]
    : roomState.players;

  const dealerRotatedIdx = roomState.players.findIndex(
    (_, i) => i === roomState.dealerIdx
  );
  // Map original dealerIdx to rotated index
  const rotatedDealerIdx = myIndex >= 0
    ? (roomState.dealerIdx - myIndex + roomState.players.length) % roomState.players.length
    : roomState.dealerIdx;

  const rotatedTurnIdx = myIndex >= 0
    ? (roomState.currentTurnIdx - myIndex + roomState.players.length) % roomState.players.length
    : roomState.currentTurnIdx;

  const streetLabel = {
    PREFLOP:  'Pre-Flop',
    FLOP:     'Flop',
    TURN:     'Turn',
    RIVER:    'River',
    SHOWDOWN: 'Showdown',
  }[roomState.status] ?? roomState.status;

  // Game over screen
  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <h2 className="text-3xl font-extrabold text-gold mb-4">Game Over</h2>
        <p className="text-gray-400 mb-6">{gameOver.message}</p>
        <ul className="space-y-2 mb-8">
          {gameOver.players.sort((a, b) => b.coins - a.coins).map((p, i) => (
            <li key={i} className="flex gap-4 text-sm">
              <span className="text-gray-400">#{i + 1}</span>
              <span className="text-white font-medium w-32 truncate">{p.name}</span>
              <span className="text-gold font-mono">{p.coins.toLocaleString()} 🪙</span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-gold text-gray-950 font-bold hover:brightness-110"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
        <span className="font-mono font-bold text-white">{roomState.roomCode}</span>
        <span className="text-gold font-semibold">{streetLabel}</span>
        <span>{roomState.players.filter(p => p.status !== 'OUT').length} players</span>
      </div>

      {/* Table area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl" style={{ paddingBottom: '60%' }}>

          {/* Felt oval */}
          <div className="absolute inset-0 rounded-[50%] bg-felt border-4 border-felt-dark shadow-2xl overflow-hidden">

            {/* Showdown overlay */}
            <ShowdownBanner showdown={showdown} onDismiss={() => setShowdown(null)} />

            {/* Center info */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              {/* Community cards */}
              <div className="flex gap-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Card key={i} card={roomState.communityCards[i] ?? null} />
                ))}
              </div>

              {/* Pot */}
              <div className="mt-2 px-4 py-1.5 rounded-full bg-black/40 text-sm font-bold text-gold">
                Pot: {roomState.pot.toLocaleString()} 🪙
              </div>
            </div>
          </div>

          {/* Player seats (positioned outside / on edge of oval) */}
          {rotated.map((player, rotIdx) => {
            const pos = SEAT_POSITIONS[rotIdx] ?? SEAT_POSITIONS[0];
            return (
              <PlayerSeat
                key={player.playerId}
                player={player}
                isDealer={rotIdx === rotatedDealerIdx}
                isActive={rotIdx === rotatedTurnIdx}
                isMe={player.playerId === playerId}
                seatPos={pos}
              />
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      {roomState.status !== 'SHOWDOWN' && roomState.status !== 'LOBBY' && (
        <ActionBar roomState={roomState} />
      )}
    </div>
  );
}
