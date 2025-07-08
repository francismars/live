import React, { useState } from 'react';

interface KeySignInModalProps {
  show: boolean;
  onClose: () => void;
  onSignIn: (privkey: string) => Promise<{ success: boolean; error?: string }>;
}

const KeySignInModal: React.FC<KeySignInModalProps> = ({ show, onClose, onSignIn }) => {
  const [keyInput, setKeyInput] = useState('');
  const [keySignInError, setKeySignInError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeySignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeySignInError(null);
    setLoading(true);
    const result = await onSignIn(keyInput.trim());
    setLoading(false);
    if (result.success) {
      setKeyInput('');
      onClose();
    } else {
      setKeySignInError(result.error || 'Invalid key');
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
        <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={() => { setKeyInput(''); setKeySignInError(null); onClose(); }} aria-label="Back to sign in">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="text-2xl font-bold mb-6">Sign In with Key</div>
        <form className="flex flex-col gap-3 w-full" onSubmit={handleKeySignIn}>
          <input
            className="px-3 py-2 rounded border"
            placeholder="Private Key (hex or nsec)"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" disabled={loading}>Sign In</button>
          {keySignInError && <div className="text-red-600 mt-2">{keySignInError}</div>}
        </form>
        <div className="text-xs text-gray-500 mt-2 text-center">Paste your 64-char hex or nsec1... private key</div>
      </div>
    </div>
  );
};

export default KeySignInModal; 