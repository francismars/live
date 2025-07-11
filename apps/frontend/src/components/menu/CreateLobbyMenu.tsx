import React, { useState } from 'react';
import useAnimatedPresence from '../shared/useAnimatedPresence';

export interface CreateLobbyMenuProps {
  show: boolean;
  onBack: () => void;
  onCreate: (options: {
    gameType: 'normal';
    stake: string;
    timeLimit: string;
    allowSpectators: boolean;
  }) => void;
}

const CreateLobbyMenu: React.FC<CreateLobbyMenuProps> = ({ show, onBack, onCreate }) => {
  const isVisible = useAnimatedPresence(show);
  const [gameType, setGameType] = useState<'normal'>('normal');
  const [stake, setStake] = useState('');
  const [timeLimit, setTimeLimit] = useState('5');
  // Remove visibility state
  // const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [allowSpectators, setAllowSpectators] = useState(true);

  if (!isVisible) return null;
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 transition-all duration-500 ${show ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
      <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
        <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={onBack} aria-label="Back to play menu">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-2xl font-bold mb-6">Create Lobby</div>
        <div>
          <div className="mb-1 font-semibold">Game Type:</div>
          <div className="flex gap-3">
            <button className="px-4 py-2 rounded-full font-semibold border bg-black text-white transition" disabled>Normal</button>
          </div>
        </div>
        <div>
          <div className="mb-1 font-semibold">Stake Amount (sats):</div>
          <input type="number" min="0" value={stake} onChange={e => setStake(e.target.value)} className="w-full px-3 py-2 rounded border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black" placeholder="0" />
        </div>
        <div>
          <div className="mb-1 font-semibold">Time Limit (minutes):</div>
          <input type="number" min="1" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="w-full px-3 py-2 rounded border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black" />
        </div>
        {/* Remove visibility option */}
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={allowSpectators}
            onChange={e => setAllowSpectators(e.target.checked)}
            className="accent-black"
          />
          Allow Spectators
        </label>
        <button
          className="mt-8 w-full py-3 rounded-full bg-black text-white font-bold text-lg hover:bg-gray-900 transition"
          onClick={() => {
            onCreate({
              gameType: 'normal',
              stake,
              timeLimit,
              // visibility: visibility, // removed
              allowSpectators,
            });
          }}
        >
          Create Lobby
        </button>
      </div>
    </div>
  );
};

export default CreateLobbyMenu; 