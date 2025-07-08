import React from 'react';
import { nip19 } from 'nostr-tools';
import useAnimatedPresence from '../shared/useAnimatedPresence';

const UserProfileModal: React.FC<{ show: boolean; onClose: () => void; pubkey: string; profile: any; }> = ({ show, onClose, pubkey, profile }) => {
  const isVisible = useAnimatedPresence(show);
  if (!isVisible) return null;
  let npub = '';
  try {
    npub = pubkey ? nip19.npubEncode(pubkey) : '';
  } catch {
    npub = pubkey;
  }
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 transition-all duration-500 ${show ? 'scale-100 opacity-100' : 'scale-75 opacity-0 pointer-events-none'}`}>
      <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
        <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={onClose} aria-label="Close profile modal">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        {(profile?.image || profile?.picture) && (
          <img src={profile.image || profile.picture} alt="User avatar" className="w-24 h-24 rounded-full mb-4 object-cover border-2 border-black" />
        )}
        <div className="text-xl font-bold mb-2">{profile?.name || 'Nostr User'}</div>
        <div className="text-xs text-gray-500 break-all mb-2">{npub}</div>
        {profile?.about && <div className="mb-2 text-center text-gray-700">{profile.about}</div>}
        {profile?.nip05 && <div className="mb-2 text-xs text-gray-400">NIP-05: {profile.nip05}</div>}
        {profile?.lud16 && <div className="mb-2 text-xs text-gray-400">Lightning: {profile.lud16}</div>}
        <button className="mt-4 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default UserProfileModal; 