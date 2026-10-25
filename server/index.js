require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Health check (Koyeb + client keep-alive ping) ────────────────────────────
app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve compiled React app in production ───────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Socket.IO handlers (wired in Step 4) ─────────────────────────────────────
// require('./socketHandlers')(io);

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8000;

connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🃏 Poker server running on http://0.0.0.0:${PORT}`);
  });
});

module.exports = { io };
