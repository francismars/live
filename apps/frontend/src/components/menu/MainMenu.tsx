import React, { useState } from 'react';
import GameTitle from '../layout/GameTitle';
import UserAvatarButton from '../layout/UserAvatarButton';
import UserDropdown from '../layout/UserDropdown';
import MainMenuOptions from './MainMenuOptions';
import ChatButton from '../chat/ChatButton';
import SignInModal from './SignInModal';
import PlayMenuOptions from './PlayMenuOptions';
import CreateLobbyMenu from './CreateLobbyMenu';
import type { CreateLobbyMenuProps } from './CreateLobbyMenu';
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
    gameType: 'normal';
    stake: string;
    timeLimit: string;
    allowSpectators: boolean;
    roomId: string;
  }>(null);
  const [showLobby, setShowLobby] = useState(false);
  const navigate = useNavigate();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [inLobby, setInLobby] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [matchmakingStatus, setMatchmakingStatus] = useState<'idle' | 'waiting' | 'error' | 'found'>('idle');
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [pendingMatchRoomId, setPendingMatchRoomId] = useState<string | null>(null);
  const [hasAcceptedMatch, setHasAcceptedMatch] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [activeGames, setActiveGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

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

  const handleWatch = () => {
    setShowWatchModal(true);
    setLoadingGames(true);
    socket.emit('getActiveGames', (games: any[]) => {
      setActiveGames(games);
      setLoadingGames(false);
    });
  };
  const handleJoinAsSpectator = (roomId: string) => {
    setActiveRoomId(roomId);
    setInLobby(false);
    setGameStarted(true);
    setShowWatchModal(false);
  };

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

  React.useEffect(() => {
    function handleMatchmakingStatus(data: { status: string; message?: string }) {
      if (data.status === 'waiting') {
        setMatchmakingStatus('waiting');
        setMatchmakingError(null);
      } else if (data.status === 'error') {
        setMatchmakingStatus('error');
        setMatchmakingError(data.message || 'Matchmaking error');
      } else if (data.status === 'cancelled') {
        setMatchmakingStatus('idle');
        setMatchmakingError(null);
      }
    }
    function handleMatchFound(data: { roomId: string }) {
      setMatchmakingStatus('found');
      setPendingMatchRoomId(data.roomId);
      setHasAcceptedMatch(false);
      // Do NOT setActiveRoomId or setInLobby yet
    }
    function handleGameStarted() {
      if (pendingMatchRoomId) {
        setActiveRoomId(pendingMatchRoomId);
        setPendingMatchRoomId(null);
        setHasAcceptedMatch(false);
        setInLobby(false);
        setGameStarted(true);
      } else {
        setGameStarted(true);
        setInLobby(false);
      }
    }
    socket.on('matchmakingStatus', handleMatchmakingStatus);
    socket.on('matchFound', handleMatchFound);
    socket.on('gameStarted', handleGameStarted);
    return () => {
      socket.off('matchmakingStatus', handleMatchmakingStatus);
      socket.off('matchFound', handleMatchFound);
      socket.off('gameStarted', handleGameStarted);
    };
  }, [pendingMatchRoomId]);

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

  React.useEffect(() => {
    if (!showWatchModal) return;
    // Fetch immediately
    socket.emit('getActiveGames', (games: any[]) => setActiveGames(games));
    // Poll every 2 seconds
    const interval = setInterval(() => {
      socket.emit('getActiveGames', (games: any[]) => setActiveGames(games));
    }, 2000);
    return () => clearInterval(interval);
  }, [showWatchModal]);

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
          <MainMenuOptions onPlay={handlePlay} onWatch={handleWatch} hide={hideMain || menu === 'play'} />
          <PlayMenuOptions
            show={menu === 'play' && !hidePlay}
            onBack={handleBack}
            onCreateMatch={() => setShowCreateMatch(true)}
            onJoinGame={code => {
              setActiveRoomId(code);
              setInLobby(true);
              setGameStarted(false);
            }}
            onFindMatch={prefs => {
              if (!userPubkey) {
                setMatchmakingStatus('error');
                setMatchmakingError('You must be signed in to find a match.');
                return;
              }
              setMatchmakingStatus('waiting');
              setMatchmakingError(null);
              socket.emit('findMatch', {
                userId: userPubkey,
                name: userProfile?.name,
                avatar: userProfile?.image,
                gameType: prefs.gameType,
                buyIn: prefs.buyIn,
                allowSpectators: prefs.allowSpectators,
              });
            }}
          />
          {/* Show matchmaking status */}
          {matchmakingStatus === 'waiting' && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-60 z-50">
              <div className="bg-white text-black rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 items-center min-w-[300px] relative">
                <div className="text-xl font-bold mb-2">Finding a Match...</div>
                <div className="text-gray-600">Waiting for another player with similar preferences.</div>
                <button className="mt-4 px-4 py-2 rounded bg-gray-300 text-black font-bold" onClick={() => {
                  setMatchmakingStatus('idle');
                  setMatchmakingError(null);
                  socket.emit('cancelMatchmaking', { userId: userPubkey });
                }}>Cancel</button>
              </div>
            </div>
          )}
          {matchmakingStatus === 'error' && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-60 z-50">
              <div className="bg-white text-black rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 items-center min-w-[300px] relative">
                <div className="text-xl font-bold mb-2 text-red-600">Matchmaking Error</div>
                <div className="text-gray-600">{matchmakingError}</div>
                <button className="mt-4 px-4 py-2 rounded bg-gray-300 text-black font-bold" onClick={() => setMatchmakingStatus('idle')}>Close</button>
              </div>
            </div>
          )}
          {matchmakingStatus === 'found' && pendingMatchRoomId && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-60 z-50">
              <div className="bg-white text-black rounded-2xl shadow-2xl px-8 py-6 flex flex-col gap-4 items-center min-w-[300px] relative">
                <div className="text-xl font-bold mb-2">Match Found!</div>
                <div className="text-gray-600">Press Accept to start. Waiting for both players to accept.</div>
                <button
                  className={`mt-4 px-4 py-2 rounded font-bold ${hasAcceptedMatch ? 'bg-green-600 text-white' : 'bg-black text-white'}`}
                  disabled={hasAcceptedMatch}
                  onClick={() => {
                    if (pendingMatchRoomId && userPubkey) {
                      socket.emit('acceptMatch', { roomId: pendingMatchRoomId, userId: userPubkey });
                      setHasAcceptedMatch(true);
                    }
                  }}
                >
                  {hasAcceptedMatch ? 'Waiting for opponent...' : 'Accept'}
                </button>
              </div>
            </div>
          )}
          <CreateLobbyMenu
            show={showCreateMatch}
            onBack={() => setShowCreateMatch(false)}
            onCreate={(opts: Parameters<CreateLobbyMenuProps['onCreate']>[0]) => {
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
          {/* Watch Modal */}
          {showWatchModal && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
              <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[400px] max-w-[90vw] flex flex-col items-center gap-6 relative">
                <button className="absolute top-4 right-4 text-black hover:text-gray-700 text-2xl font-bold px-2 py-1 rounded-full focus:outline-none" onClick={() => setShowWatchModal(false)} aria-label="Close">
                  ×
                </button>
                <div className="text-2xl font-bold mb-2">Active Games</div>
                {loadingGames ? (
                  <div className="text-gray-500">Loading games...</div>
                ) : activeGames.length === 0 ? (
                  <div className="text-gray-500">No active games right now.</div>
                ) : (
                  <div className="flex flex-col gap-4 w-full">
                    {activeGames.map(game => (
                      <div key={game.roomId} className="bg-gray-100 rounded-xl p-4 flex flex-col gap-2 shadow hover:shadow-lg transition cursor-pointer" onClick={() => handleJoinAsSpectator(game.roomId)}>
                        {/* Player vs Player row */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center font-bold text-lg">
                              {game.players[0]?.name?.[0] || '?'}
                            </div>
                            <div className="font-bold">{game.players[0]?.name || 'Player 1'}</div>
                            <div className="text-xs text-gray-500">{game.players[0]?.sats} sats</div>
                          </div>
                          <div className="font-mono text-lg font-bold text-gray-500">VS</div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold">{game.players[1]?.name || 'Player 2'}</div>
                            <div className="text-xs text-gray-500">{game.players[1]?.sats} sats</div>
                            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-bold text-lg text-white">
                              {game.players[1]?.name?.[0] || '?'}
                            </div>
                          </div>
                        </div>
                        {/* Distribution bar */}
                        <div className="w-full h-3 bg-gray-300 rounded-full flex overflow-hidden mt-2">
                          <div
                            className="h-full bg-white rounded-l-full transition-all duration-300"
                            style={{ width: `${game.players[0] && game.players[1] ? (game.players[0].sats / (game.players[0].sats + game.players[1].sats)) * 100 : 50}%` }}
                          />
                          <div
                            className="h-full bg-gray-700 rounded-r-full transition-all duration-300"
                            style={{ width: `${game.players[0] && game.players[1] ? (game.players[1].sats / (game.players[0].sats + game.players[1].sats)) * 100 : 50}%` }}
                          />
                        </div>
                        {/* Preferences */}
                        <div className="flex gap-4 text-xs text-gray-600 mt-1">
                          <div>Buy-in: <span className="font-bold text-black">{game.preferences.buyIn} sats</span></div>
                          <div>Allow Spectators: <span className="font-bold text-black">{game.preferences.allowSpectators ? 'Yes' : 'No'}</span></div>
                        </div>
                        <div className="flex justify-end mt-2">
                          <button className="px-4 py-1 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 transition">Watch</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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