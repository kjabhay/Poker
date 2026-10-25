import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';

export default function ActionBar({ roomState }) {
  const me           = roomState.players.find(p => p.playerId === playerId);
  const activePlayer = roomState.players[roomState.currentTurnIdx];
  const isMyTurn     = activePlayer?.playerId === playerId;

  const callAmount = Math.max(0, roomState.currentHighestBet - (me?.currentBet ?? 0));
  const minRaiseTo = roomState.currentHighestBet + roomState.minRaise;
  const maxRaiseTo = (me?.currentBet ?? 0) + (me?.coins ?? 0);

  const [raiseAmount, setRaiseAmount] = useState(minRaiseTo);

  useEffect(() => {
    if (isMyTurn) setRaiseAmount(Math.min(minRaiseTo, maxRaiseTo));
  }, [isMyTurn, minRaiseTo, maxRaiseTo]);

  function emit(action, amount = 0) {
    socket.emit('game:action', { roomCode: roomState.roomCode, playerId, action, amount });
  }

  const canCheck = callAmount === 0;
  const canRaise = maxRaiseTo > roomState.currentHighestBet;
  const isAllIn  = raiseAmount >= maxRaiseTo;
  const bb       = roomState.config?.bigBlind ?? 20;

  // ── Passive states (fixed height so layout doesn't jump) ──────────────────
  if (!me || me.status === 'OUT') {
    return <div className="h-14 flex items-center justify-center text-gray-600 text-xs">Spectating</div>;
  }
  if (me.status === 'FOLDED') {
    return <div className="h-14 flex items-center justify-center text-gray-500 text-xs">You folded this hand</div>;
  }
  if (me.status === 'ALL_IN') {
    return (
      <div className="h-14 flex items-center justify-center">
        <span className="px-3 py-1.5 rounded-full bg-yellow-900/40 border border-yellow-600
                         text-yellow-400 text-xs font-bold">
          🚀 All-In · {me.totalHandBet?.toLocaleString()} 🪙
        </span>
      </div>
    );
  }
  if (!isMyTurn) {
    return (
      <div className="h-14 flex items-center justify-center gap-2 text-gray-500 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Waiting for <span className="text-gray-300 font-semibold ml-1">{activePlayer?.name ?? '…'}</span>
      </div>
    );
  }

  // ── My turn: compact desktop controls and a touch-friendly mobile layout ──
  return (
    <div className="mx-2 mb-1 rounded-2xl border border-white/[0.08] bg-slate-950/55 px-2.5 py-2.5 shadow-lg shadow-black/20 backdrop-blur sm:mx-auto sm:mb-2 sm:w-full sm:max-w-5xl sm:rounded-3xl sm:border-white/10 sm:bg-slate-950/45 sm:px-5 sm:py-4 sm:shadow-2xl sm:shadow-black/25">
      <div className="mb-2 flex items-center justify-between sm:hidden" role="status">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          Your turn
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-400">
          <span>Pot <span className="text-yellow-300">{roomState.pot.toLocaleString()} 🪙</span></span>
          {!canCheck && <span>To call <span className="text-sky-300">{callAmount.toLocaleString()} 🪙</span></span>}
        </div>
      </div>
      <div className="mb-3 hidden items-center justify-between border-b border-white/[0.08] pb-3 sm:flex">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          Your turn
        </div>
        <div className="flex items-center gap-5 text-xs font-semibold text-gray-400">
          <span>Pot <span className="ml-1 text-yellow-300">{roomState.pot.toLocaleString()} 🪙</span></span>
          {!canCheck && <span>To call <span className="ml-1 text-sky-300">{callAmount.toLocaleString()} 🪙</span></span>}
        </div>
      </div>

      {/* Raise controls row — only shown when raise is possible */}
      {canRaise && (
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-nowrap sm:items-center">
          {/* Quick presets */}
          <div className="grid grid-cols-4 gap-1 sm:flex sm:w-auto sm:shrink-0">
            {[
              { label: 'Min',  value: minRaiseTo },
              { label: '½P',   value: Math.min(maxRaiseTo, Math.max(minRaiseTo, Math.round(roomState.pot / 2))) },
              { label: 'Pot',  value: Math.min(maxRaiseTo, Math.max(minRaiseTo, roomState.pot)) },
              { label: 'All↑', value: maxRaiseTo },
            ]
              .filter((p, i, arr) => arr.findIndex(x => x.value === p.value) === i)
              .map(p => (
                <button key={p.label}
                  onClick={() => setRaiseAmount(p.value)}
                  className={`min-h-9 rounded-xl px-2 text-xs font-semibold transition sm:min-h-0 sm:flex-none sm:py-1 sm:text-[11px]
                    ${raiseAmount === p.value
                      ? 'bg-yellow-400 text-gray-950 shadow-sm shadow-yellow-500/20'
                      : 'border border-white/[0.08] bg-white/[0.06] text-gray-300 hover:bg-white/10'}`}>
                  {p.label}
                </button>
              ))}
          </div>

          {/* Slider */}
          <div className="flex min-w-0 items-center gap-3">
            <input type="range"
              min={minRaiseTo} max={maxRaiseTo} step={bb}
              value={raiseAmount}
              aria-label="Raise amount"
              onChange={e => setRaiseAmount(Number(e.target.value))}
              className="h-2 min-w-0 flex-1 accent-yellow-400 cursor-pointer sm:h-1.5" />

            {/* Amount label */}
            <span className={`w-auto shrink-0 text-right font-mono text-[11px] font-bold sm:w-20 sm:text-xs
                              ${isAllIn ? 'text-yellow-400' : 'text-white'}`}>
              {isAllIn ? 'ALL-IN' : raiseAmount.toLocaleString() + ' 🪙'}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons row */}
      <div className={`mt-2 grid ${canRaise ? 'grid-cols-3' : 'grid-cols-2'} gap-2 sm:mt-1.5 sm:flex sm:gap-2`}>
        <button onClick={() => emit('FOLD')}
          className="min-h-12 min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-1 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/10 active:scale-[0.98] sm:min-h-0 sm:flex-1 sm:px-2 sm:py-3 sm:text-sm">
          Fold
        </button>

        <button onClick={() => emit(canCheck ? 'CHECK' : 'CALL')}
          className="min-h-12 min-w-0 rounded-2xl bg-sky-500 px-1 py-1.5 text-xs font-bold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 active:scale-[0.98] sm:min-h-0 sm:flex-1 sm:px-2 sm:py-3 sm:text-sm">
          <span className="block">{canCheck ? 'Check' : 'Call'}</span>
          {!canCheck && <span className="block text-[10px] font-semibold text-sky-100 sm:hidden">{callAmount.toLocaleString()} 🪙</span>}
          {!canCheck && <span className="hidden sm:inline"> {callAmount.toLocaleString()} 🪙</span>}
        </button>

        {canRaise && (
          <button onClick={() => emit('RAISE', raiseAmount)}
            className={`min-h-12 min-w-0 rounded-2xl px-1 py-1.5 text-xs font-bold transition active:scale-[0.98] sm:min-h-0 sm:flex-1 sm:px-2 sm:py-3 sm:text-sm
              ${isAllIn
                ? 'bg-yellow-400 hover:brightness-110 text-gray-950'
                : 'bg-green-700 hover:bg-green-600 text-white'}`}>
            {isAllIn
              ? '🚀 All-In'
              : <><span className="block">Raise</span><span className="block text-[10px] font-semibold opacity-80 sm:hidden">{raiseAmount.toLocaleString()} 🪙</span><span className="hidden sm:inline"> {raiseAmount.toLocaleString()}</span></>}
          </button>
        )}
      </div>
    </div>
  );
}
