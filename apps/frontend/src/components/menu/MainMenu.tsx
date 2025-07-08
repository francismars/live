import React, { useState } from 'react';
import GameTitle from '../layout/GameTitle';
import UserAvatarButton from '../layout/UserAvatarButton';
import UserDropdown from '../layout/UserDropdown';
import MainMenuOptions from './MainMenuOptions';
import ChatButton from '../chat/ChatButton';
import SignInModal from './SignInModal';
import PlayMenuOptions from './PlayMenuOptions';
import CreateMatchMenu from './CreateMatchMenu';
import UserProfileModal from '../profile/UserProfileModal';
import useNostrAuth from '../shared/useNostrAuth';
import ChatPanel from '../chat/ChatPanel';
import { getPublicKey, nip19 } from 'nostr-tools';
import GameLobby from './GameLobby';
import { useNavigate, useMatch } from 'react-router-dom';
import SignUpModal from './SignUpModal';
import KeySignInModal from './KeySignInModal';

const MainMenu: React.FC = () => {
  const [menu, setMenu] = useState<'main' | 'play'>('main');
  const [hideMain, setHideMain] = useState(false);
  const [hidePlay, setHidePlay] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateMatch, setShowCreateMatch] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showKeySignIn, setShowKeySignIn] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keySignInError, setKeySignInError] = useState<string | null>(null);
  const [lobbyOptions, setLobbyOptions] = useState<null | {
    gameType: 'normal' | 'ranked';
    stake: string;
    timeLimit: string;
    visibility: 'public' | 'private';
    allowSpectators: boolean;
    roomId: string;
  }>(null);
  const [showLobby, setShowLobby] = useState(false);
  const navigate = useNavigate();

  const {
    userPubkey,
    userPrivkey,
    userProfile,
    userImage,
    authMethod,
    signInWithExtension,
    signInWithKey,
    publishProfile,
    signOut,
  } = useNostrAuth();

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
    setShowDropdown(false);
    signOut();
  };

  const handleExtensionSignIn = async () => {
    const result = await signInWithExtension();
    if (result.success) {
      setShowLogin(false);
    } else {
      alert(result.error);
    }
  };

  const handleProfile = async () => {
    if (userPubkey) {
      setShowProfile(true);
    }
  };
  const handleProfileClose = () => setShowProfile(false);

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
      <CreateMatchMenu
        show={showCreateMatch}
        onBack={() => setShowCreateMatch(false)}
        onCreate={opts => {
          setShowCreateMatch(false);
          // Generate a unique roomId (browser-safe)
          const roomId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
          setLobbyOptions({ ...opts, roomId });
          setShowLobby(true);
          navigate(`/join/${roomId}`);
        }}
      />

      {/* Show GameLobby modal as overlay if /join/:roomId is active */}
      {(() => {
        const match = useMatch('/join/:roomId');
        const roomId = match?.params?.roomId;
        // Find the buyIn from lobbyOptions if this user is the creator
        let buyIn = 0;
        if (lobbyOptions && lobbyOptions.roomId === roomId) {
          buyIn = parseInt(lobbyOptions.stake, 10) || 0;
        }
        if (match && roomId) {
          const inviteLink = window.location.origin + '/join/' + roomId;
          return (
            <GameLobby
              gameType="normal"
              visibility="public"
              allowSpectators={true}
              inviteLink={inviteLink}
              onStart={() => {}}
              onCancel={() => { navigate('/'); }}
              userPubkey={userPubkey || ''}
              userPrivkey={userPrivkey}
              authMethod={authMethod}
              userProfile={userProfile}
              initialBuyIn={buyIn}
            />
          );
        }
        return null;
      })()}
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
      <SignUpModal
        show={showRegister}
        onClose={() => setShowRegister(false)}
        publishProfile={publishProfile}
      />
      <KeySignInModal
        show={showKeySignIn}
        onClose={() => setShowKeySignIn(false)}
        onSignIn={signInWithKey}
      />
    </div>
  );
};

export default MainMenu; 