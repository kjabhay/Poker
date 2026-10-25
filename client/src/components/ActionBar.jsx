import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';

export default function ActionBar({ roomState }) {
  const me = roomState.players.find(p => p.playerId === playerId);
  const activePlayer = roomState.players[roomState.currentTurnIdx];
  const isMyTurn = activePlayer?.playerId === playerId;

  const callAmount = Math.max(0, roomState.currentHighestBet - (me?.currentBet ?? 0));
  const minRaiseTo = roomState.currentHighestBet + roomState.minRaise;
  const maxRaiseTo = (me?.currentBet ?? 0) + (me?.coins ?? 0); // all-in

  const [raiseAmount, setRaiseAmount] = useState(minRaiseTo);

  // Reset slider when it's our turn
  useEffect(() => {
    if (isMyTurn) setRaiseAmount(Math.min(minRaiseTo, maxRaiseTo));
  }, [isMyTurn, minRaiseTo, maxRaiseTo]);

  function emit(action, amount = 0) {
    socket.emit('game:action', {
      roomCode: roomState.roomCode,
      playerId,
      action,
      amount,
    });
  }

  const canCheck = callAmount === 0;
  const canRaise = maxRaiseTo > roomState.currentHighestBet;

  if (!me || me.status === 'FOLDED' || me.status === 'ALL_IN' || me.status === 'OUT') {
    return (
      <div className="h-24 flex items-center justify-center">
        <span className="text-gray-500 text-sm">
          {me?.status === 'FOLDED' ? 'You folded this hand' :
           me?.status === 'ALL_IN' ? 'You are all-in' : ''}
        </span>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="h-24 flex items-center justify-center">
        <span className="text-gray-500 text-sm">
          Waiting for {activePlayer?.name ?? '…'} to act
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border-t border-gray-700 px-4 py-3 space-y-3">
      {/* Raise slider */}
      {canRaise && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-16 shrink-0">Raise to</span>
          <input
            type="range"
            min={minRaiseTo}
            max={maxRaiseTo}
            step={roomState.config?.bigBlind ?? 20}
            value={raiseAmount}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            className="flex-1 accent-yellow-400"
          />
          <span className="text-sm font-mono font-bold text-gold w-20 text-right shrink-0">
            {raiseAmount.toLocaleString()} 🪙
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Fold */}
        <button
          onClick={() => emit('FOLD')}
          className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white
                     font-bold text-sm active:scale-95 transition"
        >
          Fold
        </button>

        {/* Check / Call */}
        <button
          onClick={() => emit(canCheck ? 'CHECK' : 'CALL')}
          className="flex-1 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white
                     font-bold text-sm active:scale-95 transition"
        >
          {canCheck ? 'Check' : `Call ${callAmount.toLocaleString()} 🪙`}
        </button>

        {/* Raise / All-in */}
        {canRaise && (
          <button
            onClick={() => emit('RAISE', raiseAmount)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm active:scale-95 transition
              ${raiseAmount >= maxRaiseTo
                ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-950'
                : 'bg-green-700 hover:bg-green-600 text-white'}`}
          >
            {raiseAmount >= maxRaiseTo ? 'All-In 🚀' : `Raise to ${raiseAmount.toLocaleString()}`}
          </button>
        )}
      </div>
    </div>
  );
}
