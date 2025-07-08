import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  },
});

const LNBITS_API_URL = process.env.LNBITS_API_URL;
const LNBITS_ADMIN_KEY = process.env.LNBITS_ADMIN_KEY;
const LNBITS_WEBHOOK_SECRET = process.env.LNBITS_WEBHOOK_SECRET;

// In-memory game room store
type User = {
  userId: string;
  name?: string;
  avatar?: string;
  socketId: string;
};
type GameRoom = {
  roomId: string;
  players: User[];
  spectators: User[];
  buyIn?: number;
  settings?: any;
};
const rooms: Map<string, GameRoom> = new Map();

// In-memory store for pending payments: { paymentHash: { roomId, userId } }
const pendingPayments: Record<string, { roomId: string; userId: string }> = {};

function emitRoomState(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit('roomState', {
      roomId,
      players: room.players,
      spectators: room.spectators,
      buyIn: room.buyIn,
      settings: room.settings,
    });
  }
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ roomId, user, buyIn }) => {
    socket.join(roomId);
    let room = rooms.get(roomId);
    if (!room) {
      room = { roomId, players: [], spectators: [], settings: {}, buyIn: undefined };
      // Only set buyIn if provided and is a number
      if (typeof buyIn === 'number' && !isNaN(buyIn)) {
        room.buyIn = buyIn;
      }
      rooms.set(roomId, room);
    }
    // Avoid duplicate users
    if (!room.spectators.find(u => u.userId === user.userId)) {
      room.spectators.push({ ...user, socketId: socket.id });
    }
    emitRoomState(roomId);
  });

  socket.on('leaveRoom', ({ roomId, userId }) => {
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (room) {
      room.spectators = room.spectators.filter(u => u.userId !== userId);
      room.players = room.players.filter(u => u.userId !== userId);
      emitRoomState(roomId);
    }
  });

  socket.on('registerToPlay', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room) {
      const user = room.spectators.find(u => u.userId === userId);
      if (user) {
        room.spectators = room.spectators.filter(u => u.userId !== userId);
        room.players.push(user);
        emitRoomState(roomId);
        socket.emit('registrationSuccess');
      } else {
        socket.emit('registrationFailed', { error: 'User not found in spectators' });
      }
    }
  });

  socket.on('disconnect', () => {
    // Remove user from all rooms
    for (const room of rooms.values()) {
      const beforeSpectators = room.spectators.length;
      const beforePlayers = room.players.length;
      room.spectators = room.spectators.filter(u => u.socketId !== socket.id);
      room.players = room.players.filter(u => u.socketId !== socket.id);
      if (room.spectators.length !== beforeSpectators || room.players.length !== beforePlayers) {
        emitRoomState(room.roomId);
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Endpoint to create a LNbits invoice for a buy-in
app.post('/api/create-lnurl', express.json(), async (req, res) => {
  const { roomId, userId, amount } = req.body;
  if (!roomId || !userId || !amount) {
    res.status(400).json({ error: 'Missing params' });
    return;
  }
  try {
    const resp = await axios.post(
      `${LNBITS_API_URL}/api/v1/payments`,
      {
        out: false,
        amount: amount,
        memo: `Buy-in for room ${roomId}`,
        webhook: `${req.protocol}://${req.get('host')}/api/lnbits-webhook?secret=${LNBITS_WEBHOOK_SECRET}`,
      },
      {
        headers: { 'X-Api-Key': LNBITS_ADMIN_KEY, 'Content-Type': 'application/json' },
      }
    );
    const { payment_hash, payment_request } = resp.data;
    pendingPayments[payment_hash] = { roomId, userId };
    res.json({ payment_hash, payment_request });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to create invoice', details: errorMsg });
  }
});

// LNbits webhook handler
app.post('/api/lnbits-webhook', express.json(), (req, res) => {
  const { payment_hash, paid } = req.body;
  const { secret } = req.query;
  console.log('[LNbits Webhook] Received:', { payment_hash, paid, secret });
  if (secret !== LNBITS_WEBHOOK_SECRET) {
    console.error('[LNbits Webhook] Invalid secret:', secret);
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }
  if (paid && payment_hash && pendingPayments[payment_hash]) {
    const { roomId, userId } = pendingPayments[payment_hash];
    console.log(`[LNbits Webhook] Payment confirmed for user ${userId} in room ${roomId}`);
    // Find the room and move user from spectators to players
    const room = rooms.get(roomId);
    if (room) {
      const user = room.spectators.find(u => u.userId === userId);
      if (user && room.players.length < 2) {
        room.spectators = room.spectators.filter(u => u.userId !== userId);
        room.players.push(user);
        emitRoomState(roomId);
        console.log(`[LNbits Webhook] User ${userId} moved to players in room ${roomId}`);
      } else {
        console.warn(`[LNbits Webhook] User not found in spectators or room full: userId=${userId}, roomId=${roomId}`);
      }
    } else {
      console.warn(`[LNbits Webhook] Room not found: roomId=${roomId}`);
    }
    delete pendingPayments[payment_hash];
    res.json({ ok: true });
    return;
  }
  console.error('[LNbits Webhook] Invalid or unpaid payment_hash:', payment_hash);
  res.status(400).json({ error: 'Invalid or unpaid payment_hash' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
}); 