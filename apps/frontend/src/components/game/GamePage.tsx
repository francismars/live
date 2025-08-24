import React, { useEffect, useState, useRef } from 'react';
import SnakeGame from './SnakeGame';
import useNostrAuth from '../shared/useNostrAuth';
import useNostrProfiles from '../shared/useNostrProfiles';
import { socket } from '../../socket';

// Custom hook for fetching mempool data
const useMempoolData = () => {
  const [mempoolData, setMempoolData] = useState<{
    latestBlock: number;
    latestBlockTime: number;
    latestBlockSize: number;
    latestBlockTxCount: number;
    medianFee: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMempoolData = async () => {
      try {
        console.log('[useMempoolData] Fetching mempool data...');
        setLoading(true);
        setError(null);
        
        // Fetch latest block info - use the recent blocks endpoint instead
        console.log('[useMempoolData] Fetching recent blocks...');
        const blocksResponse = await fetch('https://mempool.space/api/blocks');
        if (!blocksResponse.ok) {
          throw new Error(`Blocks fetch failed: ${blocksResponse.status}`);
        }
        const blocks = await blocksResponse.json();
        const latestBlock = blocks[0]; // First block is the latest
        console.log('[useMempoolData] Latest block:', latestBlock);
        
        // Fetch fee estimates
        console.log('[useMempoolData] Fetching fee estimates...');
        const feesResponse = await fetch('https://mempool.space/api/v1/fees/recommended');
        if (!feesResponse.ok) {
          throw new Error(`Fees fetch failed: ${feesResponse.status}`);
        }
        const fees = await feesResponse.json();
        console.log('[useMempoolData] Fee estimates:', fees);
        
        const data = {
          latestBlock: latestBlock.height,
          latestBlockTime: latestBlock.timestamp,
          latestBlockSize: Math.round(latestBlock.size / 1024 / 1024 * 100) / 100, // Convert to MB
          latestBlockTxCount: latestBlock.tx_count,
          medianFee: fees.halfHourFee || 4 // Default to 4 if not available
        };
        
        console.log('[useMempoolData] Setting mempool data:', data);
        setMempoolData(data);
        setLoading(false);
      } catch (error) {
        console.error('[useMempoolData] Failed to fetch mempool data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
        
        // Set fallback data
        setMempoolData({
          latestBlock: 904641,
          latestBlockTime: Math.floor(Date.now() / 1000) - 120, // 2 minutes ago
          latestBlockSize: 1.57,
          latestBlockTxCount: 3687,
          medianFee: 4
        });
      }
    };

    // Fetch immediately
    fetchMempoolData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchMempoolData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { mempoolData, loading, error };
};

// Confetti component for winner celebration
const Confetti: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const confetti: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
    }> = [];
    
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    
    // Create confetti pieces
    for (let i = 0; i < 100; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 3 + 2
      });
    }
    
    let animationId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      confetti.forEach((piece, index) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.1; // gravity
        
        if (piece.y > canvas.height) {
          piece.y = -10;
          piece.x = Math.random() * canvas.width;
        }
        
        ctx.fillStyle = piece.color;
        ctx.fillRect(piece.x, piece.y, piece.size, piece.size);
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};

interface GamePageProps {
  roomId: string;
  onLeaveGame: () => void;
  onReturnToLobby?: () => void;
}

const GamePage: React.FC<GamePageProps> = ({ roomId, onLeaveGame, onReturnToLobby }) => {
  const [gameState, setGameState] = useState<any>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { userPubkey } = useNostrAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const [lastRunningGameState, setLastRunningGameState] = useState<any>(null);
  const [showEnded, setShowEnded] = useState(false);
  const [showWinnerScreen, setShowWinnerScreen] = useState(false);
  const [winner, setWinner] = useState<any>(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchAccepted, setRematchAccepted] = useState(false);
  const [gameStats, setGameStats] = useState<{
    duration: number;
    totalMoves: number;
    territoryCaptured: number;
  }>({ duration: 0, totalMoves: 0, territoryCaptured: 0 });
  
  // Game stats tracking
  const gameStartTime = useRef<number>(0);
  const moveCount = useRef<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(300); // 5 minutes in seconds
  
  // Mempool data hook
  const { mempoolData, loading: mempoolLoading, error: mempoolError } = useMempoolData();
  
  // Helper function to format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };
  
  // Timer countdown effect
  useEffect(() => {
    if (gameState?.status === 'running' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [gameState?.status, timeRemaining]);
  
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
      console.log('[GamePage] Game status:', state?.status);
      console.log('[GamePage] Winner:', state?.winner);
      console.log('[GamePage] Players:', state?.players);
      console.log('[GamePage] Current gameState:', gameState);
      console.log('[GamePage] Current lastRunningGameState:', lastRunningGameState);
      
      if (state?.status === 'running') {
        console.log('[GamePage] Setting game to running state');
        setGameState(state);
        setLastRunningGameState(state); // Always update the last running state
        setHasGameStarted(true);
        setShowEnded(false);
        setShowWinnerScreen(false);
        setRematchRequested(false);
        setRematchAccepted(false);
        
        // Start tracking game stats
        if (!gameStartTime.current) {
          gameStartTime.current = Date.now();
          moveCount.current = 0;
          setTimeRemaining(300); // Reset timer to 5 minutes
        }
      } else if (state?.status === 'ended') {
        console.log('[GamePage] Game ended! Winner:', state.winner);
        console.log('[GamePage] Final state players:', state.players);
        
        // Capture the last running frame immediately when game ends
        if (lastRunningGameState && !showEnded) {
          console.log('[GamePage] Capturing last running frame');
          setLastRunningGameState(lastRunningGameState);
        }
        
        // Show the last running frame for 700ms, then show ended
        setGameState(state); // Still update for winner info
        setShowEnded(false);
        setShowWinnerScreen(false);
        
        // Calculate final game stats
        if (gameStartTime.current) {
          const duration = Math.round((Date.now() - gameStartTime.current) / 1000);
          const territoryCaptured = state.players?.reduce((total: number, p: any) => total + (p.sats || 0), 0) || 0;
          setGameStats({
            duration,
            totalMoves: moveCount.current,
            territoryCaptured
          });
        }
        
        // Determine winner
        if (state.winner) {
          const winnerPlayer = state.players?.find((p: any) => p.pubkey === state.winner);
          console.log('[GamePage] Winner player found:', winnerPlayer);
          setWinner(winnerPlayer);
        } else {
          console.log('[GamePage] No winner found in game state');
        }
        
        // Show winner screen after a short delay to let the last frame be visible
        setTimeout(() => {
          console.log('[GamePage] Showing winner screen now');
          setShowEnded(true);
          setShowWinnerScreen(true);
        }, 1000); // Increased from 700ms to 1000ms for better visibility
      } else {
        console.log('[GamePage] Setting other game state:', state?.status);
        setGameState(state);
        // Reset stats for new game
        if (state?.status === 'waiting') {
          gameStartTime.current = 0;
          moveCount.current = 0;
          setGameStats({ duration: 0, totalMoves: 0, territoryCaptured: 0 });
        }
      }
    });
    
    socket.on('startCountdown', () => {
      console.log('[GamePage] Starting countdown');
      setCountdown(3);
    });

    socket.on('countdownTick', (tick) => {
      setCountdown(tick);
    });

    // Handle rematch requests
    socket.on('rematchRequested', ({ requesterId }) => {
      if (requesterId !== userPubkey) {
        setRematchRequested(true);
      }
    });

    socket.on('rematchAccepted', () => {
      setRematchAccepted(true);
      // Reset game state for new game
      setTimeout(() => {
        setShowWinnerScreen(false);
        setRematchRequested(false);
        setRematchAccepted(false);
      }, 2000);
    });

    socket.on('rematchDeclined', () => {
      setRematchRequested(false);
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
        moveCount.current++;
        socket.emit('playerInput', { roomId, pubkey: userPubkey, direction });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      if (hasGameStarted) {
        socket.emit('leaveGame', { roomId });
      }
      socket.off('gameState');
      socket.off('startCountdown');
      socket.off('countdownTick');
      socket.off('rematchRequested');
      socket.off('rematchAccepted');
      socket.off('rematchDeclined');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [roomId, userPubkey, hasGameStarted]);

  // Handle rematch request
  const handleRematchRequest = () => {
    socket.emit('requestRematch', { roomId, requesterId: userPubkey });
    setRematchRequested(true);
  };

  // Handle rematch response
  const handleRematchResponse = (accept: boolean) => {
    if (accept) {
      socket.emit('respondToRematch', { roomId, userId: userPubkey, accept: true });
      setRematchAccepted(true);
      setRematchRequested(false);
    } else {
      socket.emit('respondToRematch', { roomId, userId: userPubkey, accept: false });
      setRematchRequested(false);
    }
  };

  // Play winner celebration sound
  useEffect(() => {
    if (showWinnerScreen && winner) {
      // Create a simple celebration sound using Web Audio API
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Play a victory melody
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        oscillator.frequency.setValueAtTime(1046.50, audioContext.currentTime + 0.3); // C6
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      } catch (error) {
        console.log('Audio not supported or blocked');
      }
    }
  }, [showWinnerScreen, winner]);

  // Decide which game state to render: last running frame if just ended and not showEnded yet
  const renderGameState = (() => {
    if (gameState?.status === 'ended' && lastRunningGameState && !showEnded) {
      // Show the last running frame with "running" status so SnakeGame renders it properly
      console.log('[GamePage] Rendering last running frame:', lastRunningGameState);
      return { ...lastRunningGameState, status: 'running' };
    }
    console.log('[GamePage] Rendering current game state:', gameState);
    return gameState;
  })();

  return (
    <div className="w-full min-h-[600px] bg-black text-white font-mono flex flex-col justify-between relative overflow-hidden">
      {/* Top bar UI inspired by screenshot */}
      {!showWinnerScreen && (
        <>
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
            
            {/* Game Timer */}
            {gameState?.status === 'running' && (
              <div className="flex flex-col items-center min-w-[80px]">
                <div className="text-xs text-gray-400 mb-1">TIME REMAINING</div>
                <div className={`text-2xl font-bold ${timeRemaining <= 60 ? 'text-red-500' : timeRemaining <= 120 ? 'text-yellow-500' : 'text-white'} ${timeRemaining <= 60 ? 'animate-pulse' : ''}`}>
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </div>
                {/* Time progress bar */}
                <div className="w-full h-1 bg-gray-700 rounded-full mt-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      timeRemaining <= 60 ? 'bg-red-500' : 
                      timeRemaining <= 120 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${(timeRemaining / 300) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
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
                      <span className="w-6 h-6 bg-black border border-white ml-2" />
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
        </>
      )}
      
      {/* Game area */}
      <div className="flex-1 flex items-center justify-center relative">
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
              <div className="text-8xl font-extrabold text-white">
                {countdown}
              </div>
            </div>
          )}
          
          {/* Winner Screen Overlay */}
          {showWinnerScreen && winner && (
            <>
              <Confetti />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-20">
                <div className="text-center max-w-md mx-auto p-8">
                  {/* Winner Celebration */}
                  <div className="mb-8">
                    <div className="text-6xl mb-4">🎉</div>
                    <div className="text-3xl font-bold text-yellow-400 mb-2">
                      {winner.pubkey === userPubkey ? 'YOU WIN!' : 'GAME OVER'}
                    </div>
                    <div className="text-xl text-gray-300 mb-4">
                      {winner.pubkey === userPubkey 
                        ? 'Congratulations! You captured the most territory!'
                        : `${profiles[winner.pubkey]?.name || winner.name || winner.pubkey.slice(0, 8)} wins!`
                      }
                      {timeRemaining === 0 && (
                        <div className="text-sm text-yellow-400 mt-2">
                          Game ended due to time limit
                        </div>
                      )}
                    </div>
                    
                    {/* Winner Stats */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6">
                      <div className="text-sm text-gray-400 mb-2">WINNER STATS</div>
                      <div className="text-lg font-bold">{winner.sats} sats captured</div>
                      {typeof winner.capturePercent === 'number' && (
                        <div className="text-sm text-green-400">+{winner.capturePercent}% territory</div>
                      )}
                    </div>
                    
                    {/* Game Stats */}
                    <div className="bg-gray-800 rounded-lg p-4 mb-6">
                      <div className="text-sm text-gray-400 mb-2">GAME STATISTICS</div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold">{gameStats.duration}s</div>
                          <div className="text-xs text-gray-400">Duration</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{gameStats.totalMoves}</div>
                          <div className="text-xs text-gray-400">Total Moves</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{gameStats.territoryCaptured}</div>
                          <div className="text-xs text-gray-400">Territory</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {isPlayer && !rematchRequested && !rematchAccepted && (
                      <button
                        onClick={handleRematchRequest}
                        className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Request Rematch
                      </button>
                    )}
                    
                    {rematchRequested && !rematchAccepted && (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-400">Waiting for opponent...</div>
                        <button
                          onClick={() => handleRematchResponse(false)}
                          className="w-full px-6 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Decline Rematch
                        </button>
                      </div>
                    )}
                    
                    {rematchAccepted && (
                      <div className="text-lg text-green-400 font-bold">
                        Rematch starting soon...
                      </div>
                    )}
                    
                    {onReturnToLobby && (
                      <button
                        onClick={onReturnToLobby}
                        className="w-full px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Return to Lobby
                      </button>
                    )}
                    
                    <button
                      onClick={onLeaveGame}
                      className="w-full px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Leave Game
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* Only show SnakeGame when not showing winner screen */}
          {!showWinnerScreen && (
            <SnakeGame gameState={renderGameState} />
          )}
      </div>
      
      {/* Bottom bar (optional, for block info, etc.) */}
      {!showWinnerScreen && (
        <div className="w-full flex justify-between items-center px-12 pb-4 text-xs text-gray-400">
          <div>
            LATEST BLOCK {mempoolLoading ? '...' : mempoolData?.latestBlock || '...'}
          </div>
          <div>
            FOUND {mempoolLoading ? '...' : mempoolData?.latestBlockTime ? formatTimeAgo(mempoolData.latestBlockTime) : '...'}
          </div>
          <div>
            SIZE {mempoolLoading ? '...' : mempoolData?.latestBlockSize ? `${mempoolData.latestBlockSize} Mb` : '...'}
          </div>
          <div>
            TX COUNT {mempoolLoading ? '...' : mempoolData?.latestBlockTxCount || '...'}
          </div>
          <div>
            MEDIAN FEE {mempoolLoading ? '...' : mempoolData?.medianFee ? `${mempoolData.medianFee} sat/vb` : '...'}
          </div>
        </div>
      )}
      
      {/* Abandon Game Button - Only show when not showing winner screen */}
      {!showWinnerScreen && (
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
                    className="px-6 py-2 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition"
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
      )}
    </div>
  );
};

export default GamePage; 