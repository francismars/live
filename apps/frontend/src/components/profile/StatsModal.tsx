import React, { useEffect, useState } from 'react';
import useNostrAuth from '../shared/useNostrAuth';
import useNostrProfiles from '../shared/useNostrProfiles';
import { socket } from '../../socket';

interface GameResult {
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
}

interface PlayerStats {
  pubkey: string;
  name?: string;
  mmr: number;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalSatsWon: number;
  totalSatsLost: number;
  averageGameDuration: number;
  longestWinStreak: number;
  currentWinStreak: number;
  gameHistory: GameResult[];
}

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose }) => {
  const { userPubkey } = useNostrAuth();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user profile for name and avatar
  const userProfiles = useNostrProfiles(userPubkey ? [userPubkey] : []);
  const userProfile = userProfiles[userPubkey || ''];

  useEffect(() => {
    if (isOpen && userPubkey) {
      fetchPlayerStats();
    }
  }, [isOpen, userPubkey]);

  const fetchPlayerStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Request stats from backend with profile info
      socket.emit('requestPlayerStats', { 
        pubkey: userPubkey,
        name: userProfile?.name,
        avatar: userProfile?.image
      });
      
      // Listen for stats response
      socket.once('playerStats', (playerStats: PlayerStats) => {
        setStats(playerStats);
        setLoading(false);
      });
      
      // Listen for stats error
      socket.once('playerStatsError', (errorMsg: string) => {
        setError(errorMsg);
        setLoading(false);
      });
      
    } catch (err) {
      setError('Failed to fetch stats');
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return 'text-green-500';
      case 'loss': return 'text-red-500';
      case 'draw': return 'text-yellow-500';
      default: return 'text-gray-400';
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win': return '🏆';
      case 'loss': return '💀';
      case 'draw': return '🤝';
      default: return '❓';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
      <div className="bg-white text-black rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold">Player Statistics</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-gray-600">Loading statistics...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-lg mb-4">{error}</div>
              <button
                onClick={fetchPlayerStats}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* Player Info & MMR */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden">
                    {userProfile?.image ? (
                      <img 
                        src={userProfile.image} 
                        alt="Player Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      stats.name?.charAt(0) || stats.pubkey.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{stats.name || userProfile?.name || 'Anonymous Player'}</h3>
                    <p className="text-blue-100 text-sm">{stats.pubkey.slice(0, 8)}...{stats.pubkey.slice(-8)}</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">{stats.mmr}</div>
                  <div className="text-blue-100">MMR Rating</div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalGames}</div>
                  <div className="text-sm text-gray-600">Total Games</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.winRate}%</div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.currentWinStreak}</div>
                  <div className="text-sm text-gray-600">Win Streak</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{formatDuration(stats.averageGameDuration)}</div>
                  <div className="text-sm text-gray-600">Avg Duration</div>
                </div>
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Win/Loss Breakdown */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-lg mb-3">Game Results</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-600">Wins</span>
                      <span className="font-bold">{stats.wins}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Losses</span>
                      <span className="font-bold">{stats.losses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600">Draws</span>
                      <span className="font-bold">{stats.draws}</span>
                    </div>
                  </div>
                </div>

                {/* Sats Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-bold text-lg mb-3">Sats Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-600">Total Won</span>
                      <span className="font-bold">{stats.totalSatsWon.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Total Lost</span>
                      <span className="font-bold">{stats.totalSatsLost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-bold">Net</span>
                      <span className={`font-bold ${stats.totalSatsWon - stats.totalSatsLost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(stats.totalSatsWon - stats.totalSatsLost).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Game History */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-bold text-lg mb-3">Recent Games</h4>
                {stats.gameHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No games played yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {stats.gameHistory.map((game) => (
                      <div key={game.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getResultIcon(game.result)}</span>
                          <div>
                            <div className="font-medium">
                              vs {game.opponentName || game.opponent.slice(0, 8)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatTimestamp(game.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${getResultColor(game.result)}`}>
                            {game.result.toUpperCase()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {game.sats} - {game.opponentSats} sats
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDuration(game.duration)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StatsModal;
