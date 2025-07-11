import React, { useRef, useState, useEffect } from 'react';
import { socket } from '../../socket';
import useNostrProfiles from '../shared/useNostrProfiles';
import axios from 'axios';
import QRCode from 'react-qr-code';

interface GameLobbyProps {
  gameType: 'normal' | 'ranked';
  visibility: 'public' | 'private';
  allowSpectators: boolean;
  inviteLink: string;
  onStart: () => void;
  onCancel: () => void;
  onGameStart?: () => void;
  userPubkey: string;
  userPrivkey: string | null;
  authMethod: 'extension' | 'key' | null;
  userProfile?: { name?: string; picture?: string };
  players?: { pubkey: string; name?: string; isYou?: boolean }[];
  spectators?: { pubkey: string; name?: string }[];
  initialBuyIn?: number;
}

// Helper to extract roomId from inviteLink
function getRoomIdFromInvite(inviteLink: string) {
  const parts = inviteLink.split('/');
  return parts[parts.length - 1];
}

const GameLobby: React.FC<GameLobbyProps> = ({
  gameType,
  visibility,
  allowSpectators,
  inviteLink,
  onStart,
  onCancel,
  onGameStart,
  userPubkey,
  userPrivkey,
  authMethod,
  userProfile,
  players,
  spectators,
  initialBuyIn,
  ...rest
}) => {
  // Minimal local chat state for the lobby
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live room state from backend
  const [playersState, setPlayersState] = useState<{ pubkey: string; name?: string; avatar?: string }[]>([]);
  const [spectatorsState, setSpectatorsState] = useState<{ pubkey: string; name?: string; avatar?: string }[]>([]);
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);

  // Fetch Nostr profiles for all users
  const allPubkeys = [
    ...playersState.map(p => p.pubkey),
    ...spectatorsState.map(s => s.pubkey)
  ];
  const profiles = useNostrProfiles(allPubkeys);

  // Registration/payment state
  const [registering, setRegistering] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [paymentHash, setPaymentHash] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Track buyIn from backend room state
  const [buyIn, setBuyIn] = useState<number>(0);

  // Determine if the current user is a spectator and can register
  const isSpectator = spectatorsState.some(s => s.pubkey === userPubkey);
  const isPlayer = playersState.some(p => p.pubkey === userPubkey);
  const canRegister = isSpectator && playersState.length < 2;
  const isReady = readyPlayers.includes(userPubkey);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debug readyPlayers changes
  useEffect(() => {
    console.log('[GameLobby] readyPlayers state changed:', readyPlayers);
  }, [readyPlayers]);

  // Socket.IO connection and room logic
  useEffect(() => {
    if (!userPubkey) return;
    const roomId = getRoomIdFromInvite(inviteLink);
    const user = {
      userId: userPubkey,
      name: userProfile?.name,
      avatar: userProfile?.picture,
    };
    // Only send buyIn if this is the creator and initialBuyIn is provided
    if (typeof initialBuyIn === 'number' && initialBuyIn > 0) {
      socket.emit('joinRoom', { roomId, user, buyIn: initialBuyIn });
    } else {
      socket.emit('joinRoom', { roomId, user });
    }
    const handleRoomState = (state: any) => {
      console.log('[GameLobby] Received room state:', state);
      setPlayersState(state.players.map((u: any) => ({ pubkey: u.userId, name: u.name, avatar: u.avatar })));
      setSpectatorsState(state.spectators.map((u: any) => ({ pubkey: u.userId, name: u.name, avatar: u.avatar })));
      if (typeof state.buyIn === 'number') setBuyIn(state.buyIn);
      if (state.readyPlayers) {
        console.log('[GameLobby] Setting ready players:', state.readyPlayers);
        setReadyPlayers(state.readyPlayers);
      }
    };
    socket.on('roomState', handleRoomState);
    
    // Listen for game start
    const handleGameStart = () => {
      console.log('[GameLobby] Game started, navigating to game page');
      if (onGameStart) {
        onGameStart(); // Call the parent's onGameStart function
      }
    };
    socket.on('gameStarted', handleGameStart);
    
    // Listen for lobbyChat messages
    const handleLobbyChat = (msg: { sender: string; text: string }) => {
      setMessages(prev => [...prev, msg]);
    };
    socket.on('lobbyChat', handleLobbyChat);

    return () => {
      socket.emit('leaveRoom', { roomId, userId: userPubkey });
      socket.off('roomState', handleRoomState);
      socket.off('gameStarted', handleGameStart);
      socket.off('lobbyChat', handleLobbyChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPubkey, inviteLink, initialBuyIn]);

  // Poll for registration confirmation
  useEffect(() => {
    if (!polling || !paymentHash) return;
    const interval = setInterval(() => {
      if (playersState.some(p => p.pubkey === userPubkey)) {
        setRegistering(false);
        setInvoice(null);
        setPaymentHash(null);
        setPolling(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, paymentHash, playersState, userPubkey]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const roomId = getRoomIdFromInvite(inviteLink);
    socket.emit('lobbyChat', { roomId, sender: userPubkey, text: input });
    setInput('');
  };

  // Handle register to play
  const handleRegisterToPlay = async () => {
    if (!buyIn) {
      // Free registration: emit registerToPlay event directly
      const roomId = getRoomIdFromInvite(inviteLink);
      socket.emit('registerToPlay', { roomId, userId: userPubkey });
      return;
    }
    setRegistering(true);
    setPaymentError(null);
    try {
      const amount = buyIn;
      const roomId = getRoomIdFromInvite(inviteLink);
      const resp = await axios.post('/api/create-lnurl', {
        roomId,
        userId: userPubkey,
        amount,
      });
      setInvoice(resp.data.payment_request);
      setPaymentHash(resp.data.payment_hash);
      setPolling(true);
    } catch (err: any) {
      setPaymentError(err.response?.data?.error || err.message || 'Failed to create invoice');
      setRegistering(false);
    }
  };

  return (
    <div className="fixed left-0 right-0 bottom-0 top-20 z-[100] flex items-center justify-center pointer-events-none">
      <div className="bg-white text-black rounded-2xl shadow-2xl px-10 py-8 min-w-[340px] max-w-[90vw] relative flex flex-col items-center w-[420px] pointer-events-auto mt-8">
        <div className="text-2xl font-bold mb-4">Game Lobby</div>
        <div className="mb-2 text-sm">
          <span className="font-semibold">Game Type:</span> {gameType.charAt(0).toUpperCase() + gameType.slice(1)}<br />
          <span className="font-semibold">Visibility:</span> {visibility.charAt(0).toUpperCase() + visibility.slice(1)}<br />
          <span className="font-semibold">Spectators:</span> {allowSpectators ? 'Allowed' : 'Not allowed'}
        </div>
        <div className="w-full flex flex-col gap-2 mb-4">
          <div className="font-semibold">Players:</div>
          <ul className="pl-4 flex flex-col gap-1">
            {playersState.map(p => {
              const profile = profiles[p.pubkey];
              const isReady = readyPlayers.includes(p.pubkey);
              return (
                <li key={p.pubkey} className={p.pubkey === userPubkey ? 'font-bold text-blue-700 flex items-center gap-2' : 'flex items-center gap-2'}>
                  {profile?.image && <img src={profile.image} alt="avatar" className="w-6 h-6 rounded-full object-cover border" />}
                  {profile?.name || p.name || p.pubkey.slice(0, 8)}{p.pubkey === userPubkey ? ' (You)' : ''}
                  {isReady && <span className="text-green-600 text-xs font-bold">✓ Ready</span>}
                </li>
              );
            })}
          </ul>
          <div className="font-semibold mt-2">Spectators:</div>
          <ul className="pl-4 flex flex-col gap-1">
            {spectatorsState.length === 0 ? <li className="text-gray-400">None yet</li> : spectatorsState.map(s => {
              const profile = profiles[s.pubkey];
              const isCurrentUser = s.pubkey === userPubkey;
              return (
                <li key={s.pubkey} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {profile?.image && <img src={profile.image} alt="avatar" className="w-6 h-6 rounded-full object-cover border" />}
                    {profile?.name || s.name || s.pubkey.slice(0, 8)}
                  </div>
                  {isCurrentUser && canRegister && !registering && (
                    <button
                      className="w-fit py-1 px-3 rounded bg-blue-600 text-white font-bold text-xs mt-1"
                      onClick={handleRegisterToPlay}
                    >
                      {buyIn ? `Register to Play (${buyIn} sats)` : 'Register to Play (Free)'}
                    </button>
                  )}
                  {isCurrentUser && registering && invoice && (
                    <div className="w-full flex flex-col items-center mb-2 mt-2">
                      <div className="font-semibold mb-2">Pay Buy-in ({buyIn} sats)</div>
                      <QRCode value={invoice} size={180} />
                      <div className="break-all text-xs bg-gray-100 rounded p-2 mt-2">{invoice}</div>
                      <div className="text-xs text-gray-500 mt-2">Waiting for payment confirmation...</div>
                      <button className="mt-2 text-sm text-blue-600 underline" onClick={() => { setRegistering(false); setInvoice(null); setPaymentHash(null); setPolling(false); }}>Cancel</button>
                    </div>
                  )}
                  {isCurrentUser && paymentError && <div className="text-red-500 text-xs mb-2">{paymentError}</div>}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="w-full flex items-center gap-2 mb-4">
          <input type="text" readOnly value={getRoomIdFromInvite(inviteLink)} className="flex-1 px-2 py-1 rounded border text-xs bg-gray-100" />
          <button className="px-2 py-1 rounded bg-black text-white text-xs font-semibold" onClick={() => {navigator.clipboard.writeText(getRoomIdFromInvite(inviteLink))}}>Copy</button>
        </div>
        {/* Custom minimal chat UI */}
        <div className="w-full mb-4 flex flex-col">
          <div className="font-semibold text-sm mb-1">Lobby Chat</div>
          <div className="h-32 overflow-y-auto bg-gray-50 rounded border p-2 text-sm mb-2" style={{ minHeight: 80 }}>
            {messages.length === 0 && <div className="text-gray-400 text-xs">No messages yet.</div>}
            {messages.map((msg, i) => {
              const profile = profiles[msg.sender];
              return (
                <div key={i} className="mb-1 flex items-center gap-2">
                  {profile?.image && <img src={profile.image} alt="avatar" className="w-5 h-5 rounded-full object-cover border" />}
                  <span className="font-bold text-xs text-gray-600">{profile?.name || msg.sender.slice(0, 8)}:</span> {msg.text}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              className="flex-1 border rounded p-2 text-sm"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className="px-3 py-2 rounded bg-black text-white font-bold text-sm" disabled={!input.trim()}>Send</button>
          </form>
        </div>
        <div className="flex w-full gap-2 mt-2">
          <button className="flex-1 py-2 rounded bg-gray-200 text-black font-semibold" onClick={onCancel}>Cancel</button>
          <button 
            className={`flex-1 py-2 rounded font-bold ${
              isReady
                ? 'bg-green-600 text-white'
                : playersState.length >= 2
                ? 'bg-blue-600 text-white'
                : 'bg-gray-400 text-gray-600'
            }`} 
            onClick={onStart}
            disabled={playersState.length < 2}
          >
            {playersState.length < 2 
              ? 'Waiting for players...' 
              : isReady
                ? '✓ Ready'
                : 'Click to Ready'
            }
          </button>
        </div>
        {/* Status message */}
        {playersState.length >= 2 && (
          <div className="text-sm text-center mt-2">
            {readyPlayers.length === playersState.length 
              ? '🎮 Game will start automatically!'
              : `Waiting for ${playersState.length - readyPlayers.length} more player${playersState.length - readyPlayers.length === 1 ? '' : 's'} to be ready...`
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLobby; 