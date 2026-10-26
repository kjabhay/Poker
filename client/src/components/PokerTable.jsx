import { useState, useEffect, useRef } from 'react';
import socket, { playerId } from '../socket';
import ActionBar from './ActionBar';
import PlayingCard from './PlayingCard';

const COMMUNITY_CARD_W = 'clamp(30px, 8.25vw, 92px)';
const OPPONENT_CARD_W  = 'clamp(20px, 6vw, 56px)';
const MY_CARD_W        = 'clamp(38px, 8vw, 88px)';

// Seat positions — seat 0 (me) rendered separately outside the table
const SEAT_POSITIONS = [
  null,
  { bottom: '4%',   left: '74%',  transform: 'none' },
  { top:    '15%',  left: '91%',  transform: 'none' },
  { top:    '-10%', left: '74%',  transform: 'none' },
  { top:    '-18%', left: '50%',  transform: 'translateX(-50%)' },
  { top:    '-10%', right: '74%', transform: 'none' },
  { top:    '15%',  right: '91%', transform: 'none' },
  { bottom: '4%',   right: '74%', transform: 'none' },
  { bottom: '14%',  left: '50%',  transform: 'translateX(-50%)' },
];

function PlayerSeat({ player, isDealer, isActive }) {
  const isFolded = player.status === 'FOLDED';
  const isAllIn  = player.status === 'ALL_IN';
  const isOut    = player.status === 'OUT';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(1px, 0.25vw, 4px)',
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
        position: 'relative', padding: 'clamp(3px, 0.55vw, 7px) clamp(6px, 0.85vw, 12px)', borderRadius: 'clamp(10px, 1vw, 16px)',
        minWidth: 'clamp(56px, 13vw, 102px)', textAlign: 'center',
        fontSize: 'clamp(9px, 2vw, 15px)', fontWeight: 600,
        transition: 'all 0.2s',
        background: isActive ? '#facc15' : 'rgba(15,23,42,0.96)',
        border:     isActive ? 'none'    : '1px solid rgba(255,255,255,0.12)',
        color:      isActive ? '#111'    : '#fff',
        transform:  isActive ? 'scale(1.08)' : 'scale(1)',
        boxShadow:  isActive ? '0 0 16px rgba(250,204,21,0.5)' : 'none',
      }}>
        {isDealer && (
          <span style={{
            position: 'absolute', top: '-0.55em', right: '-0.55em',
            width: '1.65em', height: '1.65em', borderRadius: '50%',
            background: '#fff', color: '#111', fontSize: '0.8em', fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #d1d5db', zIndex: 10,
          }}>D</span>
        )}
        <span style={{
          position: 'absolute', top: '0.65em', left: '0.7em', width: '0.45em', height: '0.45em', borderRadius: '50%',
          background: player.isConnected ? '#4ade80' : '#6b7280',
        }} />
        <div style={{ paddingLeft: '0.7em', maxWidth: 'clamp(52px, 9vw, 135px)', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
          {player.name}
        </div>
        <div style={{ fontSize: '0.82em', fontFamily: 'monospace', color: isActive ? '#444' : '#9ca3af' }}>
          {player.coins.toLocaleString()} 🪙
        </div>
        {isAllIn  && <div style={{ fontSize: '0.75em', fontWeight: 900, color: '#eab308', marginTop: 1 }}>ALL-IN</div>}
        {isFolded && <div style={{ fontSize: '0.75em', fontWeight: 900, color: '#f87171', marginTop: 1 }}>FOLDED</div>}
        {player.currentBet > 0 && (
          <div style={{ fontSize: '0.75em', color: '#67e8f9', fontFamily: 'monospace' }}>
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
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      maxWidth: '90%', textAlign: 'center', lineHeight: 1.15,
      pointerEvents: 'none',
    }}>
      <div style={{ color: '#fde68a', fontWeight: 800, fontSize: 'clamp(10px, 1.15vw, 16px)' }}>
        {showdown.winners.map(w => w.name).join(' & ')} {showdown.winners.length === 1 ? 'wins' : 'win'}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: 'clamp(8px, 0.9vw, 12px)', marginTop: 2 }}>
        {showdown.winningHandDescription}
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

function getWaitingForDeal(state) {
  if (state?.status !== 'SHOWDOWN' || !Array.isArray(state.players) || !state.players.length) return null;
  const nextDealer = state.players.find((player, index) => {
    const distance = (index - state.dealerIdx + state.players.length) % state.players.length;
    return distance > 0 && player.status !== 'OUT' && !player.leaveAfterHand && player.coins > 0;
  });
  return nextDealer
    ? { dealerId: nextDealer.playerId, dealerName: nextDealer.name }
    : null;
}

function GameOverScreen({ gameOver, onBackToLobby }) {
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
      <button onClick={onBackToLobby}
        className="px-6 py-2.5 rounded-xl bg-yellow-400 text-gray-950 font-bold
                   hover:brightness-110 active:scale-95 transition">
        Back to Lobby
      </button>
    </div>
  );
}

export default function PokerTable({ roomState: initialState, onBackToLobby }) {
  const [roomState,      setRoomState]      = useState(initialState);
  const [showdown,       setShowdown]       = useState(null);
  const [waitingForDeal, setWaitingForDeal] = useState(null);
  const [gameOver,       setGameOver]       = useState(null);
  const gameOverTimer = useRef(null);

  useEffect(() => {
    function onState(state) {
      setRoomState(state);
      setWaitingForDeal(getWaitingForDeal(state));
      // Clear transient states when a new hand begins
      if (state.status === 'PREFLOP') {
        setShowdown(null);
        setGameOver(null);
        clearTimeout(gameOverTimer.current);
      }
    }
    function onShowdown(data) {
      setShowdown(data);
      if (data.gameOver) {
        clearTimeout(gameOverTimer.current);
        gameOverTimer.current = setTimeout(() => {
          setGameOver({
            message: 'Not enough players with chips to continue.',
            players: data.players.map(({ name, coins }) => ({ name, coins })),
          });
        }, 10000);
      }
    }
    function onWaitForDeal(data) { setWaitingForDeal(data); } // keep showdown visible until new hand
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
      clearTimeout(gameOverTimer.current);
    };
  }, []);

  useEffect(() => {
    setRoomState(initialState);
    setWaitingForDeal(getWaitingForDeal(initialState));
  }, [initialState]);

  if (!roomState) return null;
  if (gameOver) {
    return (
      <GameOverScreen
        gameOver={gameOver}
        onBackToLobby={onBackToLobby}
      />
    );
  }

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
    <div className="h-dvh bg-[radial-gradient(ellipse_at_top,_#172033,_#090d18_65%)] flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3 md:px-8 shrink-0
                      bg-slate-950/55 border-b border-white/[0.07] backdrop-blur-xl shadow-lg shadow-black/10">
        <span className="font-mono font-bold text-white text-xs sm:text-sm tracking-widest">{roomState.roomCode}</span>
        <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold ${streetBadge.cls}`}>
          {streetBadge.label}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-[10px] sm:text-xs">
            {roomState.players.filter(p => p.status !== 'OUT').length} players
          </span>
          <button
            onClick={() => {
              if (window.confirm('Quit this game? You will fold this hand if possible and sit out future hands.')) {
                socket.emit('room:leave', { roomCode: roomState.roomCode, playerId });
              }
            }}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-gray-300 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-200 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            Quit
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="poker-table-scroll flex-1 min-h-0 overflow-x-hidden overflow-y-auto"
           style={{ padding: 'max(7vh, 42px) 2vw 5vh' }}>
        <div className="poker-table-stage mx-auto" style={{ position: 'relative', width: '100%', maxWidth: 1400, aspectRatio: '2 / 1.15', marginTop: 'clamp(125px, 20vw, 300px)' }}>

          {/* Felt oval */}
          <div style={{
            position: 'absolute', inset: '11% 4%', borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 35%, #328349, #165333 72%, #10432b)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 0 0 8px #4a2e10, 0 0 0 13px #2a1a08, 0 18px 70px rgba(0,0,0,0.65)',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: showdown ? '0.45vh' : '1vh',
              pointerEvents: 'none',
            }}>
              <div style={{ display: 'flex', gap: '0.8vw', alignItems: 'center' }}>
                {Array.from({ length: 5 }, (_, i) =>
                  roomState.communityCards[i]
                    ? <PlayingCard key={i} card={roomState.communityCards[i]} width={COMMUNITY_CARD_W} />
                    : <div key={i} style={{
                        width: COMMUNITY_CARD_W, aspectRatio: '5/7',
                        borderRadius: '8%',
                        border: '2px dashed rgba(255,255,255,0.13)',
                        background: 'rgba(0,0,0,0.18)', flexShrink: 0,
                      }} />
                )}
              </div>
              <div style={{
                padding: 'clamp(2px, 0.35vw, 5px) clamp(9px, 1.3vw, 18px)', borderRadius: 999,
                background: 'rgba(4,20,14,0.62)', border: '1px solid rgba(255,255,255,0.14)',
                fontSize: 'clamp(9px, 0.95vw, 13px)', fontWeight: 700, color: '#facc15',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}>
                Pot: {roomState.pot.toLocaleString()} 🪙
              </div>
              <ShowdownBanner showdown={showdown} />
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
      <div className="shrink-0 pb-[max(0.35rem,env(safe-area-inset-bottom))]">

        {/* My cards + nameplate — no background, no border, floats naturally */}
        {me && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(6px, 1vw, 12px)', paddingTop: 4, paddingBottom: 2,
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
              position: 'relative', padding: 'clamp(4px, 0.75vw, 10px) clamp(9px, 1.5vw, 20px)', borderRadius: 'clamp(12px, 1.5vw, 20px)',
              minWidth: 'clamp(92px, 20vw, 160px)', textAlign: 'center',
              fontSize: 'clamp(11px, 2.8vw, 20px)', fontWeight: 600,
              background:  isActive ? '#facc15' : 'rgba(15,23,42,0.96)',
              border:      isActive ? '1px solid rgba(255,255,255,0.7)' : '1px solid rgba(255,255,255,0.14)',
              color:       isActive ? '#111'    : '#fff',
              boxShadow:   isActive ? '0 0 24px rgba(250,204,21,0.4), 0 8px 24px rgba(0,0,0,0.22)' : '0 8px 24px rgba(0,0,0,0.22)',
            }}>
              {rotatedDealerIdx === 0 && (
                <span style={{
                  position: 'absolute', top: '-0.55em', right: '-0.55em',
                  width: '1.6em', height: '1.6em', borderRadius: '50%',
                  background: '#fff', color: '#111', fontSize: '0.75em', fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #d1d5db',
                }}>D</span>
              )}
              <span style={{
                position: 'absolute', top: '0.65em', left: '0.7em', width: '0.42em', height: '0.42em',
                borderRadius: '50%', background: me.isConnected ? '#4ade80' : '#6b7280',
              }} />
              <div style={{ paddingLeft: '0.7em', maxWidth: 'clamp(76px, 12vw, 160px)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                {me.name} ★
              </div>
              <div style={{ fontSize: '0.75em', fontFamily: 'monospace', color: isActive ? '#555' : '#9ca3af' }}>
                {me.coins.toLocaleString()} 🪙
              </div>
              {me.currentBet > 0 && (
                <div style={{ fontSize: '0.72em', color: '#67e8f9', fontFamily: 'monospace' }}>
                  {me.currentBet.toLocaleString()} bet
                </div>
              )}
              {isAllIn  && <div style={{ fontSize: '0.72em', fontWeight: 900, color: '#eab308', marginTop: 2 }}>ALL-IN</div>}
              {isFolded && <div style={{ fontSize: '0.72em', fontWeight: 900, color: '#f87171', marginTop: 2 }}>FOLDED</div>}
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
