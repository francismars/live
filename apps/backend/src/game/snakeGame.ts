// Simple in-memory game store
export interface SnakePlayer {
  pubkey: string;
  name: string;
  sats: number;
  initialSats: number;
  direction: string;
  snake: Array<{ x: number; y: number }>;
  alive: boolean;
}

export interface SnakeGameState {
  players: SnakePlayer[];
  food: { x: number; y: number };
  boardSize: { width: number; height: number };
  status: 'waiting' | 'running' | 'ended';
  winner: string | null;
  interval?: NodeJS.Timeout;
}

export const games: { [roomId: string]: SnakeGameState } = {};

const BOARD_WIDTH = 20;
const BOARD_HEIGHT = 15;
const INITIAL_SATS = 1000;
const TICK_RATE = 120; // ms

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
    [{ x: 3, y: Math.floor(BOARD_HEIGHT / 2) }],
    [{ x: BOARD_WIDTH - 4, y: Math.floor(BOARD_HEIGHT / 2) }],
  ];
  games[roomId] = {
    players: players.map((p, i) => ({
      ...p,
      sats: p.buyIn || INITIAL_SATS,
      initialSats: p.buyIn || INITIAL_SATS,
      direction: i === 0 ? 'right' : 'left',
      snake: snakes[i],
      alive: true,
    })),
    food: randomPosition(),
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
    if (!player.alive) continue;
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
      player.sats += 50;
      if (other) other.sats = Math.max(0, other.sats - 50);
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
    })),
    food: game.food,
    boardSize: game.boardSize,
    status: game.status,
    winner: game.winner,
  };
} 