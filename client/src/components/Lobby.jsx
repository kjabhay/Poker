import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';

export default function Lobby({ roomState }) {
  const isHost = roomState.hostId === playerId;

  const [config, setConfig] = useState({
    startingCoins: roomState.config.startingCoins,
    numDecks:      roomState.config.numDecks,
    smallBlind:    roomState.config.smallBlind,
    bigBlind:      roomState.config.bigBlind,
  });
  const [copied, setCopied]   = useState(false);
  const [error, setError]     = useState('');
  const [starting, setStarting] = useState(false);

  // Keep local config in sync if host changes broadcast it
  useEffect(() => {
    setConfig({
      startingCoins: roomState.config.startingCoins,
      numDecks:      roomState.config.numDecks,
      smallBlind:    roomState.config.smallBlind,
      bigBlind:      roomState.config.bigBlind,
    });
  }, [roomState.config]);

  useEffect(() => {
    function onError({ message }) { setError(message); setStarting(false); }
    socket.on('error:message', onError);
    return () => socket.off('error:message', onError);
  }, []);

  function copyCode() {
    navigator.clipboard.writeText(roomState.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function updateConfig(field, value) {
    const updated = { ...config, [field]: Number(value) };
    setConfig(updated);
    socket.emit('room:updateConfig', {
      roomCode: roomState.roomCode,
      playerId,
      config: updated,
    });
  }

  function startGame() {
    if (roomState.players.length < 2) {
      setError('Need at least 2 players to start');
      return;
    }
    setError('');
    setStarting(true);
    socket.emit('game:start', { roomCode: roomState.roomCode, playerId });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-start p-4 pt-10">

      {/* Room code banner */}
      <div className="mb-8 text-center">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Room Code</p>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-extrabold font-mono tracking-widest text-gold">
            {roomState.roomCode}
          </span>
          <button
            onClick={copyCode}
            className="text-xs px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600
                       text-gray-300 transition"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-gray-500 text-xs mt-2">Share this code with friends to join</p>
      </div>

      <div className="w-full max-w-2xl grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* Player list */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Players ({roomState.players.length}/9)
          </h2>
          <ul className="space-y-2">
            {roomState.players.map((p) => (
              <li
                key={p.playerId}
                className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${p.isConnected ? 'bg-green-400' : 'bg-gray-500'}`}
                  />
                  <span className="text-sm font-medium">
                    {p.name}
                    {p.playerId === roomState.hostId && (
                      <span className="ml-2 text-xs text-gold">HOST</span>
                    )}
                    {p.playerId === playerId && (
                      <span className="ml-1 text-xs text-gray-400">(you)</span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {p.coins.toLocaleString()} 🪙
                </span>
              </li>
            ))}
          </ul>

          {roomState.players.length < 2 && (
            <p className="mt-4 text-center text-gray-500 text-xs">
              Waiting for players to join…
            </p>
          )}
        </div>

        {/* Config panel (host only) or read-only view */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Game Settings {!isHost && <span className="text-xs normal-case text-gray-500">(host only)</span>}
          </h2>

          <div className="space-y-4">
            {/* Starting coins */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Starting Coins</label>
              <input
                type="number"
                value={config.startingCoins}
                onChange={e => isHost && updateConfig('startingCoins', e.target.value)}
                disabled={!isHost}
                min={100} max={1000000} step={100}
                className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600
                           text-white text-sm focus:outline-none focus:border-gold
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Blinds */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Small Blind</label>
                <input
                  type="number"
                  value={config.smallBlind}
                  onChange={e => isHost && updateConfig('smallBlind', e.target.value)}
                  disabled={!isHost}
                  min={1} step={1}
                  className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600
                             text-white text-sm focus:outline-none focus:border-gold
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Big Blind</label>
                <input
                  type="number"
                  value={config.bigBlind}
                  onChange={e => isHost && updateConfig('bigBlind', e.target.value)}
                  disabled={!isHost}
                  min={2} step={1}
                  className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600
                             text-white text-sm focus:outline-none focus:border-gold
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Number of decks */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Number of Decks</label>
              <select
                value={config.numDecks}
                onChange={e => isHost && updateConfig('numDecks', e.target.value)}
                disabled={!isHost}
                className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600
                           text-white text-sm focus:outline-none focus:border-gold
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n} Deck{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && <p className="mt-3 text-red-400 text-xs">{error}</p>}

          {/* Start button (host only) */}
          {isHost && (
            <button
              onClick={startGame}
              disabled={roomState.players.length < 2 || starting}
              className="mt-6 w-full py-3 rounded-xl bg-gold text-gray-950 font-bold text-sm
                         hover:brightness-110 active:scale-95 transition
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {starting ? 'Starting…' : `Start Poker Game (${roomState.players.length} players)`}
            </button>
          )}

          {!isHost && (
            <p className="mt-6 text-center text-gray-500 text-xs">
              Waiting for the host to start the game…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
