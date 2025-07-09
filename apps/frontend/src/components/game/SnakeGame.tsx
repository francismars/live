import React, { useEffect, useRef } from 'react';

interface SnakeGameProps {
  gameState: any;
}

const CELL_SIZE = 32;
const GRID_COLOR = '#333';
const PLAYER_COLORS = ['#fff', '#222'];
const FOOD_COLOR = '#ff0';

const SnakeGame: React.FC<SnakeGameProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!gameState || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { boardSize, players, food } = gameState;
    const width = boardSize.width * CELL_SIZE;
    const height = boardSize.height * CELL_SIZE;
    ctx.clearRect(0, 0, width, height);
    // Draw grid
    ctx.strokeStyle = GRID_COLOR;
    for (let x = 0; x <= boardSize.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, height);
      ctx.stroke();
    }
    for (let y = 0; y <= boardSize.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(width, y * CELL_SIZE);
      ctx.stroke();
    }
    // Draw snakes
    players.forEach((player: any, idx: number) => {
      ctx.fillStyle = PLAYER_COLORS[idx % PLAYER_COLORS.length];
      player.snake.forEach((seg: any, i: number) => {
        ctx.globalAlpha = i === 0 ? 1 : 0.7;
        ctx.fillRect(seg.x * CELL_SIZE, seg.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      });
      ctx.globalAlpha = 1;
    });
    // Draw food
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2.5,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }, [gameState]);

  if (!gameState) return <div className="text-center text-gray-400">Waiting for game state...</div>;
  const width = gameState.boardSize.width * CELL_SIZE;
  const height = gameState.boardSize.height * CELL_SIZE;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="bg-black rounded-xl border border-gray-700 shadow-lg"
      style={{ display: 'block' }}
    />
  );
};

export default SnakeGame; 