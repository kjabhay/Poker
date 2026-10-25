import { useState, useEffect, useRef } from 'react';
import socket, { playerId } from './socket';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import PokerTable from './components/PokerTable';

const LOBBY_STATUSES = ['LOBBY'];
const GAME_STATUSES  = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

export default function App() {
  const [screen, setScreen]       = useState(() => localStorage.getItem('poker_session') ? 'restoring' : 'landing');
  const [roomState, setRoomState] = useState(null);
  const resuming = useRef(false);
  const leavingRoom = useRef(false);
  const activeRoomCode = useRef(null);

  useEffect(() => {
    function onRoomState(state) {
      if (leavingRoom.current) return;
      if (state.roomCode !== activeRoomCode.current) return;
      activeRoomCode.current = state.roomCode;
      setRoomState(state);
      resuming.current = false;
      const me = state.players.find(player => player.playerId === playerId);
      if (me) {
        localStorage.setItem('poker_session', JSON.stringify({
          roomCode: state.roomCode,
          name: me.name,
        }));
      }
      if (LOBBY_STATUSES.includes(state.status)) {
        setScreen('lobby');
      } else if (GAME_STATUSES.includes(state.status)) {
        setScreen('game');
      }
    }

    function onRoomCreated({ roomCode }) {
      activeRoomCode.current = roomCode;
      leavingRoom.current = false;
    }

    function resumeSession() {
      const savedSession = localStorage.getItem('poker_session');
      if (!savedSession) {
        setScreen('landing');
        return;
      }

      try {
        const session = JSON.parse(savedSession);
        if (typeof session.roomCode !== 'string' || typeof session.name !== 'string') {
          throw new Error('Saved poker session is invalid');
        }
        activeRoomCode.current = session.roomCode;
        resuming.current = true;
        setScreen('restoring');
        socket.emit('room:join', { ...session, playerId, resume: true });
      } catch (error) {
        console.error('Could not restore saved poker session:', error);
        localStorage.removeItem('poker_session');
        setScreen('landing');
      }
    }

    function onResumeFailed() {
      if (!resuming.current) return;
      resuming.current = false;
      activeRoomCode.current = null;
      localStorage.removeItem('poker_session');
      setRoomState(null);
      setScreen('landing');
    }

    function onRoomLeft({ roomCode } = {}) {
      if (!roomCode || roomCode !== activeRoomCode.current) return;
      leavingRoom.current = false;
      activeRoomCode.current = null;
      localStorage.removeItem('poker_session');
      setRoomState(null);
      setScreen('landing');
    }

    socket.on('connect', resumeSession);
    socket.on('room:created', onRoomCreated);
    socket.on('room:state', onRoomState);
    socket.on('room:resumeFailed', onResumeFailed);
    socket.on('room:left', onRoomLeft);

    if (socket.connected) resumeSession();

    return () => {
      socket.off('connect', resumeSession);
      socket.off('room:created', onRoomCreated);
      socket.off('room:state', onRoomState);
      socket.off('room:resumeFailed', onResumeFailed);
      socket.off('room:left', onRoomLeft);
    };
  }, []);

  function returnToLanding(roomCode) {
    leavingRoom.current = true;
    localStorage.removeItem('poker_session');
    setRoomState(null);
    setScreen('landing');
    if (roomCode) socket.emit('room:leave', { roomCode, playerId });
  }

  function handleRoomRequested(roomCode) {
    activeRoomCode.current = roomCode;
    leavingRoom.current = !roomCode;
  }

  if (screen === 'restoring') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-950 text-gray-300">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-gold" />
        <p className="text-sm">Reconnecting to your table…</p>
      </div>
    );
  }

  if (screen === 'landing') {
    return <Landing onRoomRequested={handleRoomRequested} />;
  }

  if (screen === 'lobby' && roomState) {
    return <Lobby roomState={roomState} />;
  }

  if (screen === 'game' && roomState) {
    return <PokerTable roomState={roomState} onBackToLobby={() => returnToLanding(roomState.roomCode)} />;
  }

  return null;
}
