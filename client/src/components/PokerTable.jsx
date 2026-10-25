import { useState, useEffect, useCallback } from 'react';
import socket, { playerId } from '../socket';
import ActionBar from './ActionBar';

// ─── Card component ───────────────────────────────────────────────────────────
const SUIT_SYMBOLS = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS  = { h: 'text-red-500', d: 'text-red-500', c: 'text-gray-900', s: 'text-gray-900' };
const RANK_DISPLAY = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };

function Card({ card, size = 'md', faceDown = false }) {
  const sizeClasses = {
    sm:  'w-8 h-12 text-xs rounded-md',
    md:  'w-12 h-16 text-sm rounded-lg',
    lg:  'w-14 h-20 text-base rounded-xl',
  }[size];

  if (!card || card === 'BACK' || faceDown) {
    return (
      <div className={`${sizeClasses} relative bg-gradient-to-br from-blue-800 to-blue-950
                       border-2 border-blue-600 shadow-md flex items-center justify-center select-none`}>
        {/* Card back pattern */}
        <div className="w-[70%] h-[80%] border border-blue-500 rounded opacity-40" />
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const displayRank = RANK_DISPLAY[rank] ?? rank;
  const suitColor = SUIT_COLORS[suit];
  const suitSymbol = SUIT_SYMBOLS[suit];

  return (
    <div className={`${sizeClasses} relative bg-white border border-gray-200
                     shadow-md flex flex-col select-none overflow-hidden`}>
      {/* Top-left rank + suit */}
      <div className={`absolute top-0.5 left-1 leading-none ${suitColor}`}>
        <div className="font-black text-[0.65em] leading-tight">{displayRank}</div>
        <div className="text-[0.6em] leading-tight">{suitSymbol}</div>
      </div>
      {/* Center suit */}
      <div className={`flex-1 flex items-center justify-center font-bold ${suitColor}`}
           style={{ fontSize: size === 'lg' ? '1.4rem' : size === 'md' ? '1.1rem' : '0.85rem' }}>
        {suitSymbol}
      </div>
      {/* Bottom-right rank + suit (rotated) */}
      <div className={`absolute bottom-0.5 right-1 leading-none rotate-180 ${suitColor}`}>
        <div className="font-black text-[0.65em] leading-tight">{displayRank}</div>
        <div className="text-[0.6em] leading-tight">{suitSymbol}</div>
      </div>
    </div>
  );
}

// Empty card slot placeholder
function CardSlot({ size = 'md' }) {
  const sizeClasses = {
    sm: 'w-8 h-12 rounded-md',
    md: 'w-12 h-16 rounded-lg',
    lg: 'w-14 h-20 rounded-xl',
  }[size];
  return (
    <div className={`${sizeClasses} border-2 border-dashed border-white/10 bg-black/20`} />
  );
}

// ─── Seat positions ───────────────────────────────────────────────────────────
// Rotated so seat 0 = local player at bottom center, clockwise from there
const SEAT_POSITIONS = [
  { bottom: '-5%',  left: '50%',   transform: 'translateX(-50%)' }, // 0 you — bottom
  { bottom: '2%',   left: '76%',   transform: 'none' },              // 1 — bottom-right
  { top:    '22%',  left: '90%',   transform: 'none' },              // 2 — right
  { top:    '2%',   left: '75%',   transform: 'none' },              // 3 — top-right
  { top:    '-5%',  left: '50%',   transform: 'translateX(-50%)' }, // 4 — top
  { top:    '2%',   right: '75%',  transform: 'none' },              // 5 — top-left
  { top:    '22%',  right: '90%',  transform: 'none' },              // 6 — left
  { bottom: '2%',   right: '76%',  transform: 'none' },              // 7 — bottom-left
  { bottom: '18%',  left: '50%',   transform: 'translateX(-50%)' }, // 8 extra
];

function PlayerSeat({ player, isDealer, isActive, isMe }) {
  const isFolded  = player.status === 'FOLDED';
  const isAllIn   = player.status === 'ALL_IN';
  const isOut     = player.status === 'OUT';
  const showCards = player.holeCards?.length > 0;

  return (
    <div className={`flex flex-col items-center gap-1 transition-opacity duration-300
                     ${isFolded || isOut ? 'opacity-40' : 'opacity-100'}`}>

      {/* Hole cards */}
      <div className="flex gap-1">
        {showCards
          ? player.holeCards.map((c, i) => (
              <Card key={i} card={c} size="sm"
                    faceDown={c === 'BACK'} />
            ))
          : <div className="h-12" />
        }
      </div>

      {/* Name plate */}
      <div className={`relative px-2.5 py-1.5 rounded-xl text-xs font-semibold min-w-[72px]
                       text-center transition-all duration-200 shadow-lg
                       ${isActive
                          ? 'bg-yellow-400 text-gray-950 shadow-yellow-400/40 shadow-lg scale-105'
                          : isMe
                            ? 'bg-blue-900 border border-blue-500 text-white'
                            : 'bg-gray-800 border border-gray-600 text-white'
                       }`}>

        {/* Dealer button */}
        {isDealer && (
          <span className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full
                           bg-white text-gray-950 text-[9px] font-black
                           flex items-center justify-center shadow border border-gray-300 z-10">
            D
          </span>
        )}

        {/* Online dot */}
        <span className={`absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full
                          ${player.isConnected ? 'bg-green-400' : 'bg-gray-500'}`} />

        <div className="pl-2 truncate max-w-[80px]">
          {player.name}{isMe ? ' ★' : ''}
        </div>
        <div className={`text-[10px] ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>
          {player.coins.toLocaleString()} 🪙
        </div>

        {/* Status pills */}
        {isAllIn && (
          <div className="mt-0.5 text-[9px] font-black text-yellow-400 tracking-wide">ALL-IN</div>
        )}
        {isFolded && (
          <div className="mt-0.5 text-[9px] font-black text-red-400 tracking-wide">FOLDED</div>
        )}
      </div>

      {/* Bet chip */}
      {player.currentBet > 0 && (
        <div className="px-2 py-0.5 rounded-full bg-gray-950 border border-gray-600
                        text-[10px] font-mono text-blue-300 shadow">
          {player.currentBet.toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ─── Community cards area ─────────────────────────────────────────────────────
function CommunityCards({ cards, status }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) =>
          cards[i]
            ? <Card key={i} card={cards[i]} size="md" />
            : <CardSlot key={i} size="md" />
        )}
      </div>
    </div>
  );
}

// ─── Showdown banner ──────────────────────────────────────────────────────────
function ShowdownBanner({ showdown }) {
  if (!showdown) return null;
  return (
    <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-20 rounded-[50%]">
      <div className="text-center px-6 py-5 bg-gray-900/90 rounded-2xl border border-yellow-400/50
                      shadow-2xl max-w-[260px]">
        <div className="text-2xl mb-1">🏆</div>
        <p className="text-yellow-400 font-extrabold text-base leading-tight">
          {showdown.winners.map(w => w.name).join(' & ')}
        </p>
        <p className="text-white text-xs mt-1">{showdown.winningHandDescription}</p>
      </div>
    </div>
  );
}

// ─── Deal Next Hand button (host only, shown after showdown) ──────────────────
function DealNextButton({ roomCode, waitingForDeal }) {
  const isHost = waitingForDeal?.hostId === playerId;
  if (!waitingForDeal) return null;

  if (!isHost) {
    return (
      <div className="text-center text-gray-400 text-sm py-4 animate-pulse">
        Waiting for {waitingForDeal.hostName} to deal next hand…
      </div>
    );
  }

  return (
    <div className="flex justify-center py-3">
      <button
        onClick={() => socket.emit('game:dealNext', { roomCode, playerId })}
        className="px-8 py-3 rounded-xl bg-yellow-400 text-gray-950 font-extrabold text-sm
                   hover:brightness-110 active:scale-95 transition shadow-lg
                   shadow-yellow-400/30 animate-pulse"
      >
        🃏 Deal Next Hand
      </button>
    </div>
  );
}

// ─── Main PokerTable component ────────────────────────────────────────────────
export default function PokerTable({ roomState: initialState }) {
  const [roomState,      setRoomState]      = useState(initialState);
  const [showdown,       setShowdown]       = useState(null);
  const [waitingForDeal, setWaitingForDeal] = useState(null);
  const [gameOver,       setGameOver]       = useState(null);

  useEffect(() => {
    function onState(state) {
      setRoomState(state);
      // Clear waiting-for-deal once a new hand starts
      if (state.status !== 'SHOWDOWN') setWaitingForDeal(null);
    }
    function onShowdown(data)        { setShowdown(data); }
    function onWaitingForDeal(data)  { setWaitingForDeal(data); setShowdown(null); }
    function onGameOver(data)        { setGameOver(data); }
    function onHoleCards({ holeCards }) {
      setRoomState(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map(p =>
            p.playerId === playerId ? { ...p, holeCards } : p
          )
        };
      });
    }

    socket.on('room:state',         onState);
    socket.on('game:showdown',      onShowdown);
    socket.on('game:waitingForDeal', onWaitingForDeal);
    socket.on('game:over',          onGameOver);
    socket.on('player:holeCards',   onHoleCards);
    return () => {
      socket.off('room:state',         onState);
      socket.off('game:showdown',      onShowdown);
      socket.off('game:waitingForDeal', onWaitingForDeal);
      socket.off('game:over',          onGameOver);
      socket.off('player:holeCards',   onHoleCards);
    };
  }, []);

  useEffect(() => { setRoomState(initialState); }, [initialState]);

  if (!roomState) return null;

  // ── Game over ──
  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-3xl font-extrabold text-yellow-400 mb-2">Game Over</h2>
        <p className="text-gray-400 mb-8 text-sm">{gameOver.message}</p>
        <div className="w-full max-w-xs bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden mb-8">
          {gameOver.players
            .sort((a, b) => b.coins - a.coins)
            .map((p, i) => (
              <div key={i}
                   className={`flex items-center gap-3 px-4 py-3 text-sm
                               ${i < gameOver.players.length - 1 ? 'border-b border-gray-800' : ''}`}>
                <span className="text-gray-500 w-5 text-center">#{i + 1}</span>
                <span className="flex-1 text-white font-medium truncate">{p.name}</span>
                <span className="text-yellow-400 font-mono font-bold">{p.coins.toLocaleString()} 🪙</span>
              </div>
            ))}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-yellow-400 text-gray-950 font-bold
                     hover:brightness-110 active:scale-95 transition"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  // ── Rotate seats so local player is always at bottom ──
  const myIndex = roomState.players.findIndex(p => p.playerId === playerId);
  const rotated = myIndex >= 0
    ? [...roomState.players.slice(myIndex), ...roomState.players.slice(0, myIndex)]
    : roomState.players;

  const rotatedDealerIdx = myIndex >= 0
    ? (roomState.dealerIdx - myIndex + roomState.players.length) % roomState.players.length
    : roomState.dealerIdx;

  const rotatedTurnIdx = myIndex >= 0
    ? (roomState.currentTurnIdx - myIndex + roomState.players.length) % roomState.players.length
    : roomState.currentTurnIdx;

  const streetLabel = {
    PREFLOP: 'Pre-Flop', FLOP: 'Flop', TURN: 'Turn',
    RIVER: 'River', SHOWDOWN: 'Showdown',
  }[roomState.status] ?? roomState.status;

  const activePlayers = roomState.players.filter(p => p.status !== 'OUT').length;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2
                      bg-gray-900/80 border-b border-gray-800 backdrop-blur">
        <span className="font-mono font-bold text-white text-sm tracking-widest">
          {roomState.roomCode}
        </span>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
            ${{
              PREFLOP:  'bg-blue-900 text-blue-300',
              FLOP:     'bg-green-900 text-green-300',
              TURN:     'bg-yellow-900 text-yellow-300',
              RIVER:    'bg-orange-900 text-orange-300',
              SHOWDOWN: 'bg-purple-900 text-purple-300',
            }[roomState.status] ?? 'bg-gray-800 text-gray-400'}`}>
            {streetLabel}
          </span>
        </div>
        <span className="text-gray-500 text-xs">{activePlayers} players</span>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 flex items-center justify-center p-4 pt-2">
        <div className="relative w-full max-w-3xl" style={{ paddingBottom: '55%' }}>

          {/* Felt oval */}
          <div className="absolute inset-[8%] inset-x-[5%] rounded-[50%]
                          shadow-[0_0_60px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.4)]"
               style={{ background: 'radial-gradient(ellipse at 50% 40%, #2d7a27, #1a4a16)' }}>

            {/* Rail */}
            <div className="absolute inset-0 rounded-[50%] border-[10px] border-[#3d2510]
                            shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]" />

            {/* Showdown overlay */}
            <ShowdownBanner showdown={showdown} />

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <CommunityCards cards={roomState.communityCards} status={roomState.status} />
              {/* Pot */}
              <div className="px-4 py-1.5 rounded-full bg-black/50 border border-white/10
                              text-sm font-bold text-yellow-400 shadow">
                Pot: {roomState.pot.toLocaleString()} 🪙
              </div>
            </div>
          </div>

          {/* Player seats */}
          {rotated.map((player, rotIdx) => {
            const pos = SEAT_POSITIONS[rotIdx];
            if (!pos) return null;
            return (
              <div
                key={player.playerId}
                className="absolute"
                style={{
                  bottom:    pos.bottom,
                  top:       pos.top,
                  left:      pos.left,
                  right:     pos.right,
                  transform: pos.transform,
                }}
              >
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

      {/* ── Bottom controls ── */}
      <div className="bg-gray-900/80 border-t border-gray-800 backdrop-blur">
        {waitingForDeal ? (
          <DealNextButton roomCode={roomState.roomCode} waitingForDeal={waitingForDeal} />
        ) : roomState.status !== 'SHOWDOWN' && roomState.status !== 'LOBBY' ? (
          <ActionBar roomState={roomState} />
        ) : null}
      </div>
    </div>
  );
}
