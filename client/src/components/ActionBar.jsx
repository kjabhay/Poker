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

  // ── My turn: two compact rows ─────────────────────────────────────────────
  return (
    <div className="px-3 py-2 space-y-1.5">

      {/* Raise controls row — only shown when raise is possible */}
      {canRaise && (
        <div className="flex items-center gap-2">
          {/* Quick presets */}
          <div className="flex gap-1 shrink-0">
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
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition
                    ${raiseAmount === p.value
                      ? 'bg-yellow-400 text-gray-950'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                  {p.label}
                </button>
              ))}
          </div>

          {/* Slider */}
          <input type="range"
            min={minRaiseTo} max={maxRaiseTo} step={bb}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            className="flex-1 h-1.5 accent-yellow-400 cursor-pointer" />

          {/* Amount label */}
          <span className={`text-xs font-mono font-bold w-20 text-right shrink-0
                            ${isAllIn ? 'text-yellow-400' : 'text-white'}`}>
            {isAllIn ? 'ALL-IN' : raiseAmount.toLocaleString() + ' 🪙'}
          </span>
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex gap-2">
        <button onClick={() => emit('FOLD')}
          className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700
                     text-red-400 font-bold text-sm active:scale-95 transition border border-gray-700">
          Fold
        </button>

        <button onClick={() => emit(canCheck ? 'CHECK' : 'CALL')}
          className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600
                     text-white font-bold text-sm active:scale-95 transition">
          {canCheck ? 'Check' : `Call ${callAmount.toLocaleString()} 🪙`}
        </button>

        {canRaise && (
          <button onClick={() => emit('RAISE', raiseAmount)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition
              ${isAllIn
                ? 'bg-yellow-400 hover:brightness-110 text-gray-950'
                : 'bg-green-700 hover:bg-green-600 text-white'}`}>
            {isAllIn ? '🚀 All-In' : `Raise ${raiseAmount.toLocaleString()}`}
          </button>
        )}
      </div>
    </div>
  );
}
