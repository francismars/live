import React, { useEffect, useState, useRef } from 'react';
import SnakeGame from './SnakeGame';
import useNostrAuth from '../shared/useNostrAuth';
import useNostrProfiles from '../shared/useNostrProfiles';
import { socket } from '../../socket';

interface GamePageProps {
  roomId: string;
  onLeaveGame: () => void;
}

const GamePage: React.FC<GamePageProps> = ({ roomId, onLeaveGame }) => {
  const [gameState, setGameState] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { userPubkey } = useNostrAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Get player profiles for display
  const playerPubkeys = gameState?.players?.map((p: any) => p.pubkey) || [];
  const profiles = useNostrProfiles(playerPubkeys);

  // Determine if the current user is a player
  const isPlayer = !!gameState?.players?.find((p: any) => p.pubkey === userPubkey);

  useEffect(() => {
    if (!roomId) return;
    console.log('[GamePage] Joining game room:', roomId);
    console.log('[GamePage] Socket connected:', socket.connected);
    socket.emit('joinGame', { roomId });
    
    socket.on('gameState', (state) => {
      console.log('[GamePage] Received gameState:', state);
      setGameState(state);
    });
    
    socket.on('startCountdown', () => {
      console.log('[GamePage] Starting countdown');
      setCountdown(3);
    });
    
    // Add error handling
    socket.on('connect_error', (error) => {
      console.error('[GamePage] Socket connection error:', error);
    });
    socket.on('error', (error) => {
      console.error('[GamePage] Socket error:', error);
    });
    
    const handleKeyDown = (e: KeyboardEvent) => {
      let direction = null;
      if (e.key === 'ArrowUp' || e.key === 'w') direction = 'up';
      if (e.key === 'ArrowDown' || e.key === 's') direction = 'down';
      if (e.key === 'ArrowLeft' || e.key === 'a') direction = 'left';
      if (e.key === 'ArrowRight' || e.key === 'd') direction = 'right';
      if (direction && userPubkey) {
        e.preventDefault();
        socket.emit('playerInput', { roomId, pubkey: userPubkey, direction });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      socket.emit('leaveGame', { roomId });
      socket.off('gameState');
      socket.off('startCountdown');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [roomId, userPubkey]);

  // Countdown effect
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Countdown finished, start the game
      console.log('[GamePage] Countdown finished, starting game');
      if (roomId) {
        socket.emit('startGame', { roomId });
      }
      setCountdown(null);
    }
  }, [countdown, roomId]);

  return (
    <div className="w-full min-h-[600px] bg-black text-white font-mono flex flex-col justify-between relative overflow-hidden">
      {/* Top bar UI inspired by screenshot */}
      <div className="flex items-center w-full px-12 pt-8 gap-6">
        {/* Left player info */}
        <div className="flex flex-col items-start min-w-[120px]">
          <div className="font-bold text-2xl flex items-center gap-2">
            {gameState?.players?.[0] && (
              <>
                {profiles[gameState.players[0].pubkey]?.image ? (
                  <img 
                    src={profiles[gameState.players[0].pubkey].image} 
                    alt="Player 1" 
                    className="w-6 h-6 rounded-full object-cover border border-white mr-2" 
                  />
                ) : (
                  <span className="w-6 h-6 bg-white inline-block mr-2" />
                )}
                {profiles[gameState.players[0].pubkey]?.name || gameState.players[0].name || gameState.players[0].pubkey.slice(0, 8)}
              </>
            )}
          </div>
          <div className="text-xs font-bold mt-1">
            {gameState?.players?.[0]?.sats || 0} sats
            {typeof gameState?.players?.[0]?.capturePercent === 'number' && (
              <span className="ml-2 text-green-400">+{gameState.players[0].capturePercent}%</span>
            )}
          </div>
        </div>
        {/* Distribution bars */}
        <div className="flex flex-col flex-1 px-4">
          <div className="text-xs mb-1 text-center">INITIAL DISTRIBUTION</div>
          <div className="w-full h-1 bg-gray-700 rounded-full mb-2">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ 
                width: `${gameState?.players?.[0] ? (gameState.players[0].initialSats || 1000) / ((gameState.players[0].initialSats || 1000) + (gameState.players[1]?.initialSats || 1000)) * 100 : 50}%` 
              }}
            />
          </div>
          <div className="text-xs mb-1 text-center">CURRENT DISTRIBUTION</div>
          <div className="w-full h-3 bg-gray-700 rounded-full mb-2 flex overflow-hidden">
            {/* Player 1 (white) */}
            <div
              className="h-full bg-white transition-all duration-300 rounded-l-full"
              style={{
                width: `${gameState?.players?.[0] && gameState?.players?.[1] ? (gameState.players[0].sats / (gameState.players[0].sats + gameState.players[1].sats)) * 100 : 50}%`,
              }}
            />
            {/* Player 2 (dark gray) */}
            <div
              className="h-full bg-gray-700 transition-all duration-300 rounded-r-full"
              style={{
                width: `${gameState?.players?.[0] && gameState?.players?.[1] ? (gameState.players[1].sats / (gameState.players[0].sats + gameState.players[1].sats)) * 100 : 50}%`,
              }}
            />
          </div>
        </div>
        {/* Right player info */}
        <div className="flex flex-col items-end min-w-[120px]">
          <div className="font-bold text-2xl flex items-center gap-2">
            {gameState?.players?.[1] && (
              <>
                {profiles[gameState.players[1].pubkey]?.name || gameState.players[1].name || gameState.players[1].pubkey.slice(0, 8)}
                {profiles[gameState.players[1].pubkey]?.image ? (
                  <img 
                    src={profiles[gameState.players[1].pubkey].image} 
                    alt="Player 2" 
                    className="w-6 h-6 rounded-full object-cover border border-white ml-2" 
                  />
                ) : (
                  <span className="w-6 h-6 bg-black border border-white inline-block ml-2" />
                )}
              </>
            )}
          </div>
          <div className="text-xs font-bold mt-1">
            {gameState?.players?.[1]?.sats || 0} sats
            {typeof gameState?.players?.[1]?.capturePercent === 'number' && (
              <span className="ml-2 text-green-400">+{gameState.players[1].capturePercent}%</span>
            )}
          </div>
        </div>
      </div>
      {/* Game area */}
      <div className="flex-1 flex items-center justify-center relative">
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
              <div className="text-8xl font-extrabold text-white">
                {countdown}
              </div>
            </div>
          )}
          <SnakeGame gameState={gameState} />
      </div>
      {/* Bottom bar (optional, for block info, etc.) */}
      <div className="w-full flex justify-between items-center px-12 pb-4 text-xs text-gray-400">
        <div>LATEST BLOCK 904641</div>
        <div>FOUND 21 mins ago</div>
        <div>SIZE 1.57 Mb</div>
        <div>TX COUNT 3687</div>
        <div>MEDIAN FEE 4 sat/vb</div>
      </div>
      <div className="flex justify-center py-4">
        <button
          className="px-6 py-2 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
          onClick={() => setShowConfirm(true)}
        >
          {isPlayer ? 'Abandon Game' : 'Stop Watching'}
        </button>
        {showConfirm && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-white text-black rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 items-center min-w-[300px] relative">
              <div className="text-xl font-bold mb-2">
                {isPlayer ? 'Abandon Game?' : 'Stop Watching?'}
              </div>
              <div className="text-gray-600 mb-4">
                {isPlayer
                  ? 'Are you sure you want to abandon the game?'
                  : 'Stop watching and leave this game?'}
              </div>
              <div className="flex gap-4">
                <button
                  className="px-4 py-2 rounded bg-gray-300 text-black font-bold hover:bg-gray-400 transition"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
                  onClick={() => {
                    setShowConfirm(false);
                    onLeaveGame();
                  }}
                >
                  {isPlayer ? 'Abandon Game' : 'Stop Watching'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePage; 