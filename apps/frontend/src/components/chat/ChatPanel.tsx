import React, { useEffect, useRef, useState } from 'react';
import { ndk } from '../shared/nostrProfile';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import fetchNostrProfile from '../shared/nostrProfile';
import { finalizeEvent } from 'nostr-tools';
import type { ChatMessage as ChatMessageType, ProfileMap } from '../shared/chatConfig';
import {
  GLOBAL_ROOM_EVENT_ID,
  GLOBAL_ROOM_RELAYS,
  hexToUint8Array,
} from '../shared/chatConfig';
import ChatMessage from './ChatMessage';
import useNostrProfiles from '../shared/useNostrProfiles';

interface ChatPanelProps {
  onClose: () => void;
  userPubkey: string | null;
  userPrivkey: string | null;
  authMethod: 'extension' | 'key' | null;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onClose, userPubkey, userPrivkey, authMethod }) => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const profiles = useNostrProfiles(messages.map(m => m.pubkey));

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
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
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
          ...GLOBAL_ROOM_RELAYS.map(relay => ['r', relay]),
        ],
        pubkey: userPubkey,
        created_at: Math.floor(Date.now() / 1000),
      };
      let signedEvent;
      if (authMethod === 'extension' && window.nostr && window.nostr.signEvent) {
        signedEvent = await window.nostr.signEvent(unsignedEvent);
      } else if (authMethod === 'key' && userPrivkey) {
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
        {messages.map((msg) => (
          <ChatMessage key={msg.id} msg={msg} profile={profiles[msg.pubkey]} />
        ))}
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