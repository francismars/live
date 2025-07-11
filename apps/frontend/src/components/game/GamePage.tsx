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
  
  // Get player profiles for display
  const playerPubkeys = gameState?.players?.map((p: any) => p.pubkey) || [];
  const profiles = useNostrProfiles(playerPubkeys);

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
      <div className="flex justify-between items-center w-full px-12 pt-8 relative">
        <div className="flex flex-col items-start">
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
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs mb-1">INITIAL DISTRIBUTION</div>
          <div className="w-32 h-2 bg-gray-700 rounded-full mx-auto mb-2">
            <div 
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ 
                width: `${gameState?.players?.[0] ? (gameState.players[0].initialSats || 1000) / ((gameState.players[0].initialSats || 1000) + (gameState.players[1]?.initialSats || 1000)) * 100 : 50}%` 
              }}
            />
          </div>
          <div className="text-xs mb-1">CURRENT DISTRIBUTION</div>
          <div className="w-32 h-2 bg-gray-700 rounded-full mx-auto mb-2">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ 
                width: `${gameState?.players?.[0] ? gameState.players[0].sats / (gameState.players[0].sats + (gameState.players[1]?.sats || 0)) * 100 : 50}%` 
              }}
            />
          </div>
        </div>
        <div className="flex flex-col items-end">
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
          onClick={onLeaveGame}
        >
          Leave Game
        </button>
      </div>
    </div>
  );
};

export default GamePage; 