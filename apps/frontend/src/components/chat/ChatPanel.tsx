import React, { useEffect, useRef, useState } from 'react';
import { ndk } from '../shared/nostrProfile';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import fetchNostrProfile from '../shared/nostrProfile';
import { finalizeEvent } from 'nostr-tools';

// Replace with your actual global room event ID and relay
const GLOBAL_ROOM_EVENT_ID = 'f412192fdc846952c75058e911d37a7392aa7fd2e727330f4344badc92fb8a22'; // TODO: Replace with real event id
const GLOBAL_ROOM_RELAY = 'wss://relay.nostr.band';

interface ChatMessage {
  id: string;
  pubkey: string;
  content: string;
  created_at: number;
}

interface ChatPanelProps {
  onClose: () => void;
  userPubkey: string | null;
  userPrivkey: string | null;
  authMethod: 'extension' | 'key' | null;
}

// Helper to extract image URLs from text
function extractImageUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/(?:[\w-]+\.)+[\w-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?\.(?:jpg|jpeg|png|gif|webp))(\?[^\s]*)?/gi;
  const matches = text.match(urlRegex);
  return matches || [];
}

// Helper to remove image URLs from text
function removeImageUrls(text: string, imageUrls: string[]): string {
  let result = text;
  imageUrls.forEach(url => {
    // Remove the URL, and any leading/trailing whitespace
    result = result.replace(url, '').replace(/\s{2,}/g, ' ');
  });
  return result.trim();
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onClose, userPubkey, userPrivkey, authMethod }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profiles, setProfiles] = useState<Record<string, { name?: string; image?: string }>>({});

  useEffect(() => {
    setLoading(true);
    setError(null);
    const sub = ndk.subscribe({
      kinds: [42],
      '#e': [GLOBAL_ROOM_EVENT_ID],
      limit: 50,
    }, { closeOnEose: false });
    const handler = (event: any) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.id)) return prev;
        return [...prev, {
          id: event.id,
          pubkey: event.pubkey,
          content: event.content,
          created_at: event.created_at,
        }].sort((a, b) => a.created_at - b.created_at);
      });
    };
    sub.on('event', handler);
    sub.on('eose', () => setLoading(false));
    return () => sub.stop();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch sender profiles for all unique pubkeys in messages
  useEffect(() => {
    const uniquePubkeys = Array.from(new Set(messages.map(m => m.pubkey)));
    uniquePubkeys.forEach(pubkey => {
      if (!profiles[pubkey]) {
        fetchNostrProfile(pubkey).then(profile => {
          setProfiles(prev => ({ ...prev, [pubkey]: profile }));
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !userPubkey) return;
    try {
      const unsignedEvent = {
        kind: 42,
        content: input,
        tags: [
          ['e', GLOBAL_ROOM_EVENT_ID],
          ['r', GLOBAL_ROOM_RELAY],
        ],
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
      };
      let signedEvent;
      if (authMethod === 'extension' && window.nostr && window.nostr.signEvent) {
        signedEvent = await window.nostr.signEvent(unsignedEvent);
      } else if (authMethod === 'key' && userPrivkey) {
        // Convert privkey to Uint8Array if needed
        const hexToUint8Array = (hex: string) => {
          if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
          const arr = new Uint8Array(hex.length / 2);
          for (let i = 0; i < hex.length; i += 2) {
            arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
          }
          return arr;
        };
        signedEvent = finalizeEvent(unsignedEvent, hexToUint8Array(userPrivkey));
      } else {
        throw new Error('No signing method available');
      }
      const ndkEvent = new NDKEvent(ndk, signedEvent);
      await ndkEvent.publish();
      setInput('');
    } catch {
      setError('Failed to send message.');
    }
  };

  return (
    <div className="absolute bottom-28 right-12 w-80 bg-white text-black rounded-xl shadow-2xl p-4 z-30 flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">Global Chat</span>
        <button onClick={onClose} className="text-gray-500 hover:text-black text-2xl leading-none">&times;</button>
      </div>
      <div className="max-h-64 min-h-40 overflow-y-auto mb-2 bg-gray-50 rounded p-2 text-sm text-gray-700 flex-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        {loading && <div className="text-center text-xs text-gray-400">Loading...</div>}
        {error && <div className="text-center text-xs text-red-500">{error}</div>}
        {messages.map((msg) => {
          const imageUrls = extractImageUrls(msg.content);
          const cleanedText = removeImageUrls(msg.content, imageUrls);
          return (
            <div key={msg.id} className="mb-2">
              <span className="font-bold text-xs text-gray-600">
                {profiles[msg.pubkey]?.name
                  ? profiles[msg.pubkey].name
                  : msg.pubkey.slice(0, 8)}
                :
              </span> {cleanedText}
              {imageUrls.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  {imageUrls.map(url => (
                    <img key={url} src={url} alt="chat-img" className="max-h-32 max-w-full rounded border" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="w-full border rounded p-2"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={!userPubkey}
        />
        <button type="submit" className="px-3 py-2 rounded bg-black text-white font-bold" disabled={!userPubkey || !input.trim()}>Send</button>
      </form>
      {!userPubkey && <div className="text-xs text-center text-gray-400 mt-2">Sign in to chat</div>}
    </div>
  );
};

export default ChatPanel; 