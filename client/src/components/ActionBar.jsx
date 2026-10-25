import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';

export default function ActionBar({ roomState }) {
  const me          = roomState.players.find(p => p.playerId === playerId);
  const activePlayer = roomState.players[roomState.currentTurnIdx];
  const isMyTurn    = activePlayer?.playerId === playerId;

  const callAmount  = Math.max(0, roomState.currentHighestBet - (me?.currentBet ?? 0));
  const minRaiseTo  = roomState.currentHighestBet + roomState.minRaise;
  const maxRaiseTo  = (me?.currentBet ?? 0) + (me?.coins ?? 0);

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

  // Spectating states
  if (!me || me.status === 'OUT') {
    return (
      <div className="h-20 flex items-center justify-center text-gray-600 text-sm">
        Spectating
      </div>
    );
  }

  if (me.status === 'FOLDED') {
    return (
      <div className="h-20 flex items-center justify-center text-gray-500 text-sm">
        You folded this hand
      </div>
    );
  }

  if (me.status === 'ALL_IN') {
    return (
      <div className="h-20 flex items-center justify-center">
        <span className="px-4 py-2 rounded-full bg-yellow-900/50 border border-yellow-600
                         text-yellow-400 text-sm font-bold">
          🚀 All-In — {me.totalHandBet?.toLocaleString()} 🪙
        </span>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="h-20 flex items-center justify-center gap-2 text-gray-500 text-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
        Waiting for <span className="text-gray-300 font-medium">{activePlayer?.name ?? '…'}</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {/* Raise slider */}
      {canRaise && (
        <div className="flex items-center gap-3 px-1">
          <button
            onClick={() => setRaiseAmount(Math.max(minRaiseTo, raiseAmount - roomState.config.bigBlind))}
            className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-white
                       font-bold text-sm flex items-center justify-center shrink-0"
          >−</button>

          <div className="flex-1 relative">
            <input
              type="range"
              min={minRaiseTo}
              max={maxRaiseTo}
              step={roomState.config?.bigBlind ?? 20}
              value={raiseAmount}
              onChange={e => setRaiseAmount(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none accent-yellow-400 cursor-pointer"
            />
          </div>

          <button
            onClick={() => setRaiseAmount(Math.min(maxRaiseTo, raiseAmount + roomState.config.bigBlind))}
            className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 text-white
                       font-bold text-sm flex items-center justify-center shrink-0"
          >+</button>

          <span className={`text-sm font-mono font-bold w-24 text-right shrink-0
                            ${isAllIn ? 'text-yellow-400' : 'text-white'}`}>
            {isAllIn ? 'ALL-IN' : raiseAmount.toLocaleString() + ' 🪙'}
          </span>
        </div>
      )}

      {/* Quick raise presets */}
      {canRaise && (
        <div className="flex gap-1.5 px-1">
          {[
            { label: 'Min', value: minRaiseTo },
            { label: '½ Pot', value: Math.min(maxRaiseTo, Math.round(roomState.pot / 2)) },
            { label: 'Pot',   value: Math.min(maxRaiseTo, roomState.pot) },
            { label: 'All-In', value: maxRaiseTo },
          ].filter((p, i, arr) =>
            // deduplicate values
            arr.findIndex(x => x.value === p.value) === i && p.value >= minRaiseTo
          ).map(preset => (
            <button
              key={preset.label}
              onClick={() => setRaiseAmount(preset.value)}
              className={`flex-1 py-1 rounded-lg text-xs font-semibold transition
                ${raiseAmount === preset.value
                  ? 'bg-yellow-400 text-gray-950'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => emit('FOLD')}
          className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600
                     text-red-400 font-bold text-sm active:scale-95 transition border border-gray-600"
        >
          Fold
        </button>

        <button
          onClick={() => emit(canCheck ? 'CHECK' : 'CALL')}
          className="flex-1 py-3 rounded-xl font-bold text-sm active:scale-95 transition
                     bg-blue-700 hover:bg-blue-600 text-white"
        >
          {canCheck ? 'Check' : (
            <span>Call <span className="font-mono">{callAmount.toLocaleString()}</span> 🪙</span>
          )}
        </button>

        {canRaise && (
          <button
            onClick={() => emit('RAISE', raiseAmount)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-95 transition
              ${isAllIn
                ? 'bg-yellow-400 hover:brightness-110 text-gray-950'
                : 'bg-green-700 hover:bg-green-600 text-white'}`}
          >
            {isAllIn ? '🚀 All-In' : 'Raise'}
          </button>
        )}
      </div>
    </div>
  );
}
