import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';
import ActionBar from './ActionBar';
import PlayingCard from './PlayingCard';

const COMMUNITY_CARD_W = '8.25vw'; // was 11vw, now 25% smaller
const OPPONENT_CARD_W  = '5vw';
const MY_CARD_W        = '8vw';

// Seat positions — seat 0 (me) rendered separately outside the table
const SEAT_POSITIONS = [
  null,
  { bottom: '-5%',  left: '74%',  transform: 'none' },
  { top:    '15%',  left: '91%',  transform: 'none' },
  { top:    '-10%', left: '74%',  transform: 'none' },
  { top:    '-18%', left: '50%',  transform: 'translateX(-50%)' },
  { top:    '-10%', right: '74%', transform: 'none' },
  { top:    '15%',  right: '91%', transform: 'none' },
  { bottom: '-5%',  right: '74%', transform: 'none' },
  { bottom: '14%',  left: '50%',  transform: 'translateX(-50%)' },
];

function PlayerSeat({ player, isDealer, isActive }) {
  const isFolded = player.status === 'FOLDED';
  const isAllIn  = player.status === 'ALL_IN';
  const isOut    = player.status === 'OUT';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  opacity: isFolded || isOut ? 0.35 : 1, transition: 'opacity 0.3s' }}>
      {/* Hole cards */}
      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        {player.holeCards?.length > 0
          ? player.holeCards.map((c, i) => (
              <div key={i} style={{
                transform: `rotate(${i === 0 ? -6 : 6}deg) translateY(3px)`,
                marginRight: i === 0 ? `calc(${OPPONENT_CARD_W} * -0.25)` : 0,
                zIndex: i,
              }}>
                <PlayingCard card={c} width={OPPONENT_CARD_W} />
              </div>
            ))
          : <div style={{ height: `calc(${OPPONENT_CARD_W} * 1.4)` }} />
        }
      </div>

      {/* Name plate */}
      <div style={{
        position: 'relative', padding: '4px 8px', borderRadius: 10,
        minWidth: 68, textAlign: 'center', fontSize: 11, fontWeight: 600,
        transition: 'all 0.2s',
        background: isActive ? '#facc15' : 'rgba(15,15,25,0.95)',
        border:     isActive ? 'none'    : '1px solid #374151',
        color:      isActive ? '#111'    : '#fff',
        transform:  isActive ? 'scale(1.08)' : 'scale(1)',
        boxShadow:  isActive ? '0 0 16px rgba(250,204,21,0.5)' : 'none',
      }}>
        {isDealer && (
          <span style={{
            position: 'absolute', top: -9, right: -9,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff', color: '#111', fontSize: 9, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #d1d5db', zIndex: 10,
          }}>D</span>
        )}
        <span style={{
          position: 'absolute', top: 4, left: 6, width: 5, height: 5, borderRadius: '50%',
          background: player.isConnected ? '#4ade80' : '#6b7280',
        }} />
        <div style={{ paddingLeft: 7, maxWidth: 82, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
          {player.name}
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: isActive ? '#444' : '#9ca3af' }}>
          {player.coins.toLocaleString()} 🪙
        </div>
        {isAllIn  && <div style={{ fontSize: 8, fontWeight: 900, color: '#eab308', marginTop: 1 }}>ALL-IN</div>}
        {isFolded && <div style={{ fontSize: 8, fontWeight: 900, color: '#f87171', marginTop: 1 }}>FOLDED</div>}
        {player.currentBet > 0 && (
          <div style={{ fontSize: 8, color: '#67e8f9', fontFamily: 'monospace' }}>
            {player.currentBet.toLocaleString()} bet
          </div>
        )}
      </div>
    </div>
  );
}

function ShowdownBanner({ showdown }) {
  if (!showdown) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.72)', borderRadius: '50%', pointerEvents: 'none',
    }}>
      <div style={{
        textAlign: 'center', padding: '16px 24px', borderRadius: 16,
        background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(250,204,21,0.6)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
        <p style={{ color: '#facc15', fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
          {showdown.winners.map(w => w.name).join(' & ')}
        </p>
        <p style={{ color: '#d1d5db', fontSize: 12, marginTop: 4 }}>
          {showdown.winningHandDescription}
        </p>
      </div>
    </div>
  );
}

function DealNextButton({ roomCode, waitingForDeal }) {
  const isDealer = waitingForDeal?.dealerId === playerId;
  if (!isDealer) {
    return (
      <div className="flex items-center justify-center h-12 gap-2 text-gray-500 text-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        Waiting for <span className="text-gray-300 font-semibold ml-1">{waitingForDeal?.dealerName}</span> to deal…
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-12">
      <button
        onClick={() => socket.emit('game:dealNext', { roomCode, playerId })}
        className="px-8 py-2 rounded-xl bg-yellow-400 text-gray-950 font-extrabold text-sm
                   hover:brightness-110 active:scale-95 transition shadow-lg animate-pulse"
      >
        🃏 Deal Next Hand
      </button>
    </div>
  );
}

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

export default function PokerTable({ roomState: initialState }) {
  const [roomState,      setRoomState]      = useState(initialState);
  const [showdown,       setShowdown]       = useState(null);
  const [waitingForDeal, setWaitingForDeal] = useState(null);
  const [gameOver,       setGameOver]       = useState(null);

  useEffect(() => {
    function onState(state) {
      setRoomState(state);
      // Clear transient states when a new hand begins
      if (state.status === 'PREFLOP') {
        setShowdown(null);
        setWaitingForDeal(null);
      }
    }
    function onShowdown(data)    { setShowdown(data); }
    function onWaitForDeal(data) { setWaitingForDeal(data); setShowdown(null); }
    function onGameOver(data)    { setGameOver(data); }
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

  const myIndex          = roomState.players.findIndex(p => p.playerId === playerId);
  const n                = roomState.players.length;
  const rotated          = myIndex >= 0
    ? [...roomState.players.slice(myIndex), ...roomState.players.slice(0, myIndex)]
    : roomState.players;
  const rotatedDealerIdx = myIndex >= 0 ? (roomState.dealerIdx      - myIndex + n) % n : roomState.dealerIdx;
  const rotatedTurnIdx   = myIndex >= 0 ? (roomState.currentTurnIdx - myIndex + n) % n : roomState.currentTurnIdx;

  const me       = roomState.players.find(p => p.playerId === playerId);
  const isFolded = me?.status === 'FOLDED';
  const isAllIn  = me?.status === 'ALL_IN';
  const isActive = roomState.players[roomState.currentTurnIdx]?.playerId === playerId
                   && roomState.status !== 'SHOWDOWN';

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
      <div className="flex-1 flex items-center justify-center overflow-hidden"
           style={{ padding: '0.5vh 2vw' }}>
        <div style={{ position: 'relative', width: '100%', maxHeight: '100%', aspectRatio: '2 / 1.15' }}>

          {/* Felt oval */}
          <div style={{
            position: 'absolute', inset: '11% 4%', borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 38%, #2d8028, #174414)',
            boxShadow: '0 0 0 10px #4a2e10, 0 0 0 15px #2a1a08, 0 12px 60px rgba(0,0,0,0.9)',
          }}>
            <ShowdownBanner showdown={showdown} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '1vh',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', gap: '0.8vw', alignItems: 'center' }}>
                {Array.from({ length: 5 }, (_, i) =>
                  roomState.communityCards[i]
                    ? <PlayingCard key={i} card={roomState.communityCards[i]} width={COMMUNITY_CARD_W} />
                    : <div key={i} style={{
                        width: COMMUNITY_CARD_W, aspectRatio: '5/7',
                        borderRadius: `calc(${COMMUNITY_CARD_W} * 0.08)`,
                        border: '2px dashed rgba(255,255,255,0.13)',
                        background: 'rgba(0,0,0,0.18)', flexShrink: 0,
                      }} />
                )}
              </div>
              <div style={{
                padding: '3px 14px', borderRadius: 999,
                background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 13, fontWeight: 700, color: '#facc15',
              }}>
                Pot: {roomState.pot.toLocaleString()} 🪙
              </div>
            </div>
          </div>

          {/* Opponent seats only (seat 0 = me is below) */}
          {rotated.map((player, rotIdx) => {
            const pos = SEAT_POSITIONS[rotIdx];
            if (!pos) return null;
            return (
              <div key={player.playerId} style={{
                position: 'absolute',
                bottom: pos.bottom, top: pos.top,
                left: pos.left, right: pos.right,
                transform: pos.transform,
              }}>
                <PlayerSeat
                  player={player}
                  isDealer={rotIdx === rotatedDealerIdx}
                  isActive={rotIdx === rotatedTurnIdx && roomState.status !== 'SHOWDOWN'}
                  isMe={false}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom — my cards + controls */}
      <div className="shrink-0">

        {/* My cards + nameplate — no background, no border, floats naturally */}
        {me && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, paddingTop: 6, paddingBottom: 2,
            opacity: isFolded || me.status === 'OUT' ? 0.4 : 1,
          }}>
            {/* Hole cards */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {me.holeCards?.length > 0
                ? me.holeCards.map((c, i) => (
                    <div key={i} style={{
                      transform: `rotate(${i === 0 ? -5 : 5}deg)`,
                      marginRight: i === 0 ? `calc(${MY_CARD_W} * -0.22)` : 0,
                      zIndex: i,
                    }}>
                      <PlayingCard card={c} width={MY_CARD_W} />
                    </div>
                  ))
                : null
              }
            </div>

            {/* Name plate */}
            <div style={{
              position: 'relative', padding: '5px 10px', borderRadius: 12,
              minWidth: 80, textAlign: 'center', fontSize: 12, fontWeight: 600,
              background:  isActive ? '#facc15' : '#172554',
              border:      isActive ? 'none'    : '1px solid #3b82f6',
              color:       isActive ? '#111'    : '#fff',
              boxShadow:   isActive ? '0 0 14px rgba(250,204,21,0.45)' : 'none',
            }}>
              {rotatedDealerIdx === 0 && (
                <span style={{
                  position: 'absolute', top: -9, right: -9,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', color: '#111', fontSize: 9, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #d1d5db',
                }}>D</span>
              )}
              <span style={{
                position: 'absolute', top: 5, left: 7, width: 5, height: 5,
                borderRadius: '50%', background: me.isConnected ? '#4ade80' : '#6b7280',
              }} />
              <div style={{ paddingLeft: 7, maxWidth: 100, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                {me.name} ★
              </div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: isActive ? '#555' : '#9ca3af' }}>
                {me.coins.toLocaleString()} 🪙
              </div>
              {me.currentBet > 0 && (
                <div style={{ fontSize: 8, color: '#67e8f9', fontFamily: 'monospace' }}>
                  {me.currentBet.toLocaleString()} bet
                </div>
              )}
              {isAllIn  && <div style={{ fontSize: 8, fontWeight: 900, color: '#eab308', marginTop: 1 }}>ALL-IN</div>}
              {isFolded && <div style={{ fontSize: 8, fontWeight: 900, color: '#f87171', marginTop: 1 }}>FOLDED</div>}
            </div>
          </div>
        )}

        {/* Action controls */}
        {waitingForDeal
          ? <DealNextButton roomCode={roomState.roomCode} waitingForDeal={waitingForDeal} />
          : showActionBar
            ? <ActionBar roomState={roomState} />
            : <div className="h-8" />}
      </div>
    </div>
  );
}
