import React, { useState, useEffect } from 'react';
import GameTitle from '../layout/GameTitle';
import UserAvatarButton from '../layout/UserAvatarButton';
import UserDropdown from '../layout/UserDropdown';
import MainMenuOptions from './MainMenuOptions';
import ChatButton from '../chat/ChatButton';
import SignInModal from './SignInModal';
import NDK, { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

// Extend the Window interface for nostr
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
    };
  }
}

const ndk = new NDK({
  explicitRelayUrls: ["wss://relay.nostr.band", "wss://relay.damus.io"]
});
ndk.connect();

async function fetchNostrProfile(pubkey: string): Promise<{ image?: string }> {
  try {
    const events = await ndk.fetchEvents({
      kinds: [NDKKind.Metadata],
      authors: [pubkey],
      limit: 1
    });
    const event = Array.from(events)[0] as NDKEvent | undefined;
    if (!event) return {};
    const content = JSON.parse(event.content);
    return { image: content.picture };
  } catch {
    return {};
  }
}

const PUBKEY_KEY = 'cdl_pubkey';
const IMAGE_KEY = 'cdl_image';

const PlayMenuOptions: React.FC<{ show: boolean; onBack: () => void }> = ({ show, onBack }) => (
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
      <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition">Create Match</button>
      <button className="w-full py-3 px-6 text-lg font-semibold rounded-full bg-black text-white hover:bg-gray-900 transition">Join by Code</button>
    </div>
  </div>
);

const MainMenu: React.FC = () => {
  const [menu, setMenu] = useState<'main' | 'play'>('main');
  const [hideMain, setHideMain] = useState(false);
  const [hidePlay, setHidePlay] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Restore login state on mount
  useEffect(() => {
    const savedPubkey = localStorage.getItem(PUBKEY_KEY);
    const savedImage = localStorage.getItem(IMAGE_KEY);
    if (savedPubkey) setUserPubkey(savedPubkey);
    if (savedImage) setUserImage(savedImage);
  }, []);

  // Persist login state when it changes
  useEffect(() => {
    if (userPubkey) {
      localStorage.setItem(PUBKEY_KEY, userPubkey);
      if (userImage) {
        localStorage.setItem(IMAGE_KEY, userImage);
      }
    } else {
      localStorage.removeItem(PUBKEY_KEY);
      localStorage.removeItem(IMAGE_KEY);
    }
  }, [userPubkey, userImage]);

  const handlePlay = () => {
    setHideMain(true);
    setTimeout(() => setMenu('play'), 500); // match transition duration
  };

  const handleBack = () => {
    setHidePlay(true);
    setTimeout(() => {
      setMenu('main');
      setHideMain(false);
      setHidePlay(false);
    }, 500);
  };

  const handleAvatarClick = () => {
    if (userPubkey) {
      setShowDropdown((prev) => !prev);
    } else {
      setShowLogin(true);
    }
  };
  const handleLoginClose = () => setShowLogin(false);
  const handleDropdownClose = () => setShowDropdown(false);
  const handleLogout = () => {
    setUserPubkey(null);
    setUserImage(null);
    setShowDropdown(false);
    localStorage.removeItem(PUBKEY_KEY);
    localStorage.removeItem(IMAGE_KEY);
  };

  const handleExtensionSignIn = async () => {
    if (window.nostr && window.nostr.getPublicKey) {
      try {
        const pubkey = await window.nostr.getPublicKey();
        setUserPubkey(pubkey);
        // Fetch profile image
        const profile = await fetchNostrProfile(pubkey);
        if (profile.image) setUserImage(profile.image);
        setShowLogin(false);
      } catch (e) {
        alert('Failed to sign in with extension.');
      }
    } else {
      alert('Nostr extension not found.');
    }
  };

  return (
    <div className="w-screen h-screen bg-black text-white font-mono flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-center w-full px-12 pt-8 relative">
        <GameTitle />
        <div className="relative">
          <UserAvatarButton onClick={handleAvatarClick} imageUrl={userImage || undefined} />
          <UserDropdown show={showDropdown} onClose={handleDropdownClose} onLogout={handleLogout} />
        </div>
      </div>
      <MainMenuOptions
        onPlay={handlePlay}
        hide={hideMain || menu === 'play'}
      />
      <PlayMenuOptions show={menu === 'play' && !hidePlay} onBack={handleBack} />
      <SignInModal show={showLogin && !userPubkey} onClose={handleLoginClose} onExtensionSignIn={handleExtensionSignIn} />
      <ChatButton />
    </div>
  );
};

export default MainMenu; 