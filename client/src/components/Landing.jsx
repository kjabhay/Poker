import { useState, useEffect } from 'react';
import socket, { playerId } from '../socket';

export default function Landing({ onRoomRequested }) {
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
      onRoomRequested(roomCode);
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
  }, [onRoomRequested]);

  function validate() {
    if (!name.trim()) { setError('Enter your name first'); return false; }
    setError('');
    return true;
  }

  function handleCreate() {
    if (!validate()) return;
    setLoading('create');
    onRoomRequested(null);
    socket.emit('room:create', { name: name.trim(), playerId });
  }

  function handleJoin() {
    if (!validate()) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters'); return; }
    setLoading('join');
    onRoomRequested(code);
    socket.emit('room:join', { roomCode: code, name: name.trim(), playerId });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-gray-950 to-gray-950">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-400/10 text-4xl text-emerald-300 shadow-lg shadow-emerald-950/30">♠</div>
        <h1 className="text-5xl font-extrabold tracking-tight text-white mb-2">Poker<span className="text-gold">.</span></h1>
        <p className="text-gray-400 text-sm">A friendly table for your next big hand</p>
      </div>

      {/* Name input */}
      <div className="w-full max-w-sm mb-6">
        <label className="block text-xs font-semibold text-gray-300 uppercase tracking-widest mb-2">
          Your Display Name
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          maxLength={20}
          placeholder="e.g. Rahul"
          className="w-full px-4 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10
                     text-white placeholder-gray-500 focus:outline-none focus:border-gold
                     focus:ring-2 focus:ring-gold/20 text-lg shadow-inner shadow-black/10"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="mb-4 text-red-400 text-sm font-medium">{error}</p>
      )}

      {/* Two cards side by side */}
      <div className="w-full max-w-2xl grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Create room */}
        <div className="bg-white/[0.055] border border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl shadow-black/20 backdrop-blur">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/15 text-xl text-gold">✦</div>
            <h2 className="text-lg font-bold text-white">New Room</h2>
            <p className="text-gray-400 text-sm mt-1">Start a game and invite friends</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={!!loading}
            className="w-full py-3.5 rounded-2xl bg-gold text-gray-950 font-bold text-sm
                       hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50 shadow-lg shadow-yellow-950/20"
          >
            {loading === 'create' ? 'Creating…' : 'Start New Room'}
          </button>
        </div>

        {/* Join room */}
        <div className="bg-white/[0.055] border border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-xl shadow-black/20 backdrop-blur">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 text-xl text-sky-300">↗</div>
            <h2 className="text-lg font-bold text-white">Join Room</h2>
            <p className="text-gray-400 text-sm mt-1">Enter a 6-character room code</p>
          </div>
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            placeholder="PKR842"
            className="w-full px-3 py-3 rounded-2xl bg-black/20 border border-white/10
                       text-white placeholder-gray-500 text-center tracking-widest
                       font-mono text-lg focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
          <button
            onClick={handleJoin}
            disabled={!!loading}
            className="w-full py-3.5 rounded-2xl bg-white/10 text-white font-bold text-sm
                       hover:bg-white/15 active:scale-[0.98] transition disabled:opacity-50"
          >
            {loading === 'join' ? 'Joining…' : 'Join Game'}
          </button>
        </div>

      </div>
    </div>
  );
}
