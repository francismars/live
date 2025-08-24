import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import axios from 'axios';
import * as snakeGame from './game/snakeGame';
// Import TICK_RATE as a named export from snakeGame
import { TICK_RATE, setGameEndCallback } from './game/snakeGame';
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

// In-memory store for player stats and MMR
interface PlayerStats {
  pubkey: string;
  name?: string;
  mmr: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  totalSatsWon: number;
  totalSatsLost: number;
  totalGameDuration: number;
  longestWinStreak: number;
  currentWinStreak: number;
  gameHistory: Array<{
    id: string;
    roomId: string;
    opponent: string;
    opponentName?: string;
    result: 'win' | 'loss' | 'draw';
    sats: number;
    opponentSats: number;
    duration: number;
    timestamp: number;
    gameType: 'normal' | 'ranked';
  }>;
}

const playerStats: Map<string, PlayerStats> = new Map();

// MMR calculation constants
const INITIAL_MMR = 1000;
const MMR_K_FACTOR = 32;
const MMR_CHANGE_BASE = 25;

// Function to update player name in stats
function updatePlayerName(pubkey: string, name: string): void {
  const stats = playerStats.get(pubkey);
  if (stats) {
    stats.name = name;
    playerStats.set(pubkey, stats);
  }
}

// Set up game end callback to update stats
setGameEndCallback((roomId: string, winner: string, players: any[]) => {
  console.log(`[GameEndCallback] Game ${roomId} ended, updating stats for winner: ${winner}`);
  
  const winnerPlayer = players.find(p => p.pubkey === winner);
  const loserPlayer = players.find(p => p.pubkey !== winner);
  
  if (winnerPlayer && loserPlayer) {
    // Get the game to access startTime
    const game = snakeGame.games[roomId];
    const gameStartTime = game?.startTime || Date.now();
    const duration = Math.round((Date.now() - gameStartTime) / 1000);
    
    // Update stats for both players
    updatePlayerStats(
      winnerPlayer.pubkey,
      loserPlayer.pubkey,
      'win',
      winnerPlayer.sats,
      loserPlayer.sats,
      duration,
      roomId,
      'normal' // Default to normal for now
    );
    
    console.log(`[GameEndCallback] Stats updated for game ${roomId}`);
  }
});

// MMR calculation functions
function getExpectedScore(playerMMR: number, opponentMMR: number): number {
  return 1 / (1 + Math.pow(10, (opponentMMR - playerMMR) / 400));
}

function calculateMMRChange(playerMMR: number, opponentMMR: number, result: 'win' | 'loss' | 'draw'): number {
  const expectedScore = getExpectedScore(playerMMR, opponentMMR);
  let actualScore: number;
  
  switch (result) {
    case 'win': actualScore = 1; break;
    case 'loss': actualScore = 0; break;
    case 'draw': actualScore = 0.5; break;
    default: actualScore = 0.5;
  }
  
  const mmrChange = Math.round(MMR_K_FACTOR * (actualScore - expectedScore));
  return mmrChange;
}

function updatePlayerStats(
  playerPubkey: string, 
  opponentPubkey: string, 
  result: 'win' | 'loss' | 'draw',
  sats: number,
  opponentSats: number,
  duration: number,
  roomId: string,
  gameType: 'normal' | 'ranked' = 'normal'
): void {
  // Get or create player stats
  let player = playerStats.get(playerPubkey);
  if (!player) {
    player = {
      pubkey: playerPubkey,
      mmr: INITIAL_MMR,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalSatsWon: 0,
      totalSatsLost: 0,
      totalGameDuration: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      gameHistory: []
    };
    playerStats.set(playerPubkey, player);
  }

  // Get opponent stats for MMR calculation
  let opponent = playerStats.get(opponentPubkey);
  if (!opponent) {
    opponent = {
      pubkey: opponentPubkey,
      mmr: INITIAL_MMR,
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      totalSatsWon: 0,
      totalSatsLost: 0,
      totalGameDuration: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      gameHistory: []
    };
    playerStats.set(opponentPubkey, opponent);
  }

  // Calculate MMR changes
  const playerMMRChange = calculateMMRChange(player.mmr, opponent.mmr, result);
  const opponentMMRChange = calculateMMRChange(opponent.mmr, player.mmr, 
    result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw'
  );

  // Update player stats
  player.mmr += playerMMRChange;
  player.totalGames++;
  player.totalGameDuration += duration;
  
  if (result === 'win') {
    player.wins++;
    player.currentWinStreak++;
    player.totalSatsWon += sats;
    player.totalSatsLost += opponentSats;
    if (player.currentWinStreak > player.longestWinStreak) {
      player.longestWinStreak = player.currentWinStreak;
    }
  } else if (result === 'loss') {
    player.losses++;
    player.currentWinStreak = 0;
    player.totalSatsLost += sats;
    player.totalSatsWon += opponentSats;
  } else {
    player.draws++;
    player.currentWinStreak = 0;
    player.totalSatsWon += sats;
    player.totalSatsLost += opponentSats;
  }

  // Update opponent stats
  opponent.mmr += opponentMMRChange;
  opponent.totalGames++;
  opponent.totalGameDuration += duration;
  
  const opponentResult = result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw';
  if (opponentResult === 'win') {
    opponent.wins++;
    opponent.currentWinStreak++;
    opponent.totalSatsWon += opponentSats;
    opponent.totalSatsLost += sats;
    if (opponent.currentWinStreak > opponent.longestWinStreak) {
      opponent.longestWinStreak = opponent.currentWinStreak;
    }
  } else if (opponentResult === 'loss') {
    opponent.losses++;
    opponent.currentWinStreak = 0;
    opponent.totalSatsLost += opponentSats;
    opponent.totalSatsWon += sats;
  } else {
    opponent.draws++;
    opponent.currentWinStreak = 0;
    opponent.totalSatsWon += opponentSats;
    opponent.totalSatsLost += sats;
  }

  // Add game to history
  const gameId = `${roomId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  player.gameHistory.unshift({
    id: gameId,
    roomId,
    opponent: opponentPubkey,
    opponentName: opponent.name,
    result,
    sats,
    opponentSats,
    duration,
    timestamp: Date.now(),
    gameType
  });

  opponent.gameHistory.unshift({
    id: gameId,
    roomId,
    opponent: playerPubkey,
    opponentName: player.name,
    result: opponentResult,
    sats: opponentSats,
    opponentSats: sats,
    duration,
    timestamp: Date.now(),
    gameType
  });

  // Keep only last 50 games in history
  if (player.gameHistory.length > 50) {
    player.gameHistory = player.gameHistory.slice(0, 50);
  }
  if (opponent.gameHistory.length > 50) {
    opponent.gameHistory = opponent.gameHistory.slice(0, 50);
  }

  // Update the maps
  playerStats.set(playerPubkey, player);
  playerStats.set(opponentPubkey, opponent);
}

// --- Matchmaking Queue ---
interface MatchmakingRequest {
  socket: any;
  userId: string;
  name?: string;
  avatar?: string;
  gameType: 'normal' | 'ranked';
  buyIn: number;
  allowSpectators: boolean;
}
const matchmakingQueue: MatchmakingRequest[] = [];

function findCompatibleMatch(request: MatchmakingRequest) {
  return matchmakingQueue.find(
    (other) =>
      other !== request &&
      other.gameType === request.gameType &&
      other.buyIn === request.buyIn &&
      other.allowSpectators === request.allowSpectators
  );
}

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

// --- Game Intervals ---
const gameIntervals = new Map(); // roomId -> { interval, broadcastInterval }

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

  if (gameIntervals.has(roomId)) {
    console.warn(`[startGameForRoom] Attempted to start game loop for ${roomId}, but intervals already exist.`);
    return;
  }
  // Now safe to create intervals
  console.log(`[startGameForRoom] Starting game loop for room ${roomId}`);
  io.to(roomId).emit('gameStarted');
  const interval = setInterval(() => {
    snakeGame.gameTick(roomId);
    const state = snakeGame.getGameState(roomId);
    if (state && state.status === 'ended') {
      console.log(`[startGameForRoom] Game ended, sending final state and clearing intervals for room ${roomId}`);
      
      // Send the final ended state to all players before clearing
      io.to(roomId).emit('gameState', state);
      
      // Clear intervals after sending final state
      const intervals = gameIntervals.get(roomId);
      if (intervals) {
        clearInterval(intervals.interval);
        clearInterval(intervals.broadcastInterval);
        gameIntervals.delete(roomId);
      }
      delete snakeGame.games[roomId];
    }
  }, TICK_RATE);
  const broadcastInterval = setInterval(() => {
    const state = snakeGame.getGameState(roomId);
    io.to(roomId).emit('gameState', state);
  }, 16);
  gameIntervals.set(roomId, { interval, broadcastInterval });
}

// --- Matchmaking Accept State ---
const matchmakingAccepts: Record<string, Set<string>> = {};

// --- Countdown State ---
const countdowns = new Map(); // roomId -> countdown interval

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
      
      // Update player name in stats if they have a name
      if (user.name) {
        updatePlayerName(user.userId, user.name);
      }
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
        
        // Update player name in stats if they have a name
        if (user.name) {
          updatePlayerName(user.userId, user.name);
        }
        
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
    const gameState = snakeGame.getGameState(roomId);
    if (room && room.players.length === 2 && gameState && gameState.status === 'waiting') {
      // Only trigger countdown if both players have joined and game is waiting to start
      console.log(`[joinGame] Both players in game room, starting countdown for ${roomId}`);
      io.to(roomId).emit('startCountdown');
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
    // Handle player abandonment
    const room = rooms.get(roomId);
    const user = room?.players.find(u => u.socketId === socket.id) || room?.spectators.find(u => u.socketId === socket.id);
    const userId = user?.userId || 'unknown';
    console.log(`[leaveGame] User ${userId} (socket ${socket.id}) is trying to leave game in room ${roomId}`);
    if (room) {
      // Remove the player from the room.players array
      const prevPlayers = [...room.players];
      room.players = room.players.filter(u => u.socketId !== socket.id);
      console.log(`[leaveGame] Player left. Remaining players in room ${roomId}:`, room.players.map(p => p.userId));
      // Always end the game and log it
      const game = snakeGame.games[roomId];
      if (game && game.status !== 'ended') {
        // Emit the last frame before ending
        io.to(roomId).emit('gameState', snakeGame.getGameState(roomId));
        game.status = 'ended';
        game.winner = room.players.length === 1 ? room.players[0].userId : null;
        console.log(`[leaveGame] Game forcibly ended due to user leaving. Winner: ${game.winner || 'none'}`);
        
        // Update stats for forfeit
        if (game.winner && userId !== 'unknown') {
          const winnerPlayer = game.players.find(p => p.pubkey === game.winner);
          const forfeitingPlayer = game.players.find(p => p.pubkey === userId);
          
          if (winnerPlayer && forfeitingPlayer) {
            const gameStartTime = game.startTime || Date.now();
            const duration = Math.round((Date.now() - gameStartTime) / 1000);
            
            // Update stats - winner gets a win, forfeiting player gets a loss
            updatePlayerStats(
              winnerPlayer.pubkey,
              forfeitingPlayer.pubkey,
              'win',
              winnerPlayer.sats,
              forfeitingPlayer.sats,
              duration,
              roomId,
              'normal'
            );
            
            console.log(`[leaveGame] Stats updated for forfeit in room ${roomId}`);
          }
        }
        
        io.to(roomId).emit('gameState', snakeGame.getGameState(roomId));
      }
    }
  });

  socket.on('playerReady', ({ roomId, userId }) => {
    console.log(`[playerReady] Player ${userId} ready for room ${roomId}`);
    const room = rooms.get(roomId);
    if (room) {
      room.readyPlayers.add(userId);
      emitRoomState(roomId);
      console.log(`[playerReady] Current players:`, room.players.map(p => p.userId));
      console.log(`[playerReady] Ready players:`, Array.from(room.readyPlayers));
      // Check if all players are ready
      const allPlayersReady = room.players.length === 2 && 
        room.players.every(player => room.readyPlayers.has(player.userId));
      if (allPlayersReady) {
        // Backend-driven countdown
        if (countdowns.has(roomId)) return; // Prevent duplicate countdowns
        let count = 3;
        console.log(`[countdown] Starting countdown for room ${roomId} with players:`, room.players.map(p => p.userId));
        io.to(roomId).emit('startCountdown');
        io.to(roomId).emit('countdownTick', count);
        const interval = setInterval(() => {
          count--;
          io.to(roomId).emit('countdownTick', count);
          console.log(`[countdown] Tick ${count} for room ${roomId}`);
          if (count === 0) {
            clearInterval(interval);
            countdowns.delete(roomId);
            // Double-check both players are still present before starting the game
            const roomNow = rooms.get(roomId);
            if (roomNow && roomNow.players.length === 2) {
              console.log(`[countdown] Countdown finished, starting game for room ${roomId}`);
              startGameForRoom(roomId);
            } else {
              console.warn(`[countdown] Countdown finished but not enough players in room ${roomId}. Players:`, roomNow?.players.map(p => p.userId));
            }
          }
        }, 1000);
        countdowns.set(roomId, interval);
      }
    }
  });

  // Remove startGame logic from frontend-initiated event
  socket.on('startGame', ({ roomId }) => {
    // No-op: game is started by backend after countdown
  });

  socket.on('playerInput', ({ roomId, pubkey, direction }) => {
    snakeGame.handleInput(roomId, pubkey, direction);
  });

  // Handle rematch requests
  socket.on('requestRematch', ({ roomId, requesterId }) => {
    console.log(`[requestRematch] Player ${requesterId} requesting rematch in room ${roomId}`);
    // Notify other players in the room about the rematch request
    socket.to(roomId).emit('rematchRequested', { requesterId });
  });

  // Handle rematch responses
  socket.on('respondToRematch', ({ roomId, userId, accept }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (accept) {
      // Reset game state and start new game
      console.log(`[respondToRematch] Rematch accepted for room ${roomId}`);
      io.to(roomId).emit('rematchAccepted');
      
      // Clear old game and start new one
      setTimeout(() => {
        if (snakeGame.games[roomId]) {
          delete snakeGame.games[roomId];
        }
        startGameForRoom(roomId);
      }, 2000);
    } else {
      console.log(`[respondToRematch] Rematch declined for room ${roomId}`);
      io.to(roomId).emit('rematchDeclined');
    }
  });

  // Handle stats requests
  socket.on('requestPlayerStats', ({ pubkey, name, avatar }) => {
    try {
      // Update player name if provided
      if (name) {
        updatePlayerName(pubkey, name);
      }
      
      const stats = playerStats.get(pubkey);
      if (stats) {
        // Calculate derived stats
        const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
        const averageGameDuration = stats.totalGames > 0 ? Math.round(stats.totalGameDuration / stats.totalGames) : 0;
        
        const responseStats = {
          ...stats,
          winRate,
          averageGameDuration
        };
        
        socket.emit('playerStats', responseStats);
      } else {
        // Create default stats for new player
        const defaultStats = {
          pubkey,
          name: name || undefined,
          mmr: INITIAL_MMR,
          totalGames: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          totalSatsWon: 0,
          totalSatsLost: 0,
          totalGameDuration: 0,
          longestWinStreak: 0,
          currentWinStreak: 0,
          gameHistory: []
        };
        
        // Store the new player stats
        playerStats.set(pubkey, defaultStats);
        
        socket.emit('playerStats', defaultStats);
      }
    } catch (error) {
      console.error('[requestPlayerStats] Error:', error);
      socket.emit('playerStatsError', 'Failed to fetch player stats');
    }
  });

  socket.on('lobbyChat', ({ roomId, sender, text }) => {
    if (!roomId || !sender || !text) return;
    io.to(roomId).emit('lobbyChat', { sender, text });
  });

  // --- Matchmaking ---
  socket.on('findMatch', (data) => {
    const { userId, name, avatar, gameType, buyIn, allowSpectators } = data;
    // Check if already in queue
    if (matchmakingQueue.some((req) => req.userId === userId)) {
      socket.emit('matchmakingStatus', { status: 'error', message: 'Already in matchmaking queue.' });
      return;
    }
    const request: MatchmakingRequest = {
      socket,
      userId,
      name,
      avatar,
      gameType,
      buyIn,
      allowSpectators,
    };
    // Try to find a compatible match
    const match = findCompatibleMatch(request);
    if (match) {
      // Remove both from queue
      matchmakingQueue.splice(matchmakingQueue.indexOf(match), 1);
      // Generate a roomId
      const roomId = generateLobbyId();
      // Create room and add both players
      const room = {
        roomId,
        players: [
          { userId: request.userId, name: request.name, avatar: request.avatar, socketId: socket.id },
          { userId: match.userId, name: match.name, avatar: match.avatar, socketId: match.socket.id },
        ],
        spectators: [],
        buyIn: request.buyIn,
        settings: { gameType: request.gameType, allowSpectators: request.allowSpectators },
        readyPlayers: new Set<string>(),
      };
      rooms.set(roomId, room);
      // Track accept state for this room
      matchmakingAccepts[roomId] = new Set();
      // Notify both clients
      socket.emit('matchFound', { roomId });
      match.socket.emit('matchFound', { roomId });
      // Auto-join both players to the room as spectators (they must register to play)
      socket.join(roomId);
      match.socket.join(roomId);
      // Do NOT emitRoomState here (no lobby for matchmaking)
    } else {
      matchmakingQueue.push(request);
      socket.emit('matchmakingStatus', { status: 'waiting' });
    }
  });

  // --- Accept Match for Matchmaking ---
  socket.on('acceptMatch', ({ roomId, userId }) => {
    if (!roomId || !userId) return;
    if (!matchmakingAccepts[roomId]) return;
    matchmakingAccepts[roomId].add(userId);
    // If both players have accepted, start the game
    const room = rooms.get(roomId);
    if (room && matchmakingAccepts[roomId].size === 2) {
      // Only add the two matched users to players (no duplicates)
      const acceptedUserIds = Array.from(matchmakingAccepts[roomId]);
      for (const uid of acceptedUserIds) {
        // Check if already a player
        if (!room.players.find(p => p.userId === uid)) {
          // Try to find in spectators first
          const spectator = room.spectators.find(u => u.userId === uid);
          if (spectator) {
            room.players.push(spectator);
            room.spectators = room.spectators.filter(u => u.userId !== uid);
          } else {
            // Fallback: if not in spectators, check if already a player (shouldn't happen)
            // Or add a placeholder if needed (should not be needed)
          }
        }
      }
      // Mark both as ready
      for (const player of room.players) {
        if (acceptedUserIds.includes(player.userId)) {
          room.readyPlayers.add(player.userId);
        }
      }
      // Remove any remaining spectators (should be none, but just in case)
      room.spectators = room.spectators.filter(u => !acceptedUserIds.includes(u.userId));
      // Start the game directly
      startGameForRoom(roomId);
      // Clean up accept state
      delete matchmakingAccepts[roomId];
    }
  });

  socket.on('cancelMatchmaking', ({ userId }) => {
    const idx = matchmakingQueue.findIndex((req) => req.userId === userId);
    if (idx !== -1) {
      matchmakingQueue.splice(idx, 1);
      socket.emit('matchmakingStatus', { status: 'cancelled' });
    }
  });

  // --- Active Games List for Spectators ---
  socket.on('getActiveGames', (cb) => {
    const activeGames = Object.entries(snakeGame.games)
      .filter(([roomId, game]) => game.status === 'running' && game.players.length === 2)
      .map(([roomId, game]) => ({
        roomId,
        players: game.players.map(p => ({
          pubkey: p.pubkey,
          name: p.name,
          sats: p.sats,
        })),
        preferences: {
          buyIn: game.players[0]?.initialSats || 0,
          allowSpectators: true, // always true for now
          // Add more preferences if available
        },
        status: game.status,
      }));
    cb(activeGames);
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

// Helper to generate a user-friendly 8-character lobby code (A-Z, 2-9, no O/0/I/1)
function generateLobbyId(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
}); 