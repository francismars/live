import React, { useEffect, useRef, useState } from 'react';

interface SnakeGameProps {
  gameState: any;
}

// Remove fixed CELL_SIZE
const GRID_COLOR = '#333';
const PLAYER_COLORS = ['#fff', '#222'];
const FOOD_COLOR = '#ff0';

const SnakeGame: React.FC<SnakeGameProps> = ({ gameState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 700, height: 350 });

  // Responsive canvas size
  useEffect(() => {
    function handleResize() {
      setCanvasSize({
        width: window.innerWidth * 0.7,
        height: window.innerWidth * 0.35,
      });
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!gameState || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const { boardSize, players, food } = gameState;
    const { width, height } = canvasSize;
    const colSize = width / boardSize.width;
    const rowSize = height / boardSize.height;
    ctx.clearRect(0, 0, width, height);
    // Draw grid
    ctx.strokeStyle = GRID_COLOR;
    for (let x = 0; x <= boardSize.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * colSize, 0);
      ctx.lineTo(x * colSize, height);
      ctx.stroke();
    }
    for (let y = 0; y <= boardSize.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * rowSize);
      ctx.lineTo(width, y * rowSize);
      ctx.stroke();
    }
    // Draw snakes
    players.forEach((player: any, idx: number) => {
      ctx.fillStyle = PLAYER_COLORS[idx % PLAYER_COLORS.length];
      player.snake.forEach((seg: any, i: number) => {
        ctx.globalAlpha = i === 0 ? 1 : 0.7;
        ctx.fillRect(seg.x * colSize, seg.y * rowSize, colSize, rowSize);
      });
      ctx.globalAlpha = 1;
    });
    // Draw food
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc(
      food.x * colSize + colSize / 2,
      food.y * rowSize + rowSize / 2,
      Math.min(colSize, rowSize) / 2.5,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }, [gameState, canvasSize]);

  if (!gameState) return <div className="text-center text-gray-400">Waiting for game state...</div>;
  const { width, height } = canvasSize;

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