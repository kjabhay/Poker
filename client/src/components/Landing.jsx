import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';

export default function Landing({ onJoined }) {
  const [name, setName]           = useState(() => localStorage.getItem('poker_name') || '');
  const [joinCode, setJoinCode]   = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(''); // 'create' | 'join' | ''

  // Persist name
  useEffect(() => {
    if (name) localStorage.setItem('poker_name', name);
  }, [name]);

  // Listen for server responses
  useEffect(() => {
    function onCreated({ roomCode }) {
      setLoading('');
      onJoined({ roomCode, isHost: true });
    }
    function onState(state) {
      // Joined successfully — App.jsx will handle routing via room:state
      setLoading('');
    }
    function onError({ message }) {
      setError(message);
      setLoading('');
    }

    socket.on('room:created', onCreated);
    socket.on('room:state',   onState);
    socket.on('error:message', onError);
    return () => {
      socket.off('room:created', onCreated);
      socket.off('room:state',   onState);
      socket.off('error:message', onError);
    };
  }, [onJoined]);

  function validate() {
    if (!name.trim()) { setError('Enter your name first'); return false; }
    setError('');
    return true;
  }

  function handleCreate() {
    if (!validate()) return;
    setLoading('create');
    socket.emit('room:create', { name: name.trim(), playerId });
  }

  function handleJoin() {
    if (!validate()) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters'); return; }
    setLoading('join');
    socket.emit('room:join', { roomCode: code, name: name.trim(), playerId });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-950">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-gold mb-2">♠ Poker</h1>
        <p className="text-gray-400 text-sm">Multiplayer Texas Hold'em · Virtual Coins</p>
      </div>

      {/* Name input */}
      <div className="w-full max-w-sm mb-6">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
          Your Display Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          maxLength={20}
          placeholder="e.g. Rahul"
          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700
                     text-white placeholder-gray-500 focus:outline-none focus:border-gold
                     focus:ring-1 focus:ring-gold text-lg"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 text-red-400 text-sm font-medium">{error}</p>
      )}

      {/* Two cards side by side */}
      <div className="w-full max-w-sm grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Create room */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">New Room</h2>
            <p className="text-gray-400 text-xs mt-1">Start a game and invite friends</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={!!loading}
            className="w-full py-3 rounded-xl bg-gold text-gray-950 font-bold text-sm
                       hover:brightness-110 active:scale-95 transition disabled:opacity-50"
          >
            {loading === 'create' ? 'Creating…' : 'Start New Room'}
          </button>
        </div>

        {/* Join room */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Join Room</h2>
            <p className="text-gray-400 text-xs mt-1">Enter a 6-character room code</p>
          </div>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            placeholder="PKR842"
            className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600
                       text-white placeholder-gray-500 text-center tracking-widest
                       font-mono text-lg focus:outline-none focus:border-gold"
          />
          <button
            onClick={handleJoin}
            disabled={!!loading}
            className="w-full py-3 rounded-xl bg-gray-600 text-white font-bold text-sm
                       hover:bg-gray-500 active:scale-95 transition disabled:opacity-50"
          >
            {loading === 'join' ? 'Joining…' : 'Join Game'}
          </button>
        </div>

      </div>
    </div>
  );
}
