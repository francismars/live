import React, { useState, useEffect } from 'react';
import GameTitle from '../layout/GameTitle';
import UserAvatarButton from '../layout/UserAvatarButton';
import UserDropdown from '../layout/UserDropdown';
import MainMenuOptions from './MainMenuOptions';
import ChatButton from '../chat/ChatButton';
import SignInModal from './SignInModal';
import PlayMenuOptions from './PlayMenuOptions';
import CreateMatchMenu from './CreateMatchMenu';
import UserProfileModal from '../profile/UserProfileModal';
import useAnimatedPresence from '../shared/useAnimatedPresence';
import fetchNostrProfile from '../shared/nostrProfile';
import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools';
import ChatPanel from '../chat/ChatPanel';
import { ndk } from '../shared/nostrProfile';
import { NDKEvent } from '@nostr-dev-kit/ndk';

const PUBKEY_KEY = 'cdl_pubkey';
const IMAGE_KEY = 'cdl_image';
const PROFILE_KEY = 'cdl_profile';

type AuthMethod = 'extension' | 'key' | null;

const MainMenu: React.FC = () => {
  const [menu, setMenu] = useState<'main' | 'play'>('main');
  const [hideMain, setHideMain] = useState(false);
  const [hidePlay, setHidePlay] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [userPubkey, setUserPubkey] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPrivkey, setUserPrivkey] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showKeySignIn, setShowKeySignIn] = useState(false);
  const [registerStep, setRegisterStep] = useState<'form' | 'showKeys' | 'review' | 'publishing' | 'done'>('form');
  const [profileForm, setProfileForm] = useState({
    name: '',
    display_name: '',
    about: '',
    picture: '',
    nip05: '',
    lud16: '',
    website: '',
    banner: '',
  });
  const [generatedKeys, setGeneratedKeys] = useState<{ priv: string; pub: string } | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keySignInError, setKeySignInError] = useState<string | null>(null);

  // Restore login state on mount
  useEffect(() => {
    const savedPubkey = localStorage.getItem(PUBKEY_KEY);
    const savedImage = localStorage.getItem(IMAGE_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);
    if (savedPubkey) setUserPubkey(savedPubkey);
    if (savedImage) setUserImage(savedImage);
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
  }, []);

  // Persist login state when it changes
  useEffect(() => {
    if (userPubkey) {
      localStorage.setItem(PUBKEY_KEY, userPubkey);
      if (userImage) {
        localStorage.setItem(IMAGE_KEY, userImage);
      }
      if (userProfile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(userProfile));
      }
    } else {
      localStorage.removeItem(PUBKEY_KEY);
      localStorage.removeItem(IMAGE_KEY);
      localStorage.removeItem(PROFILE_KEY);
    }
  }, [userPubkey, userImage, userProfile]);

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
    setUserProfile(null);
    setShowDropdown(false);
    setUserPrivkey(null);
    setAuthMethod(null);
    localStorage.removeItem(PUBKEY_KEY);
    localStorage.removeItem(IMAGE_KEY);
    localStorage.removeItem(PROFILE_KEY);
  };

  const handleExtensionSignIn = async () => {
    if (window.nostr && window.nostr.getPublicKey) {
      try {
        const pubkey = await window.nostr.getPublicKey();
        setUserPubkey(pubkey);
        // Fetch profile image and info
        const profile = await fetchNostrProfile(pubkey);
        if (profile.image) setUserImage(profile.image);
        setUserProfile(profile);
        setShowLogin(false);
        setUserPrivkey(null);
        setAuthMethod('extension');
      } catch (e) {
        alert('Failed to sign in with extension.');
      }
    } else {
      alert('Nostr extension not found.');
    }
  };

  const handleProfile = async () => {
    if (userPubkey) {
      // Always fetch latest profile on open
      const profile = await fetchNostrProfile(userPubkey);
      setUserProfile(profile);
      setShowProfile(true);
    }
  };
  const handleProfileClose = () => setShowProfile(false);

  const handleProfileFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  function generateNostrPrivateKey(): string {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToUint8Array(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
    const arr = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return arr;
  }

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.picture.trim()) {
      return;
    }
    // Generate keypair
    const priv = generateNostrPrivateKey();
    const pub = getPublicKey(hexToUint8Array(priv));
    setGeneratedKeys({ priv, pub });
    setRegisterStep('showKeys');
  };

  const handleRegisterDone = () => {
    setRegisterStep('review');
  };

  const handlePublishProfile = async () => {
    if (!generatedKeys) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const unsignedEvent = {
        kind: 0,
        content: JSON.stringify(profileForm),
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        pubkey: generatedKeys.pub,
      };
      const signedEvent = finalizeEvent(unsignedEvent, hexToUint8Array(generatedKeys.priv));
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();
      setUserPubkey(generatedKeys.pub);
      setUserProfile(profileForm);
      setUserImage(profileForm.picture);
      setUserPrivkey(generatedKeys.priv);
      setAuthMethod('key');
      setRegisterStep('done');
    } catch (e: any) {
      setPublishError(e.message || 'Failed to publish profile');
    } finally {
      setPublishing(false);
    }
  };

  const handleKeySignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeySignInError(null);
    let priv: string;
    let pub: string;
    try {
      let input = keyInput.trim();
      if (input.startsWith('nsec')) {
        // decode nsec
        const decoded = nip19.decode(input);
        if (decoded.type !== 'nsec' || typeof decoded.data !== 'string') throw new Error('Invalid nsec');
        priv = decoded.data;
      } else {
        // hex
        if (!/^[0-9a-fA-F]{64}$/.test(input)) throw new Error('Invalid hex private key');
        priv = input;
      }
      pub = getPublicKey(hexToUint8Array(priv));
      setUserPubkey(pub);
      // Fetch profile from Nostr
      const profile = await fetchNostrProfile(pub);
      setUserProfile(profile);
      if (profile.image) setUserImage(profile.image);
      setUserPrivkey(priv);
      setAuthMethod('key');
      setShowKeySignIn(false);
      setKeyInput('');
    } catch (err: any) {
      setKeySignInError(err.message || 'Invalid key');
    }
  };

  return (
    <div className="w-screen h-screen bg-black text-white font-mono flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-center w-full px-12 pt-8 relative">
        <GameTitle />
        <div className="relative">
          <UserAvatarButton onClick={handleAvatarClick} imageUrl={userImage || undefined} />
          <UserDropdown show={showDropdown} onClose={handleDropdownClose} onLogout={handleLogout} onProfile={handleProfile} />
        </div>
      </div>
      <MainMenuOptions
        onPlay={handlePlay}
        hide={hideMain || menu === 'play'}
      />
      <PlayMenuOptions show={menu === 'play' && !hidePlay} onBack={handleBack} onCreateMatch={() => setShowCreateMatch(true)} />
      <CreateMatchMenu show={showCreateMatch} onBack={() => setShowCreateMatch(false)} />
      <SignInModal
        show={showLogin && !userPubkey}
        onClose={handleLoginClose}
        onExtensionSignIn={handleExtensionSignIn}
        onKeySignIn={() => { setShowLogin(false); setShowKeySignIn(true); }}
        onRegister={() => { setShowLogin(false); setShowRegister(true); }}
      />
      <UserProfileModal show={showProfile} onClose={handleProfileClose} pubkey={userPubkey || ''} profile={userProfile} />
      {showChat && <ChatPanel onClose={() => setShowChat(false)} userPubkey={userPubkey} userPrivkey={userPrivkey} authMethod={authMethod} />}
      <ChatButton onClick={() => setShowChat((open) => !open)} />
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
            <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={() => { setShowRegister(false); setRegisterStep('form'); setGeneratedKeys(null); }} aria-label="Back to sign in">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            {registerStep === 'form' && (
              <>
                <div className="text-2xl font-bold mb-6">Register</div>
                <form className="flex flex-col gap-3 w-full" onSubmit={handleRegisterSubmit}>
                  <input className="px-3 py-2 rounded border" name="name" placeholder="Name *" value={profileForm.name} onChange={handleProfileFormChange} required style={{ borderColor: !profileForm.name.trim() ? 'red' : undefined }} />
                  <input className="px-3 py-2 rounded border" name="display_name" placeholder="Display Name" value={profileForm.display_name} onChange={handleProfileFormChange} />
                  <textarea className="px-3 py-2 rounded border" name="about" placeholder="About" value={profileForm.about} onChange={handleProfileFormChange} />
                  <input className="px-3 py-2 rounded border" name="picture" placeholder="Profile Picture URL *" value={profileForm.picture} onChange={handleProfileFormChange} required style={{ borderColor: !profileForm.picture.trim() ? 'red' : undefined }} />
                  <input className="px-3 py-2 rounded border" name="banner" placeholder="Banner URL" value={profileForm.banner} onChange={handleProfileFormChange} />
                  <input className="px-3 py-2 rounded border" name="nip05" placeholder="NIP-05 (e.g. alice@nostr.com)" value={profileForm.nip05} onChange={handleProfileFormChange} />
                  <input className="px-3 py-2 rounded border" name="lud16" placeholder="Lightning Address (lud16)" value={profileForm.lud16} onChange={handleProfileFormChange} />
                  <input className="px-3 py-2 rounded border" name="website" placeholder="Website" value={profileForm.website} onChange={handleProfileFormChange} />
                  <button type="submit" className="mt-4 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" disabled={!profileForm.name.trim() || !profileForm.picture.trim()}>Generate Keys & Continue</button>
                  <div className="text-xs text-red-600 mt-1">* Name and Profile Picture URL are required</div>
                </form>
              </>
            )}
            {registerStep === 'showKeys' && generatedKeys && (
              <>
                <div className="text-2xl font-bold mb-4">Backup Your Keys</div>
                <div className="mb-2 text-sm text-gray-700">Save your private key somewhere safe. You will need it to log in again. <span className="text-red-600 font-bold">Do not share it!</span></div>
                <div className="w-full break-all bg-gray-100 rounded p-2 mb-2"><b>Public Key:</b><br />{generatedKeys.pub}</div>
                <div className="w-full break-all bg-yellow-100 rounded p-2 mb-4"><b>Private Key:</b><br />{generatedKeys.priv}</div>
                <button className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" onClick={handleRegisterDone}>I have backed up my keys</button>
              </>
            )}
            {registerStep === 'review' && generatedKeys && (
              <>
                <div className="text-2xl font-bold mb-4">Review Profile</div>
                <div className="flex flex-col items-center w-full gap-2 mb-4">
                  <img src={profileForm.picture} alt="Profile" className="w-24 h-24 rounded-full object-cover border-2 border-black" />
                  <div className="font-bold text-lg">{profileForm.name}</div>
                  {profileForm.display_name && <div className="text-gray-700">{profileForm.display_name}</div>}
                  {profileForm.about && <div className="text-gray-600 text-center">{profileForm.about}</div>}
                  {profileForm.banner && <img src={profileForm.banner} alt="Banner" className="w-full max-w-xs h-16 object-cover rounded" />}
                  {profileForm.nip05 && <div className="text-xs text-gray-400">NIP-05: {profileForm.nip05}</div>}
                  {profileForm.lud16 && <div className="text-xs text-gray-400">Lightning: {profileForm.lud16}</div>}
                  {profileForm.website && <div className="text-xs text-blue-600 underline">{profileForm.website}</div>}
                </div>
                <button className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" onClick={handlePublishProfile} disabled={publishing}>Confirm & Publish to Nostr</button>
                <button className="mt-2 px-6 py-2 rounded bg-gray-200 text-black hover:bg-gray-300 transition font-bold" onClick={() => setRegisterStep('form')}>Edit</button>
                {publishError && <div className="text-red-600 mt-2">{publishError}</div>}
              </>
            )}
            {registerStep === 'publishing' && (
              <div className="text-lg font-bold">Publishing profile to Nostr...</div>
            )}
            {registerStep === 'done' && (
              <>
                <div className="text-2xl font-bold mb-4">Profile Published!</div>
                <div className="mb-4">Your profile has been published to Nostr. You can now use your account.</div>
                <button className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold" onClick={() => { setShowRegister(false); setRegisterStep('form'); setGeneratedKeys(null); }}>Close</button>
              </>
            )}
          </div>
        </div>
      )}
      {showKeySignIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center">
            <button className="absolute top-4 left-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={() => { setShowKeySignIn(false); setKeyInput(''); setKeySignInError(null); }} aria-label="Back to sign in">
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
              <button type="submit" className="mt-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-900 transition font-bold">Sign In</button>
              {keySignInError && <div className="text-red-600 mt-2">{keySignInError}</div>}
            </form>
            <div className="text-xs text-gray-500 mt-2 text-center">Paste your 64-char hex or nsec1... private key</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainMenu; 