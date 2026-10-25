import { useState, useEffect } from 'react';
import socket, { playerId } from './socket';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import PokerTable from './components/PokerTable';

const LOBBY_STATUSES = ['LOBBY'];
const GAME_STATUSES  = ['PREFLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN'];

export default function App() {
  const [screen, setScreen]       = useState('landing'); // 'landing' | 'lobby' | 'game'
  const [roomState, setRoomState] = useState(null);

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

  if (screen === 'landing') {
    return <Landing onJoined={() => {}} />;
  }

  if (screen === 'lobby' && roomState) {
    return <Lobby roomState={roomState} />;
  }

  if (screen === 'game' && roomState) {
    return <PokerTable roomState={roomState} />;
  }

  return null;
}
