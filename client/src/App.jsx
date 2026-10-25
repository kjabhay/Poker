import { useState, useEffect } from 'react';
import socket, { playerId } from './socket';
import Landing from './components/Landing';
import Lobby from './components/Lobby';

// PokerTable will be added in Step 6
// import PokerTable from './components/PokerTable';

const LOBBY_STATUSES = ['LOBBY'];
const GAME_STATUSES  = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

export default function App() {
  const [screen, setScreen]         = useState('landing'); // 'landing' | 'lobby' | 'game'
  const [roomState, setRoomState]   = useState(null);

  useEffect(() => {
    function onRoomState(state) {
      setRoomState(state);
      if (LOBBY_STATUSES.includes(state.status)) {
        setScreen('lobby');
      } else if (GAME_STATUSES.includes(state.status)) {
        setScreen('game');
      }
    }

    socket.on('room:state', onRoomState);
    return () => socket.off('room:state', onRoomState);
  }, []);

  function handleJoined({ roomCode }) {
    // Landing emits room:create / room:join — wait for room:state to route us
  }

  if (screen === 'landing') {
    return <Landing onJoined={handleJoined} />;
  }

  if (screen === 'lobby' && roomState) {
    return <Lobby roomState={roomState} />;
  }

  if (screen === 'game' && roomState) {
    // Placeholder until Step 6
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-2xl font-bold text-gold mb-2">Game in progress</p>
          <p className="text-gray-400 text-sm">
            Room: {roomState.roomCode} · Street: {roomState.status}
          </p>
          <p className="text-gray-500 text-xs mt-4">
            Poker table UI coming in Step 6…
          </p>
        </div>
      </div>
    );
  }

  return null;
}
