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
import { useNavigate } from 'react-router-dom';
import SignUpModal from './SignUpModal';
import KeySignInModal from './KeySignInModal';
import { socket } from '../../socket';
import GamePage from '../game/GamePage';

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
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [inLobby, setInLobby] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

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

  // Listen for gameStarted event when in a lobby
  React.useEffect(() => {
    if (!activeRoomId || !inLobby) return;
    const handleGameStarted = () => {
      setGameStarted(true);
      setInLobby(false);
    };
    // Listen for gameStarted event from backend
    socket.on('gameStarted', handleGameStarted);
    return () => {
      socket.off('gameStarted', handleGameStarted);
    };
  }, [activeRoomId, inLobby]);

  // When leaving lobby/game, navigate to main menu
  const handleLeaveLobby = () => {
    setActiveRoomId(null);
    setInLobby(false);
    setGameStarted(false);
    navigate('/');
  };
  const handleLeaveGame = () => {
    setActiveRoomId(null);
    setGameStarted(false);
    navigate('/');
  };

  // Helper to generate an 8-character lobby code (A-Z, 2-9, no O/0/I/1)
  function generateLobbyId(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  return (
    <div className="w-screen h-screen bg-black text-white font-mono flex flex-col justify-between relative overflow-hidden">
      <div className="flex justify-between items-center w-full px-12 pt-8 relative">
        <GameTitle />
        <div className="relative flex items-center gap-2">
          <button
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg focus:outline-none border-2 border-transparent hover:border-black hover:bg-gray-100 transition overflow-hidden"
            onClick={() => setShowChat((open) => !open)}
            aria-label="Open chat"
            type="button"
          >
            <ChatButton />
          </button>
          <UserAvatarButton onClick={handleAvatarClick} imageUrl={userImage || undefined} />
          <UserDropdown show={showDropdown} onClose={handleDropdownClose} onLogout={handleLogout} onProfile={handleProfile} />
          {showChat && (
            <div className="absolute top-16 right-0 mt-2 z-50">
              <ChatPanel onClose={() => setShowChat(false)} userPubkey={userPubkey} userPrivkey={userPrivkey} authMethod={authMethod} />
            </div>
          )}
        </div>
      </div>
      {/* Lobby/Game area */}
      {activeRoomId && inLobby && !gameStarted && (
        <div className="flex flex-col items-center justify-center flex-1 w-full">
          <GameLobby
            gameType="normal"
            visibility="public"
            allowSpectators={true}
            inviteLink={window.location.origin + '/join/' + activeRoomId}
            onStart={() => {
              if (activeRoomId && userPubkey) {
                socket.emit('playerReady', { roomId: activeRoomId, userId: userPubkey });
              }
            }}
            onCancel={handleLeaveLobby}
            userPubkey={userPubkey || ''}
            userPrivkey={userPrivkey}
            authMethod={authMethod}
            userProfile={userProfile ?? undefined}
            initialBuyIn={0}
            onGameStart={() => { setGameStarted(true); setInLobby(false); }}
          />
        </div>
      )}
      {activeRoomId && gameStarted && (
        <div className="flex flex-col items-center justify-center flex-1 w-full">
          <GamePage roomId={activeRoomId} onLeaveGame={handleLeaveGame} />
        </div>
      )}
      {/* Main menu, only shown if not in a game or lobby */}
      {!activeRoomId && !inLobby && !gameStarted && (
        <>
          <MainMenuOptions onPlay={handlePlay} hide={hideMain || menu === 'play'} />
          <PlayMenuOptions
            show={menu === 'play' && !hidePlay}
            onBack={handleBack}
            onCreateMatch={() => setShowCreateMatch(true)}
            onJoinGame={code => {
              setActiveRoomId(code);
              setInLobby(true);
              setGameStarted(false);
            }}
          />
          <CreateMatchMenu
            show={showCreateMatch}
            onBack={() => setShowCreateMatch(false)}
            onCreate={opts => {
              setShowCreateMatch(false);
              // Generate a user-friendly 8-character lobby code
              const roomId = generateLobbyId();
              setLobbyOptions({ ...opts, roomId });
              setShowLobby(true);
              setActiveRoomId(roomId);
              setInLobby(true);
              setGameStarted(false);
            }}
          />
        </>
      )}
      {/* Remove all useMatch and navigate logic for /game/:roomId */}
      {/* Remove GameLobby modal overlay logic */}
      <SignInModal
        show={showLogin && !userPubkey}
        onClose={handleLoginClose}
        onExtensionSignIn={handleExtensionSignIn}
        onKeySignIn={() => { setShowLogin(false); setShowKeySignIn(true); }}
        onRegister={() => { setShowLogin(false); setShowRegister(true); }}
      />
      <UserProfileModal show={showProfile} onClose={handleProfileClose} pubkey={userPubkey || ''} profile={userProfile} />
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