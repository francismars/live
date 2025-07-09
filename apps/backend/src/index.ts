import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import axios from 'axios';
import * as snakeGame from './game/snakeGame';
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
  readyPlayers: Set<string>; // Track which players are ready
};
const rooms: Map<string, GameRoom> = new Map();

// In-memory store for pending payments: { paymentHash: { roomId, userId } }
const pendingPayments: Record<string, { roomId: string; userId: string }> = {};

// In-memory store for lobbies: { roomId: { players: Array<{ pubkey: string; name: string }> } }
const lobbies: { [roomId: string]: { players: Array<{ pubkey: string; name: string }> } } = {};

function emitRoomState(roomId: string) {
  const room = rooms.get(roomId);
  if (room) {
    const roomState = {
      roomId,
      players: room.players,
      spectators: room.spectators,
      buyIn: room.buyIn,
      settings: room.settings,
      readyPlayers: Array.from(room.readyPlayers),
    };
    console.log(`[emitRoomState] Emitting room state for ${roomId}:`, roomState);
    io.to(roomId).emit('roomState', roomState);
  }
}

function startGameForRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room || room.players.length === 0) {
    console.log(`[startGameForRoom] No room or no players found for roomId: ${roomId}`);
    return;
  }
  
  const players: Array<{ pubkey: string; name: string; buyIn?: number }> = room.players.map(p => ({ 
    pubkey: p.userId, 
    name: p.name || p.userId.slice(0, 8),
    buyIn: room.buyIn || 1000 // Use room buyIn or default to 1000
  }));
  
  console.log(`[startGameForRoom] Starting game for room ${roomId} with players:`, players);
  snakeGame.initGame(roomId, players);
  console.log(`[startGameForRoom] Game initialized. Initial state:`, snakeGame.getGameState(roomId));
  
  if (!snakeGame.games[roomId].interval) {
    console.log(`[startGameForRoom] Starting game loop for room ${roomId}`);
    // Emit game started event
    io.to(roomId).emit('gameStarted');
    snakeGame.games[roomId].interval = setInterval(() => {
      snakeGame.gameTick(roomId);
      const state = snakeGame.getGameState(roomId);
      io.to(roomId).emit('gameState', state);
      if (state && state.status === 'ended') {
        console.log(`[startGameForRoom] Game ended, clearing interval for room ${roomId}`);
        clearInterval(snakeGame.games[roomId].interval);
      }
    }, 100);
  } else {
    console.log(`[startGameForRoom] Game loop already running for room ${roomId}`);
  }
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRoom', ({ roomId, user, buyIn }) => {
    socket.join(roomId);
    let room = rooms.get(roomId);
    if (!room) {
      room = { roomId, players: [], spectators: [], settings: {}, buyIn: undefined, readyPlayers: new Set() };
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
    console.log(`[registerToPlay] Received for roomId: ${roomId}, userId: ${userId}`);
    const room = rooms.get(roomId);
    if (room) {
      const user = room.spectators.find(u => u.userId === userId);
      if (user) {
        room.spectators = room.spectators.filter(u => u.userId !== userId);
        room.players.push(user);
        console.log(`[registerToPlay] User ${userId} moved to players in room ${roomId}. Players:`, room.players.map(p => p.userId));
        console.log(`[registerToPlay] Current ready players:`, Array.from(room.readyPlayers));
        emitRoomState(roomId);
        socket.emit('registrationSuccess');
      } else {
        console.log(`[registerToPlay] User ${userId} not found in spectators for room ${roomId}`);
        socket.emit('registrationFailed', { error: 'User not found in spectators' });
      }
    } else {
      console.log(`[registerToPlay] Room ${roomId} not found`);
    }
  });

  socket.on('joinGame', ({ roomId }) => {
    console.log(`[joinGame] User ${socket.id} joining game room: ${roomId}`);
    socket.join(roomId);
    
    // Get the room to check player count
    const room = rooms.get(roomId);
    if (room) {
      // Count how many players are in the game room
      const playersInGame = Array.from(io.sockets.adapter.rooms.get(roomId) || []).length;
      console.log(`[joinGame] Players in game room ${roomId}: ${playersInGame}`);
      
      // If we have 2 players in the game room, start countdown
      if (playersInGame >= 2) {
        console.log(`[joinGame] Both players in game room, starting countdown for ${roomId}`);
        io.to(roomId).emit('startCountdown');
      }
    }
    
    // Send current state immediately to the joining user
    const state = snakeGame.getGameState(roomId);
    if (state) {
      console.log(`[joinGame] Sending existing game state for room ${roomId} to user ${socket.id}:`, state);
      socket.emit('gameState', state);
    } else {
      console.log(`[joinGame] No existing game state for room ${roomId}`);
    }
  });

  socket.on('leaveGame', ({ roomId }) => {
    socket.leave(roomId);
  });

  socket.on('playerReady', ({ roomId, userId }) => {
    console.log(`[playerReady] Player ${userId} ready for room ${roomId}`);
    const room = rooms.get(roomId);
    if (room) {
      room.readyPlayers.add(userId);
      emitRoomState(roomId);
      
      // Check if all players are ready
      const allPlayersReady = room.players.length >= 2 && 
        room.players.every(player => room.readyPlayers.has(player.userId));
      
      if (allPlayersReady) {
        console.log(`[playerReady] All players ready, starting game for room ${roomId}`);
        startGameForRoom(roomId);
      }
    }
  });

  socket.on('startGame', ({ roomId }) => {
    console.log(`[startGame] Manual start game request for room ${roomId}`);
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`[startGame] Room not found: ${roomId}`);
      return;
    }
    
    // Mark the requesting player as ready
    const userId = room.players.find(p => p.socketId === socket.id)?.userId;
    if (userId) {
      room.readyPlayers.add(userId);
      emitRoomState(roomId);
      
      // Check if all players are ready
      const allPlayersReady = room.players.length >= 2 && 
        room.players.every(player => room.readyPlayers.has(player.userId));
      
      if (allPlayersReady) {
        console.log(`[startGame] All players ready, starting game for room ${roomId}`);
        startGameForRoom(roomId);
      } else {
        console.log(`[startGame] Not all players ready yet. Ready: ${room.readyPlayers.size}/${room.players.length}`);
      }
    }
  });

  socket.on('playerInput', ({ roomId, pubkey, direction }) => {
    snakeGame.handleInput(roomId, pubkey, direction);
  });

  socket.on('disconnect', () => {
    // Optionally handle player leaving
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