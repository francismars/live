// Simple in-memory game store
export interface SnakePlayer {
  pubkey: string;
  name: string;
  sats: number;
  initialSats: number;
  direction: string;
  snake: Array<{ x: number; y: number }>;
  alive: boolean;
  spawn: { x: number; y: number };
  initialDirection: string;
}

export interface SnakeGameState {
  players: SnakePlayer[];
  food: { x: number; y: number };
  boardSize: { width: number; height: number };
  status: 'waiting' | 'running' | 'ended';
  winner: string | null;
  interval?: NodeJS.Timeout;
  broadcastInterval?: NodeJS.Timeout;
}

export const games: { [roomId: string]: SnakeGameState } = {};

const BOARD_WIDTH = 51;
const BOARD_HEIGHT = 25;
const INITIAL_SATS = 1000;
export const TICK_RATE = 100; // ms (10 frames per second)

function randomPosition() {
  return {
    x: Math.floor(Math.random() * BOARD_WIDTH),
    y: Math.floor(Math.random() * BOARD_HEIGHT),
  };
}

function oppositeDirection(dir1: string, dir2: string) {
  return (
    (dir1 === 'up' && dir2 === 'down') ||
    (dir1 === 'down' && dir2 === 'up') ||
    (dir1 === 'left' && dir2 === 'right') ||
    (dir1 === 'right' && dir2 === 'left')
  );
}

export function initGame(roomId: string, players: Array<{ pubkey: string; name: string; buyIn?: number }>): void {
  console.log(`[initGame] Initializing game for room ${roomId} with players:`, players);
  // players: [{ pubkey, name, buyIn }]
  const snakes = [
    [
      { x: 6, y: 12 }, // p1 head
      { x: 5, y: 12 }, // p1 body
    ],
    [
      { x: 44, y: 12 }, // p2 head
      { x: 45, y: 12 }, // p2 body
    ],
  ];
  const spawns = [
    { x: 6, y: 12 },
    { x: 44, y: 12 },
  ];
  const directions = ['right', 'left'];
  games[roomId] = {
    players: players.map((p, i) => ({
      ...p,
      sats: p.buyIn || INITIAL_SATS,
      initialSats: p.buyIn || INITIAL_SATS,
      direction: directions[i],
      initialDirection: directions[i],
      snake: snakes[i],
      alive: true,
      spawn: spawns[i],
    })),
    food: { x: 25, y: 12 }, // coinbase position
    boardSize: { width: BOARD_WIDTH, height: BOARD_HEIGHT },
    status: 'running',
    winner: null,
  };
  console.log(`[initGame] Game initialized for room ${roomId}:`, games[roomId]);
}

export function handleInput(roomId: string, pubkey: string, direction: string): void {
  const game = games[roomId];
  if (!game) return;
  const player = game.players.find(p => p.pubkey === pubkey);
  if (!player) return;
  // Prevent reversing
  if (!oppositeDirection(player.direction, direction)) {
    player.direction = direction;
  }
}

export function gameTick(roomId: string): void {
  const game = games[roomId];
  if (!game || game.status !== 'running') return;
  // Move snakes
  for (const player of game.players) {
    if (!player.alive) {
      // Respawn logic: reset snake to spawn, direction, and length 2
      player.snake = [
        { x: player.spawn.x, y: player.spawn.y },
        player.initialDirection === 'right'
          ? { x: player.spawn.x - 1, y: player.spawn.y }
          : player.initialDirection === 'left'
          ? { x: player.spawn.x + 1, y: player.spawn.y }
          : player.initialDirection === 'up'
          ? { x: player.spawn.x, y: player.spawn.y + 1 }
          : { x: player.spawn.x, y: player.spawn.y - 1 },
      ];
      player.direction = player.initialDirection;
      player.alive = true;
      continue;
    }
    const head = { ...player.snake[0] };
    if (player.direction === 'up') head.y--;
    if (player.direction === 'down') head.y++;
    if (player.direction === 'left') head.x--;
    if (player.direction === 'right') head.x++;
    // Check wall collision
    if (
      head.x < 0 ||
      head.x >= game.boardSize.width ||
      head.y < 0 ||
      head.y >= game.boardSize.height
    ) {
      player.alive = false;
      continue;
    }
    // Check self collision
    if (player.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      player.alive = false;
      continue;
    }
    // Check collision with other snake
    const other = game.players.find(p => p.pubkey !== player.pubkey);
    if (other && other.snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      player.alive = false;
      continue;
    }
    // Move snake
    player.snake.unshift(head);
    // Check food
    if (head.x === game.food.x && head.y === game.food.y) {
      // Calculate changeInPoints based on body length
      const bodyLength = player.snake.length - 1;
      const totalPoints = (player.sats + (other ? other.sats : 0));
      let changeInPoints = 0;
      if (bodyLength === 1) {
        changeInPoints = Math.floor(totalPoints * 0.02);
      } else if (bodyLength === 2 || bodyLength === 3) {
        changeInPoints = Math.floor(totalPoints * 0.04);
      } else if (bodyLength >= 4 && bodyLength <= 6) {
        changeInPoints = Math.floor(totalPoints * 0.08);
      } else if (bodyLength >= 7 && bodyLength <= 10) {
        changeInPoints = Math.floor(totalPoints * 0.16);
      } else if (bodyLength >= 11) {
        changeInPoints = Math.floor(totalPoints * 0.32);
      }
      player.sats += changeInPoints;
      if (other) other.sats = Math.max(0, other.sats - changeInPoints);
      game.food = randomPosition();
    } else {
      player.snake.pop();
    }
  }
  // Check win
  for (const player of game.players) {
    if (player.sats >= INITIAL_SATS * 2) {
      game.status = 'ended';
      game.winner = player.pubkey;
    }
  }
}

export function getGameState(roomId: string): SnakeGameState | null {
  const game = games[roomId];
  if (!game) return null;
  return {
    players: game.players.map(p => ({
      pubkey: p.pubkey,
      name: p.name,
      sats: p.sats,
      initialSats: p.initialSats,
      direction: p.direction,
      snake: p.snake,
      alive: p.alive,
      spawn: p.spawn,
      initialDirection: p.initialDirection,
      capturePercent: (() => {
        const bodyLength = p.snake.length - 1;
        if (bodyLength === 1) return 2;
        if (bodyLength === 2 || bodyLength === 3) return 4;
        if (bodyLength >= 4 && bodyLength <= 6) return 8;
        if (bodyLength >= 7 && bodyLength <= 10) return 16;
        if (bodyLength >= 11) return 32;
        return 0;
      })(),
    })),
    food: game.food,
    boardSize: game.boardSize,
    status: game.status,
    winner: game.winner,
  };
} 