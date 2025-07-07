import React, { useState } from 'react';
import useAnimatedPresence from '../shared/useAnimatedPresence';

const CreateMatchMenu: React.FC<{ show: boolean; onBack: () => void }> = ({ show, onBack }) => {
  const isVisible = useAnimatedPresence(show);
  const [gameType, setGameType] = useState<'normal' | 'ranked'>('normal');
  const [stake, setStake] = useState('');
  const [timeLimit, setTimeLimit] = useState('5');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');

  if (!isVisible) return null;
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 transition-all duration-500 ${show ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
      <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
        <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={onBack} aria-label="Back to play menu">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-2xl font-bold mb-6">Create Match</div>
        <div className="w-full flex flex-col gap-4">
          <div>
            <div className="mb-1 font-semibold">Game Type:</div>
            <div className="flex gap-3">
              <button onClick={() => setGameType('normal')} className={`px-4 py-2 rounded-full font-semibold border ${gameType === 'normal' ? 'bg-black text-white' : 'bg-gray-100 text-black'} transition`}>Normal</button>
              <button onClick={() => setGameType('ranked')} className={`px-4 py-2 rounded-full font-semibold border ${gameType === 'ranked' ? 'bg-black text-white' : 'bg-gray-100 text-black'} transition`}>Ranked</button>
            </div>
          </div>
          <div>
            <div className="mb-1 font-semibold">Stake Amount (sats or tokens):</div>
            <input type="number" min="0" value={stake} onChange={e => setStake(e.target.value)} className="w-full px-3 py-2 rounded border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black" placeholder="0" />
          </div>
          <div>
            <div className="mb-1 font-semibold">Time Limit (minutes):</div>
            <input type="number" min="1" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="w-full px-3 py-2 rounded border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black" />
          </div>
          <div>
            <div className="mb-1 font-semibold">Visibility:</div>
            <div className="flex gap-3">
              <button onClick={() => setVisibility('private')} className={`px-4 py-2 rounded-full font-semibold border ${visibility === 'private' ? 'bg-black text-white' : 'bg-gray-100 text-black'} transition`}>Private</button>
              <button onClick={() => setVisibility('public')} className={`px-4 py-2 rounded-full font-semibold border ${visibility === 'public' ? 'bg-black text-white' : 'bg-gray-100 text-black'} transition`}>Public</button>
            </div>
          </div>
        </div>
        <button className="mt-8 w-full py-3 rounded-full bg-black text-white font-bold text-lg hover:bg-gray-900 transition">Create Game</button>
      </div>
    </div>
  );
};

export default CreateMatchMenu; 