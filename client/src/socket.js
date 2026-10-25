/**
 * socket.js — Socket.IO client singleton.
 *
 * - Connects to the same origin in production (Express serves both).
 * - Connects to localhost:8000 in development (via Vite proxy).
 * - Generates and persists a stable playerId UUID in localStorage.
 * - Sends GET /api/ping every 3 minutes to keep Koyeb's free instance awake.
 */

import { io } from 'socket.io-client';

// ── Stable player identity ────────────────────────────────────────────────────
function getOrCreatePlayerId() {
  let id = localStorage.getItem('poker_playerId');
  if (!id) {
    // Simple UUID v4 generator (no external dependency needed)
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    localStorage.setItem('poker_playerId', id);
  }
  return id;
}

export const playerId = getOrCreatePlayerId();

// ── Socket connection ─────────────────────────────────────────────────────────
const URL = import.meta.env.DEV ? 'http://localhost:8000' : window.location.origin;

const socket = io(URL, {
  autoConnect: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('[Socket] connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] disconnected:', reason);
});

// ── Koyeb keep-alive: ping every 3 minutes ────────────────────────────────────
setInterval(() => {
  fetch('/api/ping').catch(() => {}); // fire-and-forget, ignore errors
}, 3 * 60 * 1000);

export default socket;
