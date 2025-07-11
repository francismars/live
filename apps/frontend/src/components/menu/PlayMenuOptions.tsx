import React, { useState } from 'react';
import useAnimatedPresence from '../shared/useAnimatedPresence';
import { useNavigate } from 'react-router-dom';

const PlayMenuOptions: React.FC<{ show: boolean; onBack: () => void; onCreateMatch: () => void }> = ({ show, onBack, onCreateMatch }) => {
  const isVisible = useAnimatedPresence(show);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    // Simulate a short delay for UX
    setTimeout(() => {
      setLoading(false);
      setShowJoinModal(false);
      navigate(`/join/${roomCode}`);
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
        <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition">Find Match</button>
        <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition" onClick={onCreateMatch}>Create Match</button>
        <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition" onClick={handleJoinByCode}>Join by Code</button>
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
      </div>
    </div>
  );
};

export default PlayMenuOptions; 