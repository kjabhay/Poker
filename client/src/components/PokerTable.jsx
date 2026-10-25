import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';
import ActionBar from './ActionBar';
import PlayingCard from './PlayingCard';

// ─── Seat positions (% relative to wrapper div) ───────────────────────────────
const SEAT_POSITIONS = [
  { bottom: '-16%', left: '50%',  transform: 'translateX(-50%)' }, // 0 you — bottom
  { bottom: '-4%',  left: '74%',  transform: 'none' },              // 1
  { top:    '18%',  left: '90%',  transform: 'none' },              // 2
  { top:    '-8%',  left: '74%',  transform: 'none' },              // 3
  { top:    '-16%', left: '50%',  transform: 'translateX(-50%)' }, // 4
  { top:    '-8%',  right: '74%', transform: 'none' },              // 5
  { top:    '18%',  right: '90%', transform: 'none' },              // 6
  { bottom: '-4%',  right: '74%', transform: 'none' },              // 7
  { bottom: '15%',  left: '50%',  transform: 'translateX(-50%)' }, // 8
];

// ─── PlayerSeat ───────────────────────────────────────────────────────────────
function PlayerSeat({ player, isDealer, isActive, isMe }) {
  const isFolded = player.status === 'FOLDED';
  const isAllIn  = player.status === 'ALL_IN';
  const isOut    = player.status === 'OUT';

  return (
    <div className={`flex flex-col items-center gap-1 transition-opacity duration-300
                     ${isFolded || isOut ? 'opacity-35' : 'opacity-100'}`}>

      {/* Hole cards — fanned */}
      <div className="flex items-end" style={{ gap: 0 }}>
        {player.holeCards?.length > 0
          ? player.holeCards.map((c, i) => (
              <div key={i} style={{
                transform: player.holeCards.length === 2
                  ? (i === 0 ? 'rotate(-6deg) translateY(2px)' : 'rotate(6deg) translateY(2px)')
                  : 'none',
                marginRight: i === 0 ? '-6px' : 0,
                zIndex: i,
              }}>
                <PlayingCard card={c} size="sm" />
              </div>
            ))
          : <div style={{ height: 62 }} />
        }
      </div>

      {/* Name plate */}
      <div className={`relative px-2.5 py-1.5 rounded-xl text-xs font-semibold
                       min-w-[76px] text-center transition-all duration-200
                       ${isActive
                         ? 'bg-yellow-400 text-gray-950 scale-105 shadow-lg shadow-yellow-500/40'
                         : isMe
                           ? 'bg-blue-950 border border-blue-500 text-white'
                           : 'bg-gray-900/95 border border-gray-700 text-white'}`}>
        {/* Dealer chip */}
        {isDealer && (
          <span className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-white
                           text-gray-900 text-[10px] font-black border-2 border-gray-300
                           flex items-center justify-center shadow-md z-10">D</span>
        )}
        {/* Online dot */}
        <span className={`absolute top-1.5 left-2 w-1.5 h-1.5 rounded-full
                          ${player.isConnected ? 'bg-green-400' : 'bg-gray-500'}`} />
        <div className="pl-2 truncate max-w-[90px] font-bold">{player.name}{isMe ? ' ★' : ''}</div>
        <div className={`text-[10px] font-mono ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
          {player.coins.toLocaleString()} 🪙
        </div>
        {isAllIn  && <div className="text-[9px] font-black text-yellow-500 tracking-wider mt-0.5">ALL-IN</div>}
        {isFolded && <div className="text-[9px] font-black text-red-400 tracking-wider mt-0.5">FOLDED</div>}
      </div>

      {/* Bet chip */}
      {player.currentBet > 0 && (
        <div className="px-2 py-0.5 rounded-full bg-black border border-gray-600
                        text-[10px] font-mono text-cyan-300 shadow">
          {player.currentBet.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ─── Showdown banner ──────────────────────────────────────────────────────────
function ShowdownBanner({ showdown }) {
  if (!showdown) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center
                    bg-black/70 rounded-[50%] pointer-events-none">
      <div className="text-center px-6 py-4 rounded-2xl bg-gray-950/95
                      border border-yellow-400/60 shadow-2xl">
        <div className="text-3xl mb-1">🏆</div>
        <p className="text-yellow-400 font-extrabold text-lg">
          {showdown.winners.map(w => w.name).join(' & ')}
        </p>
        <p className="text-gray-300 text-sm mt-1">{showdown.winningHandDescription}</p>
      </div>
    </div>
  );
}

// ─── Deal Next Hand ───────────────────────────────────────────────────────────
function DealNextButton({ roomCode, waitingForDeal }) {
  const isDealer = waitingForDeal?.dealerId === playerId;
  if (!isDealer) {
    return (
      <div className="flex items-center justify-center h-14 gap-2 text-gray-500 text-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        Waiting for <span className="text-gray-300 font-semibold ml-1">{waitingForDeal?.dealerName}</span> to deal…
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-14">
      <button
        onClick={() => socket.emit('game:dealNext', { roomCode, playerId })}
        className="px-8 py-2.5 rounded-xl bg-yellow-400 text-gray-950 font-extrabold text-sm
                   hover:brightness-110 active:scale-95 transition shadow-lg animate-pulse"
      >
        🃏 Deal Next Hand
      </button>
    </div>
  );
}

// ─── Game Over ────────────────────────────────────────────────────────────────
function GameOverScreen({ gameOver }) {
  return (
    <div className="h-dvh bg-gray-950 flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="text-5xl mb-3">🏆</div>
      <h2 className="text-2xl font-extrabold text-yellow-400 mb-1">Game Over</h2>
      <p className="text-gray-400 mb-6 text-sm">{gameOver.message}</p>
      <div className="w-full max-w-xs bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden mb-6">
        {[...gameOver.players].sort((a, b) => b.coins - a.coins).map((p, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 text-sm
                                   ${i < gameOver.players.length - 1 ? 'border-b border-gray-800' : ''}`}>
            <span className="text-gray-500 w-5 text-center font-mono">#{i + 1}</span>
            <span className="flex-1 text-white font-medium truncate">{p.name}</span>
            <span className="text-yellow-400 font-mono font-bold">{p.coins.toLocaleString()} 🪙</span>
          </div>
        ))}
      </div>
      <button onClick={() => window.location.reload()}
        className="px-6 py-2.5 rounded-xl bg-yellow-400 text-gray-950 font-bold
                   hover:brightness-110 active:scale-95 transition">
        Back to Lobby
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PokerTable({ roomState: initialState }) {
  const [roomState,      setRoomState]      = useState(initialState);
  const [showdown,       setShowdown]       = useState(null);
  const [waitingForDeal, setWaitingForDeal] = useState(null);
  const [gameOver,       setGameOver]       = useState(null);

  useEffect(() => {
    function onState(state) {
      setRoomState(state);
      if (state.status !== 'SHOWDOWN') setWaitingForDeal(null);
    }
    function onShowdown(data)      { setShowdown(data); }
    function onWaitForDeal(data)   { setWaitingForDeal(data); setShowdown(null); }
    function onGameOver(data)      { setGameOver(data); }
    function onHoleCards({ holeCards }) {
      setRoomState(prev => prev
        ? { ...prev, players: prev.players.map(p => p.playerId === playerId ? { ...p, holeCards } : p) }
        : prev);
    }

    socket.on('room:state',          onState);
    socket.on('game:showdown',       onShowdown);
    socket.on('game:waitingForDeal', onWaitForDeal);
    socket.on('game:over',           onGameOver);
    socket.on('player:holeCards',    onHoleCards);
    return () => {
      socket.off('room:state',          onState);
      socket.off('game:showdown',       onShowdown);
      socket.off('game:waitingForDeal', onWaitForDeal);
      socket.off('game:over',           onGameOver);
      socket.off('player:holeCards',    onHoleCards);
    };
  }, []);

  useEffect(() => { setRoomState(initialState); }, [initialState]);

  if (!roomState) return null;
  if (gameOver)   return <GameOverScreen gameOver={gameOver} />;

  // Rotate so local player is always bottom
  const myIndex          = roomState.players.findIndex(p => p.playerId === playerId);
  const n                = roomState.players.length;
  const rotated          = myIndex >= 0
    ? [...roomState.players.slice(myIndex), ...roomState.players.slice(0, myIndex)]
    : roomState.players;
  const rotatedDealerIdx = myIndex >= 0 ? (roomState.dealerIdx     - myIndex + n) % n : roomState.dealerIdx;
  const rotatedTurnIdx   = myIndex >= 0 ? (roomState.currentTurnIdx - myIndex + n) % n : roomState.currentTurnIdx;

  const streetBadge = {
    PREFLOP:  { label: 'Pre-Flop', cls: 'bg-blue-900/70 text-blue-300' },
    FLOP:     { label: 'Flop',     cls: 'bg-green-900/70 text-green-300' },
    TURN:     { label: 'Turn',     cls: 'bg-yellow-900/70 text-yellow-300' },
    RIVER:    { label: 'River',    cls: 'bg-orange-900/70 text-orange-300' },
    SHOWDOWN: { label: 'Showdown', cls: 'bg-purple-900/70 text-purple-300' },
  }[roomState.status] ?? { label: roomState.status, cls: 'bg-gray-800 text-gray-400' };

  const showActionBar = !waitingForDeal
    && roomState.status !== 'SHOWDOWN'
    && roomState.status !== 'LOBBY';

  return (
    <div className="h-dvh bg-gray-950 flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0
                      bg-gray-900/90 border-b border-gray-800">
        <span className="font-mono font-bold text-white text-sm tracking-widest">{roomState.roomCode}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${streetBadge.cls}`}>
          {streetBadge.label}
        </span>
        <span className="text-gray-500 text-xs">
          {roomState.players.filter(p => p.status !== 'OUT').length} players
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 py-2">
        <div className="relative w-full" style={{ maxHeight: '100%', aspectRatio: '2 / 1.2' }}>

          {/* Felt oval */}
          <div className="absolute inset-[11%] inset-x-[4%] rounded-[50%]"
               style={{
                 background: 'radial-gradient(ellipse at 50% 35%, #267022, #174414)',
                 boxShadow: '0 0 0 10px #3d2510, 0 0 0 14px #2a1a0a, 0 10px 50px rgba(0,0,0,0.85)',
               }}>

            <ShowdownBanner showdown={showdown} />

            {/* Community cards + pot */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <div className="flex gap-2 items-center">
                {Array.from({ length: 5 }, (_, i) =>
                  roomState.communityCards[i]
                    ? <PlayingCard key={i} card={roomState.communityCards[i]} size="md" />
                    : <div key={i} style={{ width: 58, height: 82, borderRadius: 6,
                                            border: '2px dashed rgba(255,255,255,0.12)',
                                            background: 'rgba(0,0,0,0.2)', flexShrink: 0 }} />
                )}
              </div>
              <div className="px-4 py-1 rounded-full bg-black/60 border border-white/10
                              text-sm font-bold text-yellow-400">
                Pot: {roomState.pot.toLocaleString()} 🪙
              </div>
            </div>
          </div>

          {/* Player seats */}
          {rotated.map((player, rotIdx) => {
            const pos = SEAT_POSITIONS[rotIdx];
            if (!pos) return null;
            return (
              <div key={player.playerId} className="absolute"
                   style={{ bottom: pos.bottom, top: pos.top, left: pos.left,
                            right: pos.right, transform: pos.transform }}>
                <PlayerSeat
                  player={player}
                  isDealer={rotIdx === rotatedDealerIdx}
                  isActive={rotIdx === rotatedTurnIdx && roomState.status !== 'SHOWDOWN'}
                  isMe={player.playerId === playerId}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 bg-gray-900/90 border-t border-gray-800">
        {waitingForDeal
          ? <DealNextButton roomCode={roomState.roomCode} waitingForDeal={waitingForDeal} />
          : showActionBar
            ? <ActionBar roomState={roomState} />
            : <div className="h-14" />}
      </div>
    </div>
  );
}
