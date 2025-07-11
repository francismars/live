import React, { useState } from 'react';
import useAnimatedPresence from '../shared/useAnimatedPresence';
// No navigate import needed

// Modal for match preferences
const MatchPreferencesModal: React.FC<{
  show: boolean;
  onConfirm: (prefs: { gameType: 'normal' | 'ranked'; buyIn: number; allowSpectators: boolean }) => void;
  onCancel: () => void;
}> = ({ show, onConfirm, onCancel }) => {
  const [gameType, setGameType] = useState<'normal' | 'ranked'>('normal');
  const [buyIn, setBuyIn] = useState(0);
  const [allowSpectators, setAllowSpectators] = useState(true);
  if (!show) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-40">
      <div className="bg-white text-black rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 items-center min-w-[300px] relative">
        <div className="text-xl font-bold mb-2">Match Preferences</div>
        <div className="flex flex-col gap-2 w-full">
          <label className="font-semibold">Game Type:</label>
          <div className="flex gap-4">
            <label><input type="radio" name="gameType" value="normal" checked={gameType === 'normal'} onChange={() => setGameType('normal')} /> Normal</label>
            <label><input type="radio" name="gameType" value="ranked" checked={gameType === 'ranked'} onChange={() => setGameType('ranked')} /> Ranked</label>
          </div>
          <label className="font-semibold mt-2">Buy-in:</label>
          <div className="flex gap-2">
            {[0, 100, 500, 1000].map(val => (
              <button key={val} type="button" className={`px-3 py-1 rounded ${buyIn === val ? 'bg-black text-white' : 'bg-gray-200 text-black'}`} onClick={() => setBuyIn(val)}>{val} sats</button>
            ))}
          </div>
          <label className="font-semibold mt-2">Allow Spectators:</label>
          <div className="flex gap-4">
            <label><input type="radio" name="allowSpectators" checked={allowSpectators} onChange={() => setAllowSpectators(true)} /> Yes</label>
            <label><input type="radio" name="allowSpectators" checked={!allowSpectators} onChange={() => setAllowSpectators(false)} /> No</label>
          </div>
        </div>
        <div className="flex gap-4 mt-4">
          <button className="px-4 py-2 rounded bg-black text-white font-bold" onClick={() => onConfirm({ gameType, buyIn, allowSpectators })}>Start Matchmaking</button>
          <button className="px-4 py-2 rounded bg-gray-300 text-black font-bold" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

interface PlayMenuOptionsProps {
  show: boolean;
  onBack: () => void;
  onCreateMatch: () => void;
  onJoinGame: (roomId: string) => void;
  onFindMatch?: (prefs: { gameType: 'normal' | 'ranked'; buyIn: number; allowSpectators: boolean }) => void;
}

const PlayMenuOptions: React.FC<PlayMenuOptionsProps> = ({ show, onBack, onCreateMatch, onJoinGame, onFindMatch }) => {
  const isVisible = useAnimatedPresence(show);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  // const navigate = useNavigate(); // Removed as per edit hint

  if (!isVisible) return null;

  const handleJoinByCode = () => {
    setShowJoinModal(true);
    setRoomCode('');
    setError('');
  };

  const handleModalClose = () => {
    setShowJoinModal(false);
    setRoomCode('');
    setError('');
    setLoading(false);
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      setLoading(false);
      setShowJoinModal(false);
      if (roomCode) {
        onJoinGame(roomCode);
      }
    }, 300);
  };

  return (
    <div
      className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-500 ${
        show ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white text-black rounded-2xl shadow-2xl px-12 py-10 flex flex-col gap-6 items-center min-w-[320px] relative">
        <button
          className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none"
          onClick={onBack}
          aria-label="Back to main menu"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-2xl font-bold mb-4">Play</div>
        <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition" onClick={() => setShowPrefsModal(true)}>Find Match</button>
        <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition" onClick={onCreateMatch}>Create Lobby</button>
        <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition" onClick={handleJoinByCode}>Join Lobby</button>
        {showJoinModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-30">
            <div className="bg-white text-black rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 items-center min-w-[300px] relative">
              <button
                className="absolute top-2 right-2 text-black hover:text-gray-700 text-xl font-bold px-2 py-1 rounded-full focus:outline-none"
                onClick={handleModalClose}
                aria-label="Close join modal"
              >
                ×
              </button>
              <div className="text-xl font-bold mb-2">Enter Room Code</div>
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-2 w-full items-center">
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value)}
                  className="border border-gray-400 rounded px-4 py-2 w-full text-lg"
                  placeholder="Room code..."
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  className="w-full py-2 px-4 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition disabled:opacity-50"
                  disabled={loading || !roomCode}
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </button>
                {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
              </form>
            </div>
          </div>
        )}
        <MatchPreferencesModal
          show={showPrefsModal}
          onConfirm={prefs => {
            setShowPrefsModal(false);
            if (onFindMatch) onFindMatch(prefs);
          }}
          onCancel={() => setShowPrefsModal(false)}
        />
      </div>
    </div>
  );
};

export default PlayMenuOptions; 